import { NextResponse } from 'next/server';
import { backendFetchAuthorized } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ restaurantId: string }>;
}

// `backendFetchAuthorized` transparently refreshes an expired access token
// once before giving up, so a long-lived tab doesn't start silently failing
// to add/remove favorites the moment the 15-minute token goes stale.
async function proxy(method: 'POST' | 'DELETE', restaurantId: string) {
  const res = await backendFetchAuthorized(`/favorites/${encodeURIComponent(restaurantId)}`, { method });
  if (!res) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: 'Request failed' }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { restaurantId } = await params;
  return proxy('POST', restaurantId);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { restaurantId } = await params;
  return proxy('DELETE', restaurantId);
}
