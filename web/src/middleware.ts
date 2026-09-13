import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next.js internals, and anything with a file extension
  // (images, favicon, etc.) — everything else goes through locale detection.
  // `apple-icon` is also excluded explicitly: it's an App Router metadata
  // route served at a bare, extension-less path (`/apple-icon`, not
  // `/apple-icon.png`), so the "has a dot" rule above doesn't catch it —
  // without this it was getting locale-rewritten to `/vi/apple-icon` (no
  // such route exists there) and 404ing, even though the icon itself built
  // and rendered correctly.
  matcher: ['/((?!api|_next|_vercel|apple-icon|.*\\..*).*)'],
  // Runs middleware in the Node.js runtime instead of the sandboxed Edge
  // runtime — next-intl's locale negotiation (Intl.Locale/negotiator
  // internals) triggers the Edge runtime's V8 isolate's "code generation
  // from strings disallowed" restriction on some Node builds; the Node.js
  // runtime has no such restriction. Requires `experimental.nodeMiddleware`
  // in next.config.ts (stable target for self-hosted `next start`; Vercel's
  // actual Edge Network doesn't hit this at all).
  runtime: 'nodejs',
};
