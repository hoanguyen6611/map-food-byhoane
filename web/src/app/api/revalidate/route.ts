import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';

// Server-to-server only — the backend calls this right after an admin write
// (see backend/src/modules/revalidation/web-revalidation.service.ts) so the
// change shows up immediately instead of waiting out the ISR windows in
// lib/api.ts (60s for listings, 300s for detail/catalog). Never reachable
// from a browser in practice: REVALIDATE_SECRET is never shipped to the
// client (no NEXT_PUBLIC_ prefix), only known to this server and the backend.
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Revalidation is not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : [];
  if (tags.length === 0) {
    return NextResponse.json({ error: 'tags must be a non-empty string array' }, { status: 400 });
  }

  for (const tag of tags) {
    revalidateTag(tag);
  }
  return NextResponse.json({ revalidated: true, tags });
}
