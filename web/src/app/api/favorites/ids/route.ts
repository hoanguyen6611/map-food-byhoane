import { NextResponse } from 'next/server';
import { backendFetchAuthorized } from '@/lib/auth';

// Same "isolated dynamic island" pattern as api/session/route.ts — proxies
// the authenticated backend call so FavoritesProvider (a client component)
// never needs the access token itself. `backendFetchAuthorized` transparently
// refreshes an expired access token once before giving up, so a long-lived
// tab doesn't start reporting "no favorites" the moment the token goes stale.
export async function GET() {
  const res = await backendFetchAuthorized('/me/favorites/ids');
  if (!res?.ok) {
    return NextResponse.json([]);
  }

  const ids = (await res.json()) as string[];
  return NextResponse.json(ids);
}
