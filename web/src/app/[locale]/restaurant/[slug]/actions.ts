'use server';

import { revalidatePath } from 'next/cache';
import { backendFetchAuthorized } from '@/lib/auth';
import type {
  ReviewDto,
  ReviewRatingInput,
  ReviewReplyDto,
  ReviewReplyListResponse,
  ToggleHelpfulResponse,
} from '@foodmap/shared-types';

// Same repeated-constant convention as lib/api.ts/lib/auth.ts (no shared
// export — each server-only file declares its own).
const BACKEND_API_URL = process.env.BACKEND_API_URL ?? 'http://localhost:3000';

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

export type ToggleHelpfulResult = { ok: true; data: ToggleHelpfulResponse } | { ok: false };

export async function toggleHelpfulAction(reviewId: string): Promise<ToggleHelpfulResult> {
  const res = await backendFetchAuthorized(`/reviews/${reviewId}/helpful`, { method: 'POST' });
  if (!res || !res.ok) return { ok: false };
  return { ok: true, data: (await res.json()) as ToggleHelpfulResponse };
}

// Public read — no auth needed, so this bypasses backendFetchAuthorized
// (which would silently fail for a signed-out visitor just browsing reviews).
export async function listRepliesAction(reviewId: string): Promise<ReviewReplyDto[]> {
  const res = await fetch(`${BACKEND_API_URL}/reviews/${reviewId}/replies`, { cache: 'no-store' });
  if (!res.ok) return [];
  const body = (await res.json()) as ReviewReplyListResponse;
  return body.items;
}

export type CreateReplyResult = { ok: true; data: ReviewReplyDto } | { ok: false; error: string };

export async function createReplyAction(reviewId: string, body: string): Promise<CreateReplyResult> {
  const res = await backendFetchAuthorized(`/reviews/${reviewId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res) return { ok: false, error: 'unauthorized' };
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(errBody?.message) ? errBody.message.join(' ') : errBody?.message;
    return { ok: false, error: message || 'generic' };
  }
  return { ok: true, data: (await res.json()) as ReviewReplyDto };
}
