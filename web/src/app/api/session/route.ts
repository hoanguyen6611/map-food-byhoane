import { NextResponse } from 'next/server';
import type { MeResponse, NotificationListResponse } from '@foodmap/shared-types';
import { getSession, backendFetchAuthorized } from '@/lib/auth';

export interface SessionInfo {
  email: string;
  displayName: string | null;
  unreadCount: number;
}

// Deliberately its own Route Handler rather than reading the session cookie
// directly in the (static-generated) root layout — `cookies()` anywhere in
// a layout/page's render tree forces that ENTIRE route to render
// dynamically, which would kill static generation/ISR for every page on
// this SEO-focused site (home/search/restaurant-detail all rely on it).
// A separate Route Handler is dynamic on its own terms without affecting
// anything else, and is fetched client-side by `AuthStatus`.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json(null);

  // `backendFetchAuthorized` now shares one in-flight refresh across both
  // of these calls (see auth.ts's `cache()`-wrapped `refreshSession`), so a
  // 401 here means the refresh token itself is genuinely dead (not a race
  // with the sibling call below) — that's a truly-over session, not a
  // transient hiccup, so it's treated as signed out instead of silently
  // degrading to email-only forever (the previous behavior: the cookie
  // itself was never invalidated by this check, so every subsequent page
  // load kept showing the signed-in email with no real session behind it).
  // Any OTHER failure (network blip, backend 5xx) still degrades
  // gracefully — it isn't evidence the session is actually dead.
  const [meRes, notificationsRes] = await Promise.all([
    backendFetchAuthorized('/me'),
    backendFetchAuthorized('/me/notifications?page=1&pageSize=1'),
  ]);
  if (meRes?.status === 401) {
    return NextResponse.json(null);
  }

  const displayName = meRes?.ok ? ((await meRes.json()) as MeResponse).profile.displayName : null;
  const unreadCount = notificationsRes?.ok ? ((await notificationsRes.json()) as NotificationListResponse).unreadCount : 0;

  const info: SessionInfo = { email: session.email, displayName: displayName || null, unreadCount };
  return NextResponse.json(info);
}
