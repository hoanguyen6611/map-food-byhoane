'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { CollectionModal } from '@/components/CollectionModal';
import { PlusIcon } from '@/components/icons';

// Standalone (not part of CollectionsManager's own state) so it can sit in
// the page header next to the title instead of stretching full-width above
// the list — on save it just refreshes the server-rendered page, same
// pattern as CollectionEditButton, rather than needing to share state with
// a separate client component instance.
export function CreateCollectionButton() {
  const t = useTranslations('collections');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn-dark" onClick={() => setOpen(true)}>
        <PlusIcon size={15} />
        {t('createButton')}
      </button>
      {open ? (
        <CollectionModal onClose={() => setOpen(false)} onSaved={() => router.refresh()} />
      ) : null}
    </>
  );
}
