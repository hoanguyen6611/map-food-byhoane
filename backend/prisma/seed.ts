// Reference/catalog data only (Module 1 scope) — Role, Permission,
// RestaurantCategory, Cuisine, PriceRange, per docs/06-database-erd.md.
// Real restaurant seed data (30-50 places) is added by
// docs/build-prompts/05-restaurant-detail-admin-seed.md.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES: { code: 'guest' | 'user' | 'moderator' | 'admin' | 'owner'; label: string }[] = [
  { code: 'guest', label: 'Khách' },
  { code: 'user', label: 'Người dùng' },
  { code: 'moderator', label: 'Kiểm duyệt viên' },
  { code: 'admin', label: 'Quản trị viên' },
  { code: 'owner', label: 'Chủ quán' },
];

// Minimal starter permission set — extended as later build-prompt modules
// (02-auth.md RBAC guard, 05/07's admin actions) need finer-grained checks.
const PERMISSIONS: { code: string; description: string }[] = [
  { code: 'restaurant.create', description: 'Tạo quán ăn mới' },
  { code: 'restaurant.edit', description: 'Chỉnh sửa thông tin quán' },
  { code: 'restaurant.delete', description: 'Xoá/ẩn quán' },
  { code: 'review.moderate', description: 'Duyệt/từ chối đánh giá' },
  { code: 'contribution.moderate', description: 'Duyệt/từ chối đóng góp cộng đồng' },
  { code: 'user.suspend', description: 'Tạm khoá tài khoản người dùng' },
  { code: 'user.manage_roles', description: 'Thay đổi vai trò người dùng' },
];

// admin: everything. moderator: moderation-only, no destructive/role actions
// (see docs/01-prd-mvp.md §10.11 business rule). user/guest/owner: none yet.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: PERMISSIONS.map((p) => p.code),
  moderator: ['review.moderate', 'contribution.moderate'],
};

const RESTAURANT_CATEGORIES = [
  { code: 'quan_an', label: 'Quán ăn' },
  { code: 'quan_ca_phe', label: 'Quán cà phê' },
  { code: 'nha_hang', label: 'Nhà hàng' },
  { code: 'xe_day', label: 'Xe đẩy' },
  { code: 'quan_via_he', label: 'Quán vỉa hè' },
  { code: 'quan_bar', label: 'Quán bar' },
];

const CUISINES = [
  { code: 'mon_viet', label: 'Món Việt' },
  { code: 'mon_han', label: 'Món Hàn' },
  { code: 'mon_nhat', label: 'Món Nhật' },
  { code: 'mon_chay', label: 'Món chay' },
  { code: 'mon_thai', label: 'Món Thái' },
  { code: 'mon_au', label: 'Món Âu' },
];

const PRICE_RANGES = [
  { code: 'under_50k', minVnd: 0, maxVnd: 50_000 },
  { code: '50_100k', minVnd: 50_000, maxVnd: 100_000 },
  { code: '100_200k', minVnd: 100_000, maxVnd: 200_000 },
  { code: '200_500k', minVnd: 200_000, maxVnd: 500_000 },
  { code: 'above_500k', minVnd: 500_000, maxVnd: null },
];

// MVP set per docs/06-database-erd.md §5 — all `appliesToCategory: null`
// (applies to all categories); the V1 extension list (menu_accuracy,
// wait_time, etc.) is explicitly out of scope until then.
const REVIEW_CRITERIA = [
  { code: 'food_quality', label: 'Chất lượng món ăn' },
  { code: 'space', label: 'Không gian' },
  { code: 'price', label: 'Giá cả' },
  { code: 'service', label: 'Phục vụ' },
  { code: 'hygiene', label: 'Vệ sinh' },
  { code: 'wifi', label: 'Wifi' },
  { code: 'parking', label: 'Chỗ để xe' },
];

async function main() {
  console.log('Seeding reference data...');

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { label: role.label },
      create: role,
    });
  }

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode as any } });
    for (const permissionCode of permissionCodes) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code: permissionCode },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  for (const category of RESTAURANT_CATEGORIES) {
    await prisma.restaurantCategory.upsert({
      where: { code: category.code },
      update: { label: category.label },
      create: category,
    });
  }

  for (const cuisine of CUISINES) {
    await prisma.cuisine.upsert({
      where: { code: cuisine.code },
      update: { label: cuisine.label },
      create: cuisine,
    });
  }

  for (const priceRange of PRICE_RANGES) {
    await prisma.priceRange.upsert({
      where: { code: priceRange.code },
      update: { minVnd: priceRange.minVnd, maxVnd: priceRange.maxVnd },
      create: priceRange,
    });
  }

  for (const criteria of REVIEW_CRITERIA) {
    await prisma.reviewCriteria.upsert({
      where: { code: criteria.code },
      update: { label: criteria.label },
      create: criteria,
    });
  }

  console.log('Reference data seeded.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
