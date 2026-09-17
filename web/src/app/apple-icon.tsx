import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Folded-map mark — same MapLogoIcon glyph used in the navbar/login/footer
// logo tiles (web/src/components/icons.tsx). Apple's touch-icon spec requires
// a raster PNG (no SVG), and iOS applies its own corner mask on top, so this
// is a full-bleed square with no border-radius of its own, rendered via
// satori/OG instead of shipped as a static file (same approach as before,
// just swapped to the current brand mark/color instead of the retired
// chopstick-pin/orange one).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#003cff',
        }}
      >
        <svg width="108" height="108" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 3.5 4 6v14l5-2.5 6 3 5-2.5V4l-5 2.5z"
            stroke="#FFFFFF"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 3.5v14M15 6.5v14"
            stroke="#FFFFFF"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
