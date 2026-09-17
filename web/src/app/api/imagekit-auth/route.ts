import { NextResponse } from 'next/server';
import { getUploadAuthParams } from '@imagekit/next/server';
import { getSession } from '@/lib/auth';

// Server-only — mints the signature/token/expire an authenticated browser
// needs to upload directly to ImageKit (PhotoUploadField.tsx). Gated behind
// a real session (same auth boundary as the add-restaurant page itself) so
// an anonymous visitor can't spend this ImageKit account's upload quota.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
  if (!privateKey || !publicKey) {
    return NextResponse.json({ error: 'ImageKit is not configured' }, { status: 500 });
  }

  const { token, signature, expire } = getUploadAuthParams({ privateKey, publicKey });
  return NextResponse.json({ token, signature, expire, publicKey });
}
