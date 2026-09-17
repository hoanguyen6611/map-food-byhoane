import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AdminDashboardStatsDto,
  AuthResponse,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Covers docs/04-screen-list.md §29 (Admin Dashboard) — the endpoint's guard
// behavior and response shape. Actual KPI/activity *numbers* aren't asserted
// against seeded fixtures here (no such fixture convention exists yet in
// this module), only that the shape is well-formed and non-negative.
describe('Admin Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const authBody = (res: request.Response) => res.body as AuthResponse;

  async function registerAs(
    role: 'admin' | 'moderator' | 'user',
  ): Promise<{ token: string }> {
    const email = uniqueEmail(role);
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const userId = authBody(reg).user.id;

    if (role !== 'user') {
      const roleRow = await prisma.role.findUniqueOrThrow({
        where: { code: role },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { roleId: roleRow.id },
      });
    }

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return { token: authBody(login).accessToken };
  }

  it('rejects a plain user from /admin/dashboard', async () => {
    const plain = await registerAs('user');
    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${plain.token}`)
      .expect(403);
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/admin/dashboard').expect(401);
  });

  it('lets both admin and moderator fetch well-formed stats', async () => {
    const admin = await registerAs('admin');
    const moderator = await registerAs('moderator');

    for (const actor of [admin, moderator]) {
      const res = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${actor.token}`)
        .expect(200);
      const body = res.body as AdminDashboardStatsDto;

      expect(body.kpis.pendingRestaurants).toBeGreaterThanOrEqual(0);
      expect(body.kpis.pendingReviews).toBeGreaterThanOrEqual(0);
      expect(body.kpis.newReports).toBeGreaterThanOrEqual(0);
      expect(body.kpis.activeUsers).toBeGreaterThanOrEqual(1); // at least `actor` itself is active

      expect(body.activity).toHaveLength(30);
      expect(body.activity[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Oldest -> newest, one entry per calendar day, no gaps/dupes.
      const dates = body.activity.map((point) => point.date);
      expect(new Set(dates).size).toBe(30);
      expect(dates).toEqual([...dates].sort());

      expect(body.ratingDistribution).toHaveLength(5);
      expect(body.ratingDistribution.map((bucket) => bucket.rating)).toEqual([
        1, 2, 3, 4, 5,
      ]);
      for (const bucket of body.ratingDistribution) {
        expect(bucket.count).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
