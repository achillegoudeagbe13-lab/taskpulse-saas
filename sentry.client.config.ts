// Sentry — surveillance des erreurs côté navigateur.
// Inerte tant que NEXT_PUBLIC_SENTRY_DSN n'est pas défini (aucun impact sinon).
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
