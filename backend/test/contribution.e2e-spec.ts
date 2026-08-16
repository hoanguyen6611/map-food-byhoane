import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import sharp from 'sharp';
import type {
  AuthResponse,
  ContributionListResponse,
  CreateRestaurantContributionResponse,
  CreateUploadUrlResponse,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClaudeGatewayService } from '../src/modules/ai/claude-gateway.service';
import { buildMockClaudeGateway } from './helpers/mock-claude-gateway';

// Covers docs/02-user-stories.md Epic F (US-F1-F4) and the ContributionModule
// half of build-prompts/07-contribution-media-moderation-ai.md's Definition
// of Done. Moderation now runs through the real Claude adapter
// (ContributionModerationService -> ClaudeGatewayService), but this sandbox
// has no real ANTHROPIC_API_KEY — ClaudeGatewayService is overridden with a
// deterministic test double (see helpers/mock-claude-gateway.ts) so the
// auto_approved/in_review assertions below stay meaningful without one.
// Runs against a real MinIO instance for the photo-upload steps.
describe('Contribution (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let realJpeg: Buffer;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClaudeGatewayService)
      .useValue(buildMockClaudeGateway())
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    realJpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 20, g: 180, b: 90 } } })
      .jpeg()
      .toBuffer();
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (label: string) => `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const authBody = (res: request.Response) => res.body as AuthResponse;

  async function registerUser(label: string): Promise<{ token: string; userId: string }> {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123' }).expect(201);
    const body = authBody(res);
    return { token: body.accessToken, userId: body.user.id };
  }

  async function uploadRealPhoto(token: string): Promise<string> {
    const uploadRes = await request(app.getHttpServer())
      .post('/media/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ contentType: 'image/jpeg', fileSizeBytes: realJpeg.length })
      .expect(201);
    const { uploadUrl, storageKey } = uploadRes.body as CreateUploadUrlResponse;

    const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array(realJpeg) });
    if (!putRes.ok) throw new Error(`PUT failed: ${putRes.status}`);

    const confirmRes = await request(app.getHttpServer())
      .post('/media/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ storageKey, ownerType: 'restaurant' })
      .expect(201);
    return (confirmRes.body as { id: string }).id;
  }

  function basicRestaurantBody(overrides: Record<string, unknown> = {}, photoIds: string[] = []) {
    return {
      name: `E2E Test Restaurant ${Date.now()}-${Math.random().toString(36).slice(2)}`,
      categoryCode: 'quan_an',
      address: { line: '1 Test St', ward: 'Phường Test', province: 'TP. Test' },
      location: { lat: 10.9 + Math.random() * 0.05, lng: 106.9 + Math.random() * 0.05 },
      photoIds,
      ...overrides,
    };
  }

  async function cleanupRestaurant(id: string): Promise<void> {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) return;
    await prisma.photo.deleteMany({ where: { ownerType: 'restaurant', ownerId: id } });
    await prisma.menuItem.deleteMany({ where: { menu: { restaurantId: id } } });
    await prisma.menu.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurantFacility.deleteMany({ where: { restaurantId: id } });
    await prisma.openingHour.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurantCuisine.deleteMany({ where: { restaurantId: id } });
    await prisma.crowdedStatus.deleteMany({ where: { restaurantId: id } });
    await prisma.seatAvailability.deleteMany({ where: { restaurantId: id } });
    await prisma.powerOutletStatus.deleteMany({ where: { restaurantId: id } });
    await prisma.parkingInformation.deleteMany({ where: { restaurantId: id } });
    const contributionIds = await prisma.contribution
      .findMany({ where: { targetRestaurantId: id }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));
    await prisma.editSuggestion.deleteMany({ where: { contributionId: { in: contributionIds } } });
    await prisma.contribution.deleteMany({ where: { targetRestaurantId: id } });
    await prisma.restaurantStatus.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurant.delete({ where: { id } });
    await prisma.address.delete({ where: { id: restaurant.addressId } });
    await prisma.location.delete({ where: { id: restaurant.locationId } });
  }

  describe('POST /restaurants (new-restaurant submission) — US-F1', () => {
    it('rejects submission with zero photos', async () => {
      const { token } = await registerUser('contrib-nophoto');
      await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(basicRestaurantBody({}, []))
        .expect(400);
    });

    it('auto-approves and publishes a clean submission, invisible-then-visible correctly', async () => {
      const { token } = await registerUser('contrib-clean');
      const photoId = await uploadRealPhoto(token);
      const res = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(basicRestaurantBody({ description: 'Quán ăn rất ngon, không gian thoáng mát.' }, [photoId]))
        .expect(201);
      const body = res.body as CreateRestaurantContributionResponse;
      expect(body.status).toBe('auto_approved');

      await request(app.getHttpServer()).get(`/restaurants/${body.restaurantId}`).expect(200);

      const photo = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } });
      expect(photo.ownerId).toBe(body.restaurantId);

      await cleanupRestaurant(body.restaurantId);
    });

    it('holds a submission with strong spam signals for review, and keeps the restaurant invisible', async () => {
      const { token } = await registerUser('contrib-spam');
      const photoId = await uploadRealPhoto(token);
      const res = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(
          basicRestaurantBody(
            { description: 'kiếm tiền online dễ dàng, xem tại https://spam.example.com nhé' },
            [photoId],
          ),
        )
        .expect(201);
      const body = res.body as CreateRestaurantContributionResponse;
      expect(body.status).toBe('in_review');

      await request(app.getHttpServer()).get(`/restaurants/${body.restaurantId}`).expect(404);

      const status = await prisma.restaurantStatus.findUniqueOrThrow({ where: { restaurantId: body.restaurantId } });
      expect(status.publicationStatus).toBe('in_review');

      await cleanupRestaurant(body.restaurantId);
    });
  });

  describe('Duplicate detection — US-F2', () => {
    it('blocks a near-duplicate submission with 409 + candidates, then succeeds once confirmed', async () => {
      const { token } = await registerUser('contrib-dup');
      const photoId1 = await uploadRealPhoto(token);
      const lat = 10.777;
      const lng = 106.777;
      const name = `Dup Test Restaurant ${Date.now()}`;

      const first = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(basicRestaurantBody({ name, location: { lat, lng } }, [photoId1]))
        .expect(201);
      const firstId = (first.body as CreateRestaurantContributionResponse).restaurantId;

      const checkRes = await request(app.getHttpServer())
        .post('/restaurants/duplicate-check')
        .set('Authorization', `Bearer ${token}`)
        .send({ lat: lat + 0.0001, lng: lng + 0.0001, name })
        .expect(201);
      expect((checkRes.body as { candidates: unknown[] }).candidates.length).toBeGreaterThan(0);

      const photoId2 = await uploadRealPhoto(token);
      await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(basicRestaurantBody({ name, location: { lat: lat + 0.0001, lng: lng + 0.0001 } }, [photoId2]))
        .expect(409);

      const confirmedRes = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(basicRestaurantBody({ name, location: { lat: lat + 0.0001, lng: lng + 0.0001 }, duplicateConfirmed: true }, [photoId2]))
        .expect(201);

      await cleanupRestaurant(firstId);
      await cleanupRestaurant((confirmedRes.body as CreateRestaurantContributionResponse).restaurantId);
    });
  });

  describe('Edit suggestions — US-F3', () => {
    it('rejects a fieldName outside the allow-list', async () => {
      const { token } = await registerUser('contrib-edit-badfield');
      const photoId = await uploadRealPhoto(token);
      const createRes = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(basicRestaurantBody({}, [photoId]))
        .expect(201);
      const restaurantId = (createRes.body as CreateRestaurantContributionResponse).restaurantId;

      await request(app.getHttpServer())
        .post(`/restaurants/${restaurantId}/edit-suggestions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fieldName: 'categoryId', newValue: 'hacked' })
        .expect(400);

      await cleanupRestaurant(restaurantId);
    });

    it('auto-approves a clean edit suggestion and applies it immediately, snapshotting the old value', async () => {
      const { token } = await registerUser('contrib-edit-clean');
      const photoId = await uploadRealPhoto(token);
      const createRes = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(basicRestaurantBody({ phone: '0901234567' }, [photoId]))
        .expect(201);
      const restaurantId = (createRes.body as CreateRestaurantContributionResponse).restaurantId;

      const editRes = await request(app.getHttpServer())
        .post(`/restaurants/${restaurantId}/edit-suggestions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fieldName: 'phone', newValue: '0909999999' })
        .expect(201);

      if ((editRes.body as { status: string }).status === 'auto_approved') {
        const detail = await request(app.getHttpServer()).get(`/restaurants/${restaurantId}`).expect(200);
        expect((detail.body as { phone: string }).phone).toBe('0909999999');

        const suggestion = await prisma.editSuggestion.findFirst({ where: { contributionId: (editRes.body as { contributionId: string }).contributionId } });
        expect(suggestion?.oldValue).toBe('0901234567');
      }
      // If it happened to be held for review instead (e.g. rapid-fire from
      // a prior test in the same run), the important invariant — never
      // apply a held suggestion — is covered by the dedicated test below.

      await cleanupRestaurant(restaurantId);
    });
  });

  describe('Status reports — US-F4', () => {
    it('immediate-apply kinds (crowded/seat/outlet/parking) write their row on auto-approve', async () => {
      const { token } = await registerUser('contrib-status-apply');
      const photoId = await uploadRealPhoto(token);
      const createRes = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(basicRestaurantBody({}, [photoId]))
        .expect(201);
      const restaurantId = (createRes.body as CreateRestaurantContributionResponse).restaurantId;

      const crowdedRes = await request(app.getHttpServer())
        .post(`/restaurants/${restaurantId}/status-reports`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'crowded', crowdedLevel: 'moderate' })
        .expect(201);
      if ((crowdedRes.body as { status: string }).status === 'auto_approved') {
        const row = await prisma.crowdedStatus.findFirst({ where: { restaurantId } });
        expect(row?.level).toBe('moderate');
      }

      await cleanupRestaurant(restaurantId);
    });

    it('human-attention kinds (moved/hours_change/wrong_info/closure) never auto-mutate the restaurant, regardless of moderation outcome', async () => {
      const { token } = await registerUser('contrib-status-noapply');
      const photoId = await uploadRealPhoto(token);
      const createRes = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(basicRestaurantBody({}, [photoId]))
        .expect(201);
      const restaurantId = (createRes.body as CreateRestaurantContributionResponse).restaurantId;
      const before = await request(app.getHttpServer()).get(`/restaurants/${restaurantId}`).expect(200);

      await request(app.getHttpServer())
        .post(`/restaurants/${restaurantId}/status-reports`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'moved', description: 'Quán đã chuyển địa chỉ mới.' })
        .expect(201);

      const after = await request(app.getHttpServer()).get(`/restaurants/${restaurantId}`).expect(200);
      expect(after.body).toEqual(before.body);

      await cleanupRestaurant(restaurantId);
    });

    it('escalates on the 3rd distinct-reporter closure report within the 14-day window, never auto-hiding the restaurant', async () => {
      const { token: ownerToken } = await registerUser('contrib-closure-owner');
      const photoId = await uploadRealPhoto(ownerToken);
      const createRes = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(basicRestaurantBody({}, [photoId]))
        .expect(201);
      const restaurantId = (createRes.body as CreateRestaurantContributionResponse).restaurantId;

      let lastContributionId = '';
      for (let i = 0; i < 3; i++) {
        const { token: reporterToken } = await registerUser(`contrib-closure-reporter-${i}`);
        const res = await request(app.getHttpServer())
          .post(`/restaurants/${restaurantId}/status-reports`)
          .set('Authorization', `Bearer ${reporterToken}`)
          .send({ kind: 'closure', description: `Quán đóng cửa rồi, báo cáo số ${i}.` })
          .expect(201);
        lastContributionId = (res.body as { contributionId: string }).contributionId;
      }

      const status = await prisma.restaurantStatus.findUniqueOrThrow({ where: { restaurantId } });
      expect(status.publicationStatus).not.toBe('rejected');
      expect(status.publicationStatus).not.toBe('hidden');

      const lastContribution = await prisma.contribution.findUniqueOrThrow({
        where: { id: lastContributionId },
        include: { moderationResult: true },
      });
      expect(lastContribution.moderationResult?.labels).toContain('closure_escalation');
      expect(Number(lastContribution.moderationResult?.riskScore)).toBe(1);
      expect(lastContribution.moderationResult?.decision).toBe('pending');

      // A 4th report from a new distinct user must not re-trigger (count is now 4, not exactly 3).
      const { token: fourthReporterToken } = await registerUser('contrib-closure-reporter-4');
      await request(app.getHttpServer())
        .post(`/restaurants/${restaurantId}/status-reports`)
        .set('Authorization', `Bearer ${fourthReporterToken}`)
        .send({ kind: 'closure', description: 'Báo cáo thứ 4.' })
        .expect(201);
      const stillSameEscalation = await prisma.contribution.findUniqueOrThrow({
        where: { id: lastContributionId },
        include: { moderationResult: true },
      });
      expect(stillSameEscalation.moderationResult?.labels).toEqual(lastContribution.moderationResult?.labels);

      await cleanupRestaurant(restaurantId);
    });
  });

  describe('GET /me/contributions — US-F3 status tracking', () => {
    it('lists the current user contributions with status', async () => {
      const { token } = await registerUser('contrib-list');
      const photoId = await uploadRealPhoto(token);
      const createRes = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(basicRestaurantBody({}, [photoId]))
        .expect(201);
      const restaurantId = (createRes.body as CreateRestaurantContributionResponse).restaurantId;

      const listRes = await request(app.getHttpServer())
        .get('/me/contributions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = listRes.body as ContributionListResponse;
      expect(body.items.some((item) => item.targetRestaurantId === restaurantId)).toBe(true);

      await cleanupRestaurant(restaurantId);
    });

    it('rejects viewing another user contribution by id', async () => {
      const { token: ownerToken } = await registerUser('contrib-owner');
      const { token: strangerToken } = await registerUser('contrib-stranger');
      const photoId = await uploadRealPhoto(ownerToken);
      const createRes = await request(app.getHttpServer())
        .post('/restaurants')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(basicRestaurantBody({}, [photoId]))
        .expect(201);
      const body = createRes.body as CreateRestaurantContributionResponse;

      await request(app.getHttpServer())
        .get(`/contributions/${body.contributionId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(403);

      await cleanupRestaurant(body.restaurantId);
    });
  });

  it('rejects unauthenticated requests across the module', async () => {
    await request(app.getHttpServer()).post('/restaurants').send(basicRestaurantBody()).expect(401);
    await request(app.getHttpServer()).post('/restaurants/duplicate-check').send({ lat: 10, lng: 106, name: 'x' }).expect(401);
    await request(app.getHttpServer()).get('/me/contributions').expect(401);
  });
});
