'use client';

import { useRef, useState } from 'react';
import { upload } from '@imagekit/next';
import { initialsOf } from '@/lib/format';

interface Props {
  avatarUrl: string | null;
  displayName: string;
  onUploaded: (url: string) => void;
  onCleared: () => void;
  uploadLabel: string;
  useInitialsLabel: string;
  uploadingLabel: string;
  errorLabel: string;
}

interface ImageKitAuthParams {
  token: string;
  signature: string;
  expire: number;
  publicKey: string;
}

/**
 * Single-image variant of PhotoUploadField's ImageKit direct-upload flow —
 * not reused as-is because that component is built around a multi-photo
 * grid with per-item remove/cover controls, neither of which apply to a
 * single avatar. Same upload mechanics, minimal UI.
 */
export function AvatarUploadButton({
  avatarUrl,
  displayName,
  onUploaded,
  onCleared,
  uploadLabel,
  useInitialsLabel,
  uploadingLabel,
  errorLabel,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(false);
    setUploading(true);
    try {
      const authRes = await fetch('/api/imagekit-auth');
      if (!authRes.ok) throw new Error('auth failed');
      const auth = (await authRes.json()) as ImageKitAuthParams;
      const result = await upload({
        file,
        fileName: file.name,
        folder: '/foodmap/user_profile',
        publicKey: auth.publicKey,
        signature: auth.signature,
        expire: auth.expire,
        token: auth.token,
      });
      if (result.url) {
        onUploaded(result.url);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="avatar-upload-row">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external ImageKit URL
        <img src={avatarUrl} alt="" className="profile-avatar profile-avatar-img" />
      ) : (
        <span className="profile-avatar" aria-hidden="true">
          {initialsOf(displayName)}
        </span>
      )}
      <div className="avatar-upload-actions">
        <label className="secondary-btn avatar-upload-label">
          {uploading ? uploadingLabel : uploadLabel}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
        </label>
        {avatarUrl ? (
          <button type="button" className="secondary-btn" onClick={onCleared} disabled={uploading}>
            {useInitialsLabel}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="write-review-error" role="alert">
          {errorLabel}
        </p>
      ) : null}
    </div>
  );
}
