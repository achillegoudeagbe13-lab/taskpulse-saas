/**
 * Intégration Jitsi Meet (API Iframe) — utilitaires partagés client/serveur.
 *
 * Ce module reste « sûr » côté serveur : il ne touche au DOM que dans
 * `loadJitsiApi()` (protégée par `typeof window`). Les noms de salles sont
 * générés côté serveur (route API) puis validés/normalisés ici pour être
 * réutilisables partout (composant, panneau, liens de partage).
 *
 * Domaine configurable via la variable d'environnement `NEXT_PUBLIC_JITSI_DOMAIN`
 * (défaut : `meet.jit.si`), ce qui permet un déploiement auto-hébergé.
 */

export const DEFAULT_JITSI_DOMAIN = 'meet.jit.si';

/** Domaine Jitsi effectif (variable NEXT_PUBLIC_… lisible aussi côté navigateur). */
export function jitsiDomain(): string {
  const raw = (process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? '').trim().toLowerCase();
  if (!raw) return DEFAULT_JITSI_DOMAIN;
  // On accepte « https://meet.exemple.fr » comme « meet.exemple.fr/ ».
  return raw.replace(/^https?:\/\//, '').replace(/\/+$/, '') || DEFAULT_JITSI_DOMAIN;
}

/** Normalise un fragment en minuscules URL-safe ([a-z0-9-]). */
export function sanitizeRoomSegment(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

/**
 * Un identifiant de salle Jitsi valide : segments [a-z0-9-] séparés par des
 * tirets (les points créent des sous-domaines dans Jitsi, on les refuse).
 */
export function isJitsiRoomName(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{2,79}$/.test(value);
}

/** URL publique d'une salle sur le domaine Jitsi. */
export function jitsiRoomUrl(roomName: string, domain: string = jitsiDomain()): string {
  return `https://${domain}/${encodeURIComponent(roomName)}`;
}

/**
 * Vrai si l'URL pointe vers une salle du domaine Jitsi attendu.
 * Sert à distinguer un lien visio natif d'un lien externe (Meet, Zoom, …).
 */
export function isJitsiUrl(url: string | null | undefined, domain: string = jitsiDomain()): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === domain.toLowerCase() && parsed.pathname !== '/';
  } catch {
    return false;
  }
}

/** Extrait l'identifiant de salle d'une URL Jitsi, ou null. */
export function roomNameFromUrl(url: string | null | undefined, domain: string = jitsiDomain()): string | null {
  if (!isJitsiUrl(url, domain)) return null;
  try {
    const candidate = decodeURIComponent(new URL(url as string).pathname.replace(/^\/+/, '').split('/')[0]);
    return isJitsiRoomName(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

const scriptPromises = new Map<string, Promise<void>>();

/**
 * Charge `external_api.js` une seule fois par domaine (singleton) et résout
 * lorsque `window.JitsiMeetExternalAPI` est disponible. Réutilise une balise
 * `<script>` déjà présente (navigation client / double montage React).
 */
export function loadJitsiApi(domain: string = jitsiDomain()): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('L’API Jitsi ne peut être chargée que dans le navigateur.'));
  }
  if (typeof window.JitsiMeetExternalAPI === 'function') return Promise.resolve();

  const cached = scriptPromises.get(domain);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const selector = `script[data-jitsi-domain="${domain}"]`;
    const existing = document.querySelector<HTMLScriptElement>(selector);

    const onLoad = () => {
      if (typeof window.JitsiMeetExternalAPI === 'function') resolve();
      else reject(new Error('Le script Jitsi Meet n’a pas exposé son API.'));
    };
    const onError = () => reject(new Error(`Impossible de charger l’API Jitsi depuis ${domain}.`));

    if (existing) {
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener('error', onError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.dataset.jitsiDomain = domain;
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  });

  // En cas d'échec on oublie la promesse : un nouvel essai relancera le chargement.
  const tracked = promise.catch((error) => {
    scriptPromises.delete(domain);
    throw error;
  });
  scriptPromises.set(domain, tracked);
  return tracked;
}