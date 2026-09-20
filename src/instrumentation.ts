// Chargement de Sentry côté serveur (app router) — requis par @sentry/nextjs.
// Sentry est configuré pour être actif uniquement dès qu'un DSN est défini dans l'environnement
// (NEXT_PUBLIC_SENTRY_DSN côté client, SENTRY_DSN côté serveur). Tant que le DSN n'est pas défini,
// ces imports sont neutres (pas d'erreur, pas de rapport envoyé).
// NB : les fichiers de config Sentry vivent à la RACINE du projet
// (sentry.{client,server,edge}.config.ts) — convention @sentry/nextjs.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
