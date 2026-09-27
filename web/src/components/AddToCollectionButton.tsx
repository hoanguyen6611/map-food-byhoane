'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CollectionSummaryDto } from '@foodmap/shared-types';
import { addToCollectionAction, createCollectionAction, listMyCollectionsAction } from '@/app/[locale]/collections/actions';
import { PlusIcon, MenuFolderIcon, CheckIcon } from '@/components/icons';

interface Props {
  restaurantId: string;
  isLoggedIn: boolean;
}

// Restaurant detail page's "Thêm vào bộ sưu tập" — a dropdown fetching the
// viewer's own collections on open (small dataset, no separate global
// context needed the way FavoritesProvider is for the favorites Set) with
// an inline "+ create new" row, since a first-time user has no collections
// yet to pick from.
export function AddToCollectionButton({ restaurantId, isLoggedIn }: Props) {
  const t = useTranslations('collections');
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionSummaryDto[] | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleOpen() {
    setOpen((v) => !v);
    if (collections === null) {
      const result = await listMyCollectionsAction();
      setCollections(result?.items ?? []);
    }
  }

  async function handleAdd(collectionId: string) {
    setAddedIds((prev) => new Set(prev).add(collectionId));
    await addToCollectionAction(collectionId, restaurantId);
  }

  async function handleCreateAndAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    const result = await createCollectionAction(trimmed);
    setCreating(false);
    if (!result.ok) return;
    setCollections((prev) => [result.data, ...(prev ?? [])]);
    setNewName('');
    await handleAdd(result.data.id);
  }

  if (!isLoggedIn) return null;

  return (
    <div className="account-menu-wrap" ref={menuRef}>
      <button
        type="button"
        className="action-icon-btn"
        onClick={handleOpen}
        aria-expanded={open}
        aria-label={t('addToCollectionButton')}
        title={t('addToCollectionButton')}
      >
        <MenuFolderIcon size={17} />
      </button>

      {open ? (
        <div className="account-menu" role="menu" style={{ minWidth: 240 }}>
          {collections === null ? (
            <span className="account-menu-item">{t('loading')}</span>
          ) : collections.length === 0 ? (
            <span className="account-menu-item">{t('noCollectionsYet')}</span>
          ) : (
            collections.map((c) => (
              <button
                key={c.id}
                type="button"
                className="account-menu-item"
                onClick={() => handleAdd(c.id)}
                disabled={addedIds.has(c.id)}
              >
                {addedIds.has(c.id) ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                {c.name}
              </button>
            ))
          )}
          <span className="account-menu-divider" />
          <div className="account-menu-item" style={{ gap: 8 }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('newCollectionPlaceholder')}
              maxLength={80}
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateAndAdd();
              }}
            />
            <button type="button" onClick={handleCreateAndAdd} disabled={creating || !newName.trim()} aria-label={t('createButton')}>
              <PlusIcon size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
