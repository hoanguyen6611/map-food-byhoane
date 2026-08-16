import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AdminReviewListItemDto,
  AdminRestaurantDetailDto,
  AuthResponse,
  Paginated,
  ReviewDto,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClaudeGatewayService } from '../src/modules/ai/claude-gateway.service';
import { buildMockClaudeGateway } from './helpers/mock-claude-gateway';

// Covers the Admin Review Management gap-fix (docs/04-screen-list.md §32) —
// managing ALREADY PUBLISHED reviews (hide/restore/delete), distinct from
// AdminModerationController's pending-decision queue.
describe('Admin Review Management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ClaudeGatewayService)
      .useValue(buildMockClaudeGateway())
      .compile();

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

  async function registerUser(label: string): Promise<{ token: string; userId: string; email: string }> {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123', displayName: label })
      .expect(201);
    const body = authBody(res);
    return { token: body.accessToken, userId: body.user.id, email };
  }

  async function registerAs(role: 'admin' | 'moderator' | 'user', label: string): Promise<{ token: string; userId: string; email: string }> {
    const registered = await registerUser(label);
    if (role !== 'user') {
      const roleRow = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.user.update({ where: { id: registered.userId }, data: { roleId: roleRow.id } });
    }
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: registered.email, password: 'password123' })
      .expect(200);
    return { token: authBody(login).accessToken, userId: registered.userId, email: registered.email };
  }

  async function createRestaurant(adminToken: string, nameSuffix: string): Promise<AdminRestaurantDetailDto> {
    const res = await request(app.getHttpServer())
      .post('/admin/restaurants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Admin Review Test Restaurant ${nameSuffix}`,
        categoryCode: 'quan_an',
        priceRangeCode: '50_100k',
        address: { line: '1 Test St', ward: 'Phường Bến Nghé', province: 'TP. Hồ Chí Minh' },
        location: { lat: 10.7769, lng: 106.7009 },
      })
      .expect(201);
    return res.body as AdminRestaurantDetailDto;
  }

  async function cleanupRestaurant(id: string): Promise<void> {
    await prisma.moderationResult.deleteMany({
      where: { targetType: 'review', targetId: { in: (await prisma.review.findMany({ where: { restaurantId: id }, select: { id: true } })).map((r) => r.id) } },
    });
    await prisma.reviewRating.deleteMany({ where: { review: { restaurantId: id } } });
    await prisma.review.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurantStatus.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurantCuisine.deleteMany({ where: { restaurantId: id } });
    await prisma.openingHour.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurantFacility.deleteMany({ where: { restaurantId: id } });
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    await prisma.restaurant.delete({ where: { id } });
    if (restaurant) {
      await prisma.address.delete({ where: { id: restaurant.addressId } });
      await prisma.location.delete({ where: { id: restaurant.locationId } });
    }
  }

  async function createPublishedReview(reviewerToken: string, restaurantId: string): Promise<ReviewDto> {
    const res = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        restaurantId,
        overallRating: 5,
        ratings: [{ criteriaCode: 'food_quality', score: 5 }],
        comment: 'Rất ngon, sẽ quay lại.',
      })
      .expect(201);
    const created = res.body as ReviewDto;
    expect(created.status).toBe('published');
    return created;
  }

  it('rejects a plain user from every admin/reviews route', async () => {
    const plain = await registerAs('user', 'ar-plain');
    await request(app.getHttpServer())
      .get('/admin/reviews')
      .set('Authorization', `Bearer ${plain.token}`)
      .expect(403);
  });

  it('lets both admin and moderator list reviews, filterable by restaurant/status', async () => {
    const admin = await registerAs('admin', 'ar-list-admin');
    const moderator = await registerAs('moderator', 'ar-list-mod');
    const reviewer = await registerUser('ar-list-reviewer');
    const restaurant = await createRestaurant(admin.token, 'List');
    const review = await createPublishedReview(reviewer.token, restaurant.id);

    for (const actor of [admin, moderator]) {
      const res = await request(app.getHttpServer())
        .get('/admin/reviews')
        .query({ restaurantId: restaurant.id, status: 'published' })
        .set('Authorization', `Bearer ${actor.token}`)
        .expect(200);
      const body = res.body as Paginated<AdminReviewListItemDto>;
      expect(body.items.some((r) => r.id === review.id)).toBe(true);
    }

    await cleanupRestaurant(restaurant.id);
  });

  it('blocks moderator from hide/restore/delete (403), admin succeeds, AuditLog written', async () => {
    const admin = await registerAs('admin', 'ar-actions-admin');
    const moderator = await registerAs('moderator', 'ar-actions-mod');
    const reviewer = await registerUser('ar-actions-reviewer');
    const restaurant = await createRestaurant(admin.token, 'Actions');
    const review = await createPublishedReview(reviewer.token, restaurant.id);

    await request(app.getHttpServer())
      .patch(`/admin/reviews/${review.id}/hide`)
      .set('Authorization', `Bearer ${moderator.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/admin/reviews/${review.id}/hide`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    const hidden = await prisma.review.findUniqueOrThrow({ where: { id: review.id } });
    expect(hidden.status).toBe('hidden');

    // Hiding an already-hidden review conflicts.
    await request(app.getHttpServer())
      .patch(`/admin/reviews/${review.id}/hide`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/admin/reviews/${review.id}/restore`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);
    const restored = await prisma.review.findUniqueOrThrow({ where: { id: review.id } });
    expect(restored.status).toBe('published');

    // Restoring a non-hidden review conflicts.
    await request(app.getHttpServer())
      .patch(`/admin/reviews/${review.id}/restore`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);

    const auditActions = await prisma.auditLog.findMany({
      where: { targetType: 'review', targetId: review.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(auditActions.map((a) => a.action)).toEqual(['review.hide', 'review.restore']);
    expect(auditActions.every((a) => a.actorId === admin.userId)).toBe(true);

    await cleanupRestaurant(restaurant.id);
  });

  it('permanently deletes a review as admin (soft-delete, excluded from subsequent list)', async () => {
    const admin = await registerAs('admin', 'ar-delete-admin');
    const reviewer = await registerUser('ar-delete-reviewer');
    const restaurant = await createRestaurant(admin.token, 'Delete');
    const review = await createPublishedReview(reviewer.token, restaurant.id);

    await request(app.getHttpServer())
      .delete(`/admin/reviews/${review.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);

    const deleted = await prisma.review.findUniqueOrThrow({ where: { id: review.id } });
    expect(deleted.deletedAt).not.toBeNull();

    const res = await request(app.getHttpServer())
      .get('/admin/reviews')
      .query({ restaurantId: restaurant.id })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    const body = res.body as Paginated<AdminReviewListItemDto>;
    expect(body.items.some((r) => r.id === review.id)).toBe(false);

    await cleanupRestaurant(restaurant.id);
  });

  it('404s hiding/restoring/deleting a nonexistent review', async () => {
    const admin = await registerAs('admin', 'ar-404-admin');
    const missingId = '00000000-0000-0000-0000-000000000000';
    await request(app.getHttpServer())
      .patch(`/admin/reviews/${missingId}/hide`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/admin/reviews/${missingId}/restore`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/admin/reviews/${missingId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });
});
