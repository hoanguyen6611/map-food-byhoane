'use client';

import { useState } from 'react';
import type { PhotoDto } from '@foodmap/shared-types';
import { PhotoFullViewer } from './PhotoFullViewer';

interface Props {
  photos: PhotoDto[];
}

/** A review's own attached photos — click one to see it large, same viewer as the detail page's main gallery (PhotoFullViewer). */
export function ReviewCardPhotos({ photos }: Props) {
  const [fullIndex, setFullIndex] = useState<number | null>(null);
  const photoAlts = photos.map(() => '');

  return (
    <>
      <div className="review-card-photos">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="review-card-photo"
            onClick={() => setFullIndex(index)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit-hosted review photos, same rationale as PhotoUploadField's previews */}
            <img src={photo.url} alt="" />
          </button>
        ))}
      </div>

      {fullIndex !== null ? (
        <PhotoFullViewer
          photos={photos}
          photoAlts={photoAlts}
          index={fullIndex}
          onClose={() => setFullIndex(null)}
          onNavigate={setFullIndex}
        />
      ) : null}
    </>
  );
}
