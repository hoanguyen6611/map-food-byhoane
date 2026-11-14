'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { submitReviewAction } from '@/app/[locale]/restaurant/[slug]/actions';
import { PhotoUploadField, type UploadedPhoto } from '@/components/PhotoUploadField';
import { CheckIcon, CloseIcon } from '@/components/icons';
import type { ReviewCriteriaCode } from '@foodmap/shared-types';

interface Criterion {
  code: ReviewCriteriaCode;
  label: string;
}

interface Props {
  restaurantId: string;
  slug: string;
  restaurantName: string;
  /** Pre-formatted "Cà phê · Quận 3 · Dưới 50k đ" line for the mini card. */
  restaurantMeta: string;
  thumbUrl: string | null;
  criteria: Criterion[];
}

type FormState =
  | { phase: 'idle' }
  | { phase: 'error'; message: string }
  | { phase: 'published' }
  | { phase: 'pending' };

const COMMENT_MAX = 2000;
const STAR_PATH = 'm12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9L3.5 9.7l5.9-.8z';

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={STAR_PATH}
        fill={filled ? '#F0CD86' : 'none'}
        stroke={filled ? '#F0CD86' : '#C8C9D2'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full-screen mobile "Viết đánh giá" flow from the redesign — same
 * submitReviewAction as the inline WriteReviewForm, laid out as the design's
 * header / restaurant card / big overall stars / per-criteria list / comment
 * box / sticky submit, then the "Đã đăng đánh giá" confirmation in place.
 */
export function WriteReviewScreen({ restaurantId, slug, restaurantName, restaurantMeta, thumbUrl, criteria }: Props) {
  const t = useTranslations('writeReview');
  const [overallRating, setOverallRating] = useState(0);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const ratedCriteriaCount = Object.values(ratings).filter((v) => v > 0).length;
  const canSubmit = overallRating >= 1 && ratedCriteriaCount >= 1;

  async function submit(_prev: FormState, _formData: FormData): Promise<FormState> {
    if (!canSubmit) {
      return { phase: 'error', message: t('validationError') };
    }
    const result = await submitReviewAction(restaurantId, slug, {
      overallRating,
      ratings: Object.entries(ratings)
        .filter(([, score]) => score > 0)
        .map(([code, score]) => ({ criteriaCode: code as ReviewCriteriaCode, score })),
      comment: comment.trim() || undefined,
      photoUrls: photos.length > 0 ? photos.map((p) => p.url) : undefined,
    });
    if (!result.ok) {
      if (result.error === 'duplicate') return { phase: 'error', message: t('duplicateError') };
      if (result.error === 'unauthorized') return { phase: 'error', message: t('unauthorizedError') };
      return { phase: 'error', message: result.message || t('genericError') };
    }
    return { phase: result.status === 'published' ? 'published' : 'pending' };
  }

  const [state, formAction, isPending] = useActionState(submit, { phase: 'idle' });

  if (state.phase === 'published' || state.phase === 'pending') {
    return (
      <div className="review-posted">
        <div className="review-posted-icon">
          <CheckIcon size={34} />
        </div>
        <div className="review-posted-text">
          <h1 className="review-posted-title">{state.phase === 'published' ? t('postedTitle') : t('pendingTitle')}</h1>
          <p className="review-posted-body">
            {state.phase === 'published'
              ? t('postedBody', { stars: overallRating, name: restaurantName })
              : t('pendingBody')}
          </p>
        </div>
        <div className="review-posted-actions">
          <Link href={`/restaurant/${slug}?tab=reviews`} className="review-posted-btn">
            {t('viewRestaurant')}
          </Link>
          <Link href="/" className="review-posted-btn review-posted-btn-primary">
            {t('backHome')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="review-screen">
      <div className="review-screen-head">
        <Link href={`/restaurant/${slug}`} className="review-screen-close" aria-label={t('closeLabel')}>
          <CloseIcon size={18} />
        </Link>
        <h1 className="review-screen-title">{t('heading')}</h1>
        <span className={`review-screen-ready ${canSubmit ? 'review-screen-ready-ok' : ''}`}>
          {canSubmit ? t('readyLabel') : overallRating >= 1 ? t('needCriteriaLabel') : t('needStarsLabel')}
        </span>
      </div>

      <div className="review-screen-place">
        <span className="review-screen-place-thumb">
          {thumbUrl ? <Image src={thumbUrl} alt="" fill sizes="48px" style={{ objectFit: 'cover' }} /> : null}
        </span>
        <span className="review-screen-place-body">
          <span className="review-screen-place-name">{restaurantName}</span>
          <span className="review-screen-place-meta">{restaurantMeta}</span>
        </span>
      </div>

      {state.phase === 'error' ? (
        <p className="write-review-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="review-screen-overall">
        <span className="review-screen-overall-label">{t('overallLabel')}</span>
        <div className="review-screen-big-stars" role="radiogroup" aria-label={t('overallLabel')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={overallRating === n}
              aria-label={String(n)}
              className={`review-screen-big-star ${n <= overallRating ? 'review-screen-big-star-on' : ''}`}
              onClick={() => setOverallRating(n)}
            >
              <Star filled={n <= overallRating} size={29} />
            </button>
          ))}
        </div>
        <span className="review-screen-word">{t(`ratingWord.${overallRating}`)}</span>
      </div>

      {criteria.length > 0 ? (
        <div className="review-screen-section">
          <div className="review-screen-section-head">
            <span className="review-screen-caption">{t('criteriaHeading')}</span>
            <span className="review-screen-hint">{t('criteriaHint')}</span>
          </div>
          <div className="review-screen-criteria">
            {criteria.map((c) => {
              const value = ratings[c.code] ?? 0;
              return (
                <div className="review-screen-criterion" key={c.code}>
                  <span className="review-screen-criterion-label">{c.label}</span>
                  <div className="review-screen-criterion-stars" role="radiogroup" aria-label={c.label}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={value === n}
                        aria-label={String(n)}
                        className="review-screen-small-star"
                        // Tapping the selected star again clears it ("bỏ qua mục không dùng").
                        onClick={() => setRatings((prev) => ({ ...prev, [c.code]: value === n ? 0 : n }))}
                      >
                        <Star filled={n <= value} size={18} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="review-screen-comment">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
          maxLength={COMMENT_MAX}
          placeholder={t('commentPlaceholderLong')}
          aria-label={t('commentLabel')}
        />
        <div className="review-screen-comment-foot">
          <PhotoUploadField photos={photos} onChange={setPhotos} ownerType="review" maxPhotos={6} />
          <span className="review-screen-count">
            {comment.length}/{COMMENT_MAX}
          </span>
        </div>
      </div>

      <div className="review-screen-note">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8h.01M11 12h1v4h1" />
        </svg>
        <span>{t('realNameNote')}</span>
      </div>

      <div className="review-screen-submit-wrap">
        <button type="submit" className="review-screen-submit" disabled={isPending || !canSubmit}>
          {isPending ? t('submitting') : t('submitScreen')}
        </button>
      </div>
    </form>
  );
}
