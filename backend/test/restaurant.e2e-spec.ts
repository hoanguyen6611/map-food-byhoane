import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';

// Covers docs/02-user-stories.md Epic B (US-B1–B4) backend contract, per the
// Definition of Done in docs/build-prompts/03-map-geospatial.md. Runs
// against whatever restaurants currently exist in the dev database (e.g.
// prisma/seed-restaurants.ts) — assertions are written to hold regardless of
// the exact dataset (structural/behavioral, not fixture-count).
describe('Restaurants — map/geospatial (e2e)', () => {
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

  const listBody = (res: request.Response) =>
    res.body as RestaurantSummaryDto[];

  describe('GET /restaurants/nearby', () => {
    it('rejects a request missing required lat/lng', async () => {
      await request(app.getHttpServer()).get('/restaurants/nearby').expect(400);
    });

    it('returns restaurants sorted by ascending distance, with distanceMeters populated', async () => {
      // Central Ho Chi Minh City — falls within/near every district in prisma/seed-restaurants.ts.
      const res = await request(app.getHttpServer())
        .get('/restaurants/nearby')
        .query({ lat: 10.786, lng: 106.689, radiusKm: 5 })
        .expect(200);

      const body = listBody(res);
      expect(Array.isArray(body)).toBe(true);
      for (const r of body) {
        expect(typeof r.distanceMeters).toBe('number');
      }
      for (let i = 1; i < body.length; i++) {
        expect(body[i].distanceMeters! >= body[i - 1].distanceMeters!).toBe(
          true,
        );
      }
    });

    it('caps an oversized radius request at 20km instead of rejecting it (200, not 400)', async () => {
      const res = await request(app.getHttpServer())
        .get('/restaurants/nearby')
        .query({ lat: 10.786, lng: 106.689, radiusKm: 5000 })
        .expect(200);
      expect(Array.isArray(listBody(res))).toBe(true);
    });

    it('returns an empty array (not an error) when nothing is nearby', async () => {
      // Hanoi — far outside any Ho Chi Minh City seed data even at the 20km cap.
      const res = await request(app.getHttpServer())
        .get('/restaurants/nearby')
        .query({ lat: 21.0285, lng: 105.8542, radiusKm: 1 })
        .expect(200);
      expect(listBody(res)).toEqual([]);
    });

    it('rejects out-of-range coordinates', async () => {
      await request(app.getHttpServer())
        .get('/restaurants/nearby')
        .query({ lat: 999, lng: 106.689 })
        .expect(400);
    });
  });

  describe('GET /restaurants/bounds', () => {
    it('rejects a request missing required corner params', async () => {
      await request(app.getHttpServer())
        .get('/restaurants/bounds')
        .query({ swLat: 10.75, swLng: 106.65 })
        .expect(400);
    });

    it('returns restaurants within the envelope, capped at 200, with distanceMeters omitted (null)', async () => {
      const res = await request(app.getHttpServer())
        .get('/restaurants/bounds')
        .query({ swLat: 10.75, swLng: 106.65, neLat: 10.81, neLng: 106.73 })
        .expect(200);

      const body = listBody(res);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeLessThanOrEqual(200);
      for (const r of body) {
        expect(r.distanceMeters).toBeNull();
      }
    });

    it('returns an empty array for an envelope with nothing in it', async () => {
      const res = await request(app.getHttpServer())
        .get('/restaurants/bounds')
        .query({ swLat: 0.1, swLng: 0.1, neLat: 0.2, neLng: 0.2 })
        .expect(200);
      expect(listBody(res)).toEqual([]);
    });
  });
});
