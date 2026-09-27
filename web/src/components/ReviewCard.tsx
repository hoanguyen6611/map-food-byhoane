import type { ReviewDto } from '@foodmap/shared-types';
import { formatRelativeDate, initialsOf } from '@/lib/format';
import { Link } from '@/i18n/navigation';
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
  replyPlaceholder: string;
  replySubmitLabel: string;
}

export function ReviewCard({
  review,
  locale,
  isLoggedIn,
  reportLabel,
  helpfulLabel,
  replyPlaceholder,
  replySubmitLabel,
}: Props) {
  return (
    <div className="review-card">
      <div className="review-card-header">
        {(() => {
          const avatarAndName = (
            <>
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
            </>
          );
          // An anonymized author (isPublic: false) has no viewable profile —
          // /profile/[id] 404s for it — so it stays plain, unlinked text
          // exactly as before, rather than a link that always errors.
          return review.author.isAnonymized ? (
            avatarAndName
          ) : (
            <Link href={`/profile/${review.author.id}`} className="review-card-author-link">
              {avatarAndName}
            </Link>
          );
        })()}
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
        replyPlaceholder={replyPlaceholder}
        replySubmitLabel={replySubmitLabel}
      />
    </div>
  );
}
