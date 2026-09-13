import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { MeResponse, MyReviewListResponse } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { formatVndFull } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { EditProfileForm } from '@/components/EditProfileForm';

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

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <h1 className="section-title" style={{ marginTop: 0 }}>
        {t('title')}
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: -8 }}>{me.user.email}</p>

      <div className="profile-stats">
        <div className="profile-stat">
          <strong>{reviews.total}</strong>
          <span>{t('reviewCountLabel')}</span>
        </div>
      </div>

      <EditProfileForm
        displayName={me.profile.displayName}
        bio={me.profile.bio ?? ''}
        homeCity={me.profile.homeCity ?? ''}
      />

      <h2 className="section-title">{t('myReviewsHeading')}</h2>
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
              <strong>{review.restaurant.name}</strong>
              {review.status !== 'published' ? (
                <span className={`status-badge status-badge-${review.status}`}>
                  {t(`status.${review.status}`)}
                </span>
              ) : null}
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 13 }}>★ {review.overallRating}</p>
            {review.comment ? <p style={{ margin: 0 }}>{review.comment}</p> : null}
            {review.billTotalVnd ? (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {formatVndFull(review.billTotalVnd, locale)}
              </p>
            ) : null}
          </div>
        ))
      )}
      <p style={{ marginTop: 24 }}>
        <Link href="/">{tCommon('home')}</Link>
      </p>
    </div>
  );
}
