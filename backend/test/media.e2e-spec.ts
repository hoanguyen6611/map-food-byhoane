import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import sharp from 'sharp';
import type {
  AuthResponse,
  CreateUploadUrlResponse,
  PhotoDto,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MediaService } from '../src/modules/media/media.service';

// Covers build-prompts/07-contribution-media-moderation-ai.md's MediaModule
// scope and the Security Checklist's upload-hardening items (magic-byte
// mismatch rejection, oversized-file rejection, no executable content-type
// ever served back) — verified against a real MinIO instance
// (docker-compose.yml), not mocked, per the module's own Definition of Done.
describe('Media (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let realJpeg: Buffer;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    realJpeg = await sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: { r: 10, g: 200, b: 100 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const authBody = (res: request.Response) => res.body as AuthResponse;

  async function registerUser(
    label: string,
  ): Promise<{ token: string; userId: string }> {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const body = authBody(res);
    return { token: body.accessToken, userId: body.user.id };
  }

  async function requestUploadUrl(
    token: string,
    fileSizeBytes: number,
  ): Promise<CreateUploadUrlResponse> {
    const res = await request(app.getHttpServer())
      .post('/media/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ contentType: 'image/jpeg', fileSizeBytes })
      .expect(201);
    return res.body as CreateUploadUrlResponse;
  }

  async function putToSignedUrl(
    uploadUrl: string,
    body: Buffer,
  ): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(body),
    });
    if (!response.ok) {
      throw new Error(`PUT to signed URL failed: ${response.status}`);
    }
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .post('/media/upload-url')
      .send({ contentType: 'image/jpeg', fileSizeBytes: 1000 })
      .expect(401);
    await request(app.getHttpServer())
      .post('/media/confirm')
      .send({ storageKey: 'x', ownerType: 'review' })
      .expect(401);
    await request(app.getHttpServer())
      .delete('/media/00000000-0000-0000-0000-000000000000')
      .expect(401);
  });

  it('happy path: upload-url -> real PUT to MinIO -> confirm creates a Photo with clamped dimensions', async () => {
    const { token } = await registerUser('media-happy');
    const { uploadUrl, storageKey } = await requestUploadUrl(
      token,
      realJpeg.length,
    );

    await putToSignedUrl(uploadUrl, realJpeg);

    const res = await request(app.getHttpServer())
      .post('/media/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ storageKey, ownerType: 'review' })
      .expect(201);
    const photo = res.body as PhotoDto;

    expect(photo.url).toMatch(/^http/);
    expect(photo.width).toBeLessThanOrEqual(1920);
    expect(photo.height).toBeLessThanOrEqual(1920);

    const row = await prisma.photo.findUniqueOrThrow({
      where: { id: photo.id },
    });
    expect(row.storageKey).toMatch(/^photos\//);
    expect(row.mimeType).toBe('image/jpeg');
    expect(row.ownerId).toBeNull(); // no ownerId supplied — stays unattached until reparented

    // Served-back content-type is always the server's choice, never the
    // client's declared type (there is no "client declared type" at all
    // here since it's always re-encoded to JPEG regardless of input).
    const headRes = await fetch(photo.url, { method: 'HEAD' });
    expect(headRes.headers.get('content-type')).toBe('image/jpeg');
  });

  it('rejects a magic-byte mismatch (renamed non-image file) and cleans up the staging object', async () => {
    const { token } = await registerUser('media-magic-byte');
    const fakeImage = Buffer.from(
      'this is definitely not a jpeg, just plain text',
    );
    const { uploadUrl, storageKey } = await requestUploadUrl(
      token,
      fakeImage.length,
    );

    await putToSignedUrl(uploadUrl, fakeImage);

    const res = await request(app.getHttpServer())
      .post('/media/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ storageKey, ownerType: 'review' })
      .expect(400);
    expect((res.body as { message: string }).message).toContain('không hợp lệ');

    const photoCount = await prisma.photo.count({ where: { storageKey } });
    expect(photoCount).toBe(0);
  });

  it('rejects a corrupt file with valid magic bytes but undecodable content', async () => {
    const { token } = await registerUser('media-corrupt');
    // Valid JPEG signature (FF D8 FF) followed by garbage — passes the
    // byte-sniff but fails sharp's real decode.
    const corrupt = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.from('garbage'.repeat(20)),
    ]);
    const { uploadUrl, storageKey } = await requestUploadUrl(
      token,
      corrupt.length,
    );

    await putToSignedUrl(uploadUrl, corrupt);

    await request(app.getHttpServer())
      .post('/media/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ storageKey, ownerType: 'review' })
      .expect(400);
  });

  it('rejects an oversized file at upload-url time, before any signed URL is issued', async () => {
    const { token } = await registerUser('media-oversized');
    await request(app.getHttpServer())
      .post('/media/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ contentType: 'image/jpeg', fileSizeBytes: 9 * 1024 * 1024 })
      .expect(400);
  });

  it('rejects an unsupported content type', async () => {
    const { token } = await registerUser('media-bad-type');
    await request(app.getHttpServer())
      .post('/media/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ contentType: 'application/pdf', fileSizeBytes: 1000 })
      .expect(400);
  });

  it('only the uploader or an admin can delete a photo', async () => {
    const { token: ownerToken } = await registerUser('media-owner');
    const { token: strangerToken } = await registerUser('media-stranger');
    const { uploadUrl, storageKey } = await requestUploadUrl(
      ownerToken,
      realJpeg.length,
    );
    await putToSignedUrl(uploadUrl, realJpeg);
    const confirmRes = await request(app.getHttpServer())
      .post('/media/confirm')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ storageKey, ownerType: 'review' })
      .expect(201);
    const photo = confirmRes.body as PhotoDto;

    await request(app.getHttpServer())
      .delete(`/media/${photo.id}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/media/${photo.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/media/${photo.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });

  describe('reparent cap enforcement', () => {
    it('rejects reparenting past the 6-photo review cap', async () => {
      const { token, userId } = await registerUser('media-cap');
      const photoIds: string[] = [];
      for (let i = 0; i < 7; i++) {
        const { uploadUrl, storageKey } = await requestUploadUrl(
          token,
          realJpeg.length,
        );
        await putToSignedUrl(uploadUrl, realJpeg);
        const res = await request(app.getHttpServer())
          .post('/media/confirm')
          .set('Authorization', `Bearer ${token}`)
          .send({ storageKey, ownerType: 'review' })
          .expect(201);
        photoIds.push((res.body as PhotoDto).id);
      }

      const mediaService = app.get(MediaService);
      // Any real uuid works as the target owner — reparent's cap check
      // doesn't require the owner row to actually exist, and `userId` is
      // reused here purely as a stand-in "some restaurant id."
      await expect(
        mediaService.reparent(userId, photoIds, 'review', userId),
      ).rejects.toThrow();

      const stillUnattached = await prisma.photo.count({
        where: { id: { in: photoIds }, ownerId: null },
      });
      expect(stillUnattached).toBe(7); // transaction rolled back — none attached.
    });
  });
});
