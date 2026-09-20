const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vérification TypeScript réactivée : toutes les erreurs de type sont corrigées (tsc --noEmit => 0 erreur).
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Requis par Next.js 14 pour charger src/instrumentation.ts (Sentry serveur/edge).
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
}

// Sentry : wrapper inerte sans DSN — la build reste identique tant que
// SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN ne sont pas configurés.
module.exports = withSentryConfig(nextConfig, {
  // Sans auth token (SENTRY_AUTH_TOKEN), pas d'upload de sourcemaps : build locale/CI ok.
  silent: true,
  disableLogger: true,
});