import { NextResponse } from 'next/server';
import { backendFetchAuthorized } from '@/lib/auth';
import type { CreateUploadUrlResponse, MediaOwnerType, PhotoDto, UploadableImageContentType } from '@foodmap/shared-types';

const ALLOWED_TYPES = new Set<UploadableImageContentType>(['image/jpeg', 'image/png', 'image/webp']);

// Collapses upload-url + direct-PUT + confirm into one same-origin request so
// the browser never has to PUT straight to R2 itself (which would need CORS
// configured on the bucket) — this server proxies that PUT instead, and
// fetch()-from-Node isn't subject to browser CORS at all.
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');
  const ownerType = String(formData.get('ownerType') ?? 'contribution') as MediaOwnerType;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type as UploadableImageContentType)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
  }

  const uploadUrlRes = await backendFetchAuthorized('/media/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, fileSizeBytes: file.size }),
  });
  if (!uploadUrlRes) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!uploadUrlRes.ok) {
    return NextResponse.json({ error: 'Could not start upload' }, { status: uploadUrlRes.status });
  }
  const { uploadUrl, storageKey } = (await uploadUrlRes.json()) as CreateUploadUrlResponse;

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
  if (!putRes.ok) {
    return NextResponse.json({ error: 'Upload to storage failed' }, { status: 502 });
  }

  const confirmRes = await backendFetchAuthorized('/media/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storageKey, ownerType }),
  });
  if (!confirmRes || !confirmRes.ok) {
    return NextResponse.json({ error: 'Could not confirm upload' }, { status: confirmRes?.status ?? 502 });
  }
  const photo = (await confirmRes.json()) as PhotoDto;
  return NextResponse.json(photo, { status: 201 });
}
