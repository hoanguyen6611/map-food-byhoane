import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Runs middleware.ts in the Node.js runtime (paired with `runtime: 'nodejs'`
  // in middleware.ts's config) instead of the sandboxed Edge runtime — see
  // that file's comment for why.
  experimental: {
    // @ts-expect-error -- runtime-supported in 15.5.22 (see the startup log's
    // "Experiments (use with caution): ✓ nodeMiddleware"), but this version's
    // bundled `ExperimentalConfig` type declarations haven't caught up yet.
    nodeMiddleware: true,
  },
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

export default withNextIntl(nextConfig);
