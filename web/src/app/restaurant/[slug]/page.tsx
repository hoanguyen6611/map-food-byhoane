import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiNotFoundError, getRestaurantBySlug, getReviewsForRestaurant } from '@/lib/api';
import { CATEGORY_LABELS, FACILITY_META } from '@/lib/labels';
import { dayLabel, formatPriceRange, formatVndFull } from '@/lib/format';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3004';
const REVIEWS_PAGE_SIZE = 10;

interface PageProps {
  params: Promise<{ slug: string }>;
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
  const { slug } = await params;
  const restaurant = await loadRestaurant(slug);
  if (!restaurant) {
    return { title: 'Không tìm thấy quán' };
  }

  const description = restaurant.description
    ? restaurant.description.slice(0, 155)
    : `${restaurant.name} — ${CATEGORY_LABELS[restaurant.categoryCode]} tại ${restaurant.address.district}, ${restaurant.address.province}. Xem giờ mở cửa, thực đơn, đánh giá thật từ cộng đồng.`;
  const image = restaurant.photos[0]?.url;

  return {
    title: `${restaurant.name} — ${restaurant.address.district}`,
    description,
    alternates: { canonical: `/restaurant/${restaurant.slug}` },
    openGraph: {
      title: restaurant.name,
      description,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function RestaurantDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { reviewPage: reviewPageParam } = await searchParams;
  const restaurant = await loadRestaurant(slug);
  if (!restaurant) {
    notFound();
  }

  const reviewPage = Number(reviewPageParam ?? '1') || 1;
  const reviewsResponse =
    restaurant.reviewCount > 0 ? await getReviewsForRestaurant(restaurant.id, reviewPage) : null;
  const reviewTotalPages = reviewsResponse
    ? Math.max(1, Math.ceil(reviewsResponse.total / REVIEWS_PAGE_SIZE))
    : 1;

  const priceLabel = formatPriceRange(restaurant.priceRange);
  const firstMenu = restaurant.menus[0];
  const categoryLabel = CATEGORY_LABELS[restaurant.categoryCode];

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
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: categoryLabel,
        item: `${SITE_URL}/search?category=${restaurant.categoryCode}`,
      },
      { '@type': 'ListItem', position: 3, name: restaurant.name, item: `${SITE_URL}/restaurant/${restaurant.slug}` },
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

      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Trang chủ</Link>
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
              alt={`Ảnh ${index + 1} của ${restaurant.name}`}
              width={photo.width ?? 400}
              height={photo.height ?? 300}
              sizes="(max-width: 640px) 45vw, 200px"
              priority={index === 0}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 24 }}>
          Chưa có ảnh cho quán này.
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
              ? `★ ${restaurant.compositeScore?.toFixed(1)} (${restaurant.reviewCount} đánh giá)`
              : 'Chưa có đánh giá'}
          </p>
          <span className={`badge ${restaurant.isOpenNow ? 'badge-open' : 'badge-closed'}`}>
            {restaurant.isOpenNow ? 'Đang mở cửa' : 'Đã đóng cửa'}
          </span>
        </div>
      </div>

      <div className="cta-banner">
        <strong>Muốn viết đánh giá hoặc lưu quán yêu thích?</strong>
        Các tính năng này hiện chỉ có trên ứng dụng di động The Food Map of Vietnam — trang web
        này tập trung vào việc giúp bạn tìm và khám phá quán ăn.
      </div>

      <h2 className="section-title">Thông tin</h2>
      <div className="info-row">
        <span className="label">Địa chỉ</span>
        <span>{restaurant.address.fullAddressText}</span>
      </div>
      {restaurant.phone ? (
        <div className="info-row">
          <span className="label">Điện thoại</span>
          <span>
            <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>
          </span>
        </div>
      ) : null}
      {restaurant.facilities.length > 0 ? (
        <div className="info-row">
          <span className="label">Tiện ích</span>
          <span>
            {restaurant.facilities.map((f) => (
              <span key={f}>
                <span aria-hidden="true">{FACILITY_META[f].emoji}</span> {FACILITY_META[f].label}
                {'  '}
              </span>
            ))}
          </span>
        </div>
      ) : null}

      <h2 className="section-title">Giờ mở cửa</h2>
      {restaurant.openingHours.map((hour) => (
        <div className="info-row" key={hour.dayOfWeek}>
          <span className="label">{dayLabel(hour.dayOfWeek)}</span>
          <span>{hour.isClosed ? 'Đóng cửa' : `${hour.openTime} - ${hour.closeTime}`}</span>
        </div>
      ))}

      <h2 className="section-title">Thực đơn</h2>
      {!firstMenu || firstMenu.items.length === 0 ? (
        <p className="empty-state">Quán này chưa cập nhật thực đơn.</p>
      ) : (
        <table className="menu-table">
          <caption className="sr-only">Thực đơn của {restaurant.name}</caption>
          <tbody>
            {firstMenu.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.name}
                  {item.isPopular ? (
                    <>
                      {' '}
                      <span aria-label="Món phổ biến">🔥</span>
                    </>
                  ) : null}
                </td>
                <td className="price">{formatVndFull(item.priceVnd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="section-title">Đánh giá</h2>
      {!reviewsResponse || reviewsResponse.items.length === 0 ? (
        <p className="empty-state">Chưa có đánh giá nào cho quán này.</p>
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
            <nav className="pagination" aria-label="Phân trang đánh giá">
              {reviewPage > 1 ? <Link href={reviewPageHref(reviewPage - 1)}>← Trước</Link> : null}
              <span>
                Trang {reviewPage}/{reviewTotalPages}
              </span>
              {reviewPage < reviewTotalPages ? <Link href={reviewPageHref(reviewPage + 1)}>Sau →</Link> : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
