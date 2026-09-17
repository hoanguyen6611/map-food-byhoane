import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

// Server-only — ImageKit's delete-file REST endpoint needs the PRIVATE key
// (Basic auth, empty password, per ImageKit's convention), so this can't be
// called from the browser directly. Best-effort, matching the old
// `api/media/[id]` route's fire-and-forget delete: PhotoUploadField doesn't
// block the UI on this succeeding, and an orphaned ImageKit file left
// behind on failure is a minor storage cost, not a correctness issue.
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fileId } = await params;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json({ error: 'ImageKit is not configured' }, { status: 500 });
  }

  const res = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}` },
  });
  if (!res.ok && res.status !== 404) {
    return NextResponse.json({ error: 'Delete failed' }, { status: res.status });
  }
  return new NextResponse(null, { status: 204 });
}
