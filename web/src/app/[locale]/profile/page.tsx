import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ContributionListResponse, MeResponse, MyReviewListResponse } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { formatRelativeDate, formatVndFull, initialsOf } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { EditProfileForm } from '@/components/EditProfileForm';
import { Stars } from '@/components/Stars';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'profile' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ProfilePage({ params }: PageProps) {
  const { locale } = await params;
  // Three independent, unrelated reads — fired together instead of one
  // after another (each is a real network round-trip; serializing them
  // tripled this page's load time for no reason, same class of issue as
  // the notifications page's N+1 restaurant lookups).
  const [meRes, reviewsRes, contributionsRes] = await Promise.all([
    backendFetchAuthorized('/me'),
    backendFetchAuthorized('/me/reviews?page=1&pageSize=20'),
    // `/me/contributions` covers every contribution type (edit suggestions,
    // status reports, closure reports too) — this section only cares about
    // "restaurants this person has added", so it's filtered client-side
    // rather than adding a `type` filter param to the backend query.
    backendFetchAuthorized('/me/contributions?page=1&pageSize=50'),
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

  const contributions: ContributionListResponse = contributionsRes?.ok
    ? ((await contributionsRes.json()) as ContributionListResponse)
    : { items: [], total: 0, page: 1, pageSize: 50 };
  const addedRestaurants = contributions.items.filter((c) => c.type === 'new_restaurant');

  const [t, tCommon] = await Promise.all([getTranslations('profile'), getTranslations('common')]);
  const displayName = me.profile.displayName || me.user.email.split('@')[0];

  return (
    <div className="container page-sections" style={{ maxWidth: 640 }}>
      <div className="profile-header">
        <span className="profile-avatar" aria-hidden="true">
          {initialsOf(displayName)}
        </span>
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            {displayName}
          </h1>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: 15, margin: '2px 0 0' }}>{me.user.email}</p>
        </div>
      </div>

      <div className="stat-grid profile-stats">
        <div className="stat-card">
          <span className="stat-value font-num">{reviews.total}</span>
          <span className="stat-label">{t('reviewCountLabel')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value font-num">{addedRestaurants.length}</span>
          <span className="stat-label">{t('contributionCountLabel')}</span>
        </div>
      </div>

      <div className="info-card">
        <h2 className="info-card-title">{t('editHeading')}</h2>
        <EditProfileForm
          displayName={me.profile.displayName}
          bio={me.profile.bio ?? ''}
          homeCity={me.profile.homeCity ?? ''}
        />
      </div>

      <div className="section-block-tight">
        <h2 className="section-title" style={{ margin: 0, fontSize: 22 }}>
          {t('myReviewsHeading')}
        </h2>
        {reviews.items.length === 0 ? (
          <p className="empty-state">{t('noReviews')}</p>
        ) : (
          reviews.items.map((review) => (
            <div className="my-review-item" key={review.id}>
              <div className="my-review-header">
                {/* Not a link: MyReviewRestaurantSummaryDto only carries the
                    restaurant's id, but the detail page routes by slug — no
                    cheap way to resolve one from the other here without an
                    extra backend call per review. */}
                <span className="my-review-name">{review.restaurant.name}</span>
                {review.status !== 'published' ? (
                  <span className={`status-badge status-badge-${review.status}`}>{t(`status.${review.status}`)}</span>
                ) : null}
              </div>
              <span className="my-review-score">
                <Stars value={review.overallRating} size={13} />
              </span>
              {review.comment ? <p className="my-review-comment">{review.comment}</p> : null}
              {review.billTotalVnd ? (
                <span className="my-review-bill">{formatVndFull(review.billTotalVnd, locale)}</span>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="section-block-tight">
        <h2 className="section-title" style={{ margin: 0, fontSize: 22 }}>
          {t('myContributionsHeading')}
        </h2>
        {addedRestaurants.length === 0 ? (
          <p className="empty-state">{t('noContributions')}</p>
        ) : (
          addedRestaurants.map((contribution) => {
            const isLive = contribution.status === 'approved' || contribution.status === 'auto_approved';
            return (
              <div className="my-review-item" key={contribution.id}>
                <div className="my-review-header">
                  {/* Not a link: pending/in-review submissions have no slug
                      yet, and resolving one per already-live item here would
                      need an extra backend call — same constraint as the
                      reviews section above. */}
                  <span className="my-review-name">{contribution.targetRestaurantName ?? '—'}</span>
                  {!isLive ? (
                    <span className={`status-badge status-badge-${contribution.status}`}>{t(`status.${contribution.status}`)}</span>
                  ) : null}
                </div>
                <span className="my-review-bill">{formatRelativeDate(contribution.createdAt, locale)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
