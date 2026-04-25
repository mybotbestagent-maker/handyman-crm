const path = require('path');

const basePath = process.env.BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  env: {
    // Expose basePath to client bundle so tRPC / fetch can prepend it
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
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
