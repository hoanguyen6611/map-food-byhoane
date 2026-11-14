import type { Metadata } from 'next';
import { redirectToLogin } from '@/lib/require-login';
import { getTranslations } from 'next-intl/server';
import type { FavoriteListResponse } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { RestaurantCard } from '@/components/RestaurantCard';
import { SavedRow } from '@/components/SavedRow';
import { Link } from '@/i18n/navigation';
import { BookmarkIcon } from '@/components/icons';
import { formatPriceRange, placeTileClass } from '@/lib/format';

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
    redirectToLogin('/favorites');
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
          <h1 className="section-title favorites-title" style={{ margin: 0 }}>
            <span className="favorites-title-desktop">{t('title')}</span>
            <span className="favorites-title-mobile">{t('mobileTitle')}</span>
          </h1>
          <p className="page-header-sub">{t('subtitle', { count: result.total })}</p>
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="empty-state favorites-empty">
          <span className="empty-state-icon">
            <BookmarkIcon size={30} />
          </span>
          <p className="empty-state-title">{t('empty')}</p>
          <p className="empty-state-body">{t('emptyBody')}</p>
          <Link href="/map" className="btn-dark btn-dark-lg">
            {t('emptyCta')}
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop keeps the photo-forward grid; mobile switches to the
              redesign's compact list rows (`.favorites-list` — see
              globals.css's 768px breakpoint) instead of a second,
              narrower copy of the same grid. */}
          <div className="card-grid favorites-grid">
            {result.items.map((favorite) => (
              <RestaurantCard key={favorite.id} restaurant={favorite.restaurant} />
            ))}
          </div>
          <div className="favorites-list">
            {result.items.map((favorite) => {
              const r = favorite.restaurant;
              const priceLabel = formatPriceRange(r.priceRange, tCommon);
              return (
                <SavedRow
                  key={favorite.id}
                  restaurantId={r.id}
                  slug={r.slug}
                  name={r.name}
                  meta={[r.district, priceLabel ? `${priceLabel}đ` : null].filter(Boolean).join(' · ')}
                  thumbnailUrl={r.thumbnailUrl}
                  tileClass={placeTileClass(r.id)}
                  score={r.reviewCount > 0 ? r.compositeScore : null}
                  reviewCount={r.reviewCount}
                  noRatingLabel={tCommon('noRating')}
                  removeLabel={tCommon('favoriteRemove')}
                  reviewLabel={t('reviewCta')}
                />
              );
            })}
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
