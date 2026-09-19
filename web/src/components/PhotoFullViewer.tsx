'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import type { PhotoDto } from '@foodmap/shared-types';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons';

interface Props {
  photos: PhotoDto[];
  photoAlts: string[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

/**
 * Full-size single-photo overlay with prev/next + keyboard nav — shared by
 * `PhotoGalleryHero` (the detail page's main gallery) and `ReviewCardPhotos`
 * (a review's own attached photos), so both "click a photo to see it large"
 * flows behave identically. Controlled: the caller owns which index (if
 * any) is open.
 */
export function PhotoFullViewer({ photos, photoAlts, index, onClose, onNavigate }: Props) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') onNavigate((index - 1 + photos.length) % photos.length);
      else if (event.key === 'ArrowRight') onNavigate((index + 1) % photos.length);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, photos.length, onClose, onNavigate]);

  return (
    <div className="photo-full-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" className="photo-full-close" onClick={onClose} aria-label="Close">
        <CloseIcon size={22} />
      </button>
      {photos.length > 1 ? (
        <button
          type="button"
          className="photo-full-nav photo-full-nav-prev"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index - 1 + photos.length) % photos.length);
          }}
          aria-label="Previous"
        >
          <ChevronLeftIcon size={24} />
        </button>
      ) : null}
      <div className="photo-full-frame" onClick={(e) => e.stopPropagation()}>
        <Image
          key={photos[index].id}
          src={photos[index].url}
          alt={photoAlts[index]}
          fill
          sizes="100vw"
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>
      {photos.length > 1 ? (
        <button
          type="button"
          className="photo-full-nav photo-full-nav-next"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index + 1) % photos.length);
          }}
          aria-label="Next"
        >
          <ChevronRightIcon size={24} />
        </button>
      ) : null}
      <span className="photo-full-counter">
        {index + 1} / {photos.length}
      </span>
    </div>
  );
}
