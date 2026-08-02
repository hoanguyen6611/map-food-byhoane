// Demo-only stopgap for docs/build-prompts/08-favorites-notifications-polish.md.
//
// There is no real Notification producer yet — that's
// docs/build-prompts/07-contribution-media-moderation-ai.md's moderation
// queue, which writes a real row whenever a moderator decides on a
// review/contribution. Since Module 7 hasn't been built, no account can
// generate a real notification through normal use yet.
//
// Rather than attach fake notifications to the unreachable demo-reviewer-*
// ghost accounts from seed-reviews.ts (they have no password and can never
// log in, so nobody could ever see them), this script attaches a few
// realistic example notifications to a REAL account you specify by email —
// register a test account in the app first, then run:
//
//   npx ts-node prisma/seed-notifications.ts your-email@example.com
//
// Re-running for the same email adds another batch (not idempotent by
// design — these are throwaway demo rows, safe to accumulate or wipe with
// `DELETE FROM notifications;` in psql).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: npx ts-node prisma/seed-notifications.ts <your-registered-email>');
    console.log('Register a test account in the app first, then run this with that email.');
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`No user found with email ${email} — register that account first.`);
    return;
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: { deletedAt: null, status: { publicationStatus: 'published' } },
    orderBy: { createdAt: 'asc' },
  });

  const notifications = [
    {
      type: 'moderation_result' as const,
      payload: {
        title: 'Đánh giá của bạn đã được duyệt',
        body: restaurant ? `Đánh giá bạn viết cho "${restaurant.name}" đã được đăng công khai.` : 'Đánh giá của bạn đã được đăng công khai.',
        deepLink: { screen: 'Reviews', restaurantId: restaurant?.id },
      },
      isRead: false,
    },
    {
      type: 'contribution_status' as const,
      payload: {
        title: 'Quán bạn đề xuất đang được xem xét',
        body: 'Đóng góp thêm quán ăn mới của bạn đang chờ kiểm duyệt viên duyệt.',
        deepLink: { screen: 'SubmissionStatus' },
      },
      isRead: false,
    },
    {
      type: 'report_resolved' as const,
      payload: {
        title: 'Báo cáo của bạn đã được xử lý',
        body: 'Cảm ơn bạn đã báo cáo nội dung không phù hợp — chúng tôi đã xem xét và xử lý.',
        deepLink: { screen: 'Reviews', restaurantId: restaurant?.id },
      },
      isRead: true,
    },
  ];

  await prisma.notification.createMany({
    data: notifications.map((n) => ({
      userId: user.id,
      type: n.type,
      payload: n.payload,
      isRead: n.isRead,
    })),
  });

  console.log(`Seeded ${notifications.length} demo notifications for ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
