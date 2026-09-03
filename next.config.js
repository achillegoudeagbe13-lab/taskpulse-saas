const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vérification TypeScript réactivée : toutes les erreurs de type sont corrigées (tsc --noEmit => 0 erreur).
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
}

module.exports = nextConfig;