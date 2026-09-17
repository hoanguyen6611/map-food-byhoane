import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AISummaryResponseDto } from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Covers build-prompts/07's AI Summary (US-J1/J2) Definition of Done items:
// not generated/shown below the minimum review threshold, and — since
// there's no real Claude summarize() this pass — the defensive re-check
// that a stale AISummary row surviving after reviews dropped below
// threshold is still correctly hidden (row existence alone isn't enough).
describe('AI Summary (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createRestaurantWithStatus(
    reviewCount: number,
  ): Promise<string> {
    const category = await prisma.restaurantCategory.findFirstOrThrow();
    const address = await prisma.address.create({
      data: {
        line: 'AI Summary Test St',
        district: 'Q',
        province: 'TP',
        fullAddressText: 'AI Summary Test St, Q, TP',
      },
    });
    const location = await prisma.location.create({
      data: { lat: 10.99, lng: 106.99 },
    });
    const restaurant = await prisma.restaurant.create({
      data: {
        name: `AI Summary Test ${Date.now()}-${Math.random().toString(36).slice(2)}`,
        slug: `ai-summary-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        categoryId: category.id,
        addressId: address.id,
        locationId: location.id,
      },
    });
    await prisma.restaurantStatus.create({
      data: {
        restaurantId: restaurant.id,
        publicationStatus: 'published',
        reviewCount,
      },
    });
    return restaurant.id;
  }

  async function cleanup(restaurantId: string): Promise<void> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) return;
    await prisma.aISummary.deleteMany({ where: { restaurantId } });
    await prisma.restaurantStatus.deleteMany({ where: { restaurantId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
    await prisma.address.delete({ where: { id: restaurant.addressId } });
    await prisma.location.delete({ where: { id: restaurant.locationId } });
  }

  it('is unavailable when a stale AISummary row exists but the current review count has dropped below threshold', async () => {
    const restaurantId = await createRestaurantWithStatus(4);
    await prisma.aISummary.create({
      data: {
        restaurantId,
        summaryText:
          'Stale summary from when this restaurant had more reviews.',
        pros: ['x'],
        cons: ['y'],
        sourceReviewCount: 10,
        modelVersion: 'test-v1',
        generatedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/ai-summary`)
      .expect(200);
    const body = res.body as AISummaryResponseDto;
    expect(body.available).toBe(false);
    expect(body.summary).toBeNull();
    expect(body.minReviewThreshold).toBeGreaterThan(0);

    await cleanup(restaurantId);
  });

  it('is available when at/above threshold with a real row', async () => {
    const restaurantId = await createRestaurantWithStatus(5);
    await prisma.aISummary.create({
      data: {
        restaurantId,
        summaryText: 'Quán này được đánh giá cao.',
        pros: ['Ngon', 'Sạch sẽ'],
        cons: ['Hơi đông'],
        sourceReviewCount: 5,
        modelVersion: 'test-v1',
        generatedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/ai-summary`)
      .expect(200);
    const body = res.body as AISummaryResponseDto;
    expect(body.available).toBe(true);
    expect(body.summary?.summaryText).toBe('Quán này được đánh giá cao.');
    expect(body.summary?.pros).toEqual(['Ngon', 'Sạch sẽ']);

    await cleanup(restaurantId);
  });

  it('is unavailable when at/above threshold but no row exists', async () => {
    const restaurantId = await createRestaurantWithStatus(10);
    const res = await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/ai-summary`)
      .expect(200);
    const body = res.body as AISummaryResponseDto;
    expect(body.available).toBe(false);
    expect(body.summary).toBeNull();

    await cleanup(restaurantId);
  });
});
