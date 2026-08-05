import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AdminRestaurantDetailDto,
  ApiErrorResponse,
  AuthResponse,
  RestaurantDetailDto,
  RestaurantSummaryDto,
  ReviewDto,
  ReviewListResponse,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Covers docs/02-user-stories.md Epic E (US-E1, E2, E3, E5 — E4 "report a
// review" is Module 7's scope, not implemented here) and the Definition of
// Done in docs/build-prompts/06-reviews-scoring.md.
describe('Reviews & Composite Scoring (e2e)', () => {
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

  async function registerUser(label: string): Promise<{ token: string; userId: string; email: string }> {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123', displayName: label })
      .expect(201);
    const body = authBody(res);
    return { token: body.accessToken, userId: body.user.id, email };
  }

  async function registerAdmin(label: string): Promise<{ token: string; userId: string }> {
    const { userId, email } = await registerUser(label);
    const roleRow = await prisma.role.findUniqueOrThrow({ where: { code: 'admin' } });
    await prisma.user.update({ where: { id: userId }, data: { roleId: roleRow.id } });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return { token: authBody(login).accessToken, userId };
  }

  async function createRestaurant(adminToken: string, nameSuffix: string): Promise<AdminRestaurantDetailDto> {
    const res = await request(app.getHttpServer())
      .post('/admin/restaurants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Review Test Restaurant ${nameSuffix}`,
        categoryCode: 'quan_an',
        priceRangeCode: '50_100k',
        address: { line: '1 Test St', district: 'Quận 1', province: 'TP. Hồ Chí Minh' },
        location: { lat: 10.7769, lng: 106.7009 },
      })
      .expect(201);
    return res.body as AdminRestaurantDetailDto;
  }

  async function cleanupRestaurant(id: string): Promise<void> {
    await prisma.moderationResult.deleteMany({ where: { targetType: 'review', targetId: { in: (await prisma.review.findMany({ where: { restaurantId: id }, select: { id: true } })).map((r) => r.id) } } });
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

  async function pollForCompositeScore(restaurantId: string, timeoutMs = 5000): Promise<number | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await request(app.getHttpServer()).get(`/restaurants/${restaurantId}`).expect(200);
      const body = res.body as RestaurantDetailDto;
      if (body.compositeScore !== null) return body.compositeScore;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return null;
  }

  describe('US-E1 — submit a structured review', () => {
    it('creates a review, auto-approves clean content, and updates the composite score within 5s', async () => {
      const admin = await registerAdmin('e1-admin');
      const restaurant = await createRestaurant(admin.token, 'E1');
      const reviewer = await registerUser('e1-reviewer');

      const start = Date.now();
      const res = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          restaurantId: restaurant.id,
          overallRating: 5,
          ratings: [
            { criteriaCode: 'food_quality', score: 5 },
            { criteriaCode: 'service', score: 4 },
          ],
          comment: 'Đồ ăn ngon, phục vụ nhiệt tình.',
        })
        .expect(201);
      const created = res.body as ReviewDto;
      expect(created.status).toBe('published');
      expect(created.ratings).toHaveLength(2);

      const score = await pollForCompositeScore(restaurant.id);
      expect(Date.now() - start).toBeLessThan(5000);
      expect(score).not.toBeNull();

      await cleanupRestaurant(restaurant.id);
    }, 10000);

    it('rejects a review with no criteria ratings', async () => {
      const admin = await registerAdmin('e1-admin-empty');
      const restaurant = await createRestaurant(admin.token, 'E1-empty');
      const reviewer = await registerUser('e1-reviewer-empty');

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ restaurantId: restaurant.id, overallRating: 4, ratings: [] })
        .expect(400);

      await cleanupRestaurant(restaurant.id);
    });

    it('rejects an out-of-range rating and an unknown criteria code', async () => {
      const admin = await registerAdmin('e1-admin-range');
      const restaurant = await createRestaurant(admin.token, 'E1-range');
      const reviewer = await registerUser('e1-reviewer-range');

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ restaurantId: restaurant.id, overallRating: 6, ratings: [{ criteriaCode: 'food_quality', score: 5 }] })
        .expect(400);

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ restaurantId: restaurant.id, overallRating: 4, ratings: [{ criteriaCode: 'not_a_real_criteria', score: 5 }] })
        .expect(400);

      await cleanupRestaurant(restaurant.id);
    });

    it('holds a review with strong spam signals for review instead of auto-publishing', async () => {
      const admin = await registerAdmin('e1-admin-spam');
      const restaurant = await createRestaurant(admin.token, 'E1-spam');
      const reviewer = await registerUser('e1-reviewer-spam');

      const res = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          restaurantId: restaurant.id,
          overallRating: 5,
          ratings: [{ criteriaCode: 'food_quality', score: 5 }],
          comment: 'Xem quảng cáo tại http://spam.example, click vào link ngay!!!!!',
        })
        .expect(201);
      expect((res.body as ReviewDto).status).toBe('pending');

      const modResult = await prisma.moderationResult.findFirst({
        where: { targetType: 'review', targetId: (res.body as ReviewDto).id },
      });
      expect(modResult?.recommendedAction).toBe('hold_for_review');
      expect(modResult?.decision).toBe('pending');

      await cleanupRestaurant(restaurant.id);
    });
  });

  describe('US-E2 — optional review fields', () => {
    it('persists dishesOrdered, billTotalVnd, partySize, waitTimeMinutes, wouldReturn', async () => {
      const admin = await registerAdmin('e2-admin');
      const restaurant = await createRestaurant(admin.token, 'E2');
      const reviewer = await registerUser('e2-reviewer');

      const res = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          restaurantId: restaurant.id,
          overallRating: 4,
          ratings: [{ criteriaCode: 'food_quality', score: 4 }],
          dishesOrdered: ['Phở bò', 'Trà đá'],
          billTotalVnd: 120000,
          partySize: 3,
          waitTimeMinutes: 10,
          wouldReturn: true,
        })
        .expect(201);
      const created = res.body as ReviewDto;
      expect(created.dishesOrdered).toEqual(['Phở bò', 'Trà đá']);
      expect(created.billTotalVnd).toBe(120000);
      expect(created.partySize).toBe(3);
      expect(created.waitTimeMinutes).toBe(10);
      expect(created.wouldReturn).toBe(true);

      await cleanupRestaurant(restaurant.id);
    });

    it('rejects a bill total at/above the 50,000,000 VND sanity cap and a comment over 2000 chars', async () => {
      const admin = await registerAdmin('e2-admin-caps');
      const restaurant = await createRestaurant(admin.token, 'E2-caps');
      const reviewer = await registerUser('e2-reviewer-caps');

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          restaurantId: restaurant.id,
          overallRating: 4,
          ratings: [{ criteriaCode: 'food_quality', score: 4 }],
          billTotalVnd: 50_000_000,
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          restaurantId: restaurant.id,
          overallRating: 4,
          ratings: [{ criteriaCode: 'food_quality', score: 4 }],
          comment: 'a'.repeat(2001),
        })
        .expect(400);

      await cleanupRestaurant(restaurant.id);
    });
  });

  describe('US-E3 — edit/delete own review', () => {
    it('lets the owner edit within 48h without setting the "edited" marker', async () => {
      const admin = await registerAdmin('e3-admin');
      const restaurant = await createRestaurant(admin.token, 'E3');
      const reviewer = await registerUser('e3-reviewer');

      const created = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ restaurantId: restaurant.id, overallRating: 3, ratings: [{ criteriaCode: 'food_quality', score: 3 }] })
        .expect(201);
      const reviewId = (created.body as ReviewDto).id;

      const edited = await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ comment: 'Sửa lại trong ngày' })
        .expect(200);
      expect((edited.body as ReviewDto).editedAt).toBeNull();
      expect((edited.body as ReviewDto).comment).toBe('Sửa lại trong ngày');

      await cleanupRestaurant(restaurant.id);
    });

    it('sets the "edited" marker when editing >48h after creation', async () => {
      const admin = await registerAdmin('e3-admin-late');
      const restaurant = await createRestaurant(admin.token, 'E3-late');
      const reviewer = await registerUser('e3-reviewer-late');

      const created = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ restaurantId: restaurant.id, overallRating: 3, ratings: [{ criteriaCode: 'food_quality', score: 3 }] })
        .expect(201);
      const reviewId = (created.body as ReviewDto).id;

      await prisma.review.update({
        where: { id: reviewId },
        data: { createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      });

      const edited = await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ comment: 'Quay lại sau vài ngày' })
        .expect(200);
      expect((edited.body as ReviewDto).editedAt).not.toBeNull();

      await cleanupRestaurant(restaurant.id);
    });

    it('blocks a non-owner from editing or deleting, and lets the owner delete', async () => {
      const admin = await registerAdmin('e3-admin-rbac');
      const restaurant = await createRestaurant(admin.token, 'E3-rbac');
      const owner = await registerUser('e3-owner');
      const stranger = await registerUser('e3-stranger');

      const created = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ restaurantId: restaurant.id, overallRating: 4, ratings: [{ criteriaCode: 'food_quality', score: 4 }] })
        .expect(201);
      const reviewId = (created.body as ReviewDto).id;

      await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ comment: 'không phải của tôi' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);

      const list = await request(app.getHttpServer()).get(`/restaurants/${restaurant.id}/reviews`).expect(200);
      expect((list.body as ReviewListResponse).total).toBe(0);

      await cleanupRestaurant(restaurant.id);
    });
  });

  describe('US-E5 — 24h duplicate block', () => {
    it('blocks a second review for the same restaurant within 24h with the specified message', async () => {
      const admin = await registerAdmin('e5-admin');
      const restaurant = await createRestaurant(admin.token, 'E5');
      const reviewer = await registerUser('e5-reviewer');

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ restaurantId: restaurant.id, overallRating: 5, ratings: [{ criteriaCode: 'food_quality', score: 5 }] })
        .expect(201);

      const blocked = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ restaurantId: restaurant.id, overallRating: 3, ratings: [{ criteriaCode: 'food_quality', score: 3 }] })
        .expect(409);
      expect(errorBody(blocked).message).toBe('Bạn đã đánh giá quán này gần đây');

      await cleanupRestaurant(restaurant.id);
    });

    it('re-submitting after 24h updates the existing row rather than creating a duplicate', async () => {
      const admin = await registerAdmin('e5-admin-resubmit');
      const restaurant = await createRestaurant(admin.token, 'E5-resubmit');
      const reviewer = await registerUser('e5-reviewer-resubmit');

      const first = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ restaurantId: restaurant.id, overallRating: 3, ratings: [{ criteriaCode: 'food_quality', score: 3 }] })
        .expect(201);
      const firstId = (first.body as ReviewDto).id;

      await prisma.review.update({
        where: { id: firstId },
        data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
      });

      const second = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({ restaurantId: restaurant.id, overallRating: 5, ratings: [{ criteriaCode: 'food_quality', score: 5 }] })
        .expect(201);
      expect((second.body as ReviewDto).id).toBe(firstId);
      expect((second.body as ReviewDto).overallRating).toBe(5);

      const count = await prisma.review.count({ where: { restaurantId: restaurant.id, userId: reviewer.userId } });
      expect(count).toBe(1);

      await cleanupRestaurant(restaurant.id);
    });
  });

  // Regression coverage for docs/09-testing-plan.md §4's "rate limiting
  // verified on ... review submission" item: the guard must key by
  // authenticated user, not raw IP — an IP-only key would throttle every
  // user behind the same network/test-runner together (this exact bug was
  // caught live: it broke this file's own multi-user tests above by
  // exhausting a shared IP-keyed bucket before their cleanup ran).
  describe('POST /reviews rate limiting (docs/09-testing-plan.md §4)', () => {
    it('limits an individual user to 10 review-creation attempts per hour, independently of other users', async () => {
      const admin = await registerAdmin('ratelimit-admin');
      const restaurants = await Promise.all(
        Array.from({ length: 11 }, (_, i) => createRestaurant(admin.token, `RateLimit${i}`)),
      );
      const limited = await registerUser('ratelimit-limited');
      const bystander = await registerUser('ratelimit-bystander');

      // 10 distinct restaurants so each POST is a genuinely new review, not
      // blocked by the 24h-duplicate rule — only the rate limit should bite.
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/reviews')
          .set('Authorization', `Bearer ${limited.token}`)
          .send({ restaurantId: restaurants[i].id, overallRating: 4, ratings: [{ criteriaCode: 'food_quality', score: 4 }] })
          .expect(201);
      }

      const eleventh = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${limited.token}`)
        .send({ restaurantId: restaurants[10].id, overallRating: 4, ratings: [{ criteriaCode: 'food_quality', score: 4 }] })
        .expect(429);
      expect(errorBody(eleventh).message).toContain('Quá nhiều yêu cầu');

      // A different authenticated user must be unaffected by the first
      // user's usage (proves the key is per-user, not per-IP).
      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${bystander.token}`)
        .send({ restaurantId: restaurants[10].id, overallRating: 5, ratings: [{ criteriaCode: 'food_quality', score: 5 }] })
        .expect(201);

      for (const restaurant of restaurants) {
        await cleanupRestaurant(restaurant.id);
      }
    }, 20000);
  });

  describe('GET /restaurants/:id/reviews', () => {
    it('paginates, filters by exact rating, and returns an honest rating breakdown', async () => {
      const admin = await registerAdmin('list-admin');
      const restaurant = await createRestaurant(admin.token, 'List');

      const reviewers = await Promise.all([
        registerUser('list-r1'),
        registerUser('list-r2'),
        registerUser('list-r3'),
      ]);
      const ratings = [5, 3, 5];
      for (let i = 0; i < reviewers.length; i++) {
        await request(app.getHttpServer())
          .post('/reviews')
          .set('Authorization', `Bearer ${reviewers[i].token}`)
          .send({
            restaurantId: restaurant.id,
            overallRating: ratings[i],
            ratings: [{ criteriaCode: 'food_quality', score: ratings[i] }],
          })
          .expect(201);
      }

      const all = await request(app.getHttpServer()).get(`/restaurants/${restaurant.id}/reviews`).expect(200);
      const allBody = all.body as ReviewListResponse;
      expect(allBody.total).toBe(3);
      const foodQuality = allBody.ratingBreakdown.find((c) => c.code === 'food_quality');
      expect(foodQuality?.ratingCount).toBe(3);
      expect(foodQuality?.averageScore).toBeCloseTo((5 + 3 + 5) / 3, 2);
      const untouchedCriteria = allBody.ratingBreakdown.find((c) => c.code === 'hygiene');
      expect(untouchedCriteria?.averageScore).toBeNull();
      expect(untouchedCriteria?.ratingCount).toBe(0);

      const filtered = await request(app.getHttpServer())
        .get(`/restaurants/${restaurant.id}/reviews`)
        .query({ filter: 5 })
        .expect(200);
      expect((filtered.body as ReviewListResponse).total).toBe(2);

      const paged = await request(app.getHttpServer())
        .get(`/restaurants/${restaurant.id}/reviews`)
        .query({ page: 1, pageSize: 2 })
        .expect(200);
      expect((paged.body as ReviewListResponse).items).toHaveLength(2);

      await cleanupRestaurant(restaurant.id);
    });
  });

  describe('Search ranking reflects composite score', () => {
    it('ranks a well-reviewed restaurant above a mediocre one for a shared matching query', async () => {
      const admin = await registerAdmin('rank-admin');
      // Space-separated so "Rank" tokenizes as its own word for tsvector
      // full-text matching below — a concatenated "RankGoodXyz" would be one
      // token and never match a plain q=Rank query.
      const goodRestaurant = await createRestaurant(admin.token, 'Rank Good Xyz');
      const mediocreRestaurant = await createRestaurant(admin.token, 'Rank Mediocre Xyz');

      // try/finally here (unlike the simpler single-restaurant tests above):
      // this test's fixture names contain the generic word "restaurant",
      // which can bleed into OTHER tests' fuzzy-match assertions (bit us
      // once already — a leftover pair here made search.e2e-spec.ts's
      // "matches nothing" case return spurious hits) if a mid-test
      // assertion throws and skips cleanup.
      try {
        const goodReviewers = await Promise.all([registerUser('rank-g1'), registerUser('rank-g2'), registerUser('rank-g3'), registerUser('rank-g4'), registerUser('rank-g5'), registerUser('rank-g6')]);
        for (const reviewer of goodReviewers) {
          await request(app.getHttpServer())
            .post('/reviews')
            .set('Authorization', `Bearer ${reviewer.token}`)
            .send({ restaurantId: goodRestaurant.id, overallRating: 5, ratings: [{ criteriaCode: 'food_quality', score: 5 }] })
            .expect(201);
        }
        const mediocreReviewers = await Promise.all([registerUser('rank-m1'), registerUser('rank-m2'), registerUser('rank-m3'), registerUser('rank-m4'), registerUser('rank-m5'), registerUser('rank-m6')]);
        for (const reviewer of mediocreReviewers) {
          await request(app.getHttpServer())
            .post('/reviews')
            .set('Authorization', `Bearer ${reviewer.token}`)
            .send({ restaurantId: mediocreRestaurant.id, overallRating: 2, ratings: [{ criteriaCode: 'food_quality', score: 2 }] })
            .expect(201);
        }

        await pollForCompositeScore(goodRestaurant.id);
        await pollForCompositeScore(mediocreRestaurant.id);

        const res = await request(app.getHttpServer())
          .get('/search')
          .query({ q: 'Rank' })
          .expect(200);
        const items = (res.body as { items: RestaurantSummaryDto[] }).items;
        const goodIndex = items.findIndex((r) => r.id === goodRestaurant.id);
        const mediocreIndex = items.findIndex((r) => r.id === mediocreRestaurant.id);
        expect(goodIndex).toBeGreaterThanOrEqual(0);
        expect(mediocreIndex).toBeGreaterThanOrEqual(0);
        expect(goodIndex).toBeLessThan(mediocreIndex);
      } finally {
        await cleanupRestaurant(goodRestaurant.id);
        await cleanupRestaurant(mediocreRestaurant.id);
      }
    }, 15000);
  });
});
