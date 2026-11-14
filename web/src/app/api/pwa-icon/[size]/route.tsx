import { ImageResponse } from 'next/og';

// PWA / notification icons (manifest + service worker). Same folded-map
// mark and brand blue as apple-icon.tsx; full-bleed so it also works as a
// `maskable` icon (the glyph sits inside the 80% safe zone).
const SIZES = new Set([96, 192, 512]);

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = Number(raw);
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 });
  const glyph = Math.round(size * 0.56);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#003cff' }}>
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
          <path d="M9 3.5 4 6v14l5-2.5 6 3 5-2.5V4l-5 2.5z" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 3.5v14M15 6.5v14" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=86400, immutable' } },
  );
}
