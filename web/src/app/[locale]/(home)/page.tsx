import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCategories, getDistricts, getProvinces, getTrendingUp, searchRestaurants } from '@/lib/api';
import { RestaurantCard } from '@/components/RestaurantCard';
import { HomeTopByCategory, type TopCategorySection } from '@/components/HomeTopByCategory';
import { formatPriceRange, placeTileClass } from '@/lib/format';
import Image from 'next/image';
import { MapCanvas } from '@/components/MapCanvas';
import { HomeProvinceSelect } from '@/components/HomeProvinceSelect';
import { DISTRICTS } from '@/lib/districts';
import { getHomeProvince, HCMC_PROVINCE_NAME, HCMC_DATASET_CODE } from '@/lib/home-province';
import { Link, getPathname } from '@/i18n/navigation';
import { SearchIcon, MapPinIcon, MapLogoIcon, TrophyIcon, ArrowUpRightIcon, StarIcon, TrendingUpIcon } from '@/components/icons';
import { VN_PROVINCES, getCategoryIconPath } from '@foodmap/shared-types';
import { Reveal } from '@/components/Reveal';
import { LoggedOutOnly } from '@/components/LoggedOutOnly';

// Caps how much a long grid's last items wait before animating in — past
// this many items, every later one fires at the same (max) delay instead of
// stretching the stagger out further and further.
const MAX_STAGGER_INDEX = 8;
const STAGGER_STEP = 0.05;
function staggerDelay(index: number): number {
  return Math.min(index, MAX_STAGGER_INDEX) * STAGGER_STEP;
}

// HCMC is pinned as its own default option (below, with the friendlier
// "heroArea" label instead of the dataset's plain shortName) rather than
// appearing a second time in this list.
// Slimmed to what the picker shows — the full dataset carries every ward,
// which would otherwise be serialized into the client component's props.
const OTHER_PROVINCES = VN_PROVINCES.filter((p) => p.code !== HCMC_DATASET_CODE).map(({ code, name, shortName }) => ({ code, name, shortName }));

export const metadata: Metadata = {
  // No `title` key here at all — Next.js only inherits a parent segment's
  // title when the field is omitted entirely (see the previous incident this
  // comment used to document: an explicit `title: undefined` still counts as
  // "this segment defines title", blanking the whole app's <title>).
  alternates: { canonical: '/' },
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

const AREA_TILE_CLASSES = ['area-tile-0', 'area-tile-1', 'area-tile-2', 'area-tile-3'];
const CAT_TILE_CLASSES = ['cat-tile-0', 'cat-tile-1', 'cat-tile-2', 'cat-tile-3', 'cat-tile-4', 'cat-tile-5'];

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  const [t, tCommon] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
  ]);

  const selectedProvince = await getHomeProvince();
  const isHcmc = selectedProvince === HCMC_PROVINCE_NAME;
  const categories = await getCategories();
  // "Khu vực" (Quận 1/3/Bình Thạnh/Phú Nhuận) only exists for HCMC — no
  // equivalent breakdown for any other province, so the whole section is
  // skipped (not fetched, not rendered) rather than showing HCMC's district
  // names with a stale/misleading count for a different province.
  const [featured, categoryCounts, areaCounts, topByCategory, trendingUp, apiDistricts, provinces] = await Promise.all([
    searchRestaurants({ pageSize: 8, province: selectedProvince }),
    Promise.all(categories.map((c) => searchRestaurants({ category: c.code, pageSize: 1, province: selectedProvince }))),
    isHcmc ? Promise.all(DISTRICTS.map((d) => searchRestaurants({ district: d.name, pageSize: 1 }))) : Promise.resolve([]),
    // "Top 6 [danh mục] nên thử" — one section per category, ranked by
    // activity (views + reviews, see SearchService's 'trending' sort), only
    // for a category that actually HAS ≥6 published restaurants (checked via
    // `.total`, the same one query that already returns the top 6 `.items` —
    // no separate count call needed). A category under 6 doesn't get a
    // section at all rather than showing an incomplete/padded-out top list.
    // 6 (not 5) for a more balanced grid — divides evenly at common
    // `.card-grid` column counts (2, 3) instead of leaving a dangling
    // last card in the row.
    Promise.all(categories.map((c) => searchRestaurants({ category: c.code, sort: 'trending', pageSize: 6, province: selectedProvince }))),
    // "Quán đang lên" — ranked by week-over-week GROWTH (SearchService.findTrendingUp),
    // distinct from the lifetime-popularity 'trending' sort above. Empty
    // during a quiet period is expected, not an error — hidden entirely
    // rather than showing a misleading "no results" state.
    getTrendingUp({ province: selectedProvince }),
    // Live district list (stored or parsed from the address) — null when
    // the backend doesn't serve /districts yet; then the static HCMC list
    // below is used as before.
    getDistricts(selectedProvince),
    getProvinces(),
  ]);
  const provinceCounts: Record<string, number> = Object.fromEntries(provinces.map((p) => [p.name, p.restaurantCount]));
  const provinceCountLabels: Record<string, string> = Object.fromEntries(
    provinces.map((p) => [p.name, tCommon('resultCount', { count: p.restaurantCount })]),
  );
  const AREA_PREVIEW = 6;
  const areaEntries =
    apiDistricts && apiDistricts.length > 0
      ? apiDistricts.map((d) => ({ slug: d.slug, name: d.name, count: d.restaurantCount }))
      : isHcmc
        ? DISTRICTS.map((d, i) => ({ slug: d.slug, name: d.name, count: areaCounts[i]?.total ?? 0 }))
        : [];
  const topCategorySections = categories
    .map((category, i) => ({ category, result: topByCategory[i] }))
    .filter(({ result }) => result.total >= 6);

  // Mobile's single chip-switched "Top 6" block — any category with at least
  // 3 ranked places (a short list still reads fine as a ranking; the desktop
  // per-category grids above keep their stricter ≥6 rule).
  const topChipSections: TopCategorySection[] = categories
    .map((category, i) => ({ category, result: topByCategory[i] }))
    .filter(({ result }) => result.items.length >= 3)
    .map(({ category, result }) => ({
      code: category.code,
      label: category.label,
      heading: t('topCategoryHeading', { category: category.label }),
      seeMoreHref: withProvince(`/search?category=${category.code}`),
      items: result.items.map((r) => {
        const price = formatPriceRange(r.priceRange, tCommon);
        return {
          id: r.id,
          slug: r.slug,
          name: r.name,
          thumbnailUrl: r.thumbnailUrl,
          tileClass: placeTileClass(r.id),
          score: r.compositeScore !== null && r.reviewCount > 0 ? r.compositeScore : null,
          reviewCount: r.reviewCount,
          meta: r.area ?? (price ? `${price}đ` : null),
        };
      }),
    }));

  // Plain HTML <form action> can't use next-intl's <Link> — resolve the
  // locale-prefixed path (e.g. `/en/search`) by hand instead.
  const searchActionPath = getPathname({ href: '/search', locale });

  // Preserves the selected (non-default) province across every on-page
  // navigation into /search, so switching provinces on Home doesn't get
  // silently lost the moment the visitor clicks into a category/chip.
  function withProvince(href: string): string {
    if (isHcmc) return href;
    const [path, query] = href.split('?');
    const usp = new URLSearchParams(query);
    usp.set('province', selectedProvince);
    return `${path}?${usp.toString()}`;
  }

  const selectedProvinceLabel = isHcmc ? t('heroArea') : (VN_PROVINCES.find((p) => p.name === selectedProvince)?.shortName ?? selectedProvince);

  const heroPins = featured.items
    .filter((r) => r.compositeScore !== null)
    .slice(0, 5)
    .map((r, i) => ({ id: r.id, lat: r.lat, lng: r.lng, score: r.compositeScore!.toFixed(1), selected: i === 0 }));

  return (
    <>
      <section className="hero-band">
        <div className="container">
          <div className="hero-left">
            <span className="hero-badge">
              <span className="hero-badge-dot" aria-hidden="true" />
              {t('heroBadge', { province: selectedProvinceLabel, count: featured.total })}
            </span>
            <h1 className="hero-title">{t('heroTitle')}</h1>
            <p className="hero-subhead">{t('heroSubtitle')}</p>

            <form action={searchActionPath} className="search-bar" role="search">
              <span className="search-field">
                <SearchIcon size={18} />
                <input type="text" name="q" placeholder={t('searchPlaceholder')} aria-label={t('searchAriaLabel')} />
              </span>
              <span className="search-field search-field-secondary">
                <MapPinIcon size={18} />
                <HomeProvinceSelect
                  value={selectedProvince}
                  defaultValue={HCMC_PROVINCE_NAME}
                  defaultLabel={t('heroArea')}
                  options={OTHER_PROVINCES}
                  ariaLabel={t('heroArea')}
                  noResultsText={tCommon('noResultsFound')}
                  sheetTitle={t('provinceSheetTitle')}
                  sheetSearchPlaceholder={t('provinceSheetSearch')}
                  closeLabel={tCommon('close')}
                  counts={provinceCounts}
                  countLabels={provinceCountLabels}
                  useLocationLabel={t('useCurrentLocation')}
                  locatingLabel={t('locating')}
                  locationErrorLabel={t('locationError')}
                />
                {/* Mobile-only (design's search card header: "TP. Hồ Chí Minh · 186 quán"). */}
                <span className="search-province-count">{tCommon('resultCount', { count: featured.total })}</span>
              </span>
              <button type="submit" className="search-submit">
                {t('searchButtonShort')}
              </button>
            </form>

            <div className="hero-chips">
              <span className="hero-chips-label">{t('heroChipsLabel')}</span>
              {t.raw('heroChips').map((label: string) => (
                <Link key={label} href={withProvince(`/search?q=${encodeURIComponent(label)}`)} className="pill-plain">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="hero-right">
            <div className="map-teaser-card">
              <div className="map-teaser-canvas">
                <MapCanvas pins={heroPins} />
              </div>
              <div className="map-teaser-footer">
                <div className="map-teaser-footer-text">
                  <span className="map-teaser-title">{t('mapTeaserTitle')}</span>
                  <span className="map-teaser-sub">{t('mapTeaserSub')}</span>
                </div>
                <Link href="/map" className="btn-dark">
                  {t('mapTeaserCta')}
                </Link>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value font-num">{featured.total}</span>
                <span className="stat-label">{t('statRestaurants')}</span>
              </div>
              <div className="stat-card">
                <span className="stat-value font-num">7</span>
                <span className="stat-label">{t('statCriteria')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container page-sections home-sections">
        <section className="section-block home-sec-categories">
          <div className="section-head">
            <h2 className="section-title">{t('categoriesHeading')}</h2>
            <Link href={withProvince('/search')} className="section-link">
              {t('seeAllLink')}
            </Link>
          </div>
          <div className="cat-grid">
            {categories.map((category, i) => (
              <Reveal key={category.code} delay={staggerDelay(i)} y={16}>
                <Link href={withProvince(`/search?category=${category.code}`)} className="cat-card">
                  <span className={`cat-icon-tile ${CAT_TILE_CLASSES[i % CAT_TILE_CLASSES.length]}`} aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c2024" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d={getCategoryIconPath(category.icon)} />
                    </svg>
                  </span>
                  <span>
                    <span className="cat-card-name" style={{ display: 'block' }}>
                      {category.label}
                    </span>
                    <span className="cat-card-count">{tCommon('resultCount', { count: categoryCounts[i].total })}</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Mobile-only (see globals.css's `.home-quick-links`) — the only way
            to reach these two public pages on a phone now that the hamburger
            menu is gone; desktop still has both in the header nav row. */}
        <section className="section-block home-quick-links">
          <div className="section-head">
            <h2 className="section-title">{t('exploreHeading')}</h2>
            <LoggedOutOnly>
              <span className="section-caption">{t('exploreNoLoginHint')}</span>
            </LoggedOutOnly>
          </div>
          <div className="home-quick-grid">
            <Link href="/map" className="home-quick-card">
              <span className="home-quick-icon home-quick-icon-map" aria-hidden="true">
                <MapLogoIcon size={21} strokeWidth={1.5} />
              </span>
              <ArrowUpRightIcon size={16} className="home-quick-arrow" />
              <span className="home-quick-text">
                <span className="home-quick-title">{tCommon('mapNavLink')}</span>
                <span className="home-quick-sub">{t('exploreMapSub')}</span>
              </span>
            </Link>
            <Link href="/leaderboard" className="home-quick-card">
              <span className="home-quick-icon home-quick-icon-rank" aria-hidden="true">
                <TrophyIcon size={21} />
              </span>
              <ArrowUpRightIcon size={16} className="home-quick-arrow" />
              <span className="home-quick-text">
                <span className="home-quick-title">{tCommon('leaderboardNavLink')}</span>
                <span className="home-quick-sub">{t('exploreRankSub')}</span>
              </span>
            </Link>
          </div>
        </section>

        {areaEntries.length > 0 ? (
          <section id="khu-vuc" className="section-block home-sec-areas">
            <div className="section-head">
              <h2 className="section-title">{t('areasHeading')}</h2>
              <span className="section-caption">{t('areasCaption')}</span>
            </div>
            <div className="area-grid">
              {areaEntries.slice(0, AREA_PREVIEW).map((district, i) => (
                <Reveal key={district.slug} delay={staggerDelay(i)} y={16}>
                  <Link
                    href={`/district/${district.slug}`}
                    className={`area-card ${AREA_TILE_CLASSES[i % AREA_TILE_CLASSES.length]}`}
                  >
                    <MapPinIcon size={46} className="area-card-decor" aria-hidden="true" />
                    <span className="area-card-name">{district.name}</span>
                    <span className="area-card-meta">{tCommon('resultCount', { count: district.count })}</span>
                  </Link>
                </Reveal>
              ))}
            </div>
            {areaEntries.length > AREA_PREVIEW ? (
              <details className="home-areas-more">
                <summary>{t('allAreasLink', { count: areaEntries.length })}</summary>
                <div className="area-grid">
                  {areaEntries.slice(AREA_PREVIEW).map((district, i) => (
                    <Link
                      key={district.slug}
                      href={`/district/${district.slug}`}
                      className={`area-card ${AREA_TILE_CLASSES[(i + AREA_PREVIEW) % AREA_TILE_CLASSES.length]}`}
                    >
                      <MapPinIcon size={46} className="area-card-decor" aria-hidden="true" />
                      <span className="area-card-name">{district.name}</span>
                      <span className="area-card-meta">{tCommon('resultCount', { count: district.count })}</span>
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        ) : null}

        {trendingUp.length > 0 ? (
          <section className="section-block home-sec-trending">
            <div className="section-head">
              <h2 className="section-title home-trending-title">
                {t('trendingUpHeading')}
                <TrendingUpIcon size={14} className="home-trending-icon" aria-hidden="true" />
              </h2>
              <span className="section-caption">{t('trendingUpCaption')}</span>
            </div>
            <div className="card-grid home-desktop-only">
              {trendingUp.map((restaurant, i) => (
                <Reveal key={restaurant.id} delay={staggerDelay(i)}>
                  <RestaurantCard restaurant={restaurant} />
                </Reveal>
              ))}
            </div>
            {/* Mobile: design's horizontal strip of compact ranked cards. */}
            <div className="home-trending-strip">
              {trendingUp.map((r, i) => {
                const price = formatPriceRange(r.priceRange, tCommon);
                return (
                  <Link key={r.id} href={`/restaurant/${r.slug}`} className="home-trending-card">
                    <span className={`home-trending-thumb ${r.thumbnailUrl ? '' : placeTileClass(r.id)}`}>
                      {r.thumbnailUrl ? <Image src={r.thumbnailUrl} alt="" fill sizes="182px" style={{ objectFit: 'cover' }} /> : null}
                      <span className="home-trending-rank">#{i + 1}</span>
                      {r.viewGrowthPercent != null && r.viewGrowthPercent > 0 ? (
                        <span className="home-trending-growth">
                          {i === 0
                            ? t('trendingGrowthViews', { percent: r.viewGrowthPercent })
                            : t('trendingGrowth', { percent: r.viewGrowthPercent })}
                        </span>
                      ) : null}
                    </span>
                    <span className="home-trending-body">
                      <span className="home-trending-name">{r.name}</span>
                      <span className="home-trending-score">
                        {r.compositeScore !== null && r.reviewCount > 0 ? (
                          <>
                            <StarIcon size={12} filled className="home-top-star" />
                            <span className="home-top-score">{r.compositeScore.toFixed(1)}</span>
                            <span>({r.reviewCount})</span>
                          </>
                        ) : (
                          <span>{tCommon('noRating')}</span>
                        )}
                      </span>
                      <span className="home-trending-meta">
                        {[r.categoryLabel, r.area ?? (price ? `${price}đ` : null)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="home-trending-footnote">{t('trendingUpCaption')}</p>
          </section>
        ) : null}

        {topChipSections.length > 0 ? (
          <section className="section-block home-sec-topchips">
            <HomeTopByCategory
              sections={topChipSections}
              seeMoreLabel={t('seeMoreLink')}
              noRatingLabel={tCommon('noRating')}
              chipsLabel={t('categoriesHeading')}
            />
          </section>
        ) : null}

        {topCategorySections.map(({ category, result }) => (
          <section key={category.code} className="section-block home-desktop-only">
            <div className="section-head">
              <h2 className="section-title">{t('topCategoryHeading', { category: category.label })}</h2>
              <Link href={withProvince(`/search?category=${category.code}`)} className="section-link">
                {t('seeAllLink')}
              </Link>
            </div>
            <div className="card-grid">
              {result.items.map((restaurant, i) => (
                <Reveal key={restaurant.id} delay={staggerDelay(i)}>
                  <RestaurantCard restaurant={restaurant} />
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
