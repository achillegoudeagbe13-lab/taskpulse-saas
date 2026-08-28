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

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 250));
      return NextResponse.json({ reply: offlineAnswer(input.message), source: 'offline' });
    }

    const contents = [
      ...(input.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: input.message }] },
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
          }),
        },
      );
      const json: any = await res.json().catch(() => null);
      if (!res.ok) {
        return NextResponse.json({ reply: offlineAnswer(input.message), source: 'offline', warning: 'Service IA momentanément indisponible.' });
      }
      const reply: string | undefined = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n');
      return NextResponse.json({ reply: reply?.trim() || offlineAnswer(input.message), source: 'gemini' });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return NextResponse.json({ error: 'Question invalide.' }, { status: 400 });
  }
}