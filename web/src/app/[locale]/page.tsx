import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { searchRestaurants } from '@/lib/api';
import { RestaurantCard } from '@/components/RestaurantCard';
import { MapCanvas } from '@/components/MapCanvas';
import { HomeProvinceSelect } from '@/components/HomeProvinceSelect';
import { CATEGORY_ICON_PATH, CATEGORY_OPTIONS } from '@/lib/labels';
import { DISTRICTS } from '@/lib/districts';
import { getHomeProvince, HCMC_LEGACY_PROVINCE_NAME, HCMC_DATASET_CODE } from '@/lib/home-province';
import { Link, getPathname } from '@/i18n/navigation';
import { SearchIcon, MapPinIcon } from '@/components/icons';
import { VN_PROVINCES } from '@foodmap/shared-types';

// The dataset's own HCMC entry is excluded from the select's option list —
// see HCMC_LEGACY_PROVINCE_NAME's doc comment (home-province.ts) for why a
// second, correctly-named-but-currently-empty "Hồ Chí Minh" entry would
// just be a confusing near-duplicate of the one that actually has data.
const OTHER_PROVINCES = VN_PROVINCES.filter((p) => p.code !== HCMC_DATASET_CODE);

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
  const [t, tLabels, tCommon] = await Promise.all([
    getTranslations('home'),
    getTranslations('labels'),
    getTranslations('common'),
  ]);

  const selectedProvince = await getHomeProvince();
  const isHcmc = selectedProvince === HCMC_LEGACY_PROVINCE_NAME;
  // "Khu vực" (Quận 1/3/Bình Thạnh/Phú Nhuận) only exists for HCMC — no
  // equivalent breakdown for any other province, so the whole section is
  // skipped (not fetched, not rendered) rather than showing HCMC's district
  // names with a stale/misleading count for a different province.
  const [featured, categoryCounts, areaCounts] = await Promise.all([
    searchRestaurants({ pageSize: 8, province: selectedProvince }),
    Promise.all(CATEGORY_OPTIONS.map((code) => searchRestaurants({ category: code, pageSize: 1, province: selectedProvince }))),
    isHcmc ? Promise.all(DISTRICTS.map((d) => searchRestaurants({ district: d.name, pageSize: 1 }))) : Promise.resolve([]),
  ]);

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
                  defaultValue={HCMC_LEGACY_PROVINCE_NAME}
                  defaultLabel={t('heroArea')}
                  options={OTHER_PROVINCES}
                  ariaLabel={t('heroArea')}
                  noResultsText={tCommon('noResultsFound')}
                />
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

      <div className="container page-sections">
        <section className="section-block">
          <div className="section-head">
            <h2 className="section-title">{t('categoriesHeading')}</h2>
            <Link href={withProvince('/search')} className="section-link">
              {t('seeAllLink')}
            </Link>
          </div>
          <div className="cat-grid">
            {CATEGORY_OPTIONS.map((code, i) => (
              <Link key={code} href={withProvince(`/search?category=${code}`)} className="cat-card">
                <span className={`cat-icon-tile ${CAT_TILE_CLASSES[i % CAT_TILE_CLASSES.length]}`} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c2024" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d={CATEGORY_ICON_PATH[code]} />
                  </svg>
                </span>
                <span>
                  <span className="cat-card-name" style={{ display: 'block' }}>
                    {tLabels(`category.${code}`)}
                  </span>
                  <span className="cat-card-count">{tCommon('resultCount', { count: categoryCounts[i].total })}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {isHcmc ? (
          <section className="section-block">
            <div className="section-head">
              <h2 className="section-title">{t('areasHeading')}</h2>
              <span className="section-caption">{t('areasCaption')}</span>
            </div>
            <div className="area-grid">
              {DISTRICTS.map((district, i) => (
                <Link
                  key={district.slug}
                  href={`/district/${district.slug}`}
                  className={`area-card ${AREA_TILE_CLASSES[i % AREA_TILE_CLASSES.length]}`}
                >
                  <span className="area-card-name">{district.name}</span>
                  <span className="area-card-meta">{tCommon('resultCount', { count: areaCounts[i].total })}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="section-block">
          <div className="section-head">
            <h2 className="section-title">{t('featuredHeading')}</h2>
            <span className="section-caption">{t('featuredCaption')}</span>
          </div>
          {featured.items.length === 0 ? (
            <p className="empty-state">{t('emptyFeatured')}</p>
          ) : (
            <div className="card-grid">
              {featured.items.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
