'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { updateReviewAction } from '@/app/[locale]/profile/actions';
import { CloseIcon } from '@/components/icons';
import { useToast } from '@/components/ToastProvider';
import type { MyReviewDto, ReviewCriteriaCode } from '@foodmap/shared-types';

const CRITERIA_ORDER: ReviewCriteriaCode[] = [
  'food_quality',
  'space',
  'price',
  'service',
  'hygiene',
  'wifi',
  'parking',
];

interface Props {
  review: MyReviewDto;
  onClose: () => void;
}

function StarPicker({ value, onChange, label }: { value: number; onChange: (next: number) => void; label: string }) {
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
          onClick={() => onChange(value === n ? 0 : n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * Only edits rating/comment — not photos, which would need re-plumbing
 * PhotoUploadField's cap/reparent logic into a modal context. Scoped out of
 * this pass; the rating/comment fields are what "Sửa" is asked for.
 */
export function EditReviewModal({ review, onClose }: Props) {
  const t = useTranslations('profile');
  const tWrite = useTranslations('writeReview');
  const tLabels = useTranslations('labels');
  const router = useRouter();
  const { showToast } = useToast();

  const [overallRating, setOverallRating] = useState(review.overallRating);
  const [ratings, setRatings] = useState<Record<string, number>>(
    Object.fromEntries(review.ratings.map((r) => [r.criteriaCode, r.score])),
  );
  const [comment, setComment] = useState(review.comment ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ratedCount = Object.values(ratings).filter((v) => v > 0).length;
  const canSubmit = overallRating >= 1 && ratedCount >= 1;

  const originalRatingsByCode = Object.fromEntries(review.ratings.map((r) => [r.criteriaCode, r.score]));
  const ratingsChanged = CRITERIA_ORDER.some((code) => (ratings[code] ?? 0) !== (originalRatingsByCode[code] ?? 0));
  const isDirty = overallRating !== review.overallRating || ratingsChanged || comment !== (review.comment ?? '');

  async function submit() {
    if (!canSubmit) {
      setError(tWrite('validationError'));
      return;
    }
    setIsSaving(true);
    const result = await updateReviewAction(review.id, {
      overallRating,
      ratings: Object.entries(ratings)
        .filter(([, score]) => score > 0)
        .map(([code, score]) => ({ criteriaCode: code as ReviewCriteriaCode, score })),
      comment: comment.trim() || undefined,
    });
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error === 'unauthorized' ? t('unauthorizedError') : t('saveError'));
      return;
    }
    showToast(t('reviewUpdated'), 'success');
    router.refresh();
    onClose();
  }

  return (
    <div className="profile-edit-modal-overlay" onClick={onClose}>
      <div className="profile-edit-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="profile-edit-modal-scroll">
        <div className="profile-edit-modal-header">
          <h2 className="info-card-title" style={{ margin: '0 0 12px' }}>
            {t('editReviewHeading')}
          </h2>
          <button type="button" className="profile-edit-modal-close" aria-label={t('cancel')} onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        {error ? (
          <p className="write-review-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="write-review-field">
          <span>{tWrite('overallLabel')}</span>
          <StarPicker value={overallRating} onChange={setOverallRating} label={tWrite('overallLabel')} />
        </div>

        {CRITERIA_ORDER.map((code) => (
          <div className="write-review-field" key={code}>
            <span>{tLabels(`criteria.${code}`)}</span>
            <StarPicker
              value={ratings[code] ?? 0}
              onChange={(next) => setRatings((prev) => ({ ...prev, [code]: next }))}
              label={tLabels(`criteria.${code}`)}
            />
          </div>
        ))}

        <label className="write-review-field">
          <span>{tWrite('commentLabel')}</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} rows={4} />
        </label>

        <div className="profile-edit-modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="write-review-submit" onClick={submit} disabled={isSaving || !canSubmit || !isDirty}>
            {isSaving ? tWrite('submitting') : t('save')}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
