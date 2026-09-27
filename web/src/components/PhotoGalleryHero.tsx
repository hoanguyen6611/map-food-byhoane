'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { PhotoDto } from '@foodmap/shared-types';
import { CameraIcon, CloseIcon } from './icons';
import { PhotoFullViewer } from './PhotoFullViewer';

interface Props {
  photos: PhotoDto[];
  // Pre-resolved (not functions — this is a Client Component, and a
  // Server Component caller can't pass closures across that boundary),
  // one alt string per photo, same order/length as `photos`.
  photoAlts: string[];
  emptyText: string;
  seeAllLabel: string;
  moreCountLabel: string;
}

const VISIBLE_TILE_COUNT = 4;

// A portrait (phone-shot) photo `object-fit: cover`'d into this wide,
// short hero box loses most of its content to cropping — only relevant for
// the single-photo case (a 2-4 photo grid's smaller tiles crop the same way
// every other app's photo grid does, which isn't what was reported).
function isPortraitFromMetadata(photo: PhotoDto): boolean {
  return photo.width !== null && photo.height !== null && photo.height > photo.width;
}

interface SinglePhotoTileProps {
  photo: PhotoDto;
  alt: string;
}

/**
 * The single-photo hero case, split out so it can carry its own orientation
 * state. Stored `width`/`height` is null for any photo uploaded through the
 * ImageKit direct-upload path (see MediaService.attachExternalUrls — it
 * never runs the sharp-based dimension extraction the S3 path does), so
 * `photo.width`/`height` alone isn't reliable enough to detect portrait
 * photos anymore. Falls back to reading the actual loaded `<img>`'s
 * `naturalWidth`/`naturalHeight` once the browser has it — a one-time
 * re-render from cover to contain+backdrop if that reveals a portrait photo
 * metadata didn't already tell us about, invisible if metadata already
 * knew (no swap needed).
 */
function SinglePhotoTile({ photo, alt }: SinglePhotoTileProps) {
  const [portrait, setPortrait] = useState(isPortraitFromMetadata(photo));

  return (
    <>
      {portrait ? (
        // Blurred, cropped fill so a portrait photo's box never shows bare
        // background on the sides — purely decorative.
        <Image
          src={photo.url}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 860px) 50vw, 380px"
          className="photo-hero-single-backdrop"
          style={{ objectFit: 'cover' }}
        />
      ) : null}
      <Image
        src={photo.url}
        alt={alt}
        fill
        sizes="(max-width: 860px) 50vw, 380px"
        priority
        className={portrait ? 'photo-hero-single-fg' : undefined}
        style={{ objectFit: portrait ? 'contain' : 'cover' }}
        onLoad={(event) => {
          const img = event.currentTarget;
          if (!portrait && img.naturalWidth > 0 && img.naturalHeight > img.naturalWidth) {
            setPortrait(true);
          }
        }}
      />
    </>
  );
}

/**
 * README's redesigned detail-page photo hero — one large tile + up to two
 * stacked tiles + a 4th tile that becomes a dimmed "+N / see all" overlay
 * once there are more photos than fit. `photos` is already the merged
 * restaurant+review-photos list from the backend (buildDetailDto) — this
 * component only handles layout/lightbox, not sourcing.
 */
export function PhotoGalleryHero({ photos, photoAlts, emptyText, seeAllLabel, moreCountLabel }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Index into `photos` of the full-size view, layered on top of the grid
  // lightbox — null means "not showing a full-size photo".
  const [fullIndex, setFullIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="detail-photo-empty" style={{ marginTop: 16 }}>
        <CameraIcon size={30} style={{ color: 'var(--color-ink-disabled)' }} />
        <span className="detail-photo-empty-text">{emptyText}</span>
      </div>
    );
  }

  const visible = photos.slice(0, VISIBLE_TILE_COUNT);
  const remaining = photos.length - visible.length;
  const lastTileIndex = visible.length - 1;

  return (
    <>
      <div className={`photo-hero-grid photo-hero-grid-${visible.length}`} style={{ marginTop: 16 }}>
        {visible.map((photo, index) => {
          const isLastTile = index === lastTileIndex;
          const isOverlayTile = isLastTile && remaining > 0;
          return (
            <button
              key={photo.id}
              type="button"
              className={`photo-hero-tile photo-hero-tile-${index}`}
              onClick={() => setLightboxOpen(true)}
              aria-label={isOverlayTile ? seeAllLabel : photoAlts[index]}
            >
              {visible.length === 1 ? (
                <SinglePhotoTile photo={photo} alt={photoAlts[index]} />
              ) : (
                <Image
                  src={photo.url}
                  alt={isOverlayTile ? '' : photoAlts[index]}
                  fill
                  sizes="(max-width: 860px) 50vw, 380px"
                  priority={index === 0}
                  style={{ objectFit: 'cover' }}
                />
              )}
              {isOverlayTile ? (
                <span className="photo-hero-more-overlay">
                  <span className="photo-hero-more-count">{moreCountLabel}</span>
                  <span className="photo-hero-more-cta">{seeAllLabel}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {lightboxOpen ? (
        <div className="photo-lightbox-overlay" role="dialog" aria-modal="true" onClick={() => setLightboxOpen(false)}>
          <div className="photo-lightbox-panel" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="photo-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Close">
              <CloseIcon size={20} />
            </button>
            <div className="photo-lightbox-grid">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  className="photo-lightbox-item"
                  onClick={() => setFullIndex(index)}
                  aria-label={photoAlts[index]}
                >
                  <Image
                    src={photo.url}
                    alt={photoAlts[index]}
                    width={photo.width ?? 400}
                    height={photo.height ?? 300}
                    sizes="(max-width: 640px) 45vw, 240px"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

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
