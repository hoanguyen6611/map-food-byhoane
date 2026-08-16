import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { searchRestaurants } from '@/lib/api';
import { RestaurantCard } from '@/components/RestaurantCard';
import { DISTRICTS, findDistrictBySlug } from '@/lib/districts';
import { Link, getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3004';
const PAGE_SIZE = 20;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

// A fixed, small set of districts — real SSG rather than on-demand ISR,
// same spirit as the detail page's slug lookup but cheaper since there's
// no backend round-trip needed to enumerate them. Crossed with both locales.
export function generateStaticParams(): { locale: string; slug: string }[] {
  return routing.locales.flatMap((locale) => DISTRICTS.map((d) => ({ locale, slug: d.slug })));
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

  const [t, tCommon] = await Promise.all([
    getTranslations('district'),
    getTranslations('common'),
  ]);

  const page = Number(pageParam ?? '1') || 1;
  const result = await searchRestaurants({ district: district.name, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

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

  // ItemList — only the restaurants actually returned on this page, never
  // fabricated beyond what the backend returned.
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
    <div className="container" style={{ paddingTop: 32 }}>
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify'd structured data, not user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {result.items.length > 0 && (
        // eslint-disable-next-line react/no-danger -- JSON.stringify'd structured data, not user input
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      <nav aria-label={tCommon('breadcrumbLabel')} className="breadcrumb">
        <Link href="/">{tCommon('home')}</Link>
        <span aria-hidden="true"> › </span>
        <span aria-current="page">{district.name}</span>
      </nav>

      <h1 className="section-title" style={{ marginTop: 0 }}>
        {t('heading', { name: district.name })} · {tCommon('resultCount', { count: result.total })}
      </h1>

      {result.items.length === 0 ? (
        <div className="empty-state">
          <p>{t('empty', { name: district.name })}</p>
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
            <nav className="pagination" aria-label={tCommon('paginationLabel')}>
              {page > 1 ? <Link href={pageHref(page - 1)}>{tCommon('prev')}</Link> : null}
              <span>{tCommon('pageOf', { page, totalPages })}</span>
              {page < totalPages ? <Link href={pageHref(page + 1)}>{tCommon('next')}</Link> : null}
            </nav>
          ) : null}

          <p style={{ marginTop: 24 }}>
            <Link href={`/search?district=${encodeURIComponent(district.name)}`}>{t('filterMoreLink')}</Link>
          </p>
        </>
      )}
    </div>
  );
}
