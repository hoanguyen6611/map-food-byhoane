'use server';

import { revalidatePath } from 'next/cache';
import { backendFetchAuthorized } from '@/lib/auth';
import type { ReviewDto, ReviewRatingInput } from '@foodmap/shared-types';

export type SubmitReviewResult =
  | { ok: true; status: ReviewDto['status'] }
  | { ok: false; error: 'unauthorized' | 'duplicate' | 'generic'; message?: string };

export async function submitReviewAction(
  restaurantId: string,
  slug: string,
  input: {
    overallRating: number;
    ratings: ReviewRatingInput[];
    comment?: string;
    photoUrls?: string[];
  },
): Promise<SubmitReviewResult> {
  const res = await backendFetchAuthorized('/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId, ...input }),
  });
  if (!res) {
    return { ok: false, error: 'unauthorized' };
  }
  if (!res.ok) {
    if (res.status === 409) return { ok: false, error: 'duplicate' };
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    return { ok: false, error: 'generic', message };
  }
  const review = (await res.json()) as ReviewDto;
  // `[locale]` is a dynamic segment, not a real path revalidatePath can glob
  // over — revalidate both real locale variants explicitly instead. `vi` is
  // routing.ts's default locale under `localePrefix: 'as-needed'`, so it's
  // served unprefixed (`/restaurant/x`), unlike `en` (`/en/restaurant/x`).
  revalidatePath(`/restaurant/${slug}`, 'page');
  revalidatePath(`/en/restaurant/${slug}`, 'page');
  return { ok: true, status: review.status };
}
