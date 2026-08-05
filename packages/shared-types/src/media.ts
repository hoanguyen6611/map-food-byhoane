// Contract for docs/build-prompts/07-contribution-media-moderation-ai.md's
// MediaModule — a real signed-upload pipeline replacing the admin-only
// stopgap (PhotoService) for community-facing uploads (reviews, contributions).
// PhotoDto itself lives in ./restaurant-detail (already exported by index.ts).

export type UploadableImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

// The owner isn't necessarily known yet at upload time (e.g. a review draft
// has no id until it's created) — `ownerId` is supplied later via the
// owning create-endpoint's `photoIds` field, which reparents the photo.
export type MediaOwnerType = 'restaurant' | 'review' | 'contribution';

export interface CreateUploadUrlRequest {
  contentType: UploadableImageContentType;
  fileSizeBytes: number;
}

export interface CreateUploadUrlResponse {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export interface ConfirmUploadRequest {
  storageKey: string;
  ownerType: MediaOwnerType;
  // Omit when the parent (restaurant/review/contribution) doesn't exist yet
  // — the photo is created "unattached" and reparented later.
  ownerId?: string;
}
