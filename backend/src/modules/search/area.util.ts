import { Prisma } from '@prisma/client';

/**
 * Restaurants entered after the 2025 administrative reform store an empty
 * `Address.district` (the new model is province → ward), but their
 * `full_address_text` still usually carries the old district ("…, Quận 3,
 * Hồ Chí Minh …"), which is what people browse by. This regex pulls that
 * district name out. "Thành phố" alone is excluded on purpose — it would
 * match the province ("Thành phố Hồ Chí Minh"); only Thủ Đức is a
 * city-level district.
 */
export const DISTRICT_FROM_ADDRESS_REGEX =
  '(Quận [^,]+|Huyện [^,]+|Thị xã [^,]+|Thành phố Thủ Đức|TP\\.? Thủ Đức)';

/** SQL expression (needs `addresses a` in scope): stored district, else parsed one. */
export const DISTRICT_SQL = Prisma.sql`COALESCE(
  NULLIF(BTRIM(a.district), ''),
  BTRIM(substring(a.full_address_text from ${DISTRICT_FROM_ADDRESS_REGEX}::text))
)`;

/** SQL expression for RestaurantSummaryDto.area: district (stored or parsed), else ward. */
export const AREA_SQL = Prisma.sql`COALESCE(${DISTRICT_SQL}, NULLIF(BTRIM(a.ward), ''))`;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `?district=` filter matching either the stored district or that district
 * appearing as its own comma-separated part of the full address — so
 * "Quận 1" matches "…, Quận 1, …" but not "…, Quận 10, …".
 */
export function districtCondition(district: string): Prisma.Sql {
  const pattern = `(^|,)\\s*${escapeRegex(district.trim())}\\s*(,|$)`;
  return Prisma.sql`(a.district = ${district} OR a.full_address_text ~* ${pattern}::text)`;
}

/** Accent-free slug: "Bình Thạnh" → "binh-thanh", "Quận 3" → "quan-3". */
export function slugifyArea(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
