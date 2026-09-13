import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Chopstick Pin mark ("1c" in the "Food Map Logo Icon" design canvas) — a map
// pin outline with two crossed chopsticks. Apple's touch-icon spec requires
// a raster PNG (no SVG), and iOS applies its own corner mask on top, so this
// is a full-bleed square with no border-radius of its own — same solid
// white-on-brand-orange mark as app/icon.svg, just rendered via satori/OG
// instead of shipped as a static file.
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
          background: '#E4572E',
        }}
      >
        <svg width="132" height="132" viewBox="0 0 64 64" fill="none">
          <path
            d="M32 11.5c-9.7 0-17.6 7.7-17.6 17.3 0 5.8 3.7 11.6 7.6 16 3.2 3.6 6.6 6.3 8.3 7.6.9.7 2.2.7 3.1 0 1.8-1.3 5.1-4 8.3-7.6 3.9-4.4 7.6-10.2 7.6-16 0-9.6-7.9-17.3-17.6-17.3Zm-7.3 24.4 13.6-10.4a2.9 2.9 0 0 0-3.6-4.6L21.1 31.3a2.9 2.9 0 0 0 3.6 4.6Zm0-9.1 10.3-7.9a2.9 2.9 0 0 0-3.6-4.6l-10.3 7.9a2.9 2.9 0 0 0 3.6 4.6Z"
            fill="#FFFFFF"
            fillRule="evenodd"
          />
        </svg>
      </div>
    ),
    size,
  );
}
