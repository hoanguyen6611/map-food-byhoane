import { useCallback, useState } from 'react';
import type { MediaOwnerType, UploadableImageContentType } from '@foodmap/shared-types';
import { mediaApi, putToSignedUrl } from '../api/media';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXTENSIONS: Record<string, UploadableImageContentType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export interface PickedAsset {
  uri: string;
  fileSize?: number | null;
  mimeType?: string | null;
}

export interface UploadItem {
  localUri: string;
  progress: number; // 0-1
  status: 'uploading' | 'confirming' | 'done' | 'error';
  photoId?: string;
  errorMessage?: string;
}

function guessContentType(asset: PickedAsset): UploadableImageContentType | null {
  if (asset.mimeType === 'image/jpeg' || asset.mimeType === 'image/png' || asset.mimeType === 'image/webp') {
    return asset.mimeType;
  }
  const extension = asset.uri.split('.').pop()?.toLowerCase().split('?')[0];
  return extension ? (ALLOWED_EXTENSIONS[extension] ?? null) : null;
}

/**
 * Drives the real signed-upload pipeline (build-prompts/07's MediaModule)
 * for the shared PhotoUploadGrid component — client-side pre-checks (size,
 * type) reject obviously-bad files before ever calling the backend; the
 * backend's own magic-byte/re-encode validation is still the real security
 * boundary (see MediaService.confirm), this is purely a fast-feedback UX layer.
 */
export function useMediaUpload(ownerType: MediaOwnerType, maxPhotos: number) {
  const [items, setItems] = useState<UploadItem[]>([]);

  const updateItem = useCallback((localUri: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.localUri === localUri ? { ...item, ...patch } : item)));
  }, []);

  const addPhoto = useCallback(
    async (asset: PickedAsset) => {
      if (items.length >= maxPhotos) {
        return { ok: false as const, error: `Chỉ được phép tối đa ${maxPhotos} ảnh.` };
      }
      const contentType = guessContentType(asset);
      if (!contentType) {
        return { ok: false as const, error: 'Chỉ hỗ trợ ảnh định dạng JPEG, PNG hoặc WEBP.' };
      }
      if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
        return { ok: false as const, error: 'Ảnh phải nhỏ hơn 8MB.' };
      }

      const localUri = asset.uri;
      setItems((prev) => [...prev, { localUri, progress: 0, status: 'uploading' }]);

      try {
        const { uploadUrl, storageKey } = await mediaApi.createUploadUrl({
          contentType,
          fileSizeBytes: asset.fileSize ?? MAX_UPLOAD_BYTES,
        });
        await putToSignedUrl(uploadUrl, localUri, contentType, (fraction) => updateItem(localUri, { progress: fraction }));
        updateItem(localUri, { status: 'confirming', progress: 1 });
        const photo = await mediaApi.confirm({ storageKey, ownerType });
        updateItem(localUri, { status: 'done', photoId: photo.id });
        return { ok: true as const };
      } catch (error) {
        updateItem(localUri, { status: 'error', errorMessage: error instanceof Error ? error.message : 'Tải ảnh thất bại.' });
        return { ok: false as const, error: 'Tải ảnh lên thất bại, thử lại nhé.' };
      }
    },
    [items.length, maxPhotos, ownerType, updateItem],
  );

  const removePhoto = useCallback(async (localUri: string) => {
    const item = items.find((i) => i.localUri === localUri);
    setItems((prev) => prev.filter((i) => i.localUri !== localUri));
    if (item?.photoId) {
      await mediaApi.remove(item.photoId).catch(() => undefined);
    }
  }, [items]);

  const photoIds = items.filter((i) => i.status === 'done' && i.photoId).map((i) => i.photoId!);

  return { items, addPhoto, removePhoto, photoIds };
}
