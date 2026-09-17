'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitReviewAction } from '@/app/[locale]/restaurant/[slug]/actions';
import { PhotoUploadField, type UploadedPhoto } from '@/components/PhotoUploadField';
import type { ReviewCriteriaCode } from '@foodmap/shared-types';

interface Criterion {
  code: ReviewCriteriaCode;
  label: string;
}

interface Props {
  restaurantId: string;
  slug: string;
  criteria: Criterion[];
}

type FormState =
  | { phase: 'idle' }
  | { phase: 'error'; message: string }
  | { phase: 'published' }
  | { phase: 'pending' };

// Same 1-5 star button used for the overall rating and each per-criteria
// rating — value 0 means "not rated yet" (only the overall one is required).
function StarPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="star-picker" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={String(n)}
          className={`star-button ${n <= value ? 'star-button-filled' : ''}`}
          // Tapping the already-selected star clears it back to 0 — matches
          // mobile's WriteReviewScreen convention for per-criteria ratings.
          onClick={() => onChange(value === n ? 0 : n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function WriteReviewForm({ restaurantId, slug, criteria }: Props) {
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
      <div className="write-review-done">
        <strong>{state.phase === 'published' ? t('publishedTitle') : t('pendingTitle')}</strong>
        <p>{state.phase === 'published' ? t('publishedBody') : t('pendingBody')}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="write-review-form">
      <h3 className="section-title">{t('heading')}</h3>
      {state.phase === 'error' ? (
        <p className="write-review-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="write-review-field">
        <span>{t('overallLabel')}</span>
        <StarPicker value={overallRating} onChange={setOverallRating} label={t('overallLabel')} />
      </div>

      {criteria.map((c) => (
        <div className="write-review-field" key={c.code}>
          <span>{c.label}</span>
          <StarPicker
            value={ratings[c.code] ?? 0}
            onChange={(next) => setRatings((prev) => ({ ...prev, [c.code]: next }))}
            label={c.label}
          />
        </div>
      ))}

      <label className="write-review-field">
        <span>{t('commentLabel')}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder={t('commentPlaceholder')}
        />
      </label>

      <div className="write-review-field">
        <span>{t('photosLabel')}</span>
        <PhotoUploadField photos={photos} onChange={setPhotos} ownerType="review" maxPhotos={6} />
      </div>

      <button type="submit" className="write-review-submit" disabled={isPending || !canSubmit}>
        {isPending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
