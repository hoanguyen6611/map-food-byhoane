import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import sharp from 'sharp';
import type {
  AdminModerationQueueItemDto,
  AuthResponse,
  CreateRestaurantContributionResponse,
  CreateUploadUrlResponse,
  NotificationListResponse,
  Paginated,
  ReviewDto,
} from '@foodmap/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClaudeGatewayService } from '../src/modules/ai/claude-gateway.service';
import { buildMockClaudeGateway } from './helpers/mock-claude-gateway';

// Covers US-I2/I3 and the Admin Moderation Queue half of
// build-prompts/07-contribution-media-moderation-ai.md's Definition of
// Done — the "AI risk score/reason" now comes from the real Claude adapter
// (ReviewModerationService -> ClaudeGatewayService), but this sandbox has no
// real ANTHROPIC_API_KEY, so ClaudeGatewayService is overridden with a
// deterministic test double (see helpers/mock-claude-gateway.ts) that
// reproduces the exact spam-signal labels submitSpammyReview()'s fixture
// text is designed to trigger. The hard-rule invariant itself is proven at
// the unit level (moderation-decision.util.spec.ts); this file proves the
// legitimate human-decision path works end-to-end through the real HTTP API.
describe('Admin Moderation Queue (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let realJpeg: Buffer;
  let seededRestaurantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClaudeGatewayService)
      .useValue(buildMockClaudeGateway())
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    realJpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 40, g: 40, b: 220 } } }).jpeg().toBuffer();

    const restaurant = await prisma.restaurant.findFirst({ where: { deletedAt: null, status: { publicationStatus: 'published' } } });
    if (!restaurant) throw new Error('No published restaurant in the dev DB — run prisma/seed-restaurants.ts first.');
    seededRestaurantId = restaurant.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (label: string) => `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const authBody = (res: request.Response) => res.body as AuthResponse;

  async function registerUser(label: string): Promise<{ token: string; userId: string; email: string }> {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password123' }).expect(201);
    const body = authBody(res);
    return { token: body.accessToken, userId: body.user.id, email };
  }

  async function registerElevated(label: string, roleCode: 'admin' | 'moderator'): Promise<{ token: string; userId: string }> {
    const { userId, email } = await registerUser(label);
    const roleRow = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    await prisma.user.update({ where: { id: userId }, data: { roleId: roleRow.id } });
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'password123' }).expect(200);
    return { token: authBody(login).accessToken, userId };
  }

  async function submitSpammyReview(token: string): Promise<{ reviewId: string; moderationResultId: string }> {
    const res = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        restaurantId: seededRestaurantId,
        overallRating: 5,
        comment: 'kiếm tiền online dễ dàng, xem tại https://spam.example.com nhé',
        ratings: [{ criteriaCode: 'food_quality', score: 5 }],
      })
      .expect(201);
    const review = res.body as ReviewDto;
    const moderationResult = await prisma.moderationResult.findFirstOrThrow({ where: { targetType: 'review', targetId: review.id } });
    return { reviewId: review.id, moderationResultId: moderationResult.id };
  }

  async function cleanupReview(reviewId: string): Promise<void> {
    await prisma.moderationResult.deleteMany({ where: { targetType: 'review', targetId: reviewId } });
    await prisma.reviewRating.deleteMany({ where: { reviewId } });
    await prisma.review.deleteMany({ where: { id: reviewId } });
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

  async function cleanupRestaurant(id: string): Promise<void> {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) return;
    await prisma.photo.deleteMany({ where: { ownerType: 'restaurant', ownerId: id } });
    await prisma.contribution.deleteMany({ where: { targetRestaurantId: id } });
    await prisma.restaurantStatus.deleteMany({ where: { restaurantId: id } });
    await prisma.restaurant.delete({ where: { id } });
    await prisma.address.delete({ where: { id: restaurant.addressId } });
    await prisma.location.delete({ where: { id: restaurant.locationId } });
  }

  it('rejects unauthenticated and non-elevated access to the queue', async () => {
    await request(app.getHttpServer()).get('/admin/moderation-queue').expect(401);
    const { token } = await registerUser('queue-plain-user');
    await request(app.getHttpServer()).get('/admin/moderation-queue').set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('lists a flagged review with risk score, labels, reason, and submitter name', async () => {
    const { token: authorToken } = await registerUser('queue-review-author');
    const { token: modToken } = await registerElevated('queue-review-mod', 'moderator');
    const { reviewId } = await submitSpammyReview(authorToken);

    const res = await request(app.getHttpServer())
      .get('/admin/moderation-queue')
      .query({ targetType: 'review' })
      .set('Authorization', `Bearer ${modToken}`)
      .expect(200);
    const body = res.body as Paginated<AdminModerationQueueItemDto>;
    const item = body.items.find((i) => i.targetId === reviewId);
    expect(item).toBeDefined();
    expect(item?.riskScore).toBeGreaterThan(0);
    expect(item?.labels).toEqual(expect.arrayContaining(['contains_url', 'spam_phrase']));
    expect(item?.aiReason).toContain('contains_url');
    expect(item?.decision).toBe('pending');

    await cleanupReview(reviewId);
  });

  it('blocks reject/edit_requested without a reason (server-side), both for moderator and admin', async () => {
    const { token: authorToken } = await registerUser('queue-reason-author');
    const { token: modToken } = await registerElevated('queue-reason-mod', 'moderator');
    const { reviewId, moderationResultId } = await submitSpammyReview(authorToken);

    await request(app.getHttpServer())
      .post(`/admin/moderation-queue/${moderationResultId}/decision`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ decision: 'rejected' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/admin/moderation-queue/${moderationResultId}/decision`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ decision: 'edit_requested' })
      .expect(400);

    await cleanupReview(reviewId);
  });

  it('a moderator can reject with a reason — updates review status, writes AuditLog, creates a Notification for the author', async () => {
    const { token: authorToken, userId: authorId } = await registerUser('queue-reject-author');
    const { token: modToken, userId: modId } = await registerElevated('queue-reject-mod', 'moderator');
    const { reviewId, moderationResultId } = await submitSpammyReview(authorToken);

    await request(app.getHttpServer())
      .post(`/admin/moderation-queue/${moderationResultId}/decision`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ decision: 'rejected', reason: 'Nội dung quảng cáo trái phép.' })
      .expect(204);

    const review = await prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
    expect(review.status).toBe('rejected');

    const auditRow = await prisma.auditLog.findFirst({ where: { action: 'moderation.rejected', targetId: reviewId } });
    expect(auditRow?.actorId).toBe(modId);

    const notificationsRes = await request(app.getHttpServer())
      .get('/me/notifications')
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(200);
    const notifications = notificationsRes.body as NotificationListResponse;
    expect(notifications.items.some((n) => n.payload.body.includes('quảng cáo trái phép'))).toBe(true);

    // Re-deciding an already-decided item is blocked.
    await request(app.getHttpServer())
      .post(`/admin/moderation-queue/${moderationResultId}/decision`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ decision: 'approved' })
      .expect(409);

    await prisma.notification.deleteMany({ where: { userId: authorId } });
    await cleanupReview(reviewId);
  });

  it('both admin and moderator can decide (not admin-only, unlike restaurant hard-delete)', async () => {
    const { token: authorToken } = await registerUser('queue-bothroles-author');
    const { token: adminToken } = await registerElevated('queue-bothroles-admin', 'admin');
    const { reviewId, moderationResultId } = await submitSpammyReview(authorToken);

    await request(app.getHttpServer())
      .post(`/admin/moderation-queue/${moderationResultId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'approved' })
      .expect(204);

    const review = await prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
    expect(review.status).toBe('published');

    await cleanupReview(reviewId);
  });

  it('approving a held contribution publishes the restaurant (ContributionFinalizeService dispatch)', async () => {
    const { token: submitterToken, userId: submitterId } = await registerUser('queue-contrib-submitter');
    const { token: modToken } = await registerElevated('queue-contrib-mod', 'moderator');
    const photoId = await uploadRealPhoto(submitterToken);

    const createRes = await request(app.getHttpServer())
      .post('/restaurants')
      .set('Authorization', `Bearer ${submitterToken}`)
      .send({
        name: `Queue Contrib Test ${Date.now()}`,
        categoryCode: 'quan_an',
        description: 'kiếm tiền online dễ dàng, xem tại https://spam.example.com nhé', // force hold_for_review
        address: { line: '1 Queue St', district: 'Quận Test', province: 'TP. Test' },
        location: { lat: 10.95, lng: 106.95 },
        photoIds: [photoId],
      })
      .expect(201);
    const created = createRes.body as CreateRestaurantContributionResponse;
    expect(created.status).toBe('in_review');

    const moderationResult = await prisma.moderationResult.findFirstOrThrow({ where: { targetType: 'contribution', targetId: created.contributionId } });

    await request(app.getHttpServer())
      .post(`/admin/moderation-queue/${moderationResult.id}/decision`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ decision: 'approved' })
      .expect(204);

    await request(app.getHttpServer()).get(`/restaurants/${created.restaurantId}`).expect(200);
    const status = await prisma.restaurantStatus.findUniqueOrThrow({ where: { restaurantId: created.restaurantId } });
    expect(status.publicationStatus).toBe('published');

    const contribution = await prisma.contribution.findUniqueOrThrow({ where: { id: created.contributionId } });
    expect(contribution.status).toBe('approved');

    await prisma.notification.deleteMany({ where: { userId: submitterId } });
    await cleanupRestaurant(created.restaurantId);
  });

  it('surfaces related reports for the same target restaurant on a contribution queue item', async () => {
    const { token: submitterToken } = await registerUser('queue-related-submitter');
    const { token: reporterToken } = await registerUser('queue-related-reporter');
    const { token: modToken } = await registerElevated('queue-related-mod', 'moderator');
    const photoId = await uploadRealPhoto(submitterToken);

    const createRes = await request(app.getHttpServer())
      .post('/restaurants')
      .set('Authorization', `Bearer ${submitterToken}`)
      .send({
        name: `Queue Related Reports Test ${Date.now()}`,
        categoryCode: 'quan_an',
        description: 'click vào link https://x.com kiếm tiền online',
        address: { line: '1 Related St', district: 'Quận Test', province: 'TP. Test' },
        location: { lat: 10.96, lng: 106.96 },
        photoIds: [photoId],
      })
      .expect(201);
    const created = createRes.body as CreateRestaurantContributionResponse;
    expect(created.status).toBe('in_review');

    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ targetType: 'restaurant', targetId: created.restaurantId, reason: 'incorrect_info' })
      .expect(201);

    const moderationResult = await prisma.moderationResult.findFirstOrThrow({ where: { targetType: 'contribution', targetId: created.contributionId } });
    const queueRes = await request(app.getHttpServer())
      .get('/admin/moderation-queue')
      .query({ targetType: 'contribution' })
      .set('Authorization', `Bearer ${modToken}`)
      .expect(200);
    const body = queueRes.body as Paginated<AdminModerationQueueItemDto>;
    const item = body.items.find((i) => i.id === moderationResult.id);
    expect(item?.relatedReports.length).toBeGreaterThan(0);
    expect(item?.relatedReports[0].targetId).toBe(created.restaurantId);

    await prisma.report.deleteMany({ where: { targetId: created.restaurantId } });
    await cleanupRestaurant(created.restaurantId);
  });
});
