/**
 * Typed client for the admin-only ImageKit upload-auth endpoint
 * (backend/src/modules/admin/admin-media.controller.ts) — mints the
 * short-lived token/signature admin-web's PhotosSection.tsx needs to
 * upload a file straight to ImageKit from the browser.
 */
import { apiClient } from './client'

export interface ImageKitUploadAuth {
  token: string
  expire: number
  signature: string
  publicKey: string
}

export const adminMediaApi = {
  getImageKitAuth: () => apiClient.get<ImageKitUploadAuth>('/admin/media/imagekit-auth'),
}
