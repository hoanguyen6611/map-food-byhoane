/**
 * Owner-facing review list + reply — reuses the exact same PUBLIC review
 * endpoints any logged-in user hits (`GET /restaurants/:id/reviews`,
 * `GET/POST /reviews/:id/replies`), since reply-creation has no
 * ownership/role gating by design (any authenticated user may reply). The
 * only owner-specific thing here is `ReviewReplyDto.isOwnerReply`, computed
 * server-side by comparing a reply's author to the restaurant's current
 * owner — this page doesn't need to compute or pass that itself.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError } from '../../api/client'
import { reviewsApi } from '../../api/reviews'
import { useOwnerRestaurant } from '../../owner/OwnerRestaurantContext'

function ReviewReplies({ reviewId }: { reviewId: string }) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const repliesQuery = useQuery({
    queryKey: ['review-replies', reviewId],
    queryFn: () => reviewsApi.listReplies(reviewId),
  })

  const replyMutation = useMutation({
    mutationFn: (text: string) => reviewsApi.createReply(reviewId, text),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: ['review-replies', reviewId] })
    },
  })

  return (
    <div className="owner-review-replies">
      {repliesQuery.data?.items.map((reply) => (
        <div key={reply.id} className="owner-review-reply">
          {reply.isOwnerReply && <span className="status-badge status-badge-approved">Chủ quán</span>}
          <span className="owner-review-reply-author">{reply.author.displayName}</span>
          <p>{reply.body}</p>
        </div>
      ))}
      <div className="owner-review-reply-form">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Phản hồi đánh giá này…"
        />
        <button
          type="button"
          className="button button-small button-primary"
          disabled={replyMutation.isPending || body.trim().length === 0}
          onClick={() => replyMutation.mutate(body.trim())}
        >
          {replyMutation.isPending ? 'Đang gửi…' : 'Gửi phản hồi'}
        </button>
      </div>
    </div>
  )
}

export function OwnerReviewsPage() {
  const { selected, selectedId } = useOwnerRestaurant()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const reviewsQuery = useQuery({
    queryKey: ['owner-restaurant-reviews', selectedId],
    queryFn: () => reviewsApi.listForRestaurant(selectedId!),
    enabled: selectedId !== null,
  })

  if (!selected) {
    return (
      <div className="page">
        <h1>Đánh giá</h1>
        <p>Bạn chưa quản lý quán ăn nào.</p>
      </div>
    )
  }
  if (reviewsQuery.isLoading) {
    return <div className="page">Đang tải…</div>
  }
  if (reviewsQuery.isError) {
    return (
      <div className="page">
        <p className="form-error" role="alert">
          {reviewsQuery.error instanceof ApiError ? reviewsQuery.error.message : 'Không thể tải đánh giá.'}
        </p>
      </div>
    )
  }

  const items = reviewsQuery.data?.items ?? []

  return (
    <div className="page">
      <h1>Đánh giá — {selected.name}</h1>
      {items.length === 0 && <p>Chưa có đánh giá nào.</p>}
      <div className="owner-review-list">
        {items.map((review) => (
          <div key={review.id} className="detail-section owner-review-item">
            <div className="page-header-row">
              <div>
                <span>{review.overallRating.toFixed(1)} ★</span> <span>{review.author.displayName}</span>
                <p>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</p>
              </div>
            </div>
            {review.comment && <p>{review.comment}</p>}
            <button
              type="button"
              className="button button-small"
              onClick={() => setExpandedId(expandedId === review.id ? null : review.id)}
            >
              {expandedId === review.id ? 'Ẩn phản hồi' : 'Xem / trả lời'}
            </button>
            {expandedId === review.id && <ReviewReplies reviewId={review.id} />}
          </div>
        ))}
      </div>
    </div>
  )
}
