import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { CollectionDetailDto } from '@foodmap/shared-types';
import { backendFetchOptionalAuth } from '@/lib/auth';
import { RestaurantCard } from '@/components/RestaurantCard';
import { RemoveFromCollectionButton } from '@/components/RemoveFromCollectionButton';
import { CollectionEditButton } from '@/components/CollectionEditButton';
import { LockIcon, GlobeIcon } from '@/components/icons';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const res = await backendFetchOptionalAuth(`/collections/${id}`);
  if (!res.ok) return { title: (await getTranslations({ locale, namespace: 'collections' }))('notFoundTitle') };
  const collection = (await res.json()) as CollectionDetailDto;
  return { title: collection.name, robots: { index: false, follow: false } };
}

// Public — a collection's own `isPublic` flag (not a route guard) decides
// visibility; the backend 404s for a private collection unless the viewer
// owns it (see CollectionService.getDetail), same convention as the public
// profile route.
export default async function CollectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const res = await backendFetchOptionalAuth(`/collections/${id}`);
  if (res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    throw new Error(`Backend request failed: GET /collections/${id} -> ${res.status}`);
  }

  const t = await getTranslations('collections');
  const collection = (await res.json()) as CollectionDetailDto;

  return (
    <div className="container page-sections">
      <div className="page-header">
        <div>
          <div className="contributed-heading-row">
            <h1 className="section-title" style={{ margin: 0 }}>
              {collection.name}
            </h1>
            <span className="status-badge">
              {collection.isPublic ? <GlobeIcon size={12} /> : <LockIcon size={12} />}
              {collection.isPublic ? t('publicBadge') : t('privateBadge')}
            </span>
          </div>
          {collection.description ? <p className="page-header-sub">{collection.description}</p> : null}
        </div>
        {collection.isOwner ? <CollectionEditButton collection={collection} /> : null}
      </div>

      {collection.items.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">{t('emptyItems')}</p>
        </div>
      ) : (
        <div className="card-grid">
          {collection.items.map((item) => (
            <div key={item.restaurant.id}>
              <RestaurantCard restaurant={item.restaurant} />
              {collection.isOwner ? (
                <RemoveFromCollectionButton collectionId={collection.id} restaurantId={item.restaurant.id} />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
