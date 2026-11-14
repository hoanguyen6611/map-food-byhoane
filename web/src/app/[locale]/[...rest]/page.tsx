import { notFound } from 'next/navigation';

// Unknown paths under a locale would otherwise fall through to Next's bare
// global 404 (no top bar, tab bar or footer). Matching them here and calling
// notFound() renders [locale]/not-found.tsx inside the normal layout —
// next-intl's recommended catch-all pattern. Real routes always win over
// this optional fallback.
export default function CatchAllPage() {
  notFound();
}
