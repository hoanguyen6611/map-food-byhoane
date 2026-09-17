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

  // Best-effort enrichment — the cookie's email alone is enough to render
  // "signed in", so a failure here (network hiccup, dead refresh token)
  // falls back to email-only display rather than treating the user as
  // signed out; pages that actually gate on auth already redirect via
  // `backendFetchAuthorized` returning null on their own.
  const [meRes, notificationsRes] = await Promise.all([
    backendFetchAuthorized('/me'),
    backendFetchAuthorized('/me/notifications?page=1&pageSize=1'),
  ]);
  const displayName = meRes?.ok ? ((await meRes.json()) as MeResponse).profile.displayName : null;
  const unreadCount = notificationsRes?.ok ? ((await notificationsRes.json()) as NotificationListResponse).unreadCount : 0;

  const info: SessionInfo = { email: session.email, displayName: displayName || null, unreadCount };
  return NextResponse.json(info);
}
