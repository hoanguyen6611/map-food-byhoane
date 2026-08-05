import sharp from 'sharp';
import { reencode, sniffImageMagicBytes } from './image-processing.util';

// Covers the Security Checklist's magic-byte validation item — the
// authoritative check must key off real file signature bytes, never a
// client-declared Content-Type or file extension.
describe('sniffImageMagicBytes', () => {
  it('identifies a real JPEG by its FF D8 FF signature', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffImageMagicBytes(jpeg)).toBe('image/jpeg');
  });

  it('identifies a real PNG by its 8-byte signature', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(sniffImageMagicBytes(png)).toBe('image/png');
  });

  it('identifies a real WEBP by its RIFF....WEBP signature', () => {
    const webp = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP', 'ascii'),
    ]);
    expect(sniffImageMagicBytes(webp)).toBe('image/webp');
  });

  it('rejects plain text pretending to be an image via a spoofed extension/content-type', () => {
    const fake = Buffer.from('this is definitely not an image');
    expect(sniffImageMagicBytes(fake)).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(sniffImageMagicBytes(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a buffer with valid-looking-but-wrong-length RIFF header (no WEBP marker)', () => {
    const notWebp = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0, 0, 0, 0]), Buffer.from('AVI ', 'ascii')]);
    expect(sniffImageMagicBytes(notWebp)).toBeNull();
  });
});

describe('reencode', () => {
  it('clamps a large image to the 1920px display cap and produces a smaller thumbnail', async () => {
    const original = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    const result = await reencode(original);

    expect(result.width).toBeLessThanOrEqual(1920);
    expect(result.height).toBeLessThanOrEqual(1920);
    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(400);
    expect(thumbMeta.height).toBeLessThanOrEqual(400);
  });

  it('never upscales a small image past its original size', async () => {
    const original = await sharp({
      create: { width: 100, height: 80, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .jpeg()
      .toBuffer();

    const result = await reencode(original);
    expect(result.width).toBeLessThanOrEqual(100);
    expect(result.height).toBeLessThanOrEqual(80);
  });

  it('throws on a buffer with valid magic bytes but undecodable content', async () => {
    const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('not actually a jpeg body')]);
    await expect(reencode(corrupt)).rejects.toThrow();
  });
});
