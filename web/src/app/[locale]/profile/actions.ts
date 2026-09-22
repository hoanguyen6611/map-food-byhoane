'use server';

import { revalidatePath } from 'next/cache';
import { backendFetchAuthorized, logout } from '@/lib/auth';
import type { MeResponse, ReviewRatingInput, UpdateProfileRequest } from '@foodmap/shared-types';

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

function revalidateProfile(): void {
  // Same locale-prefix caveat as restaurant/[slug]/actions.ts: `vi` (default)
  // is unprefixed, `en` is not.
  revalidatePath('/profile', 'page');
  revalidatePath('/en/profile', 'page');
}

export async function updateProfileAction(input: UpdateProfileRequest): Promise<UpdateProfileResult> {
  const res = await backendFetchAuthorized('/me/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res) {
    return { ok: false, error: 'unauthorized' };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    return { ok: false, error: message || 'generic' };
  }
  revalidateProfile();
  return { ok: true };
}

export type UpdateAvatarResult = { ok: true; data: MeResponse } | { ok: false; error: string };

export async function updateAvatarAction(photoUrl: string | null): Promise<UpdateAvatarResult> {
  const res = await backendFetchAuthorized('/me/avatar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoUrl }),
  });
  if (!res) return { ok: false, error: 'unauthorized' };
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    return { ok: false, error: message || 'generic' };
  }
  revalidateProfile();
  return { ok: true, data: (await res.json()) as MeResponse };
}

export type UpdateReviewResult = { ok: true } | { ok: false; error: string };

export async function updateReviewAction(
  reviewId: string,
  input: { overallRating: number; ratings: ReviewRatingInput[]; comment?: string },
): Promise<UpdateReviewResult> {
  const res = await backendFetchAuthorized(`/reviews/${reviewId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res) return { ok: false, error: 'unauthorized' };
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    return { ok: false, error: message || 'generic' };
  }
  revalidateProfile();
  return { ok: true };
}

export async function deleteReviewAction(reviewId: string): Promise<UpdateReviewResult> {
  const res = await backendFetchAuthorized(`/reviews/${reviewId}`, { method: 'DELETE' });
  if (!res) return { ok: false, error: 'unauthorized' };
  if (!res.ok) return { ok: false, error: 'generic' };
  revalidateProfile();
  return { ok: true };
}

export type DeleteAccountResult = { ok: true } | { ok: false };

// Soft, anonymizing delete (UserService.deleteAccount) — never a hard
// delete. Clears the session cookie afterward since the account is no
// longer usable to sign back into.
export async function deleteAccountAction(): Promise<DeleteAccountResult> {
  const res = await backendFetchAuthorized('/me', { method: 'DELETE' });
  if (!res || !res.ok) return { ok: false };
  await logout();
  return { ok: true };
}
