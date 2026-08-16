import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth';

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? 'http://localhost:3000';

interface RouteParams {
  params: Promise<{ restaurantId: string }>;
}

async function proxy(method: 'POST' | 'DELETE', restaurantId: string) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${BACKEND_API_URL}/favorites/${encodeURIComponent(restaurantId)}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
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
