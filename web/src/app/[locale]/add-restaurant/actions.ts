'use server';

import { backendFetchAuthorized } from '@/lib/auth';
import type {
  CreateRestaurantContributionRequest,
  CreateRestaurantContributionResponse,
  DuplicateCandidateDto,
} from '@foodmap/shared-types';

export type SubmitContributionResult =
  | { ok: true; status: CreateRestaurantContributionResponse['status'] }
  | { ok: false; error: 'duplicate'; candidates: DuplicateCandidateDto[] }
  | { ok: false; error: 'unauthorized' | 'generic'; message?: string };

export async function submitContributionAction(
  input: CreateRestaurantContributionRequest,
): Promise<SubmitContributionResult> {
  const res = await backendFetchAuthorized('/restaurants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res) {
    return { ok: false, error: 'unauthorized' };
  }
  if (res.status === 409) {
    const body = (await res.json().catch(() => null)) as { candidates?: DuplicateCandidateDto[] } | null;
    return { ok: false, error: 'duplicate', candidates: body?.candidates ?? [] };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    return { ok: false, error: 'generic', message };
  }
  const result = (await res.json()) as CreateRestaurantContributionResponse;
  return { ok: true, status: result.status };
}
