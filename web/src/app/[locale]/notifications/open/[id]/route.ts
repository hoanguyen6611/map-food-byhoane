import { NextResponse, type NextRequest } from 'next/server';
import { backendFetchAuthorized } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string; locale: string }>;
}

/**
 * A notification card's whole click target routes through here instead of
 * linking to the destination directly — this is the one place "open a
 * notification" and "mark it read" happen together as a single real
 * navigation (no client JS needed to fire a Server Action alongside a
 * <Link>). `to` is always a same-origin, already-locale-prefixed path this
 * app itself generated (see NotificationsPage) — never taken from anything
 * else, so there's no open-redirect risk in trusting it directly.
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const to = request.nextUrl.searchParams.get('to') || '/notifications';

  // Best-effort — a failed mark-read must never block the navigation the
  // user actually clicked for (same "downstream failure never blocks the
  // core flow" convention as everywhere else notifications are written).
  await backendFetchAuthorized(`/me/notifications/${id}/read`, { method: 'PATCH' }).catch(() => undefined);

  return NextResponse.redirect(new URL(to, request.url));
}
