import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { PublicProfileDto, PublicProfileReviewListResponse } from '@foodmap/shared-types';
import { backendFetchOptionalAuth, getSessionUserId } from '@/lib/auth';
import { formatJoinDate, formatRelativeDate, initialsOf } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { Stars } from '@/components/Stars';
import { ReviewCardPhotos } from '@/components/ReviewCardPhotos';
import { FollowButton } from '@/components/FollowButton';
import { ContributedRestaurantsList } from '@/components/ContributedRestaurantsList';
import { StarIcon } from '@/components/icons';

const REVIEWS_PAGE_SIZE = 20;

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const res = await backendFetchOptionalAuth(`/users/${id}`);
  if (!res.ok) return { title: (await getTranslations({ locale, namespace: 'publicProfile' }))('notFoundTitle') };
  const profile = (await res.json()) as PublicProfileDto;
  return { title: profile.displayName, robots: { index: false, follow: false } };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { locale, id } = await params;

  const viewerId = await getSessionUserId();
  if (viewerId === id) {
    // Own profile — the richer self-management page (edit/settings/saved
    // places) is the real destination, not this read-only public view.
    redirect('/profile');
  }

  const [profileRes, reviewsRes] = await Promise.all([
    backendFetchOptionalAuth(`/users/${id}`),
    backendFetchOptionalAuth(`/users/${id}/reviews?page=1&pageSize=${REVIEWS_PAGE_SIZE}`),
  ]);
  if (profileRes.status === 404) {
    notFound();
  }
  if (!profileRes.ok) {
    throw new Error(`Backend request failed: GET /users/${id} -> ${profileRes.status}`);
  }
  const profile = (await profileRes.json()) as PublicProfileDto;
  const reviews: PublicProfileReviewListResponse = reviewsRes.ok
    ? ((await reviewsRes.json()) as PublicProfileReviewListResponse)
    : { items: [], total: 0, page: 1, pageSize: REVIEWS_PAGE_SIZE };

  const [t, tProfile] = await Promise.all([getTranslations('publicProfile'), getTranslations('profile')]);
  const { gamification } = profile;

  return (
    <div className="container page-sections" style={{ maxWidth: 720 }}>
      <div className="profile-banner">
        <div className="profile-banner-content">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external ImageKit/S3 URL
            <img src={profile.avatarUrl} alt="" className="profile-avatar profile-avatar-img profile-banner-avatar" />
          ) : (
            <span className="profile-avatar profile-banner-avatar" aria-hidden="true">
              {initialsOf(profile.displayName)}
            </span>
          )}
          <div className="profile-banner-info">
            <div className="profile-banner-name-row">
              <h1 className="section-title" style={{ margin: 0 }}>
                {profile.displayName}
              </h1>
              <span className="status-badge profile-level-badge">
                <StarIcon size={13} filled />
                {tProfile('levelBadge', { level: gamification.level })}
              </span>
            </div>
            <p className="profile-banner-meta">
              {profile.username ? `@${profile.username} · ` : ''}
              {profile.homeCity ? `${profile.homeCity} · ` : ''}
              {tProfile('joinedOn', { date: formatJoinDate(profile.createdAt, locale) })}
            </p>
            {profile.bio ? <p className="profile-banner-bio">{profile.bio}</p> : null}
          </div>
          <FollowButton
            targetUserId={profile.id}
            initialIsFollowing={profile.isFollowedByViewer}
            initialFollowerCount={profile.followerCount}
            isLoggedIn={viewerId !== null}
          />
        </div>
      </div>

      <div className="stat-grid profile-stats">
        <div className="stat-card">
          <span className="profile-stat-label-row">
            <span className="profile-stat-icon profile-stat-icon-star">
              <StarIcon size={13} filled />
            </span>
            <span className="stat-label">{tProfile('reviewCountLabel')}</span>
          </span>
          <span className="stat-value font-num">{profile.reviewCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">{t('followerCountLabel')}</span>
          <span className="stat-value font-num">{profile.followerCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">{t('followingCountLabel')}</span>
          <span className="stat-value font-num">{profile.followingCount}</span>
        </div>
      </div>

      {profile.contributedRestaurants.length > 0 ? (
        <div className="section-block">
          <div className="contributed-heading-row">
            <h2 className="section-title">{t('contributedHeading')}</h2>
            <span className="stat-label">{t('contributedCount', { count: profile.contributedRestaurants.length })}</span>
          </div>
          <ContributedRestaurantsList restaurants={profile.contributedRestaurants} />
        </div>
      ) : null}

      <div className="section-block">
        <h2 className="section-title">{tProfile('reviewsTab')}</h2>
        {reviews.items.length === 0 ? (
          <p className="empty-state">{t('noReviews')}</p>
        ) : (
          <div className="section-block-tight">
            {reviews.items.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-card-header">
                  <Stars value={review.overallRating} size={14} />
                  <span className="review-card-when">{formatRelativeDate(review.createdAt, locale)}</span>
                </div>
                <Link href={`/restaurant/${review.restaurant.slug}`} className="place-row-name">
                  {review.restaurant.name}
                </Link>
                {review.comment ? <p className="review-card-body">{review.comment}</p> : null}
                {review.photos.length > 0 ? <ReviewCardPhotos photos={review.photos} /> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
