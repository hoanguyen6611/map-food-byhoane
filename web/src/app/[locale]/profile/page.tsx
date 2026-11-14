import type { Metadata } from 'next';
import { redirectToLogin } from '@/lib/require-login';
import { getTranslations } from 'next-intl/server';
import type {
  FavoriteListResponse,
  MeResponse,
  MyPhotoListResponse,
  MyReviewListResponse,
  PublicProfileDto,
} from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { getCuisines, getWebPushPublicKey } from '@/lib/api';
import { formatJoinDate, initialsOf } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { ProfileHeaderActions } from '@/components/ProfileHeaderActions';
import { ProfileReviewItem } from '@/components/ProfileReviewItem';
import { ContributedRestaurantsList } from '@/components/ContributedRestaurantsList';
import { PlaceRow } from '@/components/PlaceRow';
import { ProfileTabs, type ProfileTabKey } from '@/components/ProfileTabs';
import { ProfileSettingsTab } from '@/components/ProfileSettingsTab';
import {
  StarIcon,
  CameraIcon,
  BookmarkIcon,
  ThumbsUpIcon,
  PlusIcon,
  CoffeeIcon,
  CheckIcon,
  ListViewIcon,
  MenuFolderIcon,
  ChevronRightIcon,
} from '@/components/icons';
import type { BadgeCode } from '@foodmap/shared-types';

const BADGE_ICON: Record<BadgeCode, React.ReactNode> = {
  contributor_10: <PlusIcon size={13} />,
  coffee_hunter: <CoffeeIcon size={13} />,
  helpful_100: <CheckIcon size={13} />,
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'profile' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

const PHOTOS_TAB_PAGE_SIZE = 30;

export default async function ProfilePage({ params }: PageProps) {
  const { locale } = await params;
  // Independent, unrelated reads — fired together (see this page's earlier
  // comment history for why serializing them was a real perf bug before).
  const [meRes, reviewsRes, favoritesRes, photosRes, cuisineOptions, webPushPublicKey] = await Promise.all([
    backendFetchAuthorized('/me'),
    backendFetchAuthorized('/me/reviews?page=1&pageSize=20'),
    backendFetchAuthorized('/me/favorites?page=1&pageSize=24'),
    backendFetchAuthorized(`/me/photos?page=1&pageSize=${PHOTOS_TAB_PAGE_SIZE}`),
    getCuisines(),
    getWebPushPublicKey(),
  ]);
  if (!meRes) {
    redirectToLogin('/profile');
  }
  if (!meRes.ok) {
    throw new Error(`Backend request failed: GET /me -> ${meRes.status}`);
  }
  const me = (await meRes.json()) as MeResponse;

  // Reuses the public profile endpoint purely for `contributedRestaurants`
  // (same data B's public /profile/[id] page shows) — `viewerId === targetId`
  // bypasses the isPublic gate server-side, so this works even with the
  // "hiện hồ sơ công khai" toggle off. No dedicated "my contributed
  // restaurants" endpoint exists, and building one just to avoid this one
  // reused call isn't worth it for a single capped-at-12 list.
  const contributedRes = await backendFetchAuthorized(`/users/${me.user.id}`);
  const contributedRestaurants = contributedRes?.ok
    ? ((await contributedRes.json()) as PublicProfileDto).contributedRestaurants
    : [];

  const reviews: MyReviewListResponse = reviewsRes?.ok
    ? ((await reviewsRes.json()) as MyReviewListResponse)
    : { items: [], total: 0, page: 1, pageSize: 20 };
  const favorites: FavoriteListResponse = favoritesRes?.ok
    ? ((await favoritesRes.json()) as FavoriteListResponse)
    : { items: [], total: 0, page: 1, pageSize: 24 };
  const photos: MyPhotoListResponse = photosRes?.ok
    ? ((await photosRes.json()) as MyPhotoListResponse)
    : { items: [], total: 0, page: 1, pageSize: PHOTOS_TAB_PAGE_SIZE };

  const [t, tAuth, tLabels] = await Promise.all([
    getTranslations('profile'),
    getTranslations('auth'),
    getTranslations('labels'),
  ]);
  const displayName = me.profile.displayName || me.user.email.split('@')[0];
  const { gamification } = me;
  // Profile's "Đã lưu" tab is a glance-level preview (3 rows + a link to the
  // full page), not the full list — FavoriteRestaurantSummaryDto already
  // carries everything PlaceRow needs directly, no category-label lookup
  // required (that was only for the old full-list rendering this replaces).
  const savedMini = favorites.items.slice(0, 3).map((favorite) => ({
    id: favorite.restaurant.id,
    slug: favorite.restaurant.slug,
    name: favorite.restaurant.name,
    thumbnailUrl: favorite.restaurant.thumbnailUrl,
    compositeScore: favorite.restaurant.compositeScore,
    reviewCount: favorite.restaurant.reviewCount,
    priceRange: favorite.restaurant.priceRange,
  }));
  const photosRemaining = photos.total - photos.items.length;

  // Order matches the redesign's `pTabs` (Đánh giá/Đóng góp/Ảnh/Đã lưu) —
  // Settings is no longer one of these tabs (see the page's own doc comment
  // further down on why it's now an always-visible section instead).
  const tabs: { key: ProfileTabKey; label: string; count: number; content: React.ReactNode }[] = [
    {
      key: 'reviews',
      label: t('reviewsTab'),
      count: reviews.total,
      content:
        reviews.items.length === 0 ? (
          <p className="empty-state">{t('noReviews')}</p>
        ) : (
          <>
            <div className="profile-tab-panel-head">
              <span className="profile-tab-panel-count">{t('myReviewsCountLabel', { count: reviews.total })}</span>
            </div>
            <div className="section-block-tight">
              {reviews.items.map((review) => (
                <ProfileReviewItem key={review.id} review={review} locale={locale} />
              ))}
            </div>
          </>
        ),
    },
    {
      key: 'contributed',
      label: t('contributedTab'),
      count: contributedRestaurants.length,
      content: (
        <>
          <div className="profile-tab-panel-head">
            <span className="profile-tab-panel-count">
              {t('contributedCountLabel', { count: contributedRestaurants.length })}
            </span>
          </div>
          {contributedRestaurants.length === 0 ? (
            <p className="empty-state">{t('noContributed')}</p>
          ) : (
            <ContributedRestaurantsList restaurants={contributedRestaurants} />
          )}
        </>
      ),
    },
    {
      key: 'photos',
      label: t('photosTab'),
      count: photos.total,
      content:
        photos.items.length === 0 ? (
          <p className="empty-state">{t('noPhotos')}</p>
        ) : (
          <>
            <div className="profile-tab-panel-head">
              <span className="profile-tab-panel-count">{t('photosCountLabel', { count: photos.total })}</span>
            </div>
            <div className="profile-photo-grid">
              {photos.items.map((photo, i) => (
                <div key={photo.id} className="profile-photo-tile-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external ImageKit/S3 URL */}
                  <img src={photo.url} alt="" className="profile-photo-tile" />
                  {i === photos.items.length - 1 && photosRemaining > 0 ? (
                    <span className="profile-photo-more-overlay">+{photosRemaining}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ),
    },
    {
      key: 'saved',
      label: t('savedTab'),
      count: favorites.total,
      content: (
        <>
          <div className="profile-tab-panel-head">
            <span className="profile-tab-panel-count">{t('savedMiniCountLabel', { count: favorites.total })}</span>
            <Link href="/favorites" className="profile-tab-panel-action">
              {t('openSavedCta')}
            </Link>
          </div>
          {savedMini.length === 0 ? (
            <p className="empty-state">{t('noSaved')}</p>
          ) : (
            <div className="profile-saved-mini-list">
              {savedMini.map((restaurant) => (
                <PlaceRow key={restaurant.id} restaurant={restaurant} thumb={44} showStatus={false} />
              ))}
            </div>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="container page-sections" style={{ maxWidth: 720 }}>
      <div className="profile-banner">
        {/* Mobile-only (see globals.css's 768px breakpoint) — desktop's
            existing full-card gradient covers this same role there, so an
            empty cover strip would just double up behind it. */}
        <div className="profile-banner-cover" aria-hidden="true" />
        <div className="profile-banner-content">
          {me.profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external ImageKit/S3 URL
            <img src={me.profile.avatarUrl} alt="" className="profile-avatar profile-avatar-img profile-banner-avatar" />
          ) : (
            <span className="profile-avatar profile-banner-avatar" aria-hidden="true">
              {initialsOf(displayName)}
            </span>
          )}
          <div className="profile-banner-info">
            <div className="profile-banner-name-row">
              <h1 className="section-title" style={{ margin: 0 }}>
                {displayName}
              </h1>
              <span className="status-badge profile-level-badge">
                <StarIcon size={13} filled />
                {t('levelBadge', { level: gamification.level })}
              </span>
            </div>
            <p className="profile-banner-meta">
              {me.profile.username ? `@${me.profile.username} · ` : ''}
              {t('joinedOn', { date: formatJoinDate(me.user.createdAt, locale) })}
            </p>
            {me.profile.homeCity ? <p className="profile-banner-meta">{me.profile.homeCity}</p> : null}
            {me.profile.bio ? <p className="profile-banner-bio">{me.profile.bio}</p> : null}
          </div>
          <ProfileHeaderActions profile={me.profile} cuisineOptions={cuisineOptions} shareTitle={displayName} />
        </div>
      </div>

      <div className="stat-grid profile-stats">
        <div className="stat-card">
          <span className="profile-stat-label-row">
            <span className="profile-stat-icon profile-stat-icon-star">
              <StarIcon size={13} filled />
            </span>
            <span className="stat-label">{t('reviewCountLabel')}</span>
          </span>
          <span className="stat-value font-num">{reviews.total}</span>
        </div>
        <div className="stat-card">
          <span className="profile-stat-label-row">
            <span className="profile-stat-icon profile-stat-icon-photo">
              <CameraIcon size={13} />
            </span>
            <span className="stat-label">{t('photoCountLabel')}</span>
          </span>
          <span className="stat-value font-num">{photos.total}</span>
        </div>
        <div className="stat-card profile-stat-saved">
          <span className="profile-stat-label-row">
            <span className="profile-stat-icon profile-stat-icon-saved">
              <BookmarkIcon size={13} filled />
            </span>
            <span className="stat-label">{t('savedCountLabel')}</span>
          </span>
          <span className="stat-value font-num">{favorites.total}</span>
        </div>
        <div className="stat-card">
          <span className="profile-stat-label-row">
            <span className="profile-stat-icon profile-stat-icon-helpful">
              <ThumbsUpIcon size={13} />
            </span>
            <span className="stat-label">{t('helpfulCountLabel')}</span>
          </span>
          <span className="stat-value font-num">{gamification.helpfulVotesReceived}</span>
        </div>
      </div>

      <div className="info-card profile-level-card">
        <div className="profile-level-head">
          <span className="info-card-title" style={{ margin: 0 }}>
            {gamification.nextLevelThreshold !== null
              ? t('levelProgressToHeading', { level: gamification.level + 1 })
              : t('levelProgressHeading')}
          </span>
          <span className="profile-edit-hint">
            {gamification.nextLevelThreshold !== null
              ? t('pointsProgress', { points: gamification.points, threshold: gamification.nextLevelThreshold })
              : t('maxLevelReached')}
          </span>
        </div>
        <span className="profile-level-track">
          <span
            className="profile-level-fill"
            style={{
              width:
                gamification.nextLevelThreshold === null
                  ? '100%'
                  : `${Math.min(100, (gamification.points / gamification.nextLevelThreshold) * 100)}%`,
            }}
          />
        </span>
        {gamification.pointsToNextLevel !== null ? (
          <span className="profile-level-hint">
            {t('pointsToNextLevel', { points: gamification.pointsToNextLevel, level: gamification.level + 1 })}
          </span>
        ) : null}
        {gamification.badges.length > 0 ? (
          <>
            <hr className="filter-rule" style={{ margin: '12px 0 0' }} />
            <span className="profile-badges-earned-label">
              {t('badgesEarnedLabel', { count: gamification.badges.length })}
            </span>
            <div className="chip-row" style={{ marginTop: 6 }}>
              {gamification.badges.map((badge) => (
                <span key={badge} className={`chip profile-badge-chip profile-badge-chip-${badge}`}>
                  {BADGE_ICON[badge]}
                  {tLabels(`badge.${badge}`)}
                </span>
              ))}
            </div>
          </>
        ) : null}
        <Link href="/about?section=cap-do-thanh-vien" className="profile-level-rules-link">
          {t('levelRulesLink')}
        </Link>
      </div>

      <ProfileTabs tabs={tabs} />

      {/* Feed/Collections moved here (mobile's hamburger menu — the only
          other place they used to live — was removed entirely). Both
          require being logged in already (same as this whole page), unlike
          Bản đồ/Xếp hạng, which stayed public — see Home page's own quick-
          link row for those two instead of here. */}
      <div className="profile-settings-section">
        <span className="filter-section-title">{t('exploreMoreHeading')}</span>
        <div className="profile-settings-card">
          <Link href="/feed" className="profile-settings-row">
            <ListViewIcon size={18} aria-hidden="true" />
            <span className="profile-settings-row-label">{tAuth('feedLink')}</span>
            <ChevronRightIcon size={15} className="profile-settings-row-chevron" />
          </Link>
          <Link href="/collections" className="profile-settings-row">
            <MenuFolderIcon size={18} aria-hidden="true" />
            <span className="profile-settings-row-label">{tAuth('collectionsLink')}</span>
            <ChevronRightIcon size={15} className="profile-settings-row-chevron" />
          </Link>
          <Link href="/add-restaurant" className="profile-settings-row">
            <PlusIcon size={18} aria-hidden="true" />
            <span className="profile-settings-row-label">{t('suggestRestaurantRow')}</span>
            <ChevronRightIcon size={15} className="profile-settings-row-chevron" />
          </Link>
        </div>
      </div>

      {/* Always visible, not a 5th tab — the redesign's "Cài đặt" section
          sits directly below the tabbed content on the same scroll, not
          behind an extra tap (and sign-out specifically also needs to stay
          reachable without digging through tabs — see
          ProfileHeaderActions.tsx's own floating copy). */}
      <div className="profile-settings-section">
        <span className="filter-section-title">{t('settingsTab')}</span>
        <ProfileSettingsTab webPushPublicKey={webPushPublicKey} />
      </div>
    </div>
  );
}
