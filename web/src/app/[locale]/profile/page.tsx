import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type {
  FavoriteListResponse,
  MeResponse,
  MyPhotoListResponse,
  MyReviewListResponse,
} from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { getCuisines } from '@/lib/api';
import { formatJoinDate, initialsOf } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { RestaurantCard } from '@/components/RestaurantCard';
import { ProfileHeaderActions } from '@/components/ProfileHeaderActions';
import { ProfileReviewItem } from '@/components/ProfileReviewItem';
import { ProfileTabs, type ProfileTabKey } from '@/components/ProfileTabs';
import { ProfileSettingsTab } from '@/components/ProfileSettingsTab';
import { StarIcon, CameraIcon, BookmarkIcon, ThumbsUpIcon, PlusIcon, CoffeeIcon, CheckIcon } from '@/components/icons';
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
  const [meRes, reviewsRes, favoritesRes, photosRes, cuisineOptions] = await Promise.all([
    backendFetchAuthorized('/me'),
    backendFetchAuthorized('/me/reviews?page=1&pageSize=20'),
    backendFetchAuthorized('/me/favorites?page=1&pageSize=24'),
    backendFetchAuthorized(`/me/photos?page=1&pageSize=${PHOTOS_TAB_PAGE_SIZE}`),
    getCuisines(),
  ]);
  if (!meRes) {
    redirect('/login');
  }
  if (!meRes.ok) {
    throw new Error(`Backend request failed: GET /me -> ${meRes.status}`);
  }
  const me = (await meRes.json()) as MeResponse;

  const reviews: MyReviewListResponse = reviewsRes?.ok
    ? ((await reviewsRes.json()) as MyReviewListResponse)
    : { items: [], total: 0, page: 1, pageSize: 20 };
  const favorites: FavoriteListResponse = favoritesRes?.ok
    ? ((await favoritesRes.json()) as FavoriteListResponse)
    : { items: [], total: 0, page: 1, pageSize: 24 };
  const photos: MyPhotoListResponse = photosRes?.ok
    ? ((await photosRes.json()) as MyPhotoListResponse)
    : { items: [], total: 0, page: 1, pageSize: PHOTOS_TAB_PAGE_SIZE };

  const [t, tCommon, tLabels] = await Promise.all([
    getTranslations('profile'),
    getTranslations('common'),
    getTranslations('labels'),
  ]);
  const displayName = me.profile.displayName || me.user.email.split('@')[0];
  const { gamification } = me;

  const tabs: { key: ProfileTabKey; label: string; count: number; content: React.ReactNode }[] = [
    {
      key: 'reviews',
      label: t('reviewsTab'),
      count: reviews.total,
      content:
        reviews.items.length === 0 ? (
          <p className="empty-state">{t('noReviews')}</p>
        ) : (
          <div className="section-block-tight">
            {reviews.items.map((review) => (
              <ProfileReviewItem key={review.id} review={review} locale={locale} />
            ))}
          </div>
        ),
    },
    {
      key: 'saved',
      label: t('savedTab'),
      count: favorites.total,
      content:
        favorites.items.length === 0 ? (
          <p className="empty-state">{t('noSaved')}</p>
        ) : (
          <>
            <div className="card-grid">
              {favorites.items.map((favorite) => (
                <RestaurantCard key={favorite.id} restaurant={favorite.restaurant} />
              ))}
            </div>
            {favorites.total > favorites.items.length ? (
              <Link href="/favorites" className="profile-review-action">
                {tCommon('seeAllRestaurants')}
              </Link>
            ) : null}
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
          <div className="profile-photo-grid">
            {photos.items.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element -- external ImageKit/S3 URL
              <img key={photo.id} src={photo.url} alt="" className="profile-photo-tile" />
            ))}
          </div>
        ),
    },
    {
      key: 'settings',
      label: t('settingsTab'),
      count: 0,
      content: <ProfileSettingsTab />,
    },
  ];

  return (
    <div className="container page-sections" style={{ maxWidth: 720 }}>
      <div className="profile-banner">
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
              {me.profile.homeCity ? `${me.profile.homeCity} · ` : ''}
              {t('joinedOn', { date: formatJoinDate(me.user.createdAt, locale) })}
            </p>
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
        <div className="stat-card">
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
            {t('levelProgressHeading')}
          </span>
          <span className="profile-edit-hint">
            {gamification.pointsToNextLevel !== null
              ? t('pointsToNextLevel', { points: gamification.pointsToNextLevel, level: gamification.level + 1 })
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
        {gamification.badges.length > 0 ? (
          <div className="chip-row" style={{ marginTop: 12 }}>
            {gamification.badges.map((badge) => (
              <span key={badge} className={`chip profile-badge-chip profile-badge-chip-${badge}`}>
                {BADGE_ICON[badge]}
                {tLabels(`badge.${badge}`)}
              </span>
            ))}
          </div>
        ) : null}
        <Link href="/about?section=cap-do-thanh-vien" className="profile-level-rules-link">
          {t('levelRulesLink')}
        </Link>
      </div>

      <ProfileTabs tabs={tabs} />
    </div>
  );
}
