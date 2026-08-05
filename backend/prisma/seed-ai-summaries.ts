// Demo-only stopgap for docs/build-prompts/07-contribution-media-moderation-ai.md's
// AI Summary (US-J1/J2) — read-side only this pass, no real Claude
// summarize() call exists (see src/modules/ai/ai-summary-trigger.stub.ts).
// Seeds a couple of demo AISummary rows for restaurants that already have
// enough seeded reviews (>= AI_SUMMARY_MIN_REVIEW_COUNT, default 5) so the
// read-side API/UI has real data to render in dev.
//
// Idempotent (upsert on restaurantId) — safe to re-run.
//
//   npx ts-node prisma/seed-ai-summaries.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MIN_REVIEW_COUNT = Number(process.env.AI_SUMMARY_MIN_REVIEW_COUNT ?? '5');
const MODEL_VERSION = 'seed-demo-v1';

async function main() {
  const eligible = await prisma.restaurantStatus.findMany({
    where: { reviewCount: { gte: MIN_REVIEW_COUNT }, publicationStatus: 'published' },
    include: { restaurant: true },
    orderBy: { reviewCount: 'desc' },
    take: 3,
  });

  if (eligible.length === 0) {
    console.log(`No restaurant has >= ${MIN_REVIEW_COUNT} reviews yet — run prisma/seed-reviews.ts first.`);
    return;
  }

  for (const status of eligible) {
    await prisma.aISummary.upsert({
      where: { restaurantId: status.restaurantId },
      create: {
        restaurantId: status.restaurantId,
        summaryText: `${status.restaurant.name} được thực khách đánh giá cao về hương vị và không gian. Đa số ý kiến tích cực ghi nhận chất lượng món ăn ổn định qua nhiều lượt ghé thăm.`,
        pros: ['Món ăn ngon, đúng vị', 'Phục vụ nhiệt tình', 'Không gian sạch sẽ'],
        cons: ['Giờ cao điểm khá đông', 'Chỗ đậu xe hạn chế'],
        sourceReviewCount: status.reviewCount,
        modelVersion: MODEL_VERSION,
        generatedAt: new Date(),
      },
      update: {
        sourceReviewCount: status.reviewCount,
        modelVersion: MODEL_VERSION,
        generatedAt: new Date(),
      },
    });
    console.log(`Seeded AI summary for "${status.restaurant.name}" (${status.reviewCount} reviews).`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
