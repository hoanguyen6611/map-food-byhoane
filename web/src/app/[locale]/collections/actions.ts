'use server';

import { revalidatePath } from 'next/cache';
import { backendFetchAuthorized } from '@/lib/auth';
import type { CollectionListResponse, CollectionSummaryDto } from '@foodmap/shared-types';

// Same locale-prefix caveat as profile/actions.ts: `vi` (default) is
// unprefixed, `en` is not — both need an explicit revalidate call.
function revalidateCollections(id?: string): void {
  revalidatePath('/collections', 'page');
  revalidatePath('/en/collections', 'page');
  if (id) {
    revalidatePath(`/collections/${id}`, 'page');
    revalidatePath(`/en/collections/${id}`, 'page');
  }
}

export type CollectionActionResult = { ok: true; data: CollectionSummaryDto } | { ok: false };
export type SimpleActionResult = { ok: boolean };

export async function createCollectionAction(name: string, description?: string): Promise<CollectionActionResult> {
  const res = await backendFetchAuthorized('/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!res || !res.ok) return { ok: false };
  revalidateCollections();
  return { ok: true, data: (await res.json()) as CollectionSummaryDto };
}

export async function updateCollectionAction(
  id: string,
  patch: { name?: string; description?: string; isPublic?: boolean },
): Promise<CollectionActionResult> {
  const res = await backendFetchAuthorized(`/collections/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res || !res.ok) return { ok: false };
  revalidateCollections(id);
  return { ok: true, data: (await res.json()) as CollectionSummaryDto };
}

export async function deleteCollectionAction(id: string): Promise<SimpleActionResult> {
  const res = await backendFetchAuthorized(`/collections/${id}`, { method: 'DELETE' });
  const ok = !!res && res.ok;
  if (ok) revalidateCollections(id);
  return { ok };
}

export async function listMyCollectionsAction(): Promise<CollectionListResponse | null> {
  const res = await backendFetchAuthorized('/me/collections');
  if (!res || !res.ok) return null;
  return (await res.json()) as CollectionListResponse;
}

export async function addToCollectionAction(collectionId: string, restaurantId: string): Promise<SimpleActionResult> {
  const res = await backendFetchAuthorized(`/collections/${collectionId}/items/${restaurantId}`, { method: 'POST' });
  const ok = !!res && res.ok;
  if (ok) revalidateCollections(collectionId);
  return { ok };
}

export async function removeFromCollectionAction(collectionId: string, restaurantId: string): Promise<SimpleActionResult> {
  const res = await backendFetchAuthorized(`/collections/${collectionId}/items/${restaurantId}`, { method: 'DELETE' });
  const ok = !!res && res.ok;
  if (ok) revalidateCollections(collectionId);
  return { ok };
}
