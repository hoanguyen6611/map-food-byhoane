'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MediaOwnerType } from '@foodmap/shared-types';

interface UploadedPhoto {
  id: string;
  url: string;
}

interface Props {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  maxPhotos?: number;
  // Must match whatever `ownerType` the eventual reparent-on-submit call
  // uses server-side, or MediaService.reparent's lookup (`WHERE ownerType =
  // ...`) simply finds zero matching rows and rejects the whole submission
  // as "invalid photos" — e.g. ContributionService.create reparents new-
  // restaurant photos as `'restaurant'`, NOT `'contribution'`, even though
  // the contribution itself is what temporarily "owns" them pre-submit.
  ownerType: MediaOwnerType;
}

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
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('ownerType', ownerType);
        const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          setError(t('photoUploadError'));
          continue;
        }
        const photo = (await res.json()) as { id: string; url: string };
        uploaded.push({ id: photo.id, url: photo.url });
      }
      onChange([...photos, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removePhoto(id: string) {
    onChange(photos.filter((p) => p.id !== id));
    // Best-effort — an orphaned unattached photo is swept server-side after
    // 24h anyway (PhotoCleanupProcessor), so a failure here isn't user-facing.
    fetch(`/api/media/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }

  return (
    <div className="photo-upload-field">
      <div className="photo-upload-grid">
        {photos.map((photo) => (
          // eslint-disable-next-line @next/next/no-img-element -- previews of
          // freshly-uploaded R2 objects, not worth next/image's remote-pattern
          // config churn for a handful of thumbnails in a one-off form.
          <div className="photo-upload-thumb" key={photo.id}>
            <img src={photo.url} alt="" />
            <button type="button" onClick={() => removePhoto(photo.id)} aria-label={t('removePhoto')}>
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
