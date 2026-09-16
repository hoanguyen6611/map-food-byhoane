import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { MeResponse, MyReviewListResponse } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { formatVndFull, initialsOf } from '@/lib/format';
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
  const meRes = await backendFetchAuthorized('/me');
  if (!meRes) {
    redirect('/login');
  }
  if (!meRes.ok) {
    throw new Error(`Backend request failed: GET /me -> ${meRes.status}`);
  }
  const me = (await meRes.json()) as MeResponse;

  const reviewsRes = await backendFetchAuthorized('/me/reviews?page=1&pageSize=20');
  const reviews: MyReviewListResponse = reviewsRes?.ok
    ? ((await reviewsRes.json()) as MyReviewListResponse)
    : { items: [], total: 0, page: 1, pageSize: 20 };

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
          <p style={{ color: 'var(--color-ink-muted)', fontSize: 13, margin: '2px 0 0' }}>{me.user.email}</p>
        </div>
      </div>

      <div className="stat-grid profile-stats">
        <div className="stat-card">
          <span className="stat-value font-num">{reviews.total}</span>
          <span className="stat-label">{t('reviewCountLabel')}</span>
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
        <h2 className="section-title" style={{ margin: 0, fontSize: 20 }}>
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

      <p style={{ marginTop: 8 }}>
        <Link href="/">{tCommon('home')}</Link>
      </p>
    </div>
  );
}
