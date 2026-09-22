/**
 * Screen 32 — Admin Review Management (docs/04-screen-list.md §32).
 *
 * Manages ALREADY PUBLISHED reviews (hide/restore/delete) — distinct from
 * `AdminModerationQueuePage`, which only handles content still awaiting a
 * pending decision. `admin`/`moderator` can both browse; hide/restore/delete
 * are admin-only per the screen spec, mirroring `AdminRestaurantManagementPage`'s
 * hard-delete gating.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ReviewStatus } from '@foodmap/shared-types'
import { ApiError } from '../api/client'
import { adminReviewsApi } from '../api/admin-reviews'
import { useAuth } from '../auth/AuthContext'
import { useDebouncedValue } from './restaurant-admin/useDebouncedValue'
import {
  formatDateTime,
  RISK_SCORE_OPTIONS,
  riskScoreLabel,
  STATUS_OPTIONS,
  statusLabel,
} from './review-admin/constants'

const PAGE_SIZE = 20

export function AdminReviewManagementPage() {
  const { session } = useAuth()
  const isAdmin = session?.user.role === 'admin'
  const queryClient = useQueryClient()

  // restaurantId/userId arrive only via deep-link (e.g. "Xem đánh giá" from
  // Admin User Management) — there's no free-text UUID picker in this UI,
  // that would be worse UX than just clicking through from context.
  const [searchParams, setSearchParams] = useSearchParams()
  const restaurantId = searchParams.get('restaurantId') ?? ''
  const userId = searchParams.get('userId') ?? ''

  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState<ReviewStatus | ''>('')
  const [minRiskScore, setMinRiskScore] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(searchInput, 400)

  const listQuery = useQuery({
    queryKey: ['admin-reviews', restaurantId, userId, debouncedSearch, status, minRiskScore, page],
    queryFn: () =>
      adminReviewsApi.list({
        restaurantId: restaurantId || undefined,
        userId: userId || undefined,
        search: debouncedSearch || undefined,
        status: status || undefined,
        minRiskScore: minRiskScore === '' ? undefined : minRiskScore,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
  })

  function reportError(err: unknown) {
    if (err instanceof ApiError) {
      setActionError(err.message)
    } else {
      setActionError('Không thể kết nối máy chủ. Vui lòng thử lại.')
    }
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-reviews'] })
  }

  const hideMutation = useMutation({
    mutationFn: (id: string) => adminReviewsApi.hide(id),
    meta: { successMessage: 'Đã ẩn đánh giá.' },
    onSuccess: () => {
      invalidate()
      setActionError(null)
    },
    onError: reportError,
  })
  const restoreMutation = useMutation({
    mutationFn: (id: string) => adminReviewsApi.restore(id),
    meta: { successMessage: 'Đã khôi phục đánh giá.' },
    onSuccess: () => {
      invalidate()
      setActionError(null)
    },
    onError: reportError,
  })
  const removeMutation = useMutation({
    mutationFn: (id: string) => adminReviewsApi.remove(id),
    meta: { successMessage: 'Đã xoá đánh giá.' },
    onSuccess: () => {
      invalidate()
      setActionError(null)
    },
    onError: reportError,
  })
  const isMutating = hideMutation.isPending || restoreMutation.isPending || removeMutation.isPending

  function handleDelete(id: string, authorName: string) {
    if (!isAdmin) return
    // "Xoá vĩnh viễn yêu cầu xác nhận 2 bước" per the screen spec — two
    // sequential confirms, matching this codebase's existing window.confirm
    // convention for destructive actions (AdminRestaurantManagementPage)
    // rather than introducing a custom modal component for one screen.
    if (!window.confirm(`Xoá vĩnh viễn đánh giá của "${authorName}"? Hành động này không thể hoàn tác.`)) return
    if (!window.confirm('Xác nhận lần nữa: XOÁ VĨNH VIỄN đánh giá này khỏi hệ thống?')) return
    setActionError(null)
    removeMutation.mutate(id)
  }

  function clearContextFilter() {
    setSearchParams({})
    setPage(1)
  }

  const data = listQuery.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Quản lý Đánh giá</h1>
          <p>Quản lý toàn bộ đánh giá đã đăng — xử lý báo cáo, gỡ nội dung vi phạm sau khi đã xuất bản.</p>
        </div>
      </div>

      {(restaurantId || userId) && (
        <p>
          Đang lọc theo {restaurantId ? 'quán' : 'người dùng'} đã chọn từ màn hình khác.{' '}
          <button type="button" className="button button-small" onClick={clearContextFilter}>
            Xoá bộ lọc
          </button>
        </p>
      )}

      <div className="filter-bar">
        <label className="filter-field">
          <span>Tìm theo nội dung</span>
          <input
            type="text"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setPage(1)
            }}
            placeholder="Tìm trong nội dung đánh giá…"
          />
        </label>
        <label className="filter-field">
          <span>Trạng thái</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ReviewStatus | '')
              setPage(1)
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Điểm rủi ro</span>
          <select
            value={minRiskScore}
            onChange={(event) => {
              setMinRiskScore(event.target.value === '' ? '' : Number(event.target.value))
              setPage(1)
            }}
          >
            {RISK_SCORE_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {listQuery.isLoading && <p>Đang tải…</p>}
      {listQuery.isError && (
        <p className="form-error" role="alert">
          {listQuery.error instanceof ApiError ? listQuery.error.message : 'Không thể tải danh sách đánh giá.'}
        </p>
      )}

      {data && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Quán</th>
                <th>Người đánh giá</th>
                <th>Điểm</th>
                <th>Nội dung</th>
                <th>Ngày tạo</th>
                <th>Rủi ro</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="data-table-empty">
                    Không có review nào khớp bộ lọc.
                  </td>
                </tr>
              )}
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.restaurantName}</td>
                  <td>{item.author.displayName}</td>
                  <td>{item.overallRating}★</td>
                  <td>{item.comment ?? '(Không có bình luận)'}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                    {riskScoreLabel(item.riskScore)}
                    {item.labels.length > 0 && <div className="moderation-labels">{item.labels.join(', ')}</div>}
                  </td>
                  <td>
                    <span className={`status-badge status-badge-${item.status}`}>{statusLabel(item.status)}</span>
                  </td>
                  <td className="data-table-actions">
                    {item.status !== 'hidden' ? (
                      <button
                        type="button"
                        className="button button-small"
                        disabled={!isAdmin || isMutating}
                        title={!isAdmin ? 'Chỉ admin mới có quyền ẩn đánh giá' : undefined}
                        onClick={() => {
                          setActionError(null)
                          hideMutation.mutate(item.id)
                        }}
                      >
                        Ẩn
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-small"
                        disabled={!isAdmin || isMutating}
                        title={!isAdmin ? 'Chỉ admin mới có quyền khôi phục đánh giá' : undefined}
                        onClick={() => {
                          setActionError(null)
                          restoreMutation.mutate(item.id)
                        }}
                      >
                        Khôi phục
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-small button-danger"
                      disabled={!isAdmin || isMutating}
                      title={!isAdmin ? 'Chỉ admin mới có quyền xoá vĩnh viễn' : undefined}
                      onClick={() => handleDelete(item.id, item.author.displayName)}
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination-bar">
            <button
              type="button"
              className="button button-small"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              ← Trước
            </button>
            <span>
              Trang {data.page} / {totalPages} ({data.total} mục)
            </span>
            <button
              type="button"
              className="button button-small"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Sau →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
