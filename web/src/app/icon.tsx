import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// Generated icon (Next.js App Router's `icon.tsx` file convention) rather
// than a binary asset — avoids needing an image-editing tool in this
// environment for a placeholder brand mark; swap for a real designed
// favicon before any actual deployment.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: '#e4572e',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        🍜
      </div>
    ),
    size,
  );
}
