import type { ReviewDto } from '@foodmap/shared-types';
import { formatRelativeDate, initialsOf } from '@/lib/format';
import { Stars } from './Stars';
import { ReviewCardPhotos } from './ReviewCardPhotos';
import { ReviewCardFooter } from './ReviewCardFooter';

interface Props {
  review: ReviewDto;
  locale: string;
  isLoggedIn: boolean;
  /** Pre-translated "Báo cáo" label. */
  reportLabel: string;
  /** Pre-translated "Hữu ích" label. */
  helpfulLabel: string;
  /** Pre-translated "{count} phản hồi" label (literal "{count}" token, replaced client-side). */
  replyCountLabel: string;
  replyPlaceholder: string;
  replySubmitLabel: string;
}

export function ReviewCard({
  review,
  locale,
  isLoggedIn,
  reportLabel,
  helpfulLabel,
  replyCountLabel,
  replyPlaceholder,
  replySubmitLabel,
}: Props) {
  return (
    <div className="review-card">
      <div className="review-card-header">
        {review.author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external ImageKit/S3 URL, not a local asset
          <img src={review.author.avatarUrl} alt="" className="avatar-mono avatar-mono-img" aria-hidden="true" />
        ) : (
          <span className="avatar-mono" aria-hidden="true">
            {initialsOf(review.author.displayName)}
          </span>
        )}
        <div className="review-card-headtext">
          <span className="review-card-author">{review.author.displayName}</span>
          <span className="review-card-when">{formatRelativeDate(review.createdAt, locale)}</span>
        </div>
        <Stars value={review.overallRating} size={14} />
      </div>
      {review.comment ? <p className="review-card-body">{review.comment}</p> : null}
      {review.photos.length > 0 ? <ReviewCardPhotos photos={review.photos} /> : null}
      <ReviewCardFooter
        reviewId={review.id}
        locale={locale}
        isLoggedIn={isLoggedIn}
        initialHelpfulCount={review.helpfulCount}
        initialViewerHasMarkedHelpful={review.viewerHasMarkedHelpful}
        initialReplyCount={review.replyCount}
        helpfulLabel={helpfulLabel}
        reportLabel={reportLabel}
        replyCountLabel={replyCountLabel}
        replyPlaceholder={replyPlaceholder}
        replySubmitLabel={replySubmitLabel}
      />
    </div>
  );
}
