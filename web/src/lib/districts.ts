/**
 * District landing pages (`/district/[slug]`, docs/08-roadmap-sprint.md's
 * Phase 1.5 "city/district landing pages" item). A small, static list rather
 * than a generic unaccent-slugify function — matches the handful of
 * districts actually present in the seed data (see backend's
 * `GET /search?district=` which does an exact string match against
 * `Address.district`, so `name` here must be the exact stored value).
 */
export interface DistrictEntry {
  slug: string;
  name: string;
}

export const DISTRICTS: DistrictEntry[] = [
  { slug: 'quan-1', name: 'Quận 1' },
  { slug: 'quan-3', name: 'Quận 3' },
  { slug: 'binh-thanh', name: 'Bình Thạnh' },
  { slug: 'phu-nhuan', name: 'Phú Nhuận' },
];

export function findDistrictBySlug(slug: string): DistrictEntry | undefined {
  return DISTRICTS.find((d) => d.slug === slug);
}
