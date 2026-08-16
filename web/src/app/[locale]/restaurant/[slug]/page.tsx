import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ApiNotFoundError, getRestaurantBySlug, getReviewsForRestaurant } from '@/lib/api';
import { formatPriceRange, formatVndFull } from '@/lib/format';
import { FACILITY_EMOJI } from '@/lib/labels';
import { Link, getPathname } from '@/i18n/navigation';
import { FavoriteButton } from '@/components/FavoriteButton';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3004';
const REVIEWS_PAGE_SIZE = 10;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ reviewPage?: string }>;
}

async function loadRestaurant(slug: string) {
  try {
    return await getRestaurantBySlug(slug);
  } catch (error) {
    if (error instanceof ApiNotFoundError) {
      return null;
    }
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const restaurant = await loadRestaurant(slug);
  const [t, tLabels] = await Promise.all([
    getTranslations({ locale, namespace: 'restaurant' }),
    getTranslations({ locale, namespace: 'labels' }),
  ]);
  if (!restaurant) {
    return { title: t('notFoundTitle') };
  }

  const categoryLabel = tLabels(`category.${restaurant.categoryCode}`);
  const description = restaurant.description
    ? restaurant.description.slice(0, 155)
    : t('metaDescriptionFallback', {
        name: restaurant.name,
        category: categoryLabel,
        district: restaurant.address.district,
        province: restaurant.address.province,
      });
  const image = restaurant.photos[0]?.url;

  return {
    title: `${restaurant.name} — ${restaurant.address.district}`,
    description,
    alternates: { canonical: getPathname({ href: `/restaurant/${restaurant.slug}`, locale }) },
    openGraph: {
      title: restaurant.name,
      description,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function RestaurantDetailPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { reviewPage: reviewPageParam } = await searchParams;
  const restaurant = await loadRestaurant(slug);
  if (!restaurant) {
    notFound();
  }

  const [t, tCommon, tLabels] = await Promise.all([
    getTranslations('restaurant'),
    getTranslations('common'),
    getTranslations('labels'),
  ]);

  const reviewPage = Number(reviewPageParam ?? '1') || 1;
  const reviewsResponse =
    restaurant.reviewCount > 0 ? await getReviewsForRestaurant(restaurant.id, reviewPage) : null;
  const reviewTotalPages = reviewsResponse
    ? Math.max(1, Math.ceil(reviewsResponse.total / REVIEWS_PAGE_SIZE))
    : 1;

  const priceLabel = formatPriceRange(restaurant.priceRange, tCommon);
  const firstMenu = restaurant.menus[0];
  const categoryLabel = tLabels(`category.${restaurant.categoryCode}`);

  // schema.org/Restaurant structured data — the concrete SEO artifact this
  // module exists to produce (build-prompts/09-public-web.md), not optional
  // polish. Only include fields we actually have real data for — never
  // fabricate a rating (aggregateRating) when reviewCount is 0.
  const restaurantJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    description: restaurant.description ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: restaurant.address.line,
      addressLocality: restaurant.address.district,
      addressRegion: restaurant.address.province,
      addressCountry: 'VN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: restaurant.location.lat,
      longitude: restaurant.location.lng,
    },
    telephone: restaurant.phone ?? undefined,
    servesCuisine: restaurant.cuisineCodes,
    priceRange: priceLabel ?? undefined,
    image: restaurant.photos.map((p) => p.url),
    ...(restaurant.compositeScore !== null && restaurant.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: restaurant.compositeScore.toFixed(1),
            reviewCount: restaurant.reviewCount,
          },
        }
      : {}),
  };

  // BreadcrumbList — a second, cheap-but-real SEO/UX win alongside the
  // Restaurant structured data above (Google surfaces breadcrumb trails
  // directly in search results).
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tCommon('home'), item: SITE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: categoryLabel,
        item: `${SITE_URL}${getPathname({ href: `/search?category=${restaurant.categoryCode}`, locale })}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: restaurant.name,
        item: `${SITE_URL}${getPathname({ href: `/restaurant/${restaurant.slug}`, locale })}`,
      },
    ],
  };

  function reviewPageHref(targetPage: number): string {
    return `/restaurant/${slug}?reviewPage=${targetPage}`;
  }

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify'd structured data, not user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }} />
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify'd structured data, not user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav aria-label={tCommon('breadcrumbLabel')} className="breadcrumb">
        <Link href="/">{tCommon('home')}</Link>
        <span aria-hidden="true"> › </span>
        <Link href={`/search?category=${restaurant.categoryCode}`}>{categoryLabel}</Link>
        <span aria-hidden="true"> › </span>
        <span aria-current="page">{restaurant.name}</span>
      </nav>

      {restaurant.photos.length > 0 ? (
        <div className="detail-photos">
          {restaurant.photos.map((photo, index) => (
            <Image
              key={photo.id}
              src={photo.url}
              alt={t('photoAlt', { index: index + 1, name: restaurant.name })}
              width={photo.width ?? 400}
              height={photo.height ?? 300}
              sizes="(max-width: 640px) 45vw, 200px"
              priority={index === 0}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 24 }}>
          {t('noPhotos')}
        </div>
      )}

      <div className="detail-header">
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ margin: '0 0 8px' }}>{restaurant.name}</h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
            {categoryLabel}
            {priceLabel ? ` · ${priceLabel}đ` : ''}
          </p>
          <p style={{ fontSize: 14 }}>
            {restaurant.reviewCount > 0
              ? t('ratingSummary', { score: restaurant.compositeScore?.toFixed(1) ?? '—', count: restaurant.reviewCount })
              : tCommon('noRating')}
          </p>
          <span className={`badge ${restaurant.isOpenNow ? 'badge-open' : 'badge-closed'}`}>
            {restaurant.isOpenNow ? tCommon('openNow') : tCommon('closedNow')}
          </span>
        </div>
        <FavoriteButton restaurantId={restaurant.id} />
      </div>

      <div className="cta-banner">
        <strong>{t('ctaTitle')}</strong>
        {t('ctaBody')}
      </div>

      <h2 className="section-title">{t('infoHeading')}</h2>
      <div className="info-row">
        <span className="label">{t('addressLabel')}</span>
        <span>{restaurant.address.fullAddressText}</span>
      </div>
      {restaurant.phone ? (
        <div className="info-row">
          <span className="label">{t('phoneLabel')}</span>
          <span>
            <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>
          </span>
        </div>
      ) : null}
      {restaurant.facilities.length > 0 ? (
        <div className="info-row">
          <span className="label">{t('facilitiesLabel')}</span>
          <span>
            {restaurant.facilities.map((f) => (
              <span key={f}>
                <span aria-hidden="true">{FACILITY_EMOJI[f]}</span> {tLabels(`facilityLabel.${f}`)}
                {'  '}
              </span>
            ))}
          </span>
        </div>
      ) : null}

      <h2 className="section-title">{t('hoursHeading')}</h2>
      {restaurant.openingHours.map((hour) => (
        <div className="info-row" key={hour.dayOfWeek}>
          <span className="label">{tLabels(`day.${hour.dayOfWeek}`)}</span>
          <span>{hour.isClosed ? t('closedDay') : `${hour.openTime} - ${hour.closeTime}`}</span>
        </div>
      ))}

      <h2 className="section-title">{t('menuHeading')}</h2>
      {!firstMenu || firstMenu.items.length === 0 ? (
        <p className="empty-state">{t('noMenu')}</p>
      ) : (
        <table className="menu-table">
          <caption className="sr-only">{t('menuCaption', { name: restaurant.name })}</caption>
          <tbody>
            {firstMenu.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.name}
                  {item.isPopular ? (
                    <>
                      {' '}
                      <span aria-label={t('popularDish')}>🔥</span>
                    </>
                  ) : null}
                </td>
                <td className="price">{formatVndFull(item.priceVnd, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="section-title">{t('reviewsHeading')}</h2>
      {!reviewsResponse || reviewsResponse.items.length === 0 ? (
        <p className="empty-state">{t('noReviews')}</p>
      ) : (
        <>
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {reviewsResponse.ratingBreakdown
              .filter((c) => c.ratingCount > 0)
              .map((c) => (
                <span key={c.code} className="chip">
                  {c.label}: {c.averageScore?.toFixed(1)}★
                </span>
              ))}
          </div>
          {reviewsResponse.items.map((review) => (
            <div className="review-item" key={review.id}>
              <div className="review-header">
                <span className="author">{review.author.displayName}</span>
                <span>★ {review.overallRating}</span>
              </div>
              {review.comment ? <p style={{ margin: 0 }}>{review.comment}</p> : null}
            </div>
          ))}

          {reviewTotalPages > 1 ? (
            <nav className="pagination" aria-label={t('reviewsPaginationLabel')}>
              {reviewPage > 1 ? <Link href={reviewPageHref(reviewPage - 1)}>{tCommon('prev')}</Link> : null}
              <span>{tCommon('pageOf', { page: reviewPage, totalPages: reviewTotalPages })}</span>
              {reviewPage < reviewTotalPages ? (
                <Link href={reviewPageHref(reviewPage + 1)}>{tCommon('next')}</Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
