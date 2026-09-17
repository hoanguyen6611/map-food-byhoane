'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { upload } from '@imagekit/next';
import type { MediaOwnerType } from '@foodmap/shared-types';

export interface UploadedPhoto {
  /** ImageKit's fileId — needed to delete the file via api/imagekit-delete. */
  fileId: string;
  url: string;
}

interface ImageKitAuthParams {
  token: string;
  signature: string;
  expire: number;
  publicKey: string;
}

interface Props {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  maxPhotos?: number;
  /** Used only to namespace the ImageKit upload folder (e.g. `/foodmap/restaurant`) — organizational, not a security boundary. */
  ownerType: MediaOwnerType;
}

/**
 * Uploads straight from the browser to ImageKit.io (`@imagekit/next`'s
 * `upload()`), authorized by a short-lived signature this app's own
 * `api/imagekit-auth` route mints server-side from the ImageKit PRIVATE key
 * — the browser never sees that key. Replaces the previous flow that PUT
 * the file through this app's own S3/MinIO-backed MediaModule (re-encode +
 * magic-byte sniff + AI moderation); see MediaService.attachExternalUrls's
 * doc comment for that tradeoff.
 */
export function PhotoUploadField({ photos, onChange, maxPhotos = 10, ownerType }: Props) {
  const t = useTranslations('addRestaurant');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const files = Array.from(fileList).slice(0, maxPhotos - photos.length);
    setUploading(true);
    try {
      const uploaded: UploadedPhoto[] = [];
      let hadError = false;
      for (const file of files) {
        try {
          const authRes = await fetch('/api/imagekit-auth');
          if (!authRes.ok) throw new Error('auth failed');
          const auth = (await authRes.json()) as ImageKitAuthParams;

          const result = await upload({
            file,
            fileName: file.name,
            folder: `/foodmap/${ownerType}`,
            publicKey: auth.publicKey,
            signature: auth.signature,
            expire: auth.expire,
            token: auth.token,
          });
          if (result.fileId && result.url) {
            uploaded.push({ fileId: result.fileId, url: result.url });
          } else {
            hadError = true;
          }
        } catch {
          // ImageKitInvalidRequestError / ImageKitServerError /
          // ImageKitUploadNetworkError / ImageKitAbortError, or the auth
          // fetch itself failing — all surface as one generic message.
          hadError = true;
        }
      }
      if (hadError) setError(t('photoUploadError'));
      onChange([...photos, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removePhoto(fileId: string) {
    onChange(photos.filter((p) => p.fileId !== fileId));
    // Best-effort — see api/imagekit-delete's doc comment.
    fetch(`/api/imagekit-delete/${fileId}`, { method: 'DELETE' }).catch(() => undefined);
  }

  return (
    <div className="photo-upload-field">
      <div className="photo-upload-grid">
        {photos.map((photo) => (
          // eslint-disable-next-line @next/next/no-img-element -- previews of
          // freshly-uploaded ImageKit files, not worth next/image's remote-pattern
          // config churn for a handful of thumbnails in a one-off form.
          <div className="photo-upload-thumb" key={photo.fileId}>
            <img src={photo.url} alt="" />
            <button type="button" onClick={() => removePhoto(photo.fileId)} aria-label={t('removePhoto')}>
              ×
            </button>
          </div>
        ))}
        {photos.length < maxPhotos ? (
          <label className="photo-upload-add">
            {uploading ? t('uploading') : `+ ${t('addPhoto')}`}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: 'none' }}
            />
          </label>
        ) : null}
      </div>
      {error ? (
        <p className="write-review-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
