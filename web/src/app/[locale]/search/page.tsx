import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { searchRestaurants } from '@/lib/api';
import { RestaurantCard } from '@/components/RestaurantCard';
import { SearchFilterForm } from '@/components/SearchFilterForm';
import { Link } from '@/i18n/navigation';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

async function buildTitle(q?: string, district?: string): Promise<string> {
  const t = await getTranslations('search');
  if (q) return t('titleQuery', { query: q });
  if (district) return t('titleForDistrict', { district });
  return t('titleAll');
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const search = await searchParams;
  const [title, t] = await Promise.all([
    buildTitle(search.q, search.district),
    getTranslations({ locale, namespace: 'search' }),
  ]);
  return {
    title,
    description: t('metaDescription'),
    robots: { index: !!(search.q || search.category || search.district), follow: true },
  };
}

const PAGE_SIZE = 20;

export default async function SearchPage({ searchParams }: PageProps) {
  const search = await searchParams;
  const page = Number(search.page ?? '1') || 1;

  const [t, tCommon, title] = await Promise.all([
    getTranslations('search'),
    getTranslations('common'),
    buildTitle(search.q, search.district),
  ]);

  const result = await searchRestaurants({
    q: search.q,
    category: search.category,
    district: search.district,
    cuisine: search.cuisine,
    facilities: search.facilities,
    priceMin: search.priceMin ? Number(search.priceMin) : undefined,
    priceMax: search.priceMax ? Number(search.priceMax) : undefined,
    minRating: search.minRating ? Number(search.minRating) : undefined,
    openNow: search.openNow === 'true',
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value && key !== 'page') usp.set(key, value);
    }
    usp.set('page', String(targetPage));
    return `/search?${usp.toString()}`;
  }

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <h1 className="section-title" style={{ marginTop: 0 }}>
        {title} · {tCommon('resultCount', { count: result.total })}
      </h1>

      <SearchFilterForm
        initial={{
          q: search.q,
          category: search.category,
          district: search.district,
          cuisine: search.cuisine,
          facilities: search.facilities,
          priceMin: search.priceMin,
          priceMax: search.priceMax,
          openNow: search.openNow,
        }}
      />

      {result.items.length === 0 ? (
        <div className="empty-state">
          <p>{t('emptyTitle')}</p>
          <Link href="/search">{tCommon('seeAllRestaurants')}</Link>
        </div>
      ) : (
        <>
          <div className="card-grid">
            {result.items.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="pagination">
              {page > 1 ? <Link href={pageHref(page - 1)}>{tCommon('prev')}</Link> : null}
              <span>{tCommon('pageOf', { page, totalPages })}</span>
              {page < totalPages ? <Link href={pageHref(page + 1)}>{tCommon('next')}</Link> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
