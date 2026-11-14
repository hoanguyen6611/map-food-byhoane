'use server';

import { backendFetchAuthorized } from '@/lib/auth';
import type { FollowActionResponse } from '@foodmap/shared-types';

export type FollowActionResult = { ok: true; data: FollowActionResponse } | { ok: false; error: 'unauthorized' | 'generic' };

export async function followUserAction(targetUserId: string): Promise<FollowActionResult> {
  const res = await backendFetchAuthorized(`/users/${targetUserId}/follow`, { method: 'POST' });
  if (!res || res.status === 401) return { ok: false, error: 'unauthorized' };
  if (!res.ok) return { ok: false, error: 'generic' };
  return { ok: true, data: (await res.json()) as FollowActionResponse };
}

export async function unfollowUserAction(targetUserId: string): Promise<FollowActionResult> {
  const res = await backendFetchAuthorized(`/users/${targetUserId}/follow`, { method: 'DELETE' });
  if (!res || res.status === 401) return { ok: false, error: 'unauthorized' };
  if (!res.ok) return { ok: false, error: 'generic' };
  return { ok: true, data: (await res.json()) as FollowActionResponse };
}
