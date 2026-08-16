import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AdminRestaurantDetailDto,
  ApiErrorResponse,
  AuthResponse,
  Paginated,
  RestaurantDetailDto,
  RestaurantSummaryDto,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Covers docs/02-user-stories.md Epic C (US-C1–C4) backend contract, per the
// Definition of Done in docs/build-prompts/04-search-filter.md. Runs against
// whatever restaurants currently exist in the dev database (e.g.
// prisma/seed-restaurants.ts, the real Module 5 demo dataset) — assertions
// hold regardless of exact fixture count/names (structural/behavioral, not
// hardcoded specific restaurants).
describe('Search & Filter (e2e)', () => {
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

  const body = (res: request.Response) =>
    res.body as Paginated<RestaurantSummaryDto>;
  const errorBody = (res: request.Response) => res.body as ApiErrorResponse;
  const authBody = (res: request.Response) => res.body as AuthResponse;

  const uniqueEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  async function registerAdmin(label: string): Promise<{ token: string }> {
    const email = uniqueEmail(label);
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const roleRow = await prisma.role.findUniqueOrThrow({ where: { code: 'admin' } });
    await prisma.user.update({ where: { id: authBody(reg).user.id }, data: { roleId: roleRow.id } });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return { token: authBody(login).accessToken };
  }

  // Mirrors review.e2e-spec.ts's createRestaurant/cleanupRestaurant fixture
  // pattern — a real restaurant via the admin API (immediately published),
  // not hand-rolled Prisma relations.
  async function createRestaurant(adminToken: string, name: string): Promise<AdminRestaurantDetailDto> {
    const res = await request(app.getHttpServer())
      .post('/admin/restaurants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        categoryCode: 'quan_an',
        priceRangeCode: '50_100k',
        address: { line: '1 Test St', ward: 'Phường Bến Nghé', province: 'TP. Hồ Chí Minh' },
        location: { lat: 10.7769, lng: 106.7009 },
      })
      .expect(201);
    return res.body as AdminRestaurantDetailDto;
  }

  async function addMenuItem(adminToken: string, restaurantId: string, name: string): Promise<void> {
    await request(app.getHttpServer())
      .post(`/admin/restaurants/${restaurantId}/menu-items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name, priceVnd: 40000 })
      .expect(201);
  }

  async function cleanupRestaurant(id: string): Promise<void> {
    // Menu/MenuItem cascade-delete with the restaurant (onDelete: Cascade in
    // schema.prisma) — no explicit cleanup needed for those.
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

  describe('GET /search — US-C1 (search by name/dish/cuisine, diacritics-insensitive)', () => {
    it('matches a diacritics-stripped query against accented restaurant names', async () => {
      // Module 5's seed data (prisma/seed-restaurants.ts) always includes
      // several "Cà Phê ..." places — a diacritics-free "ca phe" query must
      // still find them via the unaccent()-backed search_vector/trigram index.
      const res = await request(app.getHttpServer())
        .get('/search')
        .query({ q: 'ca phe' })
        .expect(200);
      const result = body(res);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.some((r) => r.name.includes('Cà Phê'))).toBe(true);
    });

    it('returns a well-formed empty result (not an error) for a query matching nothing', async () => {
      const res = await request(app.getHttpServer())
        .get('/search')
        .query({ q: 'zzz-no-such-restaurant-zzz' })
        .expect(200);
      expect(body(res)).toMatchObject({ items: [], total: 0 });
    });
  });

  describe('GET /search — dish-name matching, and the fuzzy-name-match false-positive fix', () => {
    it('matches via a menu item\'s dish name, per the literal "com tam" acceptance criterion', async () => {
      const admin = await registerAdmin('search-dish');
      // Name deliberately shares nothing with "cơm tấm" — the only way this
      // fixture can match is via the dish-name join (search.service.ts
      // branch (c)), proving that specific branch actually works end-to-end
      // now that MenuItem.dishId gets linked at creation time.
      const restaurant = await createRestaurant(admin.token, `Search Dish Test Alpha ${Date.now()}`);
      await addMenuItem(admin.token, restaurant.id, 'Cơm tấm sườn bì chả');

      try {
        const res = await request(app.getHttpServer())
          .get('/search')
          .query({ q: 'com tam' })
          .expect(200);
        expect(body(res).items.some((r) => r.id === restaurant.id)).toBe(true);
      } finally {
        await cleanupRestaurant(restaurant.id);
      }
    });

    it('does NOT return a restaurant whose name merely shares an unaccented substring with the query (regression)', async () => {
      const admin = await registerAdmin('search-false-positive');
      // Mirrors the real reported bug exactly: unaccented, this name shares
      // the "Tam" token with unaccented "Cơm tấm" ("Com tam"), which used to
      // cross the old 0.2 trigram-similarity threshold despite being
      // semantically unrelated. No menu item is added, so this can only
      // match via the fuzzy-name branch (b), if the threshold fix regresses.
      const restaurant = await createRestaurant(admin.token, `Quán Ăn Chị Tám Test ${Date.now()}`);

      try {
        const res = await request(app.getHttpServer())
          .get('/search')
          .query({ q: 'Cơm tấm' })
          .expect(200);
        expect(body(res).items.some((r) => r.id === restaurant.id)).toBe(false);
      } finally {
        await cleanupRestaurant(restaurant.id);
      }
    });
  });

  describe('GET /search — US-C2 (combined filters are AND, not OR)', () => {
    it('combining distance + price + openNow returns only restaurants satisfying all three simultaneously', async () => {
      // Central HCMC — falls within/near every district in prisma/seed-restaurants.ts.
      const res = await request(app.getHttpServer())
        .get('/search')
        .query({
          lat: 10.786,
          lng: 106.689,
          distanceKm: 5,
          priceMax: 100000,
          openNow: 'true',
        })
        .expect(200);
      const result = body(res);
      expect(result.items.length).toBeGreaterThan(0);
      for (const r of result.items) {
        expect(r.distanceMeters).not.toBeNull();
        expect(r.distanceMeters!).toBeLessThanOrEqual(5000);
        expect(r.priceRange).not.toBeNull();
        expect(r.priceRange!.minVnd).toBeLessThanOrEqual(100000);
        expect(r.isOpenNow).toBe(true);
      }
    });

    it('cuisine filter is ANY-of, facilities filter is ALL-of', async () => {
      // RestaurantSummaryDto doesn't carry cuisineCodes/facilities (those are
      // detail-only fields), so each matched summary is re-verified against
      // its own detail payload — behavioral, not tied to any specific
      // fixture's name.
      const cuisineRes = await request(app.getHttpServer())
        .get('/restaurants')
        .query({ cuisine: 'mon_nhat' })
        .expect(200);
      const cuisineItems = body(cuisineRes).items;
      expect(cuisineItems.length).toBeGreaterThan(0);
      for (const item of cuisineItems) {
        const detail = await request(app.getHttpServer())
          .get(`/restaurants/${item.id}`)
          .expect(200);
        expect((detail.body as RestaurantDetailDto).cuisineCodes).toContain('mon_nhat');
      }

      const facilitiesRes = await request(app.getHttpServer())
        .get('/restaurants')
        .query({ facilities: 'wifi,air_conditioner' })
        .expect(200);
      const facilitiesItems = body(facilitiesRes).items;
      expect(facilitiesItems.length).toBeGreaterThan(0);
      for (const item of facilitiesItems) {
        const detail = await request(app.getHttpServer())
          .get(`/restaurants/${item.id}`)
          .expect(200);
        expect((detail.body as RestaurantDetailDto).facilities).toEqual(
          expect.arrayContaining(['wifi', 'air_conditioner']),
        );
      }
    });

    // Added for build-prompts/09-public-web.md's category/district browse
    // chips (backend/src/modules/search/dto/search-query.dto.ts).
    it('filters by category and by district', async () => {
      const categoryRes = await request(app.getHttpServer())
        .get('/restaurants')
        .query({ category: 'quan_ca_phe' })
        .expect(200);
      const categoryItems = body(categoryRes).items;
      expect(categoryItems.length).toBeGreaterThan(0);
      expect(categoryItems.every((r) => r.categoryCode === 'quan_ca_phe')).toBe(true);

      const districtRes = await request(app.getHttpServer())
        .get('/restaurants')
        .query({ district: 'Quận 1' })
        .expect(200);
      expect(body(districtRes).items.length).toBeGreaterThan(0);

      const combinedRes = await request(app.getHttpServer())
        .get('/restaurants')
        .query({ category: 'quan_bar', district: 'zzz-no-such-district' })
        .expect(200);
      expect(body(combinedRes).items).toEqual([]);
    });

    // Province/Ward replace District as Vietnam's real administrative
    // hierarchy going forward (backend/src/modules/search/dto/search-query.dto.ts) —
    // seeded via prisma/seed-restaurants.ts's DISTRICTS constant, which
    // writes a real `province`/`ward` on every restaurant regardless of the
    // legacy `district` field.
    it('filters by province and by province+ward (exact match)', async () => {
      const provinceRes = await request(app.getHttpServer())
        .get('/restaurants')
        .query({ province: 'TP. Hồ Chí Minh' })
        .expect(200);
      expect(body(provinceRes).items.length).toBeGreaterThan(0);

      const wardRes = await request(app.getHttpServer())
        .get('/restaurants')
        .query({ province: 'TP. Hồ Chí Minh', ward: 'Bến Nghé' })
        .expect(200);
      expect(body(wardRes).items.length).toBeGreaterThan(0);

      const noMatchRes = await request(app.getHttpServer())
        .get('/restaurants')
        .query({ province: 'TP. Hồ Chí Minh', ward: 'zzz-no-such-ward' })
        .expect(200);
      expect(body(noMatchRes).items).toEqual([]);
    });
  });

  describe('GET /search — validation', () => {
    it('rejects priceMin > priceMax with a validation error, not silently ignoring it', async () => {
      const res = await request(app.getHttpServer())
        .get('/search')
        .query({ priceMin: 200000, priceMax: 50000 })
        .expect(400);
      expect(errorBody(res).message).toContain('priceMin');
    });

    it('rejects distanceKm without lat/lng', async () => {
      await request(app.getHttpServer())
        .get('/search')
        .query({ distanceKm: 5 })
        .expect(400);
    });

    it('caps an oversized distanceKm instead of rejecting it (200, not 400)', async () => {
      await request(app.getHttpServer())
        .get('/search')
        .query({ lat: 10.786, lng: 106.689, distanceKm: 5000 })
        .expect(200);
    });
  });

  describe('GET /restaurants — US-C3/C4 (browse with filters, no q)', () => {
    it('supports the same filters without a search term', async () => {
      const res = await request(app.getHttpServer())
        .get('/restaurants')
        .query({ priceMax: 50000 })
        .expect(200);
      const result = body(res);
      for (const r of result.items) {
        expect(r.priceRange).not.toBeNull();
        expect(r.priceRange!.minVnd).toBeLessThanOrEqual(50000);
      }
    });

    it('paginates results per page/pageSize', async () => {
      const res = await request(app.getHttpServer())
        .get('/restaurants')
        .query({ page: 1, pageSize: 2 })
        .expect(200);
      const result = body(res);
      expect(result.items.length).toBeLessThanOrEqual(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
    });
  });

  describe('performance sanity (real load testing is Module 8/DevOps)', () => {
    it('responds to a filtered search well under 500ms against the seeded dataset', async () => {
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/search')
        .query({ lat: 10.786, lng: 106.689, distanceKm: 10, priceMax: 200000 })
        .expect(200);
      expect(Date.now() - start).toBeLessThan(500);
    });
  });
});
