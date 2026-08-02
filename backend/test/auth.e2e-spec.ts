import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  ApiErrorResponse,
  AuthResponse,
  MeResponse,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';

// Covers docs/02-user-stories.md Epic A (US-A1–A5) acceptance criteria, per
// the Definition of Done in docs/build-prompts/02-auth.md.
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

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
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  // supertest's `.body` is `any` by default; casting through this helper
  // keeps every call site typed against the real shared-types contract
  // instead of scattering `as` casts (and tripping @typescript-eslint's
  // no-unsafe-member-access rule) throughout the test bodies below.
  const authBody = (res: request.Response) => res.body as AuthResponse;
  const meBody = (res: request.Response) => res.body as MeResponse;
  const errorBody = (res: request.Response) => res.body as ApiErrorResponse;
  const messageBody = (res: request.Response) =>
    res.body as { message: string };

  describe('US-A1 register', () => {
    it('creates an account and returns a token pair', async () => {
      const email = uniqueEmail('register');
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123', displayName: 'Người Test' })
        .expect(201);

      const body = authBody(res);
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
      expect(body.user.email).toBe(email);
      expect(body.user.role).toBe('user');
    });

    it('rejects a duplicate email without revealing details', async () => {
      const email = uniqueEmail('dup');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(409);
      expect(errorBody(res).message).toContain('đã được sử dụng');
    });

    it('rejects a weak password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail('weak'), password: 'short' })
        .expect(400);
    });
  });

  describe('US-A2 login', () => {
    it('logs in with correct credentials', async () => {
      const email = uniqueEmail('login-ok');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);
      expect(authBody(res).accessToken).toEqual(expect.any(String));
    });

    it('returns a generic error for wrong password, without revealing account existence', async () => {
      const email = uniqueEmail('login-wrong');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      const wrongPass = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrongpassword1' })
        .expect(401);
      const noSuchUser = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: uniqueEmail('never-registered'),
          password: 'password123',
        })
        .expect(401);

      expect(errorBody(wrongPass).message).toBe(errorBody(noSuchUser).message);
    });

    it('blocks the 6th login attempt within the rate-limit window', async () => {
      const email = uniqueEmail('ratelimit');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email, password: `wrong${i}` })
          .expect(401);
      }

      const sixth = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-again' })
        .expect(429);
      expect(errorBody(sixth).message).toContain('Quá nhiều yêu cầu');
    }, 15000);
  });

  describe('GET /me', () => {
    it('rejects requests without a token', async () => {
      await request(app.getHttpServer()).get('/me').expect(401);
    });

    it('returns the current user and profile for a valid token', async () => {
      const email = uniqueEmail('me');
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123', displayName: 'Me Test' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${authBody(reg).accessToken}`)
        .expect(200);
      const body = meBody(res);
      expect(body.user.email).toBe(email);
      expect(body.profile.displayName).toBe('Me Test');
    });
  });

  describe('PATCH /me/profile', () => {
    it('updates profile fields and validates VN phone format', async () => {
      const email = uniqueEmail('profile');
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);
      const auth = `Bearer ${authBody(reg).accessToken}`;

      const updated = await request(app.getHttpServer())
        .patch('/me/profile')
        .set('Authorization', auth)
        .send({
          displayName: 'Đã đổi tên',
          phone: '0912345678',
          homeCity: 'Hà Nội',
        })
        .expect(200);
      expect(meBody(updated).profile.displayName).toBe('Đã đổi tên');

      await request(app.getHttpServer())
        .patch('/me/profile')
        .set('Authorization', auth)
        .send({ phone: 'not-a-phone' })
        .expect(400);
    });
  });

  describe('refresh token rotation', () => {
    it('rotates on refresh and rejects reuse of the old token', async () => {
      const email = uniqueEmail('refresh');
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);
      const oldRefresh = authBody(reg).refreshToken;

      const refreshed = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefresh })
        .expect(200);
      const newRefresh = authBody(refreshed).refreshToken;
      expect(newRefresh).not.toBe(oldRefresh);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefresh })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: newRefresh })
        .expect(200);
    });
  });

  describe('logout', () => {
    it('invalidates the refresh token', async () => {
      const email = uniqueEmail('logout');
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);
      const refreshToken = authBody(reg).refreshToken;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('US-A3 forgot/reset password', () => {
    it('responds identically whether or not the email exists', async () => {
      const email = uniqueEmail('forgot');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      const existing = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email })
        .expect(200);
      const nonExisting = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: uniqueEmail('never') })
        .expect(200);

      expect(messageBody(existing).message).toBe(
        messageBody(nonExisting).message,
      );
    });

    it('resets the password with a single-use token and rejects reuse', async () => {
      const email = uniqueEmail('reset');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      // No email infra in MVP (per build-prompts/02-auth.md) — the service
      // only ever logs the reset link, mirroring exactly what a developer
      // would read from server logs locally. We capture that log line here
      // to extract the real plaintext token (only its hash is ever
      // persisted), so this test exercises the actual single-use invariant
      // end-to-end rather than just asserting on an invalid-token shape.
      const logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email })
        .expect(200);
      const logged = logSpy.mock.calls
        .map((call) => String(call[0]))
        .find((line) => line.includes('token='));
      logSpy.mockRestore();

      const token = logged?.match(/token=([a-f0-9]+)/)?.[1];
      expect(token).toBeTruthy();

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'newpassword123' })
        .expect(200);

      // Reusing the same (now-consumed) token must fail.
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'yetanotherpass456' })
        .expect(401);

      // New password works; old one no longer does.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'newpassword123' })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(401);
    });
  });

  describe('DELETE /me', () => {
    it('anonymizes the account instead of hard-deleting, and revokes access', async () => {
      const email = uniqueEmail('delete');
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);
      const accessToken = authBody(reg).accessToken;

      await request(app.getHttpServer())
        .delete('/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // The same access token must stop working immediately (status changed
      // to 'deleted'), not just at next natural expiry.
      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });
});
