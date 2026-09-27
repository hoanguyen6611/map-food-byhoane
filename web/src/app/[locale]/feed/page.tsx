import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { FeedResponse } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { formatRelativeDate, initialsOf } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { Stars } from '@/components/Stars';
import { ReviewCardPhotos } from '@/components/ReviewCardPhotos';
import { BellIcon } from '@/components/icons';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'feed' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function FeedPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const search = await searchParams;
  const page = Number(search.page ?? '1') || 1;

  // Same "no session at all" gate as favorites/page.tsx — `backendFetchAuthorized`
  // already retried an expired access token once before giving up.
  const res = await backendFetchAuthorized(`/me/feed?page=${page}`);
  if (!res) {
    redirect('/login');
  }
  if (!res.ok) {
    throw new Error(`Backend request failed: GET /me/feed -> ${res.status}`);
  }

  const [t, tCommon] = await Promise.all([getTranslations('feed'), getTranslations('common')]);
  const result = (await res.json()) as FeedResponse;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="container page-sections" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            {t('title')}
          </h1>
          <p className="page-header-sub">{t('subtitle')}</p>
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            <BellIcon size={26} />
          </span>
          <p className="empty-state-title">{t('empty')}</p>
          <p className="empty-state-body">{t('emptyBody')}</p>
        </div>
      ) : (
        <>
          <div className="leaderboard-list">
            {result.items.map((item) => (
              <div key={item.id} className="feed-row">
                <Link href={`/restaurant/${item.restaurant.slug}`} className="feed-row-header">
                  <span className="leaderboard-avatar">
                    {item.author.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external ImageKit/S3 URL
                      <img src={item.author.avatarUrl} alt="" />
                    ) : (
                      initialsOf(item.author.displayName)
                    )}
                  </span>
                  <span className="leaderboard-body">
                    <span className="leaderboard-name">
                      {t('reviewedLine', { name: item.author.displayName, restaurant: item.restaurant.name })}
                    </span>
                    <span className="leaderboard-meta">
                      <Stars value={item.overallRating} size={11} /> {formatRelativeDate(item.createdAt, locale)}
                    </span>
                    {item.comment ? <span className="leaderboard-comment">{item.comment}</span> : null}
                  </span>
                </Link>
                {item.photos.length > 0 ? <ReviewCardPhotos photos={item.photos} /> : null}
              </div>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="pagination">
              {page > 1 ? <Link href={`/feed?page=${page - 1}`}>{tCommon('prev')}</Link> : null}
              <span>{tCommon('pageOf', { page, totalPages })}</span>
              {page < totalPages ? <Link href={`/feed?page=${page + 1}`}>{tCommon('next')}</Link> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
