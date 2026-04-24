/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@handyman-crm/api', '@handyman-crm/db', '@handyman-crm/types'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  images: {
    domains: ['pub-*.r2.dev'], // Cloudflare R2
  },
};

module.exports = nextConfig;
