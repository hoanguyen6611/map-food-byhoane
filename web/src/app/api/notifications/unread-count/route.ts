import { NextResponse } from 'next/server';
import type { NotificationListResponse } from '@foodmap/shared-types';
import { backendFetchAuthorized } from '@/lib/auth';

/**
 * Cheap poll target for the live unread badge (SessionProvider). `null`
 * when signed out / session dead, so the client can stop polling.
 */
export async function GET() {
  const res = await backendFetchAuthorized('/me/notifications?page=1&pageSize=1');
  if (!res || res.status === 401) return NextResponse.json({ unreadCount: null }, { headers: { 'Cache-Control': 'no-store' } });
  if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  const { unreadCount } = (await res.json()) as NotificationListResponse;
  return NextResponse.json({ unreadCount }, { headers: { 'Cache-Control': 'no-store' } });
}
