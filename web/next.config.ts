import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `@foodmap/shared-types` ships raw TypeScript source (`main: src/index.ts`,
  // see the package's own package.json) — Next.js doesn't transpile
  // node_modules packages by default, only app source, so this is required
  // (Vite-based admin-web doesn't need the equivalent because Vite transpiles
  // any imported source regardless of location).
  transpilePackages: ['@foodmap/shared-types'],
  images: {
    // Seed data photos are served from picsum.photos (see
    // backend/prisma/seed-restaurants.ts's documented stopgap — no real
    // object storage/CDN exists until build-prompts/07's MediaModule).
    remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos' }],
  },
};

export default nextConfig;
