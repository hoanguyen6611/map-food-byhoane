import { NextResponse } from 'next/server';
import { backendFetchAuthorized } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const res = await backendFetchAuthorized(`/media/${id}`, { method: 'DELETE' });
  if (!res) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: 'Request failed' }, { status: res.status });
  }
  return new NextResponse(null, { status: 204 });
}
