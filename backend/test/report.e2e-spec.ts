import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthResponse, ReportDto } from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Report (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let seededRestaurantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    const restaurant = await prisma.restaurant.findFirst({ where: { deletedAt: null, status: { publicationStatus: 'published' } } });
    if (!restaurant) throw new Error('No published restaurant in the dev DB — run prisma/seed-restaurants.ts first.');
    seededRestaurantId = restaurant.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (label: string) => `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const authBody = (res: request.Response) => res.body as AuthResponse;

  async function registerUser(label: string): Promise<{ token: string; userId: string }> {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123' }).expect(201);
    const body = authBody(res);
    return { token: body.accessToken, userId: body.user.id };
  }

  async function registerModerator(label: string): Promise<{ token: string; userId: string }> {
    const { userId, token: _unused } = await registerUser(label);
    const roleRow = await prisma.role.findUniqueOrThrow({ where: { code: 'moderator' } });
    await prisma.user.update({ where: { id: userId }, data: { roleId: roleRow.id } });
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).email;
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'password123' }).expect(200);
    return { token: authBody(login).accessToken, userId };
  }

  it('rejects unauthenticated report creation', async () => {
    await request(app.getHttpServer())
      .post('/reports')
      .send({ targetType: 'restaurant', targetId: seededRestaurantId, reason: 'spam' })
      .expect(401);
  });

  it('creates a report, blocks a duplicate from the same user on the same target, allows a different user to report the same target', async () => {
    const { token: userA } = await registerUser('report-a');
    const { token: userB } = await registerUser('report-b');

    const res = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${userA}`)
      .send({ targetType: 'restaurant', targetId: seededRestaurantId, reason: 'incorrect_info', description: 'Địa chỉ sai' })
      .expect(201);
    const report = res.body as ReportDto;
    expect(report.status).toBe('open');

    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${userA}`)
      .send({ targetType: 'restaurant', targetId: seededRestaurantId, reason: 'spam' })
      .expect(409);

    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${userB}`)
      .send({ targetType: 'restaurant', targetId: seededRestaurantId, reason: 'closed_down' })
      .expect(201);
  });

  it('rejects an invalid reason', async () => {
    const { token } = await registerUser('report-badreason');
    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'restaurant', targetId: seededRestaurantId, reason: 'not_a_real_reason' })
      .expect(400);
  });

  it('lets a moderator resolve a report, writing resolvedBy/resolvedAt', async () => {
    const { token: reporterToken } = await registerUser('report-resolve-reporter');
    const { token: moderatorToken } = await registerModerator('report-resolve-mod');

    const createRes = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ targetType: 'restaurant', targetId: seededRestaurantId, reason: 'duplicate' })
      .expect(201);
    const reportId = (createRes.body as ReportDto).id;

    const resolveRes = await request(app.getHttpServer())
      .patch(`/admin/reports/${reportId}/resolve`)
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ status: 'resolved' })
      .expect(200);
    const resolved = resolveRes.body as ReportDto;
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedBy).not.toBeNull();
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it('blocks a plain user from resolving a report', async () => {
    const { token: reporterToken } = await registerUser('report-blocked-reporter');
    const createRes = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ targetType: 'restaurant', targetId: seededRestaurantId, reason: 'other', description: 'x' })
      .expect(201);
    const reportId = (createRes.body as ReportDto).id;

    await request(app.getHttpServer())
      .patch(`/admin/reports/${reportId}/resolve`)
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ status: 'dismissed' })
      .expect(403);
  });
});
