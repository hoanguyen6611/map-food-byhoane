/**
 * "Hoạt động gần đây" — moved out of the Dashboard's fixed 8-item widget
 * into its own full, paginated page. Reuses the exact same backend endpoint
 * (`adminDashboardApi.getAuditLog`, already pagination-ready) and the same
 * `RecentActivityFeed` row rendering — only the page size and the addition
 * of real pagination controls are new.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { adminDashboardApi } from '../api/admin-dashboard'
import { RecentActivityFeed } from './dashboard-admin/RecentActivityFeed'

const PAGE_SIZE = 20

export function AdminActivityPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-audit-log', PAGE_SIZE, page],
    queryFn: () => adminDashboardApi.getAuditLog({ page, pageSize: PAGE_SIZE }),
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Hoạt động gần đây</h1>
          <p>Toàn bộ nhật ký hành động của quản trị viên và chủ quán trên hệ thống.</p>
        </div>
      </div>

      {isLoading && <p>Đang tải…</p>}
      {isError && (
        <p className="form-error" role="alert">
          {error instanceof ApiError ? error.message : 'Không thể tải hoạt động gần đây.'}
        </p>
      )}

      {data && (
        <>
          <RecentActivityFeed entries={data.items} />

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
