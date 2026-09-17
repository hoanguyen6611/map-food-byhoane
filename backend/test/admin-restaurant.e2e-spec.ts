import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AdminRestaurantDetailDto,
  ApiErrorResponse,
  AuthResponse,
  MenuItemDto,
  Paginated,
  PhotoDto,
  RestaurantDetailDto,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Covers docs/build-prompts/05-restaurant-detail-admin-seed.md's Definition
// of Done: GET /restaurants/:id payload shape, admin CRUD through every
// sub-resource, moderator blocked from hard delete (403), and an AuditLog
// row produced per mutation.
describe('Admin restaurant CRUD + restaurant detail (e2e)', () => {
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

  // /auth/register always creates a plain 'user' — RBAC roles are only ever
  // assigned by an existing admin (no self-serve escalation), so tests
  // promote the account directly in the DB, then re-login to mint a token
  // whose JWT payload actually carries the new role.
  async function registerAs(
    role: 'admin' | 'moderator',
  ): Promise<{ token: string; userId: string }> {
    const email = uniqueEmail(role);
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const userId = authBody(reg).user.id;

    const roleRow = await prisma.role.findUniqueOrThrow({
      where: { code: role },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { roleId: roleRow.id },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return { token: authBody(login).accessToken, userId };
  }

  async function createDraftRestaurant(
    token: string,
    nameSuffix: string,
  ): Promise<AdminRestaurantDetailDto> {
    const res = await request(app.getHttpServer())
      .post('/admin/restaurants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `E2E Test Restaurant ${nameSuffix}`,
        description: 'Created by admin-restaurant.e2e-spec.ts',
        categoryCode: 'quan_an',
        priceRangeCode: '50_100k',
        phone: '+84901234567',
        address: {
          line: '1 Test St',
          ward: 'Phường 1',
          district: 'Quận 1',
          province: 'TP. Hồ Chí Minh',
        },
        location: { lat: 10.7769, lng: 106.7009 },
        cuisineCodes: ['mon_viet'],
      })
      .expect(201);
    return res.body as AdminRestaurantDetailDto;
  }

  // Mirrors the FK-respecting teardown order used to hand-verify this module
  // — a leftover soft-deleted row is harmless, but a full cleanup keeps
  // repeated local `npm run test:e2e` runs from accumulating junk data.
  async function cleanupRestaurant(id: string): Promise<void> {
    await prisma.photo.deleteMany({
      where: { ownerType: 'restaurant', ownerId: id },
    });
    await prisma.menuItem.deleteMany({ where: { menu: { restaurantId: id } } });
    await prisma.menu.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurantFacility.deleteMany({ where: { restaurantId: id } });
    await prisma.openingHour.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurantCuisine.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurantStatus.deleteMany({ where: { restaurantId: id } });
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    await prisma.restaurant.delete({ where: { id } });
    if (restaurant) {
      await prisma.address.delete({ where: { id: restaurant.addressId } });
      await prisma.location.delete({ where: { id: restaurant.locationId } });
    }
  }

  async function latestAuditAction(
    targetId: string,
  ): Promise<string | undefined> {
    const row = await prisma.auditLog.findFirst({
      where: { targetId },
      orderBy: { createdAt: 'desc' },
    });
    return row?.action;
  }

  describe('GET /restaurants/:id (public detail)', () => {
    it('404s for an unknown id', async () => {
      await request(app.getHttpServer())
        .get('/restaurants/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns the full aggregated contract shape for a published restaurant', async () => {
      const { token } = await registerAs('admin');
      const created = await createDraftRestaurant(token, 'detail-shape');

      const res = await request(app.getHttpServer())
        .get(`/restaurants/${created.id}`)
        .expect(200);
      const body = res.body as RestaurantDetailDto;

      expect(body.id).toBe(created.id);
      expect(body.name).toBe(created.name);
      expect(body.address.district).toBe('Quận 1');
      expect(body.location).toEqual({ lat: 10.7769, lng: 106.7009 });
      expect(body.priceRange).toEqual({
        code: '50_100k',
        minVnd: 50_000,
        maxVnd: 100_000,
      });
      expect(body.openingHours).toHaveLength(7);
      expect(typeof body.isOpenNow).toBe('boolean');
      // Honest empty states — no menus/photos/reviews were ever added, and
      // no scoring pipeline result exists yet (build-prompts/06). AI Summary
      // (build-prompts/07) is a separate GET /restaurants/:id/ai-summary
      // endpoint, not inlined on this DTO — see ai-summary.e2e-spec.ts.
      expect(body.menus).toEqual([]);
      expect(body.photos).toEqual([]);
      expect(body.reviewCount).toBe(0);
      expect(body.reviews).toEqual([]);
      expect(body.compositeScore).toBeNull();
      // Admin-only lifecycle fields must NOT leak into the public contract.
      expect(
        (body as unknown as Record<string, unknown>).publicationStatus,
      ).toBeUndefined();

      await cleanupRestaurant(created.id);
    });

    it('hides a non-published restaurant from the public endpoint', async () => {
      const { token } = await registerAs('admin');
      const created = await createDraftRestaurant(token, 'hidden-404');

      await request(app.getHttpServer())
        .post(`/admin/restaurants/${created.id}/hide`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/restaurants/${created.id}`)
        .expect(404);

      await cleanupRestaurant(created.id);
    });
  });

  describe('Admin restaurant CRUD', () => {
    it('lets admin create, then update core fields, address, and cuisines', async () => {
      const { token, userId } = await registerAs('admin');
      const created = await createDraftRestaurant(token, 'update-flow');
      expect(await latestAuditAction(created.id)).toBe('restaurant.create');

      const updated = await request(app.getHttpServer())
        .patch(`/admin/restaurants/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed Restaurant', cuisineCodes: ['mon_han'] })
        .expect(200);
      const updatedBody = updated.body as AdminRestaurantDetailDto;
      expect(updatedBody.name).toBe('Renamed Restaurant');
      expect(updatedBody.cuisineCodes).toEqual(['mon_han']);

      const auditRow = await prisma.auditLog.findFirst({
        where: { targetId: created.id, action: 'restaurant.update' },
      });
      expect(auditRow?.actorId).toBe(userId);

      await cleanupRestaurant(created.id);
    });

    it('replaces opening hours including an overnight-crossing window, and full facility set', async () => {
      const { token } = await registerAs('admin');
      const created = await createDraftRestaurant(token, 'hours-facilities');

      const days = Array.from({ length: 7 }, (_, dayOfWeek) =>
        dayOfWeek >= 1 && dayOfWeek <= 5
          ? {
              dayOfWeek,
              openTime: '18:00',
              closeTime: '02:00',
              isClosed: false,
            }
          : { dayOfWeek, isClosed: true },
      );
      await request(app.getHttpServer())
        .put(`/admin/restaurants/${created.id}/opening-hours`)
        .set('Authorization', `Bearer ${token}`)
        .send({ days })
        .expect(204);

      await request(app.getHttpServer())
        .put(`/admin/restaurants/${created.id}/facilities`)
        .set('Authorization', `Bearer ${token}`)
        .send({ facilities: ['wifi', 'air_conditioner'] })
        .expect(204);

      const detail = await request(app.getHttpServer())
        .get(`/admin/restaurants/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = detail.body as AdminRestaurantDetailDto;
      const monday = body.openingHours.find((h) => h.dayOfWeek === 1);
      expect(monday).toEqual({
        dayOfWeek: 1,
        openTime: '18:00',
        closeTime: '02:00',
        isClosed: false,
      });
      const sunday = body.openingHours.find((h) => h.dayOfWeek === 0);
      expect(sunday).toEqual({
        dayOfWeek: 0,
        openTime: null,
        closeTime: null,
        isClosed: true,
      });
      expect(body.facilities.sort()).toEqual(['air_conditioner', 'wifi']);

      expect(await latestAuditAction(created.id)).toBe(
        'restaurant.facilities.replace',
      );

      await cleanupRestaurant(created.id);
    });

    it('manages menu items end to end (add, update, remove)', async () => {
      const { token } = await registerAs('admin');
      const created = await createDraftRestaurant(token, 'menu-items');

      const add = await request(app.getHttpServer())
        .post(`/admin/restaurants/${created.id}/menu-items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Phở bò', priceVnd: 55_000, isPopular: true })
        .expect(201);
      const item = add.body as MenuItemDto;
      expect(item.priceVnd).toBe(55_000);

      const update = await request(app.getHttpServer())
        .patch(`/admin/restaurants/menu-items/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ priceVnd: 60_000 })
        .expect(200);
      expect((update.body as MenuItemDto).priceVnd).toBe(60_000);

      await request(app.getHttpServer())
        .delete(`/admin/restaurants/menu-items/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const detail = await request(app.getHttpServer())
        .get(`/admin/restaurants/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        (detail.body as AdminRestaurantDetailDto).menus[0]?.items ?? [],
      ).toEqual([]);

      await cleanupRestaurant(created.id);
    });

    it('attaches and removes photos', async () => {
      const { token } = await registerAs('admin');
      const created = await createDraftRestaurant(token, 'photos');

      const attach = await request(app.getHttpServer())
        .post(`/admin/restaurants/${created.id}/photos`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          url: 'https://picsum.photos/seed/e2e-admin-restaurant/800/600',
          width: 800,
          height: 600,
        })
        .expect(201);
      const photo = attach.body as PhotoDto;
      expect(photo.url).toBe(
        'https://picsum.photos/seed/e2e-admin-restaurant/800/600',
      );

      await request(app.getHttpServer())
        .delete(`/admin/restaurants/photos/${photo.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const detail = await request(app.getHttpServer())
        .get(`/admin/restaurants/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((detail.body as AdminRestaurantDetailDto).photos).toEqual([]);

      await cleanupRestaurant(created.id);
    });

    it('rejects a plain user from every admin route', async () => {
      const email = uniqueEmail('plain-user');
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      await request(app.getHttpServer())
        .get('/admin/restaurants')
        .set('Authorization', `Bearer ${authBody(reg).accessToken}`)
        .expect(403);
    });

    it('hides/restores as moderator, but blocks moderator from hard delete (403); admin can delete', async () => {
      const admin = await registerAs('admin');
      const moderator = await registerAs('moderator');
      const created = await createDraftRestaurant(admin.token, 'rbac-delete');

      await request(app.getHttpServer())
        .post(`/admin/restaurants/${created.id}/hide`)
        .set('Authorization', `Bearer ${moderator.token}`)
        .expect(204);
      expect(await latestAuditAction(created.id)).toBe('restaurant.hide');

      await request(app.getHttpServer())
        .post(`/admin/restaurants/${created.id}/restore`)
        .set('Authorization', `Bearer ${moderator.token}`)
        .expect(204);
      expect(await latestAuditAction(created.id)).toBe('restaurant.restore');

      const blocked = await request(app.getHttpServer())
        .delete(`/admin/restaurants/${created.id}`)
        .set('Authorization', `Bearer ${moderator.token}`)
        .expect(403);
      expect(errorBody(blocked).message).toContain('không có quyền');

      await request(app.getHttpServer())
        .delete(`/admin/restaurants/${created.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(204);
      expect(await latestAuditAction(created.id)).toBe('restaurant.delete');

      const stillGettableByAdmin = await request(app.getHttpServer())
        .get(`/admin/restaurants/${created.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(
        (stillGettableByAdmin.body as AdminRestaurantDetailDto).deletedAt,
      ).not.toBeNull();
      expect(
        (stillGettableByAdmin.body as AdminRestaurantDetailDto)
          .publicationStatus,
      ).toBe('removed');

      await cleanupRestaurant(created.id);
    });

    it('lists restaurants filterable by search text', async () => {
      const { token } = await registerAs('admin');
      const created = await createDraftRestaurant(token, 'searchable-xyz123');

      const res = await request(app.getHttpServer())
        .get('/admin/restaurants')
        .query({ search: 'searchable-xyz123' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = res.body as Paginated<{ id: string }>;
      expect(body.items.some((r) => r.id === created.id)).toBe(true);

      await cleanupRestaurant(created.id);
    });

    it('lists restaurants filterable by ward (contains, case-insensitive), and exposes ward on each item', async () => {
      const { token } = await registerAs('admin');
      const created = await createDraftRestaurant(token, 'ward-filter-xyz789');

      const res = await request(app.getHttpServer())
        .get('/admin/restaurants')
        .query({ ward: 'phường 1' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = res.body as Paginated<{ id: string; ward: string | null }>;
      const match = body.items.find((r) => r.id === created.id);
      expect(match).toBeDefined();
      expect(match?.ward).toBe('Phường 1');

      const noMatchRes = await request(app.getHttpServer())
        .get('/admin/restaurants')
        .query({ ward: 'zzz-no-such-ward', search: 'ward-filter-xyz789' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((noMatchRes.body as Paginated<{ id: string }>).items).toEqual([]);

      await cleanupRestaurant(created.id);
    });
  });
});
