import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { FavoriteListResponse } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { RestaurantCard } from '@/components/RestaurantCard';
import { Link } from '@/i18n/navigation';
import { BookmarkIcon } from '@/components/icons';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'favorites' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function FavoritesPage({ searchParams }: PageProps) {
  const search = await searchParams;
  const page = Number(search.page ?? '1') || 1;

  // `backendFetchAuthorized` refreshes an expired access token once before
  // giving up — a `null` here means there's truly no session (never logged
  // in, or the refresh token itself is dead), which is the actual "go log
  // in" case, not just "the 15-minute access token happened to be stale."
  const res = await backendFetchAuthorized(`/me/favorites?page=${page}`);
  if (!res) {
    redirect('/login');
  }
  if (!res.ok) {
    throw new Error(`Backend request failed: GET /me/favorites -> ${res.status}`);
  }

  const [t, tCommon] = await Promise.all([getTranslations('favorites'), getTranslations('common')]);
  const result = (await res.json()) as FavoriteListResponse;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="container page-sections">
      <div className="page-header favorites-page-header">
        <span className="favorites-header-icon" aria-hidden="true">
          <BookmarkIcon size={20} />
        </span>
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            {t('title')}
          </h1>
          <p className="page-header-sub">{t('subtitle', { count: result.total })}</p>
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            <BookmarkIcon size={26} />
          </span>
          <p className="empty-state-title">{t('empty')}</p>
          <p className="empty-state-body">{t('emptyBody')}</p>
          <Link href="/search" className="btn-dark btn-dark-lg">
            {tCommon('seeAllRestaurants')}
          </Link>
        </div>
      ) : (
        <>
          <div className="card-grid">
            {result.items.map((favorite) => (
              <RestaurantCard key={favorite.id} restaurant={favorite.restaurant} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="pagination">
              {page > 1 ? <Link href={`/favorites?page=${page - 1}`}>{tCommon('prev')}</Link> : null}
              <span>{tCommon('pageOf', { page, totalPages })}</span>
              {page < totalPages ? <Link href={`/favorites?page=${page + 1}`}>{tCommon('next')}</Link> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
