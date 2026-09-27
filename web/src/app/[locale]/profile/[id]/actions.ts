'use server';

import { backendFetchAuthorized } from '@/lib/auth';
import type { FollowActionResponse } from '@foodmap/shared-types';

export type FollowActionResult = { ok: true; data: FollowActionResponse } | { ok: false };

export async function followUserAction(targetUserId: string): Promise<FollowActionResult> {
  const res = await backendFetchAuthorized(`/users/${targetUserId}/follow`, { method: 'POST' });
  if (!res || !res.ok) return { ok: false };
  return { ok: true, data: (await res.json()) as FollowActionResponse };
}

export async function unfollowUserAction(targetUserId: string): Promise<FollowActionResult> {
  const res = await backendFetchAuthorized(`/users/${targetUserId}/follow`, { method: 'DELETE' });
  if (!res || !res.ok) return { ok: false };
  return { ok: true, data: (await res.json()) as FollowActionResponse };
}
