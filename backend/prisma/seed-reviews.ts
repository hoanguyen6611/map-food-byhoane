// Extends prisma/seed-restaurants.ts with the review data required by the
// Demo Data Plan (docs/10-portfolio-presentation.md §2) and the Definition
// of Done in docs/build-prompts/06-reviews-scoring.md: 8-20 varied reviews
// per restaurant (not all 5-star, so composite-score damping is visible),
// across distinct simulated users, while deliberately leaving a handful of
// restaurants with 0-1 reviews to exercise the "not enough data" empty
// states honestly. Re-runnable: any restaurant that already has reviews is
// skipped, so running this twice never creates duplicates.
import { Prisma, PrismaClient } from '@prisma/client';
import { calculateCompositeScore } from '../src/modules/review/composite-score.util';

const prisma = new PrismaClient();

// ---------- Simulated reviewer pool ----------
// These accounts exist only to attribute seeded reviews to distinct
// "people" for demo realism — they have no password/OAuth identity and can
// never actually log in, unlike real registered users.
const REVIEWER_NAMES = [
  'Minh Anh', 'Thu Hà', 'Quốc Bảo', 'Ngọc Linh', 'Đức Huy', 'Phương Thảo', 'Anh Tuấn', 'Bích Ngọc',
  'Hoàng Long', 'Thanh Tâm', 'Gia Bảo', 'Khánh Vy', 'Việt Hoàng', 'Mai Trang', 'Đình Phong', 'Thảo Nguyên',
  'Tuấn Kiệt', 'Hồng Nhung', 'Xuân Mai', 'Nhật Minh', 'Bảo Trân', 'Công Danh', 'Diệu Linh', 'Thành Đạt',
  'Yến Nhi', 'Trọng Nghĩa', 'Kim Ngân', 'Hải Đăng', 'Ánh Dương', 'Minh Thư', 'Duy Khang', 'Lan Anh',
  'Quang Huy', 'Bảo Ngọc', 'Tấn Phát', 'Thùy Dương', 'Văn Toàn', 'Ngọc Hân', 'Hữu Nghị', 'Cẩm Tú',
  'Chí Cường', 'Diễm My', 'Sơn Tùng', 'Vân Anh', 'Đăng Khoa', 'Thảo Vy', 'Minh Quân', 'Hải Yến',
];

const DISH_POOL = [
  'Phở bò', 'Bún chả', 'Cơm tấm', 'Bánh xèo', 'Cà phê sữa đá', 'Trà đào', 'Gỏi cuốn', 'Bún riêu',
  'Hủ tiếu', 'Bánh mì', 'Chè thái', 'Nem nướng',
];

interface CommentPool {
  positive: string[];
  mixed: string[];
  negative: string[];
}

const COMMENTS: CommentPool = {
  positive: [
    'Đồ ăn ngon, không gian thoải mái, chắc chắn sẽ quay lại.',
    'Nhân viên phục vụ nhiệt tình, món ăn đậm đà đúng vị.',
    'Giá hợp lý so với chất lượng, rất đáng thử.',
    'Quán sạch sẽ, đồ ăn nóng hổi, phục vụ nhanh.',
    'Một trong những quán ngon nhất khu vực này.',
    'Không gian dễ chịu, thích hợp đi cùng bạn bè.',
  ],
  mixed: [
    'Đồ ăn ổn nhưng phải chờ hơi lâu vào giờ cao điểm.',
    'Món chính ngon nhưng giá hơi nhỉnh so với mặt bằng chung.',
    'Không gian nhỏ, hơi ồn vào cuối tuần nhưng đồ ăn được.',
    'Phục vụ bình thường, đồ ăn tạm ổn, có thể thử lại.',
    'Chất lượng không đồng đều giữa các lần ghé.',
  ],
  negative: [
    'Chờ khá lâu mới có đồ ăn, nhân viên có vẻ quá tải.',
    'Món ăn hôm nay hơi nhạt so với lần trước.',
    'Không gian chật, chỗ để xe khó khăn.',
    'Giá hơi cao so với khẩu phần được phục vụ.',
  ],
};

const CRITERIA_CODES = ['food_quality', 'space', 'price', 'service', 'hygiene', 'wifi', 'parking'];

function choice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sample<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  const result: T[] = [];
  while (result.length < n && pool.length > 0) {
    result.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return result;
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

type Tier = 'great' | 'good' | 'mixed';

function sampleOverallRating(tier: Tier): number {
  const pools: Record<Tier, number[]> = {
    great: [4, 5, 5, 5, 5],
    good: [3, 4, 4, 4, 5],
    mixed: [2, 3, 3, 4, 4, 5],
  };
  return choice(pools[tier]);
}

function pickComment(overallRating: number): string {
  if (overallRating >= 5) return choice(COMMENTS.positive);
  if (overallRating >= 4) return choice([...COMMENTS.positive, ...COMMENTS.mixed]);
  if (overallRating >= 3) return choice(COMMENTS.mixed);
  return choice(COMMENTS.negative);
}

async function main() {
  console.log('Seeding reviews for the Module 6 demo dataset...');

  const restaurants = await prisma.restaurant.findMany({
    where: { deletedAt: null },
    include: { priceRange: true },
  });
  if (restaurants.length === 0) {
    console.log('No restaurants found — run prisma/seed-restaurants.ts first.');
    return;
  }

  const criteria = await prisma.reviewCriteria.findMany();
  const criteriaByCode = new Map(criteria.map((c) => [c.code, c]));

  const userRole = await prisma.role.findUniqueOrThrow({ where: { code: 'user' } });
  const reviewerIds: string[] = [];
  for (let i = 0; i < REVIEWER_NAMES.length; i++) {
    const email = `demo-reviewer-${i + 1}@seed.local`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      reviewerIds.push(existing.id);
      continue;
    }
    const user = await prisma.user.create({
      data: {
        email,
        roleId: userRole.id,
        status: 'active',
        profile: { create: { displayName: REVIEWER_NAMES[i] } },
      },
    });
    reviewerIds.push(user.id);
  }

  // ≥5 restaurants deliberately left at 0-1 reviews (Demo Data Plan) — picked
  // up front so the choice doesn't depend on iteration order.
  const shuffledForSparse = sample(restaurants, restaurants.length);
  const sparseIds = new Set(shuffledForSparse.slice(0, 6).map((r) => r.id));

  let seededRestaurants = 0;
  let skippedExisting = 0;

  for (const restaurant of restaurants) {
    const existingCount = await prisma.review.count({ where: { restaurantId: restaurant.id } });
    if (existingCount > 0) {
      skippedExisting++;
      continue;
    }

    const isSparse = sparseIds.has(restaurant.id);
    const targetCount = isSparse ? Math.floor(Math.random() * 2) : 8 + Math.floor(Math.random() * 13); // 0-1 or 8-20
    if (targetCount === 0) {
      console.log(`  + [0 reviews, deliberately sparse] ${restaurant.name}`);
      continue;
    }

    const chosenReviewers = sample(reviewerIds, Math.min(targetCount, reviewerIds.length));
    const tier: Tier = choice(['great', 'good', 'mixed']);
    const priceMin = restaurant.priceRange?.minVnd ?? 20_000;
    const priceMax = restaurant.priceRange?.maxVnd ?? priceMin + 100_000;

    for (const reviewerId of chosenReviewers) {
      const overallRating = sampleOverallRating(tier);
      const numCriteria = 1 + Math.floor(Math.random() * 4); // 1-4 criteria rated per review
      const criteriaSample = sample(CRITERIA_CODES, numCriteria);
      const daysAgo = Math.floor(Math.random() * 365);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const hasBillTotal = Math.random() < 0.6;
      const hasDishes = Math.random() < 0.5;
      const hasPartySize = Math.random() < 0.6;

      await prisma.review.create({
        data: {
          userId: reviewerId,
          restaurantId: restaurant.id,
          overallRating,
          comment: pickComment(overallRating),
          dishesOrdered: hasDishes ? sample(DISH_POOL, 1 + Math.floor(Math.random() * 2)) : [],
          billTotalVnd: hasBillTotal ? Math.round((priceMin + Math.random() * (priceMax - priceMin)) / 5000) * 5000 : undefined,
          partySize: hasPartySize ? 1 + Math.floor(Math.random() * 5) : undefined,
          wouldReturn: overallRating >= 4,
          status: 'published',
          createdAt,
          updatedAt: createdAt,
          ratings: {
            create: criteriaSample.map((code) => ({
              criteriaId: criteriaByCode.get(code)!.id,
              score: clampScore(overallRating + (Math.random() - 0.5) * 2),
            })),
          },
        },
      });
    }

    console.log(`  + [${chosenReviewers.length} reviews, tier=${tier}] ${restaurant.name}`);
    seededRestaurants++;
  }

  console.log('Recomputing composite scores for all restaurants...');
  const globalAgg = await prisma.review.aggregate({
    where: { status: 'published', deletedAt: null },
    _avg: { overallRating: true },
  });
  const globalPriorMean = globalAgg._avg.overallRating ?? 3.5;

  for (const restaurant of restaurants) {
    const agg = await prisma.review.aggregate({
      where: { restaurantId: restaurant.id, status: 'published', deletedAt: null },
      _avg: { overallRating: true },
      _count: { _all: true },
    });
    const v = agg._count._all;
    const R = agg._avg.overallRating ?? 0;
    const compositeScore = calculateCompositeScore(v, R, globalPriorMean);
    const lastReview = await prisma.review.findFirst({
      where: { restaurantId: restaurant.id, status: 'published', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    await prisma.restaurantStatus.update({
      where: { restaurantId: restaurant.id },
      data: {
        compositeScore: compositeScore === null ? null : new Prisma.Decimal(compositeScore.toFixed(2)),
        reviewCount: v,
        lastReviewAt: lastReview?.createdAt ?? null,
        lastComputedAt: new Date(),
      },
    });
  }

  console.log(
    `Done. Seeded reviews for ${seededRestaurants} restaurants, skipped ${skippedExisting} (already had reviews), global prior mean C=${globalPriorMean.toFixed(2)}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
