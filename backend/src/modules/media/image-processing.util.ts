import sharp from 'sharp';

export type SniffedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

const DISPLAY_MAX_EDGE = 1920;
const THUMBNAIL_MAX_EDGE = 400;
const JPEG_QUALITY_DISPLAY = 82;
const JPEG_QUALITY_THUMBNAIL = 75;

/**
 * The authoritative image-type check — client-declared Content-Type/file
 * extension is never trusted (Security Checklist item: magic-byte mismatch
 * must be rejected server-side regardless of what the client claimed).
 * Checks the actual file signature bytes, not metadata.
 */
export function sniffImageMagicBytes(buffer: Buffer): SniffedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export interface ReencodedImage {
  display: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
}

/**
 * Re-encodes a real, decodable image into two fixed JPEG copies (this is
 * the security boundary the magic-byte sniff above only gates entry to —
 * a file can have valid magic bytes and still fail to decode, which sharp
 * catches here). `.rotate()` auto-orients from EXIF then discards it;
 * `sharp` strips all other metadata by default since `.withMetadata()` is
 * never called — this is the EXIF-strip step. Throws if the buffer isn't a
 * real, decodable image; callers must treat that as "invalid image."
 */
export async function reencode(buffer: Buffer): Promise<ReencodedImage> {
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width === 0 || height === 0) {
    throw new Error('Không thể đọc kích thước ảnh — file có thể bị hỏng.');
  }

  const display = await sharp(buffer)
    .rotate()
    .resize({ width: DISPLAY_MAX_EDGE, height: DISPLAY_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY_DISPLAY })
    .toBuffer();

  const thumbnail = await sharp(buffer)
    .rotate()
    .resize({ width: THUMBNAIL_MAX_EDGE, height: THUMBNAIL_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY_THUMBNAIL })
    .toBuffer();

  const displayMetadata = await sharp(display).metadata();

  return {
    display,
    thumbnail,
    width: displayMetadata.width ?? width,
    height: displayMetadata.height ?? height,
  };
}
