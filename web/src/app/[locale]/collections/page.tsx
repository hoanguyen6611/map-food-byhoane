import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { CollectionListResponse } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';
import { CollectionsManager } from '@/components/CollectionsManager';
import { CreateCollectionButton } from '@/components/CreateCollectionButton';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'collections' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

// Same "no session at all" gate as favorites/page.tsx.
export default async function CollectionsPage() {
  const res = await backendFetchAuthorized('/me/collections');
  if (!res) {
    redirect('/login');
  }
  if (!res.ok) {
    throw new Error(`Backend request failed: GET /me/collections -> ${res.status}`);
  }

  const t = await getTranslations('collections');
  const { items } = (await res.json()) as CollectionListResponse;

  return (
    <div className="container page-sections">
      <div className="page-header page-header-row">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            {t('title')}
          </h1>
          <p className="page-header-sub">{t('subtitle')}</p>
        </div>
        <CreateCollectionButton />
      </div>

      <CollectionsManager initialCollections={items} />
    </div>
  );
}
