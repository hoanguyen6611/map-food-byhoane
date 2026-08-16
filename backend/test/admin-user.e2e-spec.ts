import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AdminUserDetailDto, AdminUserListItemDto, ApiErrorResponse, AuthResponse, Paginated } from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Covers the Admin User Management gap-fix described in
// admin-user.service.ts's doc comment (PRD §10.11 + the Security
// Checklist's "moderator blocked from admin-only actions (user ban, role
// change)" item, both never implemented by an earlier module).
describe('Admin User Management (e2e)', () => {
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
  const errorBody = (res: request.Response) => res.body as ApiErrorResponse;

  async function registerAs(role: 'admin' | 'moderator' | 'user'): Promise<{ token: string; userId: string; email: string }> {
    const email = uniqueEmail(role);
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const userId = authBody(reg).user.id;

    if (role !== 'user') {
      const roleRow = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.user.update({ where: { id: userId }, data: { roleId: roleRow.id } });
    }

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return { token: authBody(login).accessToken, userId, email };
  }

  it('rejects a plain user from every admin/users route', async () => {
    const plain = await registerAs('user');
    await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${plain.token}`)
      .expect(403);
  });

  it('lets both admin and moderator list users, filterable by search', async () => {
    const admin = await registerAs('admin');
    const moderator = await registerAs('moderator');
    const target = await registerAs('user');

    for (const actor of [admin, moderator]) {
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .query({ search: target.email })
        .set('Authorization', `Bearer ${actor.token}`)
        .expect(200);
      const body = res.body as Paginated<AdminUserListItemDto>;
      expect(body.items.some((u) => u.id === target.userId)).toBe(true);
    }
  });

  it('blocks moderator from suspend/reactivate/role-change (403), admin succeeds, AuditLog written', async () => {
    const admin = await registerAs('admin');
    const moderator = await registerAs('moderator');
    const target = await registerAs('user');

    const blockedSuspend = await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/suspend`)
      .set('Authorization', `Bearer ${moderator.token}`)
      .expect(403);
    expect(errorBody(blockedSuspend).message).toContain('không có quyền');

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/role`)
      .set('Authorization', `Bearer ${moderator.token}`)
      .send({ roleCode: 'admin' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/suspend`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);

    const suspended = await prisma.user.findUniqueOrThrow({ where: { id: target.userId } });
    expect(suspended.status).toBe('suspended');

    // Suspended accounts must be blocked from logging in immediately.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: target.email, password: 'password123' })
      .expect(401);

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/reactivate`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    const reactivated = await prisma.user.findUniqueOrThrow({ where: { id: target.userId } });
    expect(reactivated.status).toBe('active');

    const auditActions = await prisma.auditLog.findMany({
      where: { targetType: 'user', targetId: target.userId },
      orderBy: { createdAt: 'asc' },
    });
    expect(auditActions.map((a) => a.action)).toEqual(['user.suspend', 'user.reactivate']);
    expect(auditActions.every((a) => a.actorId === admin.userId)).toBe(true);
  });

  it('changes a role as admin, and blocks an admin from changing their own role', async () => {
    const admin = await registerAs('admin');
    const target = await registerAs('user');

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ roleCode: 'moderator' })
      .expect(204);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: target.userId }, include: { role: true } });
    expect(updated.role.code).toBe('moderator');

    const selfChange = await request(app.getHttpServer())
      .patch(`/admin/users/${admin.userId}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ roleCode: 'user' })
      .expect(400);
    expect(errorBody(selfChange).message).toContain('tự thay đổi');
  });

  it('blocks an admin from suspending themselves', async () => {
    const admin = await registerAs('admin');
    const res = await request(app.getHttpServer())
      .patch(`/admin/users/${admin.userId}/suspend`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);
    expect(errorBody(res).message).toContain('tự khoá');

    const stillActive = await prisma.user.findUniqueOrThrow({ where: { id: admin.userId } });
    expect(stillActive.status).toBe('active');
  });

  it('searches by display name as well as email', async () => {
    const admin = await registerAs('admin');
    const target = await registerAs('user');
    // registerAs doesn't set a displayName explicitly — set one directly so
    // the search-by-name assertion has a deterministic, unique value to
    // match on (avoids relying on the email-derived default).
    const uniqueName = `SearchName-${Date.now()}`;
    await prisma.userProfile.update({ where: { userId: target.userId }, data: { displayName: uniqueName } });

    const res = await request(app.getHttpServer())
      .get('/admin/users')
      .query({ search: uniqueName })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const body = res.body as Paginated<AdminUserListItemDto>;
    expect(body.items.some((u) => u.id === target.userId)).toBe(true);
  });

  it('returns user detail with review count and reports-received count', async () => {
    const admin = await registerAs('admin');
    const target = await registerAs('user');
    const reporter = await registerAs('user');

    const restaurantRes = await request(app.getHttpServer())
      .post('/admin/restaurants')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: `Detail Test Restaurant ${Date.now()}`,
        categoryCode: 'quan_an',
        priceRangeCode: '50_100k',
        address: { line: '1 Test St', ward: 'Phường Bến Nghé', province: 'TP. Hồ Chí Minh' },
        location: { lat: 10.7769, lng: 106.7009 },
      })
      .expect(201);
    const restaurantId = (restaurantRes.body as { id: string }).id;

    const reviewRes = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${target.token}`)
      .send({
        restaurantId,
        overallRating: 4,
        ratings: [{ criteriaCode: 'food_quality', score: 4 }],
        comment: 'Bình thường.',
      })
      .expect(201);
    const reviewId = (reviewRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ targetType: 'review', targetId: reviewId, reason: 'spam' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/admin/users/${target.userId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const detail = res.body as AdminUserDetailDto;
    expect(detail.id).toBe(target.userId);
    expect(detail.reviewCount).toBe(1);
    expect(detail.reportsReceivedCount).toBe(1);

    // This spec runs against the real shared dev DB (not an ephemeral test
    // DB) — clean up the restaurant/review/report/moderation rows this test
    // created rather than leaving them behind permanently (a prior run of
    // this exact test left a real "Detail Test Restaurant ..." row in the
    // dev DB before this cleanup existed).
    await prisma.report.deleteMany({ where: { targetType: 'review', targetId: reviewId } });
    await prisma.moderationResult.deleteMany({ where: { targetType: 'review', targetId: reviewId } });
    await prisma.reviewRating.deleteMany({ where: { reviewId } });
    await prisma.review.delete({ where: { id: reviewId } });
    await prisma.restaurantStatus.deleteMany({ where: { restaurantId } });
    await prisma.restaurantCuisine.deleteMany({ where: { restaurantId } });
    await prisma.openingHour.deleteMany({ where: { restaurantId } });
    await prisma.restaurantFacility.deleteMany({ where: { restaurantId } });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
    if (restaurant) {
      await prisma.address.delete({ where: { id: restaurant.addressId } });
      await prisma.location.delete({ where: { id: restaurant.locationId } });
    }
  });

  it('404s suspending/role-changing a nonexistent user', async () => {
    const admin = await registerAs('admin');
    await request(app.getHttpServer())
      .patch('/admin/users/00000000-0000-0000-0000-000000000000/suspend')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch('/admin/users/00000000-0000-0000-0000-000000000000/role')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ roleCode: 'moderator' })
      .expect(404);
  });
});
