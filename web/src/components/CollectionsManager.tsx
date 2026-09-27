'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { CollectionSummaryDto } from '@foodmap/shared-types';
import { Link } from '@/i18n/navigation';
import { deleteCollectionAction } from '@/app/[locale]/collections/actions';
import { CollectionModal } from '@/components/CollectionModal';
import { LockIcon, GlobeIcon } from '@/components/icons';

interface Props {
  initialCollections: CollectionSummaryDto[];
}

// Read-only list, driven entirely by the server-rendered `initialCollections`
// prop — mutations (create in CreateCollectionButton, edit/delete here) all
// go through `router.refresh()` rather than local optimistic state, so this
// component always reflects what the server actually has, including a
// create that happened from a sibling component in the page header.
export function CollectionsManager({ initialCollections: collections }: Props) {
  const t = useTranslations('collections');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CollectionSummaryDto | null>(null);

  function handleDelete(id: string) {
    if (!window.confirm(t('deleteConfirm'))) return;
    startTransition(async () => {
      await deleteCollectionAction(id);
      router.refresh();
    });
  }

  if (collections.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">{t('empty')}</p>
        <p className="empty-state-body">{t('emptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="page-sections">
      {collections.map((collection) => (
        <div key={collection.id} className="info-card">
          <div className="contributed-heading-row">
            <Link href={`/collections/${collection.id}`} className="info-card-title" style={{ textDecoration: 'none', color: 'inherit' }}>
              {collection.name}
            </Link>
            <span className="status-badge">
              {collection.isPublic ? <GlobeIcon size={12} /> : <LockIcon size={12} />}
              {collection.isPublic ? t('publicBadge') : t('privateBadge')}
            </span>
          </div>
          {collection.description ? <p className="page-header-sub" style={{ margin: 0 }}>{collection.description}</p> : null}
          <div className="contributed-heading-row">
            <span className="stat-label">{tCommon('resultCount', { count: collection.itemCount })}</span>
            <div className="chip-row">
              <button type="button" className="profile-review-action" onClick={() => setEditing(collection)}>
                {t('editButton')}
              </button>
              <button
                type="button"
                className="profile-review-action profile-review-action-danger"
                onClick={() => handleDelete(collection.id)}
                disabled={isPending}
              >
                {t('deleteButton')}
              </button>
            </div>
          </div>
        </div>
      ))}

      {editing ? (
        <CollectionModal collection={editing} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />
      ) : null}
    </div>
  );
}
