'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { ReviewReplyDto } from '@foodmap/shared-types';
import { createReplyAction, listRepliesAction, toggleHelpfulAction } from '@/app/[locale]/restaurant/[slug]/actions';
import { formatRelativeDate, initialsOf } from '@/lib/format';
import { ThumbsUpIcon, MessageCircleIcon } from './icons';
import { useToast } from './ToastProvider';

interface Props {
  reviewId: string;
  locale: string;
  isLoggedIn: boolean;
  initialHelpfulCount: number;
  initialViewerHasMarkedHelpful: boolean;
  initialReplyCount: number;
  helpfulLabel: string;
  reportLabel: string;
  replyPlaceholder: string;
  replySubmitLabel: string;
}

/**
 * Real helpful-vote + reply UI — replaces the old presentational-only
 * footer (see ReviewCard.tsx's prior doc comment: the backend genuinely had
 * no helpful-vote/reply model until this session's profile-page redesign).
 */
export function ReviewCardFooter({
  reviewId,
  locale,
  isLoggedIn,
  initialHelpfulCount,
  initialViewerHasMarkedHelpful,
  initialReplyCount,
  helpfulLabel,
  reportLabel,
  replyPlaceholder,
  replySubmitLabel,
}: Props) {
  const router = useRouter();
  const t = useTranslations('common');
  // Called directly here (not a pre-formatted string prop) so it can
  // re-interpolate `count` on every render as `replyCount` state changes —
  // next-intl's `t()` requires the ICU variable at the call site, it can't
  // be deferred to a manual string `.replace()` on an already-evaluated value.
  const tRestaurant = useTranslations('restaurant');
  const { showToast } = useToast();
  const [helpfulCount, setHelpfulCount] = useState(initialHelpfulCount);
  const [hasMarkedHelpful, setHasMarkedHelpful] = useState(initialViewerHasMarkedHelpful);
  const [replyCount, setReplyCount] = useState(initialReplyCount);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replies, setReplies] = useState<ReviewReplyDto[] | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleToggleHelpful() {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    // Optimistic — reverted if the server call fails.
    const wasMarked = hasMarkedHelpful;
    setHasMarkedHelpful(!wasMarked);
    setHelpfulCount((c) => (wasMarked ? c - 1 : c + 1));
    startTransition(async () => {
      const result = await toggleHelpfulAction(reviewId);
      if (!result.ok) {
        setHasMarkedHelpful(wasMarked);
        setHelpfulCount((c) => (wasMarked ? c + 1 : c - 1));
        showToast(t('actionError'), 'error');
        return;
      }
      setHasMarkedHelpful(result.data.viewerHasMarkedHelpful);
      setHelpfulCount(result.data.helpfulCount);
    });
  }

  function toggleReplies() {
    const opening = !repliesOpen;
    setRepliesOpen(opening);
    if (opening && replies === null) {
      startTransition(async () => {
        setReplies(await listRepliesAction(reviewId));
      });
    }
  }

  function submitReply() {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    const body = replyDraft.trim();
    if (!body) return;
    startTransition(async () => {
      const result = await createReplyAction(reviewId, body);
      if (result.ok) {
        setReplies((prev) => [...(prev ?? []), result.data]);
        setReplyCount((c) => c + 1);
        setReplyDraft('');
        return;
      }
      showToast(t('actionError'), 'error');
    });
  }

  return (
    <>
      <div className="review-card-footer">
        <button
          type="button"
          className={`review-card-helpful ${hasMarkedHelpful ? 'review-card-helpful-active' : ''}`}
          onClick={handleToggleHelpful}
          disabled={isPending}
        >
          <ThumbsUpIcon size={15} />
          {helpfulLabel} {helpfulCount > 0 ? `(${helpfulCount})` : ''}
        </button>
        <button type="button" className="review-card-reply-toggle" onClick={toggleReplies}>
          <MessageCircleIcon size={15} />
          {tRestaurant('replyCountLabel', { count: replyCount })}
        </button>
        <span className="font-meta" style={{ fontSize: 14, color: 'var(--color-ink-subtle)' }}>
          {reportLabel}
        </span>
      </div>

      {repliesOpen ? (
        <div className="review-card-replies">
          {replies === null ? null : (
            <>
              {replies.map((reply) => (
                <div key={reply.id} className="review-card-reply-item">
                  <span className="avatar-mono" aria-hidden="true">
                    {initialsOf(reply.author.displayName)}
                  </span>
                  <div>
                    <div className="review-card-reply-head">
                      <span className="review-card-reply-author">{reply.author.displayName}</span>
                      <span className="review-card-reply-when">{formatRelativeDate(reply.createdAt, locale)}</span>
                    </div>
                    <p className="review-card-reply-body">{reply.body}</p>
                  </div>
                </div>
              ))}
              <div className="review-card-reply-form">
                <input
                  type="text"
                  value={replyDraft}
                  placeholder={replyPlaceholder}
                  maxLength={500}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitReply();
                  }}
                />
                <button type="button" onClick={submitReply} disabled={isPending || !replyDraft.trim()}>
                  {replySubmitLabel}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
