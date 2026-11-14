import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ApiNotFoundError, getFacilities, getRestaurantBySlug, getReviewsForRestaurant, searchRestaurants } from '@/lib/api';
import { formatPriceRange, formatVndFull, placeTileClass } from '@/lib/format';
import { getDayHoursLines, getActiveRangeCloseTime } from '@/lib/opening-hours-display';
import { DEFAULT_FACILITY_ICON_PATH, FACILITY_ICON_PATH } from '@/lib/labels';
import { Link, getPathname } from '@/i18n/navigation';
import { FavoriteButton } from '@/components/FavoriteButton';
import { BackButton } from '@/components/BackButton';
import { ShareButton } from '@/components/ShareButton';
import { AddToCollectionButton } from '@/components/AddToCollectionButton';
import { WriteReviewForm } from '@/components/WriteReviewForm';
import { Stars } from '@/components/Stars';
import { OpenBadge } from '@/components/OpenBadge';
import { AxisBars } from '@/components/AxisBars';
import { ReviewCard } from '@/components/ReviewCard';
import { ReviewCardPhotos } from '@/components/ReviewCardPhotos';
import { MapCanvas } from '@/components/MapCanvas';
import { PhotoGalleryHero } from '@/components/PhotoGalleryHero';
import { Reveal } from '@/components/Reveal';
import { SocialLinksCard } from '@/components/SocialLinksCard';
import { OwnerClaimForm } from '@/components/OwnerClaimForm';
import { FacilityIcon, MapPinIcon, PhoneIcon, MenuFolderIcon, StarIcon, PencilIcon, EyeIcon, ClockIcon, ChevronDownIcon } from '@/components/icons';
import type { SocialPlatform } from '@foodmap/shared-types';
import { getSession } from '@/lib/auth';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3004';
const REVIEWS_PAGE_SIZE = 10;

/** "25k" / "1,2tr" style short price for the menu header's range. */
function formatKShort(vnd: number): string {
  if (vnd >= 1_000_000) return `${(vnd / 1_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')}tr`;
  return `${Math.round(vnd / 1000)}k`;
}

/** Straight-line distance in meters (haversine) — "Quán tương tự" shows how far each is from this one. */
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(m: number, locale: string): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })} km`;
}

function MenuRow({ name, popular, popularLabel, price }: { name: string; popular: boolean; popularLabel: string; price: string }) {
  return (
    <li className="detail-menu-row">
      <span className="detail-menu-name">{name}</span>
      {popular ? <span className="detail-menu-popular">🔥 {popularLabel}</span> : null}
      <span className="detail-menu-price">{price}</span>
    </li>
  );
}

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ reviewPage?: string; tab?: string }>;
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
  const t = await getTranslations({ locale, namespace: 'restaurant' });
  if (!restaurant) {
    return { title: t('notFoundTitle') };
  }

  const categoryLabel = restaurant.categoryLabel;
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
  const { reviewPage: reviewPageParam, tab } = await searchParams;
  const restaurant = await loadRestaurant(slug);
  if (!restaurant) {
    notFound();
  }

  const [t, tCommon, tLabels, tWriteReview] = await Promise.all([
    getTranslations('restaurant'),
    getTranslations('common'),
    getTranslations('labels'),
    getTranslations('writeReview'),
  ]);

  const reviewPage = Number(reviewPageParam ?? '1') || 1;
  const activeTab = tab === 'reviews' ? 'reviews' : 'info';

  // Always fetched (not just when reviewCount > 0) — the backend computes
  // `ratingBreakdown` (criteria codes + labels) unconditionally, and the
  // write-review form below needs that list even for a restaurant with zero
  // reviews so far.
  const [reviewsResponse, session, similarResult, facilityCatalog] = await Promise.all([
    getReviewsForRestaurant(restaurant.id, reviewPage),
    getSession(),
    searchRestaurants({ category: restaurant.categoryCode, pageSize: 4 }),
    // Facilities are an admin-editable catalog — a code added after this
    // build (e.g. `mua_mang_di`) has no static translation, so fall back to
    // the catalog's own label instead of throwing MISSING_MESSAGE.
    restaurant.facilities.length > 0 ? getFacilities().catch(() => []) : Promise.resolve([]),
  ]);
  const facilityCatalogLabel = new Map(facilityCatalog.map((f) => [f.code, f.label]));
  const facilityLabel = (code: string) =>
    tLabels.has(`facilityLabel.${code}`) ? tLabels(`facilityLabel.${code}`) : (facilityCatalogLabel.get(code) ?? code);
  const reviewTotalPages = Math.max(1, Math.ceil(reviewsResponse.total / REVIEWS_PAGE_SIZE));
  const similar = similarResult.items.filter((r) => r.id !== restaurant.id).slice(0, 3);

  const priceLabel = formatPriceRange(restaurant.priceRange, tCommon);
  const firstMenu = restaurant.menus[0];
  const categoryLabel = restaurant.categoryLabel;

  const todayIndex = new Date().getDay();
  const todayHours = restaurant.openingHours.find((h) => h.dayOfWeek === todayIndex);
  // With two possible ranges per day (e.g. lunch + dinner), "open until X"
  // must reflect whichever range is active right now, not always the first
  // one — see getActiveRangeCloseTime's doc comment for the bug this fixes.
  const activeRangeCloseTime = restaurant.isOpenNow ? getActiveRangeCloseTime(todayHours, new Date()) : null;
  const openNote = todayHours?.isOpen24h
    ? t('open24h')
    : activeRangeCloseTime
      ? t('openUntil', { time: activeRangeCloseTime })
      : undefined;

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
    return `/restaurant/${slug}?tab=reviews&reviewPage=${targetPage}`;
  }
  function tabHref(target: 'info' | 'reviews'): string {
    return `/restaurant/${slug}${target === 'reviews' ? '?tab=reviews' : ''}`;
  }

  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${restaurant.location.lat},${restaurant.location.lng}`;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${restaurant.location.lat},${restaurant.location.lng}`;

  // Menu: first 5 rows visible, the rest behind "Xem toàn bộ N món".
  const MENU_PREVIEW = 5;
  const menuItems = firstMenu?.items ?? [];
  const menuPreview = menuItems.slice(0, MENU_PREVIEW);
  const menuRest = menuItems.slice(MENU_PREVIEW);
  const menuPrices = menuItems.map((i) => i.priceVnd).filter((v) => v > 0);
  const menuPriceRange =
    menuPrices.length > 0
      ? `${formatKShort(Math.min(...menuPrices))} – ${formatKShort(Math.max(...menuPrices))}`
      : null;

  return (
    <div className="container" style={{ paddingBottom: 48 }}>
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify'd structured data, not user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }} />
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify'd structured data, not user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav aria-label={tCommon('breadcrumbLabel')} className="breadcrumb">
        <Link href="/">{tCommon('home')}</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/search?category=${restaurant.categoryCode}`}>{categoryLabel}</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{restaurant.name}</span>
      </nav>

      <Reveal y={16}>
        <div className="detail-hero-wrap">
          <PhotoGalleryHero
            photos={restaurant.photos}
            photoAlts={restaurant.photos.map((_, index) => t('photoAlt', { index: index + 1, name: restaurant.name }))}
            emptyText={t('noPhotos')}
            seeAllLabel={t('seeAllPhotos', { count: restaurant.photos.length })}
            moreCountLabel={t('morePhotosCount', { count: Math.max(0, restaurant.photos.length - 4) })}
            countLabel={t('photoCount', { count: restaurant.photos.length })}
          />
          {/* Mobile-only floating controls over the hero (see globals.css's
              `.detail-hero-back-btn`/`.detail-hero-fav-overlay`) — on desktop
              the breadcrumb above already covers "back", and favoriting lives
              in `.detail-mobile-actions`/the sidebar's action row instead. */}
          <BackButton label={t('backAriaLabel')} fallbackHref="/search" />
          <div className="detail-hero-fav-overlay">
            <ShareButton title={restaurant.name} />
            <FavoriteButton restaurantId={restaurant.id} icon="bookmark" />
          </div>
        </div>
      </Reveal>

      <div className="detail-layout" style={{ marginTop: 20 }}>
        <div className="detail-main">
          <h1 className="detail-title">{restaurant.name}</h1>
          <div className="detail-meta-row">
            {restaurant.reviewCount > 0 ? (
              <span className="detail-score">
                <StarIcon size={16} />
                <span className="detail-score-value">{restaurant.compositeScore?.toFixed(1) ?? '—'}</span>
                <span className="detail-score-count">({t('reviewCountShort', { count: restaurant.reviewCount })})</span>
              </span>
            ) : (
              <span className="detail-meta-text">{tCommon('noRating')}</span>
            )}
            <span className="detail-divider" aria-hidden="true" />
            <span className="detail-meta-text">
              {categoryLabel}
              {priceLabel ? ` · ${priceLabel}đ` : ''}
              {restaurant.address.district ? ` · ${restaurant.address.district}` : ''}
            </span>
            <span className="detail-divider detail-meta-views" aria-hidden="true" />
            <span className="detail-meta-text detail-meta-views">{t('viewCount', { count: restaurant.viewCount })}</span>
            <OpenBadge isOpen={restaurant.isOpenNow} label={restaurant.isOpenNow ? tCommon('openNow') : tCommon('closedNow')} note={openNote} />
          </div>
          {/* Mobile: views on their own line under the meta row (design). */}
          <p className="detail-views-line">
            <EyeIcon size={13} />
            {t('viewCount', { count: restaurant.viewCount })}
            {/* Optional until every backend serves it. */}
            {restaurant.weeklyViewCount != null ? ` · ${t('weeklyViewCount', { count: restaurant.weeklyViewCount })}` : ''}
          </p>

          {/* Mobile-only — the redesign's app-style layout puts these right
              under the header, not buried in the sidebar's stacked position
              below hours/similar (see globals.css's `.detail-mobile-actions`,
              which also hides the sidebar's own copy of this same row on
              mobile so it isn't shown twice). */}
          {/* Design's three equal outline buttons (Chỉ đường · Gọi điện ·
              Chia sẻ). Save/collection moved onto the hero overlay above. */}
          <div className="detail-mobile-actions">
            <a href={directionsHref} target="_blank" rel="noopener noreferrer" className="detail-action-btn">
              <MapPinIcon size={16} />
              <span>{t('directions')}</span>
            </a>
            {restaurant.phone ? (
              <a href={`tel:${restaurant.phone}`} className="detail-action-btn">
                <PhoneIcon size={16} />
                <span>{t('call')}</span>
              </a>
            ) : null}
            <ShareButton title={restaurant.name} withLabel className="detail-action-btn" />
          </div>
          {session ? (
            <div className="detail-mobile-collection">
              <AddToCollectionButton restaurantId={restaurant.id} isLoggedIn wide />
            </div>
          ) : null}

          <div className="tab-segment">
            <Link href={tabHref('info')} className={`tab-segment-btn ${activeTab === 'info' ? 'tab-segment-btn-active' : ''}`}>
              {t('infoTab')}
            </Link>
            <Link href={tabHref('reviews')} className={`tab-segment-btn ${activeTab === 'reviews' ? 'tab-segment-btn-active' : ''}`}>
              {t('reviewsTab', { count: restaurant.reviewCount })}
            </Link>
          </div>

          {activeTab === 'info' ? (
            <>
              {/* Mobile (design): one card — today's status with an expandable
                  "Giờ cả tuần", then facility chips. Desktop keeps the two
                  cards below (hidden on mobile). */}
              <div className="detail-hours-summary">
                <details className="detail-hours-details">
                  <summary>
                    <ClockIcon size={16} className="detail-hours-icon" />
                    <span className={`detail-hours-status ${restaurant.isOpenNow ? 'detail-hours-status-open' : ''}`}>
                      {restaurant.isOpenNow
                        ? todayHours?.isOpen24h
                          ? t('open24h')
                          : activeRangeCloseTime
                            ? t('openUntilToday', { time: activeRangeCloseTime })
                            : tCommon('openNow')
                        : tCommon('closedNow')}
                    </span>
                    <span className="detail-hours-toggle">
                      {t('weekHours')}
                      <ChevronDownIcon size={14} />
                    </span>
                  </summary>
                  <div className="detail-hours-rows">
                    {restaurant.openingHours.map((hour) => (
                      <div
                        key={hour.dayOfWeek}
                        className={`detail-hours-row ${hour.dayOfWeek === todayIndex ? 'detail-hours-row-today' : ''}`}
                      >
                        <span>{tLabels(`day.${hour.dayOfWeek}`)}</span>
                        <span className="font-num detail-hours-times">
                          {getDayHoursLines(hour, t('closedDay'), t('open24h')).map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
                {restaurant.facilities.length > 0 ? (
                  <div className="detail-facility-chips">
                    {restaurant.facilities.map((f) => (
                      <span key={f} className="detail-facility-chip">
                        <FacilityIcon path={FACILITY_ICON_PATH[f as keyof typeof FACILITY_ICON_PATH] ?? DEFAULT_FACILITY_ICON_PATH} size={13} />
                        {facilityLabel(f)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <Reveal>
              <div className="info-card info-card-compact detail-desktop-card">
                <h2 className="info-card-title">{t('infoHeading')}</h2>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-item-icon">
                      <MapPinIcon size={18} />
                    </span>
                    <div className="info-item-body">
                      <span className="info-item-label">{t('addressLabel')}</span>
                      <span className="info-item-value">{restaurant.address.fullAddressText}</span>
                    </div>
                  </div>
                  {restaurant.phone ? (
                    <div className="info-item">
                      <span className="info-item-icon">
                        <PhoneIcon size={18} />
                      </span>
                      <div className="info-item-body">
                        <span className="info-item-label">{t('phoneLabel')}</span>
                        <a href={`tel:${restaurant.phone}`} className="info-item-value info-item-value-link">
                          {restaurant.phone}
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>
                {restaurant.facilities.length > 0 ? (
                  <>
                    <hr className="filter-rule" />
                    <div>
                      <span className="info-item-label">{t('facilitiesLabel')}</span>
                      <div className="chip-row" style={{ marginTop: 9 }}>
                        {restaurant.facilities.map((f) => (
                          <span key={f} className="facility-pill">
                            <FacilityIcon path={FACILITY_ICON_PATH[f as keyof typeof FACILITY_ICON_PATH] ?? DEFAULT_FACILITY_ICON_PATH} size={14} />
                            {facilityLabel(f)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              </Reveal>

              <Reveal>
              <div className="info-card info-card-compact detail-desktop-card">
                <div className="info-card-head">
                  <h2 className="info-card-title">{t('hoursHeading')}</h2>
                  {restaurant.isOpenNow && openNote ? (
                    <span className="info-card-head-status">
                      {todayHours?.isOpen24h ? openNote : t('openUntilLong', { time: activeRangeCloseTime ?? '' })}
                    </span>
                  ) : null}
                </div>
                {restaurant.openingHours.map((hour) => (
                  <div
                    key={hour.dayOfWeek}
                    className={`info-hours-row ${hour.dayOfWeek === todayIndex ? 'info-hours-row-today' : ''}`}
                  >
                    <span className="info-hours-day">{tLabels(`day.${hour.dayOfWeek}`)}</span>
                    <span className="font-num info-hours-times">
                      {getDayHoursLines(hour, t('closedDay'), t('open24h')).map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              </Reveal>

              {!firstMenu || (firstMenu.items.length === 0 && firstMenu.photos.length === 0) ? (
                <div className="no-menu-card">
                  <MenuFolderIcon size={26} />
                  <span className="no-menu-title">{t('noMenu')}</span>
                </div>
              ) : (
                <div className="info-card info-card-compact detail-menu-card">
                  <div className="info-card-head">
                    <h2 className="info-card-title">{t('menuHeading')}</h2>
                    {firstMenu.items.length > 0 ? (
                      <span className="detail-menu-summary">
                        {t('menuItemCount', { count: firstMenu.items.length })}
                        {menuPriceRange ? ` · ${menuPriceRange}` : ''}
                      </span>
                    ) : null}
                  </div>
                  {firstMenu.items.length > 0 ? (
                    <ul className="detail-menu-list" aria-label={t('menuCaption', { name: restaurant.name })}>
                      {menuPreview.map((item) => (
                        <MenuRow key={item.id} name={item.name} popular={item.isPopular} popularLabel={t('popularBadge')} price={formatVndFull(item.priceVnd, locale)} />
                      ))}
                    </ul>
                  ) : null}
                  {menuRest.length > 0 ? (
                    <details className="detail-menu-more">
                      <summary>{t('menuSeeAll', { count: firstMenu.items.length })}</summary>
                      <ul className="detail-menu-list">
                        {menuRest.map((item) => (
                          <MenuRow key={item.id} name={item.name} popular={item.isPopular} popularLabel={t('popularBadge')} price={formatVndFull(item.priceVnd, locale)} />
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {firstMenu.photos.length > 0 ? (
                    <div className="info-card-body detail-menu-photos">
                      <ReviewCardPhotos photos={firstMenu.photos} />
                      <span className="detail-menu-photos-caption">
                        <strong>{t('menuPhotosHeading')}</strong>
                        <span>
                          {t('menuPhotosCount', { count: firstMenu.photos.length })}
                          {firstMenu.updatedAt
                            ? ` · ${t('menuUpdatedAt', { date: new Date(firstMenu.updatedAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }) })}`
                            : ''}
                        </span>
                      </span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Mobile-only mini map + address (desktop has it in the sidebar). */}
              <div className="detail-map-card">
                <div className="detail-map-canvas">
                  <MapCanvas
                    pins={[
                      {
                        id: restaurant.id,
                        lat: restaurant.location.lat,
                        lng: restaurant.location.lng,
                        score: restaurant.compositeScore?.toFixed(1) ?? '—',
                        selected: true,
                      },
                    ]}
                  />
                </div>
                <div className="detail-map-foot">
                  <MapPinIcon size={16} className="detail-map-foot-icon" />
                  <span className="detail-map-address">{restaurant.address.fullAddressText}</span>
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="detail-map-open">
                    {t('openMap')}
                  </a>
                </div>
              </div>

              {restaurant.socialLinks.length > 0 ? (
                <SocialLinksCard
                  links={restaurant.socialLinks}
                  heading={t('socialHeading')}
                  caption={t('socialCaption')}
                  verifiedNote={t('socialVerifiedNote')}
                  reportHint={t('socialReportHint')}
                  platformLabel={(platform: SocialPlatform) => t(`socialPlatform.${platform}`)}
                />
              ) : null}

              {!restaurant.hasOwner ? (
                <OwnerClaimForm restaurantId={restaurant.id} isLoggedIn={!!session} />
              ) : null}

            </>
          ) : (
            <>
              {reviewsResponse.items.length === 0 ? (
                <p className="empty-state">{t('noReviews')}</p>
              ) : (
                <>
                  <div className="reviews-summary-card">
                    <div className="reviews-summary-left">
                      <div className="reviews-summary-score">
                        <span className="reviews-summary-score-value">{restaurant.compositeScore?.toFixed(1) ?? '—'}</span>
                        <Stars value={restaurant.compositeScore ?? 0} size={14} />
                        <span className="reviews-summary-score-count">{t('reviewCountShort', { count: restaurant.reviewCount })}</span>
                      </div>
                    </div>
                    <div className="reviews-summary-axis">
                      <span className="reviews-summary-axis-label">{t('criteriaHeading')}</span>
                      <AxisBars items={reviewsResponse.ratingBreakdown} />
                    </div>
                  </div>

                  {reviewsResponse.items.map((review, i) => (
                    <Reveal key={review.id} delay={Math.min(i, 8) * 0.05}>
                      <ReviewCard
                        review={review}
                        locale={locale}
                        isLoggedIn={!!session}
                        reportLabel={t('reportLabel')}
                        helpfulLabel={t('helpfulLabel')}
                        replyPlaceholder={t('replyPlaceholder')}
                        replySubmitLabel={t('replySubmit')}
                      />
                    </Reveal>
                  ))}

                  {reviewTotalPages > 1 ? (
                    <nav className="pagination reviews-pagination" aria-label={t('reviewsPaginationLabel')}>
                      {reviewPage > 1 ? (
                        <Link href={reviewPageHref(reviewPage - 1)} className="reviews-pagination-btn">
                          {tCommon('prev')}
                        </Link>
                      ) : null}
                      <span>{t('pageOfSpaced', { page: reviewPage, totalPages: reviewTotalPages })}</span>
                      {reviewPage < reviewTotalPages ? (
                        <Link href={reviewPageHref(reviewPage + 1)} className="reviews-pagination-btn">
                          {t('seeMoreReviews')}
                        </Link>
                      ) : null}
                    </nav>
                  ) : null}
                </>
              )}

              <div id="write-review">
                {session ? (
                  <WriteReviewForm
                    restaurantId={restaurant.id}
                    slug={restaurant.slug}
                    criteria={reviewsResponse.ratingBreakdown.map((c) => ({ code: c.code, label: c.label }))}
                  />
                ) : (
                  <p className="write-review-login-prompt">
                    <Link href="/login">{tWriteReview('loginToReview')}</Link>
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="detail-sidebar">
          <div className="action-card">
            <a href={directionsHref} target="_blank" rel="noopener noreferrer" className="action-primary action-primary-full">
              <MapPinIcon size={16} />
              {t('directions')}
            </a>
            <div className="action-row">
              <FavoriteButton restaurantId={restaurant.id} />
              <ShareButton title={restaurant.name} />
              <AddToCollectionButton restaurantId={restaurant.id} isLoggedIn={!!session} />
            </div>
            <div className="mini-map">
              <MapCanvas
                pins={[
                  {
                    id: restaurant.id,
                    lat: restaurant.location.lat,
                    lng: restaurant.location.lng,
                    score: restaurant.compositeScore?.toFixed(1) ?? '—',
                    selected: true,
                  },
                ]}
              />
            </div>
          </div>

          <div className="hours-card">
            <div className="hours-card-head">
              <span className="filter-section-title" style={{ padding: 0 }}>
                {t('hoursHeading')}
              </span>
              {openNote ? (
                <OpenBadge
                  isOpen
                  label={todayHours?.isOpen24h ? t('open24h') : tCommon('openNow')}
                  note={todayHours?.isOpen24h ? undefined : openNote}
                />
              ) : null}
            </div>
            {restaurant.openingHours.map((hour) => (
              <div key={hour.dayOfWeek} className={`hours-row ${hour.dayOfWeek === todayIndex ? 'hours-row-highlight' : ''}`}>
                <span className="hours-day">{tLabels(`day.${hour.dayOfWeek}`)}</span>
                <span className="hours-time">
                  {getDayHoursLines(hour, t('closedDay'), t('open24h')).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
              </div>
            ))}
          </div>

          {similar.length > 0 ? (
            <div className="similar-strip-block">
              <div className="similar-strip-head">
                <span className="similar-strip-title">{t('similarHeading')}</span>
                <Link href={`/search?category=${restaurant.categoryCode}`} className="similar-strip-more">
                  {t('seeMoreShort')}
                </Link>
              </div>
              <div className="similar-strip">
                {similar.map((s) => (
                  <Link key={s.id} href={`/restaurant/${s.slug}`} className="similar-strip-card">
                    <span className={`similar-strip-thumb ${s.thumbnailUrl ? '' : placeTileClass(s.id)}`}>
                      {s.thumbnailUrl ? <Image src={s.thumbnailUrl} alt="" fill sizes="150px" style={{ objectFit: 'cover' }} /> : null}
                    </span>
                    <span className="similar-strip-name">{s.name}</span>
                    <span className="similar-strip-score">
                      {s.compositeScore !== null && s.reviewCount > 0 ? (
                        <>
                          <StarIcon size={12} />
                          <span className="similar-strip-score-value">{s.compositeScore.toFixed(1)}</span>
                          <span>({s.reviewCount})</span>
                        </>
                      ) : (
                        <span>{tCommon('noRating')}</span>
                      )}
                    </span>
                    <span className="similar-strip-meta">
                      {[s.area, formatDistance(distanceMeters(restaurant.location, { lat: s.lat, lng: s.lng }), locale)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {similar.length > 0 ? (
            <div className="similar-card">
              <span className="filter-section-title" style={{ padding: 0 }}>
                {t('similarHeading')}
              </span>
              {similar.map((s) => (
                <Link key={s.id} href={`/restaurant/${s.slug}`} className="similar-item">
                  <span className={`similar-tile ${s.thumbnailUrl ? '' : placeTileClass(s.id)}`}>
                    {s.thumbnailUrl ? <Image src={s.thumbnailUrl} alt="" width={44} height={44} /> : null}
                  </span>
                  <span>
                    <span className="similar-name" style={{ display: 'block' }}>
                      {s.name}
                    </span>
                    <span className="similar-meta">
                      {s.compositeScore !== null ? `★ ${s.compositeScore.toFixed(1)}` : tCommon('noRating')}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Mobile-only persistent CTA (see globals.css's `.detail-write-review-fab`)
          — opens the dedicated full-screen write-review route (design's
          "Viết đánh giá" screen); signed-out users go to login first. */}
      <Link href={session ? `/restaurant/${slug}/review` : '/login'} className="detail-write-review-fab">
        <PencilIcon size={18} />
        {tWriteReview('heading')}
      </Link>
    </div>
  );
}
