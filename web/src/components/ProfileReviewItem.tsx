'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import type { MyReviewDto } from '@foodmap/shared-types';
import { deleteReviewAction } from '@/app/[locale]/profile/actions';
import { formatRelativeDate } from '@/lib/format';
import { Stars } from './Stars';
import { ReviewCardPhotos } from './ReviewCardPhotos';
import { ThumbsUpIcon, MessageCircleIcon } from './icons';
import { EditReviewModal } from './EditReviewModal';
import { useToast } from './ToastProvider';

interface Props {
  review: MyReviewDto;
  locale: string;
}

export function ProfileReviewItem({ review, locale }: Props) {
  const t = useTranslations('profile');
  const tLabels = useTranslations('labels');
  const router = useRouter();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteReviewAction(review.id);
    setIsDeleting(false);
    if (result.ok) {
      showToast(t('reviewDeleted'), 'success');
      router.refresh();
      return;
    }
    setConfirmingDelete(false);
    showToast(t('deleteReviewError'), 'error');
  }

  return (
    <div className="review-card profile-review-item">
      <div className="my-review-header">
        <Link href={`/restaurant/${review.restaurant.slug}`} className="my-review-name">
          {review.restaurant.name}
        </Link>
        {review.status !== 'published' ? (
          <span className={`status-badge status-badge-${review.status}`}>{t(`status.${review.status}`)}</span>
        ) : null}
      </div>
      <span className="review-card-when">
        {formatRelativeDate(review.createdAt, locale)}
        {review.restaurant.ward ? ` · ${review.restaurant.ward}` : ''}
      </span>
      <Stars value={review.overallRating} size={14} />
      {review.comment ? <p className="review-card-body">{review.comment}</p> : null}

      {review.ratings.length > 0 ? (
        <div className="chip-row profile-review-criteria">
          {review.ratings.map((r) => (
            <span key={r.criteriaCode} className="chip profile-review-criteria-chip">
              {tLabels(`criteria.${r.criteriaCode}`)} {r.score.toFixed(1)}
            </span>
          ))}
        </div>
      ) : null}

      {review.photos.length > 0 ? <ReviewCardPhotos photos={review.photos} /> : null}

      <div className="review-card-footer">
        <span className="review-card-helpful">
          <ThumbsUpIcon size={15} />
          {review.helpfulCount}
        </span>
        <span className="review-card-reply-toggle">
          <MessageCircleIcon size={15} />
          {review.replyCount}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="profile-review-action" onClick={() => setIsEditing(true)}>
          {t('edit')}
        </button>
        {confirmingDelete ? (
          <>
            <button type="button" className="profile-review-action profile-review-action-danger" onClick={handleDelete} disabled={isDeleting}>
              {t('confirmDelete')}
            </button>
            <button type="button" className="profile-review-action" onClick={() => setConfirmingDelete(false)}>
              {t('cancel')}
            </button>
          </>
        ) : (
          <button type="button" className="profile-review-action profile-review-action-danger" onClick={() => setConfirmingDelete(true)}>
            {t('delete')}
          </button>
        )}
      </div>

      {isEditing ? <EditReviewModal review={review} onClose={() => setIsEditing(false)} /> : null}
    </div>
  );
}
