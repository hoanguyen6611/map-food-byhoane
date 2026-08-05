import type { ConfirmUploadRequest, CreateUploadUrlRequest, CreateUploadUrlResponse, MediaOwnerType, PhotoDto } from '@foodmap/shared-types';
import { apiClient } from './client';

export const mediaApi = {
  createUploadUrl: (body: CreateUploadUrlRequest) => apiClient.post<CreateUploadUrlResponse>('/media/upload-url', body),
  confirm: (body: ConfirmUploadRequest) => apiClient.post<PhotoDto>('/media/confirm', body),
  remove: (photoId: string) => apiClient.delete<void>(`/media/${photoId}`),
};

/**
 * Raw, unauthenticated PUT straight to the signed storage URL — explicitly
 * NOT routed through `apiClient`, which always forces
 * `Content-Type: application/json` and attaches a bearer token neither of
 * which belongs on a direct-to-storage upload. Uses `XMLHttpRequest`
 * instead of `fetch` specifically so `onUploadProgress` can drive a
 * per-photo progress bar — `fetch` has no upload-progress event in React
 * Native.
 */
export function putToSignedUrl(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', contentType);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded / event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Tải ảnh lên thất bại (status ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Tải ảnh lên thất bại — kiểm tra kết nối mạng.'));

    // React Native's fetch/XHR polyfill accepts a { uri } object body for
    // local file URIs (the same shape used by FormData file parts) — a
    // plain string body would try to upload the URI text itself, not the
    // file contents.
    xhr.send({ uri: fileUri } as unknown as XMLHttpRequestBodyInit);
  });
}

export type { MediaOwnerType };
