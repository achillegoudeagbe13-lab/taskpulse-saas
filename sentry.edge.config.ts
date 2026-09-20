// Sentry — surveillance des erreurs en edge runtime / middleware.
// Inerte tant que SENTRY_DSN ou NEXT_PUBLIC_SENTRY_DSN n'est pas défini.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
