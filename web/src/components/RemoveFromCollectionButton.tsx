'use client';

import { useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { removeFromCollectionAction } from '@/app/[locale]/collections/actions';

interface Props {
  collectionId: string;
  restaurantId: string;
}

// RestaurantCard is itself an async Server Component, so it can't be
// imported/rendered from inside a client component — this sits as a plain
// sibling below each card in the server-rendered grid instead of wrapping
// it, and just refreshes the server page on success (removalist state
// doesn't need to live on the client for a page this simple).
export function RemoveFromCollectionButton({ collectionId, restaurantId }: Props) {
  const t = useTranslations('collections');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await removeFromCollectionAction(collectionId, restaurantId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className="profile-review-action profile-review-action-danger"
      onClick={handleClick}
      disabled={isPending}
    >
      {t('removeItemButton')}
    </button>
  );
}
