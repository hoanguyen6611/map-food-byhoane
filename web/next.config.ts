import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `@foodmap/shared-types` ships raw TypeScript source (`main: src/index.ts`,
  // see the package's own package.json) — Next.js doesn't transpile
  // node_modules packages by default, only app source, so this is required
  // (Vite-based admin-web doesn't need the equivalent because Vite transpiles
  // any imported source regardless of location).
  transpilePackages: ['@foodmap/shared-types'],
  images: {
    remotePatterns: [
      // Seed data photos are served from picsum.photos (see
      // backend/prisma/seed-restaurants.ts's documented stopgap).
      { protocol: 'https', hostname: 'picsum.photos' },
      // Real community-uploaded photos (build-prompts/07's MediaModule,
      // now live) are served from MinIO in local dev — S3Service.publicUrl()
      // resolves them to `${S3_PUBLIC_BASE_URL}/...`, which is
      // `http://localhost:9000/foodmap-media` per backend/env.example.
      // Without this, next/image throws "hostname not configured" and
      // crashes any page rendering a real-pipeline photo (detail/search/
      // district listings alike) — this isn't optional/future, Module 7
      // ships real photos today. Deploying to production needs the real
      // S3/CDN hostname added here too.
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/foodmap-media/**' },
    ],
  },
};

export default nextConfig;
