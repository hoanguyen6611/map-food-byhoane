import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AuthResponse,
  FavoriteListResponse,
  FavoriteStatusDto,
  NotificationListResponse,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Covers docs/02-user-stories.md Epic H (US-H1-H2) and the Notification half
// of the Definition of Done in
// docs/build-prompts/08-favorites-notifications-polish.md. Runs against
// whatever restaurants already exist in the dev database (Module 5's real
// seed) — assertions are structural, not tied to a specific restaurant.
describe('Favorites & Notifications (e2e)', () => {
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
    if (!restaurant) {
      throw new Error('No published restaurant in the dev DB — run prisma/seed-restaurants.ts first.');
    }
    seededRestaurantId = restaurant.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const authBody = (res: request.Response) => res.body as AuthResponse;

  async function registerUser(label: string): Promise<{ token: string; userId: string }> {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const body = authBody(res);
    return { token: body.accessToken, userId: body.user.id };
  }

  describe('Favorites — US-H1', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).post(`/favorites/${seededRestaurantId}`).expect(401);
      await request(app.getHttpServer()).delete(`/favorites/${seededRestaurantId}`).expect(401);
      await request(app.getHttpServer()).get('/me/favorites').expect(401);
    });

    it('404s favoriting a restaurant that does not exist', async () => {
      const { token } = await registerUser('fav-404');
      await request(app.getHttpServer())
        .post('/favorites/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('adds/removes idempotently and reflects consistently in the list', async () => {
      const { token, userId } = await registerUser('fav-toggle');

      const add1 = await request(app.getHttpServer())
        .post(`/favorites/${seededRestaurantId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect((add1.body as FavoriteStatusDto).isFavorited).toBe(true);

      // Adding again must not error — idempotent per the build prompt.
      await request(app.getHttpServer())
        .post(`/favorites/${seededRestaurantId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const count = await prisma.favorite.count({ where: { userId, restaurantId: seededRestaurantId } });
      expect(count).toBe(1);

      const list = await request(app.getHttpServer())
        .get('/me/favorites')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const listBody = list.body as FavoriteListResponse;
      expect(listBody.total).toBe(1);
      expect(listBody.items[0].restaurantId).toBe(seededRestaurantId);
      expect(listBody.items[0].restaurant.name).toEqual(expect.any(String));

      const ids = await request(app.getHttpServer())
        .get('/me/favorites/ids')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(ids.body).toEqual([seededRestaurantId]);

      const remove1 = await request(app.getHttpServer())
        .delete(`/favorites/${seededRestaurantId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((remove1.body as FavoriteStatusDto).isFavorited).toBe(false);

      // Removing again must not error either.
      await request(app.getHttpServer())
        .delete(`/favorites/${seededRestaurantId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const listAfter = await request(app.getHttpServer())
        .get('/me/favorites')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((listAfter.body as FavoriteListResponse).total).toBe(0);
    });

    it('keeps favorites scoped per-user (no cross-user leakage)', async () => {
      const userA = await registerUser('fav-a');
      const userB = await registerUser('fav-b');

      await request(app.getHttpServer())
        .post(`/favorites/${seededRestaurantId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(201);

      const bList = await request(app.getHttpServer())
        .get('/me/favorites')
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(200);
      expect((bList.body as FavoriteListResponse).total).toBe(0);

      await prisma.favorite.deleteMany({ where: { userId: userA.userId } });
    });
  });

  describe('Notifications', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/me/notifications').expect(401);
    });

    it('starts empty for a fresh user, and 404s marking a nonexistent notification read', async () => {
      const { token } = await registerUser('notif-empty');
      const res = await request(app.getHttpServer())
        .get('/me/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = res.body as NotificationListResponse;
      expect(body).toEqual({ items: [], total: 0, unreadCount: 0, page: 1, pageSize: 20 });

      await request(app.getHttpServer())
        .patch('/me/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('lists, tracks unreadCount, marks read, and blocks a non-owner from marking it read', async () => {
      const owner = await registerUser('notif-owner');
      const stranger = await registerUser('notif-stranger');

      const notification = await prisma.notification.create({
        data: {
          userId: owner.userId,
          type: 'moderation_result',
          payload: { title: 'Test', body: 'Test body', deepLink: { screen: 'Reviews', restaurantId: seededRestaurantId } },
        },
      });

      const list = await request(app.getHttpServer())
        .get('/me/notifications')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      const listBody = list.body as NotificationListResponse;
      expect(listBody.total).toBe(1);
      expect(listBody.unreadCount).toBe(1);
      expect(listBody.items[0].isRead).toBe(false);
      expect(listBody.items[0].payload.deepLink).toEqual({ screen: 'Reviews', restaurantId: seededRestaurantId });

      await request(app.getHttpServer())
        .patch(`/me/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(404);

      const marked = await request(app.getHttpServer())
        .patch(`/me/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(marked.body.isRead).toBe(true);

      const listAfter = await request(app.getHttpServer())
        .get('/me/notifications')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect((listAfter.body as NotificationListResponse).unreadCount).toBe(0);

      await prisma.notification.delete({ where: { id: notification.id } });
    });
  });
});
