import type { ReviewDto } from '@foodmap/shared-types';
import { formatRelativeDate, initialsOf } from '@/lib/format';
import { Stars } from './Stars';
import { ThumbsUpIcon } from './icons';

interface Props {
  review: ReviewDto;
  locale: string;
  /** Pre-translated "Báo cáo" label. */
  reportLabel: string;
  /** Pre-translated "Hữu ích" label. */
  helpfulLabel: string;
}

/**
 * README's `ReviewCard`. The "Hữu ích" affordance is presentational only —
 * the backend has no helpful-vote field or endpoint (see
 * `ReviewDto`/`ReviewListResponse` in shared-types/review.ts), so this never
 * fakes an optimistic counter the API can't back.
 */
export function ReviewCard({ review, locale, reportLabel, helpfulLabel }: Props) {
  return (
    <div className="review-card">
      <div className="review-card-header">
        <span className="avatar-mono" aria-hidden="true">
          {initialsOf(review.author.displayName)}
        </span>
        <div className="review-card-headtext">
          <span className="review-card-author">{review.author.displayName}</span>
          <span className="review-card-when">{formatRelativeDate(review.createdAt, locale)}</span>
        </div>
        <Stars value={review.overallRating} size={14} />
      </div>
      {review.comment ? <p className="review-card-body">{review.comment}</p> : null}
      {review.photos.length > 0 ? (
        <div className="review-card-photos">
          {review.photos.map((photo) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="review-card-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit-hosted review photos, same rationale as PhotoUploadField's previews */}
              <img src={photo.url} alt="" />
            </a>
          ))}
        </div>
      ) : null}
      <div className="review-card-footer">
        <span className="review-card-helpful">
          <ThumbsUpIcon size={15} />
          {helpfulLabel}
        </span>
        <span className="font-meta" style={{ fontSize: 14, color: 'var(--color-ink-subtle)' }}>
          {reportLabel}
        </span>
      </div>
    </div>
  );
}
