import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessToken } from '@/lib/auth';
import { getFavorites } from '@/lib/api';
import { RestaurantCard } from '@/components/RestaurantCard';
import { Link } from '@/i18n/navigation';

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
  const token = await getAccessToken();
  if (!token) {
    redirect('/login');
  }

  const search = await searchParams;
  const page = Number(search.page ?? '1') || 1;

  const [t, tCommon] = await Promise.all([getTranslations('favorites'), getTranslations('common')]);
  const result = await getFavorites(token, page);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <h1 className="section-title" style={{ marginTop: 0 }}>
        {t('title')}
      </h1>

      {result.items.length === 0 ? (
        <div className="empty-state">
          <p>{t('empty')}</p>
          <Link href="/search">{tCommon('seeAllRestaurants')}</Link>
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
