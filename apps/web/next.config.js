const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo: trace from the repo root so pnpm-symlinked workspace deps
  // are bundled correctly on Vercel serverless functions.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@handyman-crm/api', '@handyman-crm/db', '@handyman-crm/types'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  images: {
    domains: ['pub-*.r2.dev'], // Cloudflare R2
  },
};

module.exports = nextConfig;
