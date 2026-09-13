'use server';

import { revalidatePath } from 'next/cache';
import { backendFetchAuthorized } from '@/lib/auth';
import type { UpdateProfileRequest } from '@foodmap/shared-types';

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

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
  // Same locale-prefix caveat as restaurant/[slug]/actions.ts: `vi` (default)
  // is unprefixed, `en` is not.
  revalidatePath('/profile', 'page');
  revalidatePath('/en/profile', 'page');
  return { ok: true };
}
