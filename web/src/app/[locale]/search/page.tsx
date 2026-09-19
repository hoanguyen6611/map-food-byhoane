import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCategories, searchRestaurants } from '@/lib/api';
import { RestaurantCard } from '@/components/RestaurantCard';
import { PlaceRow } from '@/components/PlaceRow';
import { SearchFilterForm, buildSearchHref, type SearchParamsRecord } from '@/components/SearchFilterForm';
import { CUISINE_OPTIONS, FACILITY_OPTIONS, PRICE_BUCKETS } from '@/lib/labels';
import { Link } from '@/i18n/navigation';
import { SearchIcon, ListViewIcon, GridViewIcon, CloseIcon, SearchMinusIcon } from '@/components/icons';
import { getHomeProvince, HCMC_PROVINCE_NAME } from '@/lib/home-province';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsRecord>;
}

// `province=all` is an explicit "show every province" override (reachable
// only via the active-filter chip's own "×") — distinct from the param
// being absent, which instead falls back to whatever province was last
// selected on Home (a persistent, site-wide preference, not a one-off
// search filter someone would expect "Xoá tất cả bộ lọc" to reset).
const ALL_PROVINCES = 'all';

async function resolveProvince(raw: string | undefined): Promise<string | undefined> {
  if (raw === ALL_PROVINCES) return undefined;
  if (raw) return raw;
  return getHomeProvince();
}

async function buildTitle(q?: string, district?: string, province?: string): Promise<string> {
  const t = await getTranslations('search');
  if (q) return t('titleQuery', { query: q });
  if (district) return t('titleForDistrict', { district });
  if (province) return t('titleForDistrict', { district: province });
  return t('titleAll');
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const search = await searchParams;
  const [title, t] = await Promise.all([
    buildTitle(search.q, search.district, search.province),
    getTranslations({ locale, namespace: 'search' }),
  ]);
  return {
    title,
    description: t('metaDescription'),
    robots: { index: !!(search.q || search.category || search.district || search.province), follow: true },
  };
}

const PAGE_SIZE = 20;

export default async function SearchPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  const page = Number(search.page ?? '1') || 1;
  const view = search.view === 'grid' ? 'grid' : 'list';

  const effectiveProvince = await resolveProvince(search.province);

  const [t, tCommon, tLabels, title, categories] = await Promise.all([
    getTranslations('search'),
    getTranslations('common'),
    getTranslations('labels'),
    buildTitle(search.q, search.district, effectiveProvince),
    getCategories(),
  ]);

  const [result, totalCountResult, categoryCounts] = await Promise.all([
    searchRestaurants({
      q: search.q,
      category: search.category,
      district: search.district,
      province: effectiveProvince,
      cuisine: search.cuisine,
      facilities: search.facilities,
      priceMin: search.priceMin ? Number(search.priceMin) : undefined,
      priceMax: search.priceMax ? Number(search.priceMax) : undefined,
      minRating: search.minRating ? Number(search.minRating) : undefined,
      openNow: search.openNow === 'true',
      page,
      pageSize: PAGE_SIZE,
    }),
    searchRestaurants({ pageSize: 1, province: effectiveProvince }),
    Promise.all(categories.map((c) => searchRestaurants({ category: c.code, pageSize: 1, province: effectiveProvince }))),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value && key !== 'page') usp.set(key, value);
    }
    usp.set('page', String(targetPage));
    return `/search?${usp.toString()}`;
  }

  const priceBucket = PRICE_BUCKETS.find(
    (b) => String(b.min) === search.priceMin && (b.max ? String(b.max) : '') === (search.priceMax ?? ''),
  );

  const activeChips: { key: string; label: string; clearHref: string }[] = [];
  if (search.category) {
    activeChips.push({
      key: 'category',
      label: categories.find((c) => c.code === search.category)?.label ?? search.category,
      clearHref: buildSearchHref(search, { category: undefined }),
    });
  }
  if (search.district) {
    activeChips.push({ key: 'district', label: search.district, clearHref: buildSearchHref(search, { district: undefined }) });
  }
  if (effectiveProvince) {
    activeChips.push({ key: 'province', label: effectiveProvince, clearHref: buildSearchHref(search, { province: ALL_PROVINCES }) });
  }
  if (priceBucket) {
    activeChips.push({
      key: 'price',
      label: tLabels(`priceBucket.${priceBucket.code}`),
      clearHref: buildSearchHref(search, { priceMin: undefined, priceMax: undefined }),
    });
  }
  for (const code of CUISINE_OPTIONS) {
    if (search.cuisine?.split(',').includes(code)) {
      const next = search.cuisine.split(',').filter((c) => c !== code);
      activeChips.push({
        key: `cuisine-${code}`,
        label: tLabels(`cuisine.${code}`),
        clearHref: buildSearchHref(search, { cuisine: next.length ? next.join(',') : undefined }),
      });
    }
  }
  for (const code of FACILITY_OPTIONS) {
    if (search.facilities?.split(',').includes(code)) {
      const next = search.facilities.split(',').filter((c) => c !== code);
      activeChips.push({
        key: `facility-${code}`,
        label: tLabels(`facilityLabel.${code}`),
        clearHref: buildSearchHref(search, { facilities: next.length ? next.join(',') : undefined }),
      });
    }
  }
  if (search.openNow === 'true') {
    activeChips.push({ key: 'openNow', label: tCommon('openNow'), clearHref: buildSearchHref(search, { openNow: undefined }) });
  }

  return (
    <div className="container container-wide search-layout">
      <div className="search-sidebar">
        <SearchFilterForm
          search={search}
          categoryCounts={categories.map((c, i) => ({ code: c.code, label: c.label, count: categoryCounts[i].total }))}
          totalCount={totalCountResult.total}
          locale={locale}
          isHcmc={effectiveProvince === HCMC_PROVINCE_NAME}
        />
      </div>

      <div className="search-main">
        <h1 className="sr-only">
          {title} · {tCommon('resultCount', { count: result.total })}
        </h1>

        <div className="search-controls">
          <form action="/search" className="search-input-wrap" role="search" style={{ flex: '1 1 220px', minWidth: 220 }}>
            {Object.entries(search)
              .filter(([key]) => key !== 'q' && key !== 'page')
              .map(([key, value]) => (value ? <input key={key} type="hidden" name={key} value={value} /> : null))}
            <SearchIcon size={17} />
            <input type="text" name="q" defaultValue={search.q ?? ''} placeholder={t('searchPlaceholder')} aria-label={t('searchAriaLabel')} />
            {search.q ? (
              <Link href={buildSearchHref(search, { q: undefined })} className="search-clear-btn" aria-label={tCommon('clearSearch')}>
                <CloseIcon size={11} />
              </Link>
            ) : null}
          </form>

          <div className="view-switch">
            <Link
              href={buildSearchHref(search, { view: undefined })}
              className={`view-switch-btn ${view === 'list' ? 'view-switch-btn-active' : ''}`}
              aria-label={tCommon('viewList')}
            >
              <ListViewIcon size={17} />
            </Link>
            <Link
              href={buildSearchHref(search, { view: 'grid' })}
              className={`view-switch-btn ${view === 'grid' ? 'view-switch-btn-active' : ''}`}
              aria-label={tCommon('viewGrid')}
            >
              <GridViewIcon size={17} />
            </Link>
          </div>
        </div>

        {activeChips.length > 0 ? (
          <div className="active-filter-row">
            <span className="active-filter-label">{tCommon('activeFiltersLabel')}</span>
            {activeChips.map((chip) => (
              <Link key={chip.key} href={chip.clearHref} className="active-filter-chip">
                {chip.label}
                <CloseIcon size={13} />
              </Link>
            ))}
            <Link href="/search" className="active-filter-clear-all">
              {tCommon('clearAllFilters')}
            </Link>
          </div>
        ) : null}

        <div className="result-count-row">
          <span className="result-count-text">
            {title} · {tCommon('resultCount', { count: result.total })}
          </span>
        </div>

        {result.items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">
              <SearchMinusIcon size={30} />
            </span>
            <p className="empty-state-title">{t('emptyTitle')}</p>
            <p className="empty-state-body">{t('emptyBody')}</p>
            <Link href="/search" className="btn-dark btn-dark-lg">
              {t('clearFiltersCta')}
            </Link>
          </div>
        ) : (
          <div className="result-list">
            <div className={view === 'grid' ? 'result-grid-2' : 'result-grid-1'}>
              {result.items.map((restaurant) =>
                view === 'grid' ? (
                  <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                ) : (
                  <PlaceRow key={restaurant.id} restaurant={restaurant} />
                ),
              )}
            </div>
            <div className="result-footer-line">{t('shownAllLine', { count: result.items.length })}</div>

            {totalPages > 1 ? (
              <div className="pagination">
                {page > 1 ? <Link href={pageHref(page - 1)}>{tCommon('prev')}</Link> : null}
                <span>{tCommon('pageOf', { page, totalPages })}</span>
                {page < totalPages ? <Link href={pageHref(page + 1)}>{tCommon('next')}</Link> : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
