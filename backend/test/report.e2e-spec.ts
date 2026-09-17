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

    const restaurant = await prisma.restaurant.findFirst({
      where: { deletedAt: null, status: { publicationStatus: 'published' } },
    });
    if (!restaurant)
      throw new Error(
        'No published restaurant in the dev DB — run prisma/seed-restaurants.ts first.',
      );
    seededRestaurantId = restaurant.id;
  });

  afterAll(async () => {
    // ReportService.create() now routes reports into the moderation queue
    // (ModerationResult rows) — this spec runs against the real shared dev
    // DB (not an ephemeral test DB) and reuses one real seeded restaurant
    // across every test case, so clean up whatever got created against it
    // rather than leaving stray pending queue entries behind permanently.
    await prisma.moderationResult.deleteMany({
      where: { targetType: 'restaurant', targetId: seededRestaurantId },
    });
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

  async function registerModerator(
    label: string,
  ): Promise<{ token: string; userId: string }> {
    const { userId, token: _unused } = await registerUser(label);
    const roleRow = await prisma.role.findUniqueOrThrow({
      where: { code: 'moderator' },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { roleId: roleRow.id },
    });
    const email = (
      await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    ).email;
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return { token: authBody(login).accessToken, userId };
  }

  it('rejects unauthenticated report creation', async () => {
    await request(app.getHttpServer())
      .post('/reports')
      .send({
        targetType: 'restaurant',
        targetId: seededRestaurantId,
        reason: 'spam',
      })
      .expect(401);
  });

  it('creates a report, blocks a duplicate from the same user on the same target, allows a different user to report the same target', async () => {
    const { token: userA } = await registerUser('report-a');
    const { token: userB } = await registerUser('report-b');

    const res = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${userA}`)
      .send({
        targetType: 'restaurant',
        targetId: seededRestaurantId,
        reason: 'incorrect_info',
        description: 'Địa chỉ sai',
      })
      .expect(201);
    const report = res.body as ReportDto;
    expect(report.status).toBe('open');

    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${userA}`)
      .send({
        targetType: 'restaurant',
        targetId: seededRestaurantId,
        reason: 'spam',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${userB}`)
      .send({
        targetType: 'restaurant',
        targetId: seededRestaurantId,
        reason: 'closed_down',
      })
      .expect(201);
  });

  it('rejects an invalid reason', async () => {
    const { token } = await registerUser('report-badreason');
    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetType: 'restaurant',
        targetId: seededRestaurantId,
        reason: 'not_a_real_reason',
      })
      .expect(400);
  });

  it('lets a moderator resolve a report, writing resolvedBy/resolvedAt', async () => {
    const { token: reporterToken } = await registerUser(
      'report-resolve-reporter',
    );
    const { token: moderatorToken } =
      await registerModerator('report-resolve-mod');

    const createRes = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({
        targetType: 'restaurant',
        targetId: seededRestaurantId,
        reason: 'duplicate',
      })
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

  it('routes a report into the moderation queue (creates a pending ModerationResult), and a second report reuses it instead of duplicating', async () => {
    const { token: reporterA } = await registerUser('report-queue-a');
    const { token: reporterB } = await registerUser('report-queue-b');
    const { token: moderatorToken } =
      await registerModerator('report-queue-mod');

    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${reporterA}`)
      .send({
        targetType: 'restaurant',
        targetId: seededRestaurantId,
        reason: 'inappropriate',
      })
      .expect(201);

    const queueRes = await request(app.getHttpServer())
      .get('/admin/moderation-queue')
      .query({ targetType: 'restaurant', decision: 'pending' })
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(200);
    const queueItems = (
      queueRes.body as {
        items: { targetId: string; relatedReports: unknown[] }[];
      }
    ).items;
    const queueItem = queueItems.find(
      (item) => item.targetId === seededRestaurantId,
    );
    expect(queueItem).toBeDefined();
    expect(queueItem!.relatedReports.length).toBeGreaterThanOrEqual(1);

    // A second report against the same still-pending target must not create
    // a duplicate ModerationResult — it should surface via the existing
    // entry's relatedReports instead.
    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${reporterB}`)
      .send({
        targetType: 'restaurant',
        targetId: seededRestaurantId,
        reason: 'spam',
      })
      .expect(201);
    const resultCount = await prisma.moderationResult.count({
      where: {
        targetType: 'restaurant',
        targetId: seededRestaurantId,
        decision: 'pending',
      },
    });
    expect(resultCount).toBe(1);
  });

  it('blocks a plain user from resolving a report', async () => {
    const { token: reporterToken } = await registerUser(
      'report-blocked-reporter',
    );
    const createRes = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({
        targetType: 'restaurant',
        targetId: seededRestaurantId,
        reason: 'other',
        description: 'x',
      })
      .expect(201);
    const reportId = (createRes.body as ReportDto).id;

    await request(app.getHttpServer())
      .patch(`/admin/reports/${reportId}/resolve`)
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ status: 'dismissed' })
      .expect(403);
  });
});
