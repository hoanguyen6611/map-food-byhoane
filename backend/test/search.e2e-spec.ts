import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  ApiErrorResponse,
  Paginated,
  RestaurantDetailDto,
  RestaurantSummaryDto,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';

// Covers docs/02-user-stories.md Epic C (US-C1–C4) backend contract, per the
// Definition of Done in docs/build-prompts/04-search-filter.md. Runs against
// whatever restaurants currently exist in the dev database (e.g.
// prisma/seed-restaurants.ts, the real Module 5 demo dataset) — assertions
// hold regardless of exact fixture count/names (structural/behavioral, not
// hardcoded specific restaurants).
describe('Search & Filter (e2e)', () => {
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

  const body = (res: request.Response) =>
    res.body as Paginated<RestaurantSummaryDto>;
  const errorBody = (res: request.Response) => res.body as ApiErrorResponse;

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
