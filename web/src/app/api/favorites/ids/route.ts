import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth';

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? 'http://localhost:3000';

// Same "isolated dynamic island" pattern as api/session/route.ts — proxies
// the authenticated backend call so FavoritesProvider (a client component)
// never needs the access token itself.
export async function GET() {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json([]);
  }

  const res = await fetch(`${BACKEND_API_URL}/me/favorites/ids`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json([]);
  }

  const ids = (await res.json()) as string[];
  return NextResponse.json(ids);
}
