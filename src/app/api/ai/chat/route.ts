import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgMember } from '../../../../lib/auth';

const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    text: z.string().max(4000),
  })).max(20).optional(),
});

const SYSTEM_PROMPT = `Tu es l'assistant intelligent de **Mar-ci Flow**, une plateforme SaaS de gestion du travail en équipe (multi-organisations).
Fonctionnalités principales : tableau de bord, tâches (créées par les admins, attribuées à un membre ou générales), pointage d'heures (avec contrôle GPS optionnel défini par l'admin : coordonnées + rayon de tolérance), calendrier unifié (deadlines de tâches, réunions, congés), journal de travail, annonces, messagerie interne privée (l'admin ne peut JAMAIS lire les messages privés), invitations, historique d'audit, gestion des utilisateurs (rôles Employé/Admin/Stagiaire, réinitialisation de mot de passe par l'admin).
Règles : réponds en français, de façon concise, claire et actionnable. Guide l'utilisateur étape par étape dans l'interface (ex. « Paramètres → Contrôle GPS du pointage »). Si une question sort du périmètre de l'application, réponds brièvement et recentre sur Mar-ci Flow.`;

/**
 * Récupère la clé API Gemini quel que soit le nom ou la casse utilisée chez l'hébergeur.
 * Render/Linux étant sensible à la casse, on accepte les variantes les plus courantes
 * (ex. `gemini_api_key` configuré en minuscules sur le dashboard Render).
 */
function getGeminiApiKey(): string | undefined {
  for (const name of ['GEMINI_API_KEY', 'gemini_api_key', 'GEMINI_KEY', 'GOOGLE_API_KEY', 'google_api_key']) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Modèles essayés dans l'ordre ; le premier qui répond correctement est mémorisé
 * (cache module) pour ne pas retester les modèles retirés de l'API à chaque requête.
 * GEMINI_MODEL permet de forcer un modèle précis. Les modèles 1.5 sont gardés en
 * secours : leur retrait progressif renvoie sinon un 404 silencieux converti en
 * mode hors-ligne.
 */
const GEMINI_MODELS: string[] = [
  process.env.GEMINI_MODEL?.trim() || null,
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter((m): m is string => Boolean(m));

let cachedModel: string | null = null;

interface GeminiCallResult {
  ok: boolean;
  status?: number;
  detail?: string;
  json?: any;
}

/** Appelle l'API Gemini en essayant les modèles disponibles (deadline globale de 25 s). */
async function callGemini(apiKey: string, body: unknown): Promise<GeminiCallResult> {
  const unique = Array.from(new Set([cachedModel, ...GEMINI_MODELS].filter((m): m is string => Boolean(m))));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    for (const model of unique) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(body),
          },
        );
        if (res.ok) {
          cachedModel = model;
          return { ok: true, json: await res.json().catch(() => null) };
        }
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        // 400/404 : modèle indisponible ou introuvable → on tente le modèle suivant.
        if (res.status === 400 || res.status === 404) {
          console.error(`[ai/chat] Modèle "${model}" indisponible (HTTP ${res.status}). Essai du modèle suivant…`);
          continue;
        }
        // 401/403 (clé refusée), 429 (quota) ou autre : un autre modèle ne résoudra rien.
        return { ok: false, status: res.status, detail };
      } catch (err) {
        // Timeout ou réseau : même destination pour tous les modèles, inutile d'insister.
        return { ok: false, detail: err instanceof Error ? err.message : String(err) };
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return { ok: false };
}

/** Réponses hors-ligne si GEMINI_API_KEY n'est pas configurée (dégradation propre). */
function offlineAnswer(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('pointage') || q.includes('gps') || q.includes('arrivée') || q.includes('heure')) {
    return "📍 **Pointage**\n1. Ouvrez l'onglet **Pointage** dans la barre latérale.\n2. Cliquez **Arrivée** ou **Départ**.\n3. Si votre admin a activé le contrôle GPS, autorisez la géolocalisation : vous devez être dans la zone du bureau (rayon défini par l'admin).\nSi le GPS est désactivé, le pointage reste libre et seule votre position est archivée pour audit.";
  }
  if (q.includes('calendrier') || q.includes('réunion') || q.includes('congé') || q.includes('absence')) {
    return "📅 **Calendrier**\n- Onglet **Calendrier** : 3 vues (Mois / Semaine / Jour) fusionnant tâches (bleu), réunions (violet) et congés (orange).\n- Filtrez par type ou par membre via l'icône filtre.\n- Pour poser un congé : bouton **+ Congé** ; votre manager est notifié.";
  }
  if (q.includes('mot de passe')) {
    return "🔑 **Mot de passe**\nSeul un administrateur peut réinitialiser un mot de passe : **Utilisateurs → icône clé 🔑 à côté du membre → saisir et confirmer**. Les sessions actives du compte sont alors déconnectées.";
  }
  if (q.includes('tâche') || q.includes('task')) {
    return "📋 **Tâches**\nSeuls les administrateurs créent des tâches (onglet **Tâches → Nouvelle tâche**) : elles peuvent être attribuées à un membre précis ou marquées **générales** pour toute l'équipe. Suivez statut et progression depuis la liste.";
  }
  if (q.includes('message') || q.includes('messagerie')) {
    return "💬 **Messagerie**\nVos conversations sont privées et isolées par organisation. L'administrateur ne peut pas lire leur contenu — c'est garanti côté serveur.";
  }
  return "👋 Je suis l'assistant **Mar-ci Flow**. Je peux vous guider sur : le pointage (GPS), le calendrier, les tâches, les congés, le journal de travail, la messagerie, les invitations ou la gestion des comptes.\n\n💡 *Pour des réponses génératives complètes, configurez la variable d'environnement GEMINI_API_KEY sur le serveur.*";
}

/** POST — assistant conversationnel (Gemini si configuré, sinon mode hors-ligne intégré). */
export async function POST(request: Request) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  try {
    const input = chatSchema.parse(await request.json());

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 250));
      return NextResponse.json({ reply: offlineAnswer(input.message), source: 'offline' });
    }

    const contents = [
      ...(input.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: input.message }] },
    ];

    const call = await callGemini(apiKey, {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
    });

    if (!call.ok) {
      // Log serveur (sans jamais exposer la clé) pour diagnostiquer depuis les logs Render.
      console.error('[ai/chat] Gemini indisponible', call.status ?? '(sans réponse HTTP)', call.detail ?? '');
      const warning =
        call.status === 401 || call.status === 403
          ? 'Clé API refusée par le service Gemini.'
          : call.status === 429
            ? 'Quota Gemini atteint, réessayez plus tard.'
            : 'Service IA momentanément indisponible.';
      return NextResponse.json({ reply: offlineAnswer(input.message), source: 'offline', warning });
    }

    const reply: string | undefined = call.json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n');
    const text = reply?.trim();
    if (!text) {
      console.error('[ai/chat] Réponse Gemini vide ou bloquée', JSON.stringify(call.json?.promptFeedback ?? {}).slice(0, 200));
      return NextResponse.json({ reply: offlineAnswer(input.message), source: 'offline', warning: "Le service IA n'a pas renvoyé de réponse." });
    }
    return NextResponse.json({ reply: text, source: 'gemini' });
  } catch {
    return NextResponse.json({ error: 'Question invalide.' }, { status: 400 });
  }
}