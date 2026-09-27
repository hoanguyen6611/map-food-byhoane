'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { CollectionDetailDto } from '@foodmap/shared-types';
import { CollectionModal } from '@/components/CollectionModal';

interface Props {
  collection: CollectionDetailDto;
}

export function CollectionEditButton({ collection }: Props) {
  const t = useTranslations('collections');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="secondary-btn" onClick={() => setOpen(true)}>
        {t('editButton')}
      </button>
      {open ? (
        <CollectionModal
          collection={collection}
          onClose={() => setOpen(false)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
