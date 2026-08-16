// The real 30-50 place demo dataset per docs/10-portfolio-presentation.md §2
// (Demo Data Plan) and the Definition of Done in
// docs/build-prompts/05-restaurant-detail-admin-seed.md. Supersedes
// seed-test-restaurants.ts (Module 3/4's throwaway 8-place fixture) — run
// that file's cleanup (or a fresh DB) before running this one to avoid
// duplicate/confusing data in local dev.
//
// Reviews are deliberately NOT seeded here — Module 6
// (docs/build-prompts/06-reviews-scoring.md) doesn't exist yet, and the
// build prompt explicitly defers review seeding to that module. Every place
// below is a fictional composite (name + address are plausible but
// invented), per this module's ethical/legal note: never impersonate a real
// business with fabricated data in a public portfolio artifact.
import { PrismaClient, type FacilityType, type PhotoOwnerType } from '@prisma/client';
import { slugify } from '../src/common/slug.util';

const prisma = new PrismaClient();

// ---------- Districts (real HCMC areas, approximate centers) ----------

interface DistrictSeed {
  name: string;
  center: { lat: number; lng: number };
  wards: string[];
  streets: string[];
}

const DISTRICTS: DistrictSeed[] = [
  {
    name: 'Quận 1',
    center: { lat: 10.7769, lng: 106.7009 },
    wards: ['Bến Nghé', 'Bến Thành', 'Đa Kao', 'Nguyễn Thái Bình'],
    streets: ['Lê Thánh Tôn', 'Nguyễn Huệ', 'Đồng Khởi', 'Pasteur', 'Mạc Thị Bưởi', 'Lý Tự Trọng', 'Thái Văn Lung'],
  },
  {
    name: 'Quận 3',
    center: { lat: 10.7843, lng: 106.6822 },
    wards: ['Võ Thị Sáu', 'Phường 6', 'Phường 9', 'Phường 14'],
    streets: ['Nguyễn Thiện Thuật', 'Trần Quốc Thảo', 'Cách Mạng Tháng Tám', 'Lý Chính Thắng', 'Bà Huyện Thanh Quan'],
  },
  {
    name: 'Bình Thạnh',
    center: { lat: 10.8019, lng: 106.7147 },
    wards: ['Phường 25', 'Phường 21', 'Phường 13', 'Phường 17'],
    streets: ['Điện Biên Phủ', 'Xô Viết Nghệ Tĩnh', 'Nguyễn Hữu Cảnh', 'Phan Văn Trị', 'Nguyễn Gia Trí'],
  },
  {
    name: 'Phú Nhuận',
    center: { lat: 10.799, lng: 106.68 },
    wards: ['Phường 3', 'Phường 7', 'Phường 9', 'Phường 11'],
    streets: ['Phan Xích Long', 'Phan Đăng Lưu', 'Nguyễn Văn Trỗi', 'Trần Huy Liệu'],
  },
];

// ---------- Category-specific generation pools ----------

type CategoryCode = 'quan_an' | 'quan_ca_phe' | 'nha_hang' | 'xe_day' | 'quan_via_he' | 'quan_bar';

interface MenuPoolItem {
  name: string;
  category: string;
  priceRange: [number, number];
}

interface CategorySpec {
  code: CategoryCode;
  count: number;
  priceRangeCodes: string[];
  cuisineCodes: string[];
  nameTemplates: () => string | { label: string; cuisine: string };
  menuPool: MenuPoolItem[];
  // [openTime, closeTime] candidates; overnight = closeTime < openTime.
  hoursCandidates: [string, string][];
}

const OWNER_TAGS = ['Cô Ba', 'Chú Tư', 'Bà Năm', 'Dì Sáu', 'Anh Hai', 'Cô Út', 'Ông Bảy', 'Chị Tám', 'Cô Lan', 'Chú Minh'];
const STREET_FOOD_DISHES = [
  'Bún Bò Huế', 'Phở Bò', 'Bún Chả', 'Cơm Tấm', 'Bánh Xèo', 'Hủ Tiếu Nam Vang',
  'Bún Riêu', 'Mì Quảng', 'Bún Thang', 'Cháo Lòng', 'Bánh Canh Cua', 'Cơm Gà',
  'Bún Mắm', 'Bò Kho', 'Gỏi Cuốn', 'Chả Cá',
];
const CAFE_ADJECTIVES = [
  'Sương Sớm', 'Hẻm Nhỏ', 'Vợt', 'Xưa', 'Góc Phố', 'Vườn', 'Vọng', 'Phin Cũ', 'Sân Thượng', 'Nắng',
];
const STREET_CART_DISHES = [
  'Bánh Mì', 'Bánh Tráng Trộn', 'Bột Chiên', 'Xôi Mặn', 'Chè', 'Nem Nướng', 'Ốc', 'Gỏi Khô Bò',
];
const RESTAURANT_CUISINE_NAMES = [
  { label: 'Nhật Bản', cuisine: 'mon_nhat' },
  { label: 'Hàn Quốc', cuisine: 'mon_han' },
  { label: 'Thái Lan', cuisine: 'mon_thai' },
  { label: 'Âu', cuisine: 'mon_au' },
  { label: 'Việt', cuisine: 'mon_viet' },
];
const BAR_NAMES = ['Blue Moon', 'Sài Gòn Nights', 'The Rooftop', 'Old Compass', 'Firefly', 'Red Lantern'];

const CATEGORY_SPECS: CategorySpec[] = [
  {
    code: 'quan_an',
    count: 16,
    priceRangeCodes: ['under_50k', '50_100k'],
    cuisineCodes: ['mon_viet', 'mon_chay'],
    nameTemplates: () => `Quán ${choice(STREET_FOOD_DISHES)} ${choice(OWNER_TAGS)}`,
    menuPool: [
      { name: 'Phở bò tái', category: 'Món chính', priceRange: [45000, 60000] },
      { name: 'Phở bò chín', category: 'Món chính', priceRange: [45000, 60000] },
      { name: 'Bún bò Huế', category: 'Món chính', priceRange: [40000, 55000] },
      { name: 'Bún chả Hà Nội', category: 'Món chính', priceRange: [40000, 55000] },
      { name: 'Cơm tấm sườn bì chả', category: 'Món chính', priceRange: [35000, 50000] },
      { name: 'Bánh xèo', category: 'Món chính', priceRange: [30000, 45000] },
      { name: 'Hủ tiếu Nam Vang', category: 'Món chính', priceRange: [35000, 50000] },
      { name: 'Bún riêu cua', category: 'Món chính', priceRange: [30000, 45000] },
      { name: 'Mì Quảng', category: 'Món chính', priceRange: [35000, 50000] },
      { name: 'Cháo lòng', category: 'Món chính', priceRange: [25000, 40000] },
      { name: 'Bánh canh cua', category: 'Món chính', priceRange: [35000, 50000] },
      { name: 'Cơm gà xối mỡ', category: 'Món chính', priceRange: [35000, 50000] },
      { name: 'Bò kho bánh mì', category: 'Món chính', priceRange: [35000, 45000] },
      { name: 'Gỏi cuốn tôm thịt', category: 'Khai vị', priceRange: [25000, 35000] },
      { name: 'Canh chua cá lóc', category: 'Món chính', priceRange: [45000, 60000] },
      { name: 'Rau muống xào tỏi', category: 'Món phụ', priceRange: [20000, 30000] },
      { name: 'Trà đá', category: 'Nước uống', priceRange: [3000, 5000] },
      { name: 'Nước sâm', category: 'Nước uống', priceRange: [10000, 15000] },
    ],
    hoursCandidates: [
      ['06:00', '21:00'],
      ['06:30', '20:30'],
      ['07:00', '21:30'],
    ],
  },
  {
    code: 'quan_ca_phe',
    count: 10,
    priceRangeCodes: ['under_50k', '50_100k'],
    cuisineCodes: ['mon_viet'],
    nameTemplates: () => `Cà Phê ${choice(CAFE_ADJECTIVES)}`,
    menuPool: [
      { name: 'Cà phê sữa đá', category: 'Cà phê', priceRange: [25000, 35000] },
      { name: 'Cà phê đen đá', category: 'Cà phê', priceRange: [20000, 30000] },
      { name: 'Bạc xỉu', category: 'Cà phê', priceRange: [28000, 38000] },
      { name: 'Cà phê trứng', category: 'Cà phê', priceRange: [35000, 45000] },
      { name: 'Trà đào cam sả', category: 'Trà', priceRange: [35000, 45000] },
      { name: 'Trà vải', category: 'Trà', priceRange: [35000, 45000] },
      { name: 'Sinh tố bơ', category: 'Sinh tố', priceRange: [40000, 50000] },
      { name: 'Sinh tố xoài', category: 'Sinh tố', priceRange: [40000, 50000] },
      { name: 'Nước ép cam', category: 'Nước ép', priceRange: [35000, 45000] },
      { name: 'Nước ép dưa hấu', category: 'Nước ép', priceRange: [35000, 45000] },
      { name: 'Matcha đá xay', category: 'Đá xay', priceRange: [45000, 60000] },
      { name: 'Chocolate đá xay', category: 'Đá xay', priceRange: [45000, 60000] },
      { name: 'Bánh croissant', category: 'Bánh ngọt', priceRange: [30000, 40000] },
      { name: 'Bánh tiramisu', category: 'Bánh ngọt', priceRange: [45000, 55000] },
      { name: 'Bánh flan', category: 'Bánh ngọt', priceRange: [20000, 30000] },
    ],
    hoursCandidates: [
      ['06:30', '22:00'],
      ['07:00', '23:00'],
      ['06:00', '21:00'],
    ],
  },
  {
    code: 'xe_day',
    count: 3,
    priceRangeCodes: ['under_50k'],
    cuisineCodes: ['mon_viet'],
    nameTemplates: () => `Xe ${choice(STREET_CART_DISHES)} ${choice(OWNER_TAGS)}`,
    menuPool: [
      { name: 'Bánh mì thịt nướng', category: 'Món chính', priceRange: [20000, 30000] },
      { name: 'Bánh mì pate chả', category: 'Món chính', priceRange: [18000, 25000] },
      { name: 'Bánh mì xíu mại', category: 'Món chính', priceRange: [20000, 28000] },
      { name: 'Bánh tráng trộn', category: 'Ăn vặt', priceRange: [20000, 30000] },
      { name: 'Bột chiên', category: 'Ăn vặt', priceRange: [20000, 30000] },
      { name: 'Xôi mặn', category: 'Món chính', priceRange: [20000, 30000] },
      { name: 'Xôi gà', category: 'Món chính', priceRange: [25000, 35000] },
      { name: 'Chè thái', category: 'Tráng miệng', priceRange: [15000, 25000] },
      { name: 'Chè đậu đỏ', category: 'Tráng miệng', priceRange: [15000, 22000] },
      { name: 'Nem nướng', category: 'Ăn vặt', priceRange: [25000, 35000] },
    ],
    hoursCandidates: [
      ['15:00', '23:00'],
      ['16:00', '00:00'],
    ],
  },
  {
    code: 'quan_via_he',
    count: 3,
    priceRangeCodes: ['under_50k', '50_100k'],
    cuisineCodes: ['mon_viet'],
    nameTemplates: () => `Quán Vỉa Hè ${choice(STREET_FOOD_DISHES)}`,
    menuPool: [
      { name: 'Ốc luộc', category: 'Hải sản', priceRange: [30000, 45000] },
      { name: 'Ốc xào me', category: 'Hải sản', priceRange: [35000, 50000] },
      { name: 'Gỏi khô bò', category: 'Ăn vặt', priceRange: [25000, 35000] },
      { name: 'Bắp xào', category: 'Ăn vặt', priceRange: [20000, 30000] },
      { name: 'Trứng vịt lộn', category: 'Ăn vặt', priceRange: [10000, 15000] },
      { name: 'Bánh tráng nướng', category: 'Ăn vặt', priceRange: [15000, 25000] },
      { name: 'Súp cua', category: 'Món chính', priceRange: [25000, 35000] },
      { name: 'Chân gà sả tắc', category: 'Ăn vặt', priceRange: [35000, 50000] },
      { name: 'Bia hơi', category: 'Nước uống', priceRange: [10000, 15000] },
    ],
    hoursCandidates: [
      ['17:00', '02:00'],
      ['16:30', '01:00'],
    ],
  },
  {
    code: 'nha_hang',
    count: 4,
    priceRangeCodes: ['100_200k', '200_500k'],
    cuisineCodes: [],
    nameTemplates: () => {
      const c = choice(RESTAURANT_CUISINE_NAMES);
      return { label: `Nhà Hàng ${c.label} ${choice(['Hoa Sen', 'Ngọc Lan', 'Kim Long', 'An Viên', 'Bến Thành'])}`, cuisine: c.cuisine };
    },
    menuPool: [
      { name: 'Súp cua', category: 'Khai vị', priceRange: [80000, 110000] },
      { name: 'Gỏi ngó sen tôm thịt', category: 'Khai vị', priceRange: [90000, 130000] },
      { name: 'Cá hồi áp chảo', category: 'Món chính', priceRange: [180000, 280000] },
      { name: 'Bò lúc lắc', category: 'Món chính', priceRange: [150000, 220000] },
      { name: 'Lẩu thái hải sản', category: 'Món chính', priceRange: [250000, 380000] },
      { name: 'Tôm hùm nướng phô mai', category: 'Món chính', priceRange: [350000, 500000] },
      { name: 'Sườn cừu nướng', category: 'Món chính', priceRange: [220000, 320000] },
      { name: 'Cơm chiên hải sản', category: 'Món chính', priceRange: [90000, 130000] },
      { name: 'Mì xào hải sản', category: 'Món chính', priceRange: [95000, 140000] },
      { name: 'Gà quay lá chanh', category: 'Món chính', priceRange: [160000, 230000] },
      { name: 'Rau câu dừa', category: 'Tráng miệng', priceRange: [40000, 60000] },
      { name: 'Chè khúc bạch', category: 'Tráng miệng', priceRange: [45000, 65000] },
    ],
    hoursCandidates: [
      ['10:30', '22:00'],
      ['11:00', '22:30'],
    ],
  },
  {
    code: 'quan_bar',
    count: 4,
    priceRangeCodes: ['100_200k', '200_500k'],
    cuisineCodes: [],
    nameTemplates: () => `${choice(BAR_NAMES)} Bar & Lounge`,
    menuPool: [
      { name: 'Bia Sài Gòn', category: 'Đồ uống có cồn', priceRange: [30000, 40000] },
      { name: 'Bia Tiger', category: 'Đồ uống có cồn', priceRange: [30000, 40000] },
      { name: 'Heineken', category: 'Đồ uống có cồn', priceRange: [40000, 55000] },
      { name: 'Cocktail Mojito', category: 'Cocktail', priceRange: [110000, 150000] },
      { name: 'Cocktail Margarita', category: 'Cocktail', priceRange: [120000, 160000] },
      { name: 'Rượu vang đỏ (ly)', category: 'Rượu vang', priceRange: [130000, 180000] },
      { name: 'Khô mực nướng', category: 'Đồ nhắm', priceRange: [80000, 120000] },
      { name: 'Nem chua rán', category: 'Đồ nhắm', priceRange: [60000, 90000] },
      { name: 'Cánh gà chiên nước mắm', category: 'Đồ nhắm', priceRange: [90000, 130000] },
      { name: 'Đậu phộng rang', category: 'Đồ nhắm', priceRange: [30000, 45000] },
    ],
    hoursCandidates: [
      ['18:00', '02:00'],
      ['19:00', '03:00'],
    ],
  },
];

const FACILITY_POOL: FacilityType[] = [
  'wifi', 'parking_car', 'parking_motorbike', 'air_conditioner', 'outdoor_seating',
  'kid_friendly', 'pet_friendly', 'card_payment', 'private_room',
];

// ---------- Small deterministic-ish random helpers ----------

function choice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sample<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  const result: T[] = [];
  while (result.length < n && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function roundTo5k(value: number): number {
  return Math.round(value / 5000) * 5000;
}

function randomPrice([min, max]: [number, number]): number {
  return roundTo5k(min + Math.random() * (max - min));
}

function jitter(center: number, spreadDeg: number): number {
  return Number((center + (Math.random() - 0.5) * spreadDeg).toFixed(6));
}

function parseHms(hhmm: string): [number, number] {
  const [h, m] = hhmm.split(':').map(Number);
  return [h, m];
}

// ---------- Build the plan (deterministic list of 40 restaurants) ----------

interface RestaurantPlan {
  name: string;
  description: string;
  categoryCode: CategoryCode;
  priceRangeCode: string;
  cuisineCodes: string[];
  district: DistrictSeed;
  ward: string;
  line: string;
  lat: number;
  lng: number;
  phone: string;
  hours: [string, string];
  facilities: FacilityType[];
  menuPool: MenuPoolItem[];
  sparse: boolean; // true => 0 photos, 0 menu items (empty-state test cases)
}

function buildPlans(): RestaurantPlan[] {
  const plans: RestaurantPlan[] = [];
  let phoneCounter = 90_100_0000;
  let overnightCount = 0;
  // Two deliberately under-populated restaurants (0 photos, 0 menu) to
  // exercise the empty-state UI per the Module 5 Definition of Done.
  const sparseIndexes = new Set([7, 24]);
  let globalIndex = 0;

  for (const spec of CATEGORY_SPECS) {
    for (let i = 0; i < spec.count; i++) {
      const district = choice(DISTRICTS);
      const ward = choice(district.wards);
      const street = choice(district.streets);
      const houseNumber = 5 + Math.floor(Math.random() * 200);

      const nameResult = spec.nameTemplates();
      const name = typeof nameResult === 'string' ? nameResult : nameResult.label;
      const cuisineCodes =
        spec.cuisineCodes.length > 0
          ? sample(spec.cuisineCodes, 1)
          : [typeof nameResult === 'string' ? 'mon_viet' : nameResult.cuisine];

      const hours = choice(spec.hoursCandidates);
      const isOvernight = parseHms(hours[1])[0] < parseHms(hours[0])[0];
      if (isOvernight) overnightCount++;

      const facilityCount = 3 + Math.floor(Math.random() * 3); // 3-5
      const facilities = sample(FACILITY_POOL, facilityCount);

      plans.push({
        name,
        description: `${name} — một địa điểm ${categoryLabel(spec.code)} tại ${district.name}, TP. Hồ Chí Minh. (Dữ liệu demo hư cấu cho mục đích minh hoạ sản phẩm.)`,
        categoryCode: spec.code,
        priceRangeCode: choice(spec.priceRangeCodes),
        cuisineCodes,
        district,
        ward,
        line: `${houseNumber} ${street}`,
        lat: jitter(district.center.lat, 0.02),
        lng: jitter(district.center.lng, 0.02),
        phone: `0${phoneCounter++}`,
        hours,
        facilities,
        menuPool: spec.menuPool,
        sparse: sparseIndexes.has(globalIndex),
      });
      globalIndex++;
    }
  }

  // Guarantee at least 3 overnight-hours places even if random draws came up
  // short (DoD requires ≥3; quan_bar/quan_via_he candidates already lean
  // overnight, but this is a hard floor, not a hope).
  if (overnightCount < 3) {
    for (const plan of plans) {
      if (overnightCount >= 3) break;
      const isOvernight = parseHms(plan.hours[1])[0] < parseHms(plan.hours[0])[0];
      if (!isOvernight && (plan.categoryCode === 'quan_bar' || plan.categoryCode === 'quan_via_he')) {
        plan.hours = ['18:00', '02:00'];
        overnightCount++;
      }
    }
  }

  return plans;
}

function categoryLabel(code: CategoryCode): string {
  switch (code) {
    case 'quan_an':
      return 'quán ăn';
    case 'quan_ca_phe':
      return 'quán cà phê';
    case 'nha_hang':
      return 'nhà hàng';
    case 'xe_day':
      return 'xe đẩy';
    case 'quan_via_he':
      return 'quán vỉa hè';
    case 'quan_bar':
      return 'quán bar';
  }
}

// ---------- Dish catalog ----------
// `Dish` is a curated/admin-managed catalog (docs/06-database-erd.md) that
// search's dish-name-matching branch joins against via MenuItem.dishId —
// there's no separate hand-authored dish list to maintain in sync: the
// CATEGORY_SPECS menuPools above are already the complete, closed set of
// dish names this seed script ever creates MenuItems from, so the catalog
// is just their deduplicated union. Exported so backfill-dish-links.ts can
// reuse the exact same logic against already-seeded data.
export async function ensureDishCatalog(client: PrismaClient): Promise<Map<string, string>> {
  const uniqueNames = new Set<string>();
  for (const spec of CATEGORY_SPECS) {
    for (const item of spec.menuPool) {
      uniqueNames.add(item.name);
    }
  }

  const dishByName = new Map<string, string>();
  for (const name of uniqueNames) {
    // eslint-disable-next-line no-await-in-loop
    const dish = await client.dish.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    dishByName.set(name, dish.id);
  }
  return dishByName;
}

// ---------- Seed execution ----------

async function main() {
  console.log('Seeding the real Module 5 demo dataset (30-50 HCMC restaurants)...');

  const dishByName = await ensureDishCatalog(prisma);
  console.log(`Dish catalog ready: ${dishByName.size} unique dishes.`);

  const plans = buildPlans();
  console.log(`Plan: ${plans.length} restaurants across ${DISTRICTS.length} districts.`);

  let created = 0;
  let skipped = 0;

  for (const plan of plans) {
    const slug = await uniqueSlug(plan.name);
    const existing = await prisma.restaurant.findFirst({
      where: { name: plan.name, address: { district: plan.district.name } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const category = await prisma.restaurantCategory.findUniqueOrThrow({ where: { code: plan.categoryCode } });
    const priceRange = await prisma.priceRange.findUniqueOrThrow({ where: { code: plan.priceRangeCode } });

    const address = await prisma.address.create({
      data: {
        line: plan.line,
        ward: plan.ward,
        district: plan.district.name,
        province: 'TP. Hồ Chí Minh',
        fullAddressText: `${plan.line}, ${plan.ward}, ${plan.district.name}, TP. Hồ Chí Minh`,
      },
    });
    const location = await prisma.location.create({ data: { lat: plan.lat, lng: plan.lng } });

    const restaurant = await prisma.restaurant.create({
      data: {
        name: plan.name,
        slug,
        description: plan.description,
        categoryId: category.id,
        priceRangeId: priceRange.id,
        phone: plan.phone,
        addressId: address.id,
        locationId: location.id,
      },
    });

    await prisma.restaurantStatus.create({
      data: { restaurantId: restaurant.id, publicationStatus: 'published' },
    });

    const [openHour, openMinute] = parseHms(plan.hours[0]);
    const [closeHour, closeMinute] = parseHms(plan.hours[1]);
    await prisma.openingHour.createMany({
      data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        restaurantId: restaurant.id,
        dayOfWeek,
        openTime: new Date(Date.UTC(1970, 0, 1, openHour, openMinute)),
        closeTime: new Date(Date.UTC(1970, 0, 1, closeHour, closeMinute)),
        isClosed: false,
      })),
    });

    for (const cuisineCode of plan.cuisineCodes) {
      const cuisine = await prisma.cuisine.findUnique({ where: { code: cuisineCode } });
      if (!cuisine) continue;
      await prisma.restaurantCuisine.create({ data: { restaurantId: restaurant.id, cuisineId: cuisine.id } });
    }

    if (plan.facilities.length > 0) {
      await prisma.restaurantFacility.createMany({
        data: plan.facilities.map((facilityType) => ({ restaurantId: restaurant.id, facilityType })),
      });
    }

    if (!plan.sparse) {
      const itemCount = 6 + Math.floor(Math.random() * 7); // 6-12
      const items = sample(plan.menuPool, Math.min(itemCount, plan.menuPool.length));
      const menu = await prisma.menu.create({ data: { restaurantId: restaurant.id, isActive: true } });
      await prisma.menuItem.createMany({
        data: items.map((item, idx) => ({
          menuId: menu.id,
          dishId: dishByName.get(item.name) ?? null,
          name: item.name,
          priceVnd: randomPrice(item.priceRange),
          category: item.category,
          isPopular: idx < 2, // first couple picked per place are the "popular" ones
        })),
      });

      const photoCount = 4 + Math.floor(Math.random() * 5); // 4-8
      await prisma.photo.createMany({
        data: Array.from({ length: photoCount }, (_, idx) => ({
          ownerType: 'restaurant' as PhotoOwnerType,
          ownerId: restaurant.id,
          // picsum.photos: free placeholder images, seeded per restaurant+index
          // for stable-but-varied results — NOT scraped from any real
          // business, per this module's ethical/legal note.
          storageKey: `https://picsum.photos/seed/${slug}-${idx}/900/700`,
          width: 900,
          height: 700,
        })),
      });
    }

    created++;
    console.log(`  + [${plan.categoryCode}] ${plan.name} (${plan.district.name})${plan.sparse ? '  [sparse: no menu/photos]' : ''}`);
  }

  console.log(`Done. Created ${created}, skipped ${skipped} (already existed).`);
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.restaurant.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

// Guarded so `backfill-dish-links.ts` (and anything else) can `import {
// ensureDishCatalog }` from this file without ALSO triggering a full
// duplicate re-seed as a side effect — this file is meant to run standalone
// (`ts-node prisma/seed-restaurants.ts`) but is now also a library module.
if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
