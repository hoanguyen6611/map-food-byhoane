import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { searchRestaurants } from '@/lib/api';
import { PlaceRow } from '@/components/PlaceRow';
import { MapCanvas } from '@/components/MapCanvas';
import { DISTRICTS, findDistrictBySlug } from '@/lib/districts';
import { Link, getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3004';
const PAGE_SIZE = 20;
// The backend caps `pageSize` at 50 (search-query.dto.ts) — the largest
// district in the seed dataset is under that, so one request covers a whole
// district's restaurants for honest stats (average score, most common
// category), computed separately from the paginated display list below.
const STATS_PAGE_SIZE = 50;

export function generateStaticParams(): { locale: string; slug: string }[] {
  return routing.locales.flatMap((locale) => DISTRICTS.map((d) => ({ locale, slug: d.slug })));
}

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const district = findDistrictBySlug(slug);
  const t = await getTranslations({ locale, namespace: 'district' });
  if (!district) {
    return { title: t('notFoundTitle') };
  }

  return {
    title: t('metaTitle', { name: district.name }),
    description: t('metaDescription', { name: district.name }),
    alternates: { canonical: getPathname({ href: `/district/${district.slug}`, locale }) },
    openGraph: { title: t('metaTitle', { name: district.name }), type: 'website' },
  };
}

export default async function DistrictPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { page: pageParam } = await searchParams;
  const district = findDistrictBySlug(slug);
  if (!district) {
    notFound();
  }

  const [t, tCommon, tLabels] = await Promise.all([
    getTranslations('district'),
    getTranslations('common'),
    getTranslations('labels'),
  ]);

  const page = Number(pageParam ?? '1') || 1;
  const [result, statsResult] = await Promise.all([
    searchRestaurants({ district: district.name, page, pageSize: PAGE_SIZE }),
    searchRestaurants({ district: district.name, pageSize: STATS_PAGE_SIZE }),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const rated = statsResult.items.filter((r) => r.compositeScore !== null);
  const avgScore = rated.length > 0 ? rated.reduce((sum, r) => sum + (r.compositeScore ?? 0), 0) / rated.length : null;
  const categoryTally = new Map<string, number>();
  for (const r of statsResult.items) {
    categoryTally.set(r.categoryCode, (categoryTally.get(r.categoryCode) ?? 0) + 1);
  }
  const topCategoryCode = [...categoryTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topCategoryLabel = topCategoryCode ? tLabels(`category.${topCategoryCode}`) : null;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tCommon('home'), item: SITE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: district.name,
        item: `${SITE_URL}${getPathname({ href: `/district/${district.slug}`, locale })}`,
      },
    ],
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: result.items.map((restaurant, index) => ({
      '@type': 'ListItem',
      position: (page - 1) * PAGE_SIZE + index + 1,
      url: `${SITE_URL}${getPathname({ href: `/restaurant/${restaurant.slug}`, locale })}`,
      name: restaurant.name,
    })),
  };

  function pageHref(targetPage: number): string {
    return `/district/${slug}?page=${targetPage}`;
  }

  return (
    <div className="container" style={{ paddingTop: 'clamp(20px, 3vw, 32px)', paddingBottom: 'clamp(32px, 5vw, 52px)' }}>
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify'd structured data, not user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {result.items.length > 0 && (
        // eslint-disable-next-line react/no-danger -- JSON.stringify'd structured data, not user input
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      <nav aria-label={tCommon('breadcrumbLabel')} className="breadcrumb">
        <Link href="/">{tCommon('home')}</Link>
        <span aria-hidden="true">›</span>
        <span>{t('areasCrumb')}</span>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{district.name}</span>
      </nav>

      <div className="chip-row" style={{ marginTop: 18, marginBottom: 18 }}>
        {DISTRICTS.map((d) => (
          <Link key={d.slug} href={`/district/${d.slug}`} className={`pill ${d.slug === slug ? 'pill-selected' : ''}`}>
            {d.name}
          </Link>
        ))}
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <h1 className="detail-title">{t('heading', { name: district.name })}</h1>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--color-ink-muted)', margin: 0 }}>
              {topCategoryLabel ? t('blurbWithTop', { count: result.total, topCategory: topCategoryLabel }) : t('blurb', { count: result.total })}
            </p>
          </div>

          {result.items.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">{t('empty', { name: district.name })}</p>
              <Link href="/search">{tCommon('seeAllRestaurants')}</Link>
            </div>
          ) : (
            <>
              <div className="result-grid-2">
                {result.items.map((restaurant) => (
                  <PlaceRow key={restaurant.id} restaurant={restaurant} thumb={76} showStatus={false} />
                ))}
              </div>

              {totalPages > 1 ? (
                <nav className="pagination" aria-label={tCommon('paginationLabel')}>
                  {page > 1 ? <Link href={pageHref(page - 1)}>{tCommon('prev')}</Link> : null}
                  <span>{tCommon('pageOf', { page, totalPages })}</span>
                  {page < totalPages ? <Link href={pageHref(page + 1)}>{tCommon('next')}</Link> : null}
                </nav>
              ) : null}

              <p style={{ marginTop: 8 }}>
                <Link href={`/search?district=${encodeURIComponent(district.name)}`}>{t('filterMoreLink')}</Link>
              </p>
            </>
          )}
        </div>

        <div className="detail-sidebar">
          <div className="action-card">
            <div className="mini-map" style={{ height: 150 }}>
              <MapCanvas
                pins={statsResult.items.slice(0, 60).map((r) => ({
                  id: r.id,
                  lat: r.lat,
                  lng: r.lng,
                  score: r.compositeScore?.toFixed(1) ?? '—',
                }))}
              />
            </div>
            <span className="filter-section-title" style={{ padding: 0 }}>
              {t('statsHeading', { name: district.name })}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: 'var(--color-ink-muted)' }}>{t('statCount')}</span>
                <span className="font-num" style={{ fontSize: 15, fontWeight: 600 }}>
                  {statsResult.total}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: 'var(--color-ink-muted)' }}>{t('statAvg')}</span>
                <span className="font-num" style={{ fontSize: 15, fontWeight: 600 }}>
                  {avgScore !== null ? avgScore.toFixed(1) : tCommon('noRating')}
                </span>
              </div>
              {topCategoryLabel ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, color: 'var(--color-ink-muted)' }}>{t('statTop')}</span>
                  <span className="font-num" style={{ fontSize: 15, fontWeight: 600 }}>
                    {topCategoryLabel}
                  </span>
                </div>
              ) : null}
            </div>
            <Link href="/map" className="btn-dark btn-dark-lg" style={{ justifyContent: 'center' }}>
              {t('viewOnMap')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
