/**
 * Screen 29 — Admin Dashboard (docs/04-screen-list.md §29).
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { AdminDashboardStatsDto } from '@foodmap/shared-types'
import { ApiError } from '../api/client'
import { adminDashboardApi } from '../api/admin-dashboard'
import { ActivityChart } from './dashboard-admin/ActivityChart'
import { RatingDistributionChart } from './dashboard-admin/RatingDistributionChart'
import { RecentActivityFeed } from './dashboard-admin/RecentActivityFeed'

const RECENT_ACTIVITY_PAGE_SIZE = 8

const KPI_DEFS: { key: keyof AdminDashboardStatsDto['kpis']; label: string; to: string }[] = [
  { key: 'pendingRestaurants', label: 'Quán chờ duyệt', to: '/moderation?targetType=restaurant&decision=pending' },
  { key: 'pendingReviews', label: 'Review chờ duyệt', to: '/moderation?targetType=review&decision=pending' },
  // Reports don't have their own list/tab — they're nested inside each
  // moderation row's "relatedReports" — `hasReports=true` narrows the queue
  // to exactly the rows that have one, instead of the full pending queue.
  { key: 'newReports', label: 'Báo cáo mới', to: '/moderation?hasReports=true' },
  { key: 'activeUsers', label: 'Người dùng hoạt động', to: '/users' },
]

const SHORTCUTS = [
  { to: '/restaurants', label: 'Quản lý Địa điểm' },
  { to: '/moderation', label: 'Danh sách Phê duyệt' },
  { to: '/reviews', label: 'Quản lý Đánh giá' },
  { to: '/users', label: 'Quản lý Người dùng' },
]

export function AdminDashboardPage() {
  const [days, setDays] = useState<7 | 30>(7)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: adminDashboardApi.getStats,
  })

  const auditLogQuery = useQuery({
    queryKey: ['admin-audit-log', RECENT_ACTIVITY_PAGE_SIZE],
    queryFn: () => adminDashboardApi.getAuditLog({ page: 1, pageSize: RECENT_ACTIVITY_PAGE_SIZE }),
  })

  const isEmpty = data && Object.values(data.kpis).every((value) => value === 0)

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Tổng quan Quản trị</h1>
          <p>Số lượng chờ xử lý và hoạt động gần đây trên toàn hệ thống.</p>
        </div>
      </div>

      {isError && (
        <p className="form-error" role="alert">
          {error instanceof ApiError ? error.message : 'Không thể tải dữ liệu tổng quan.'}{' '}
          <button type="button" className="button button-small" onClick={() => refetch()}>
            Thử lại
          </button>
        </p>
      )}

      <div className="kpi-grid">
        {isLoading &&
          KPI_DEFS.map((def) => <div key={def.key} className="kpi-card kpi-card-skeleton" />)}
        {data &&
          KPI_DEFS.map((def) => (
            <Link key={def.key} to={def.to} className="kpi-card">
              <span className="kpi-card-value">{data.kpis[def.key]}</span>
              <span className="kpi-card-label">{def.label}</span>
            </Link>
          ))}
      </div>

      {isEmpty && <p className="dashboard-empty">Không có mục nào cần xử lý — mọi thứ đã được duyệt.</p>}

      {data && (
        <div className="detail-section">
          <div className="page-header-row">
            <h2>Hoạt động {days} ngày qua</h2>
            <div className="tabs">
              <button type="button" className={`tab ${days === 7 ? 'tab-active' : ''}`} onClick={() => setDays(7)}>
                7 ngày
              </button>
              <button type="button" className={`tab ${days === 30 ? 'tab-active' : ''}`} onClick={() => setDays(30)}>
                30 ngày
              </button>
            </div>
          </div>
          <ActivityChart points={data.activity.slice(-days)} />
        </div>
      )}

      {data && (
        <div className="detail-section">
          <h2>Phân bố điểm đánh giá</h2>
          <RatingDistributionChart buckets={data.ratingDistribution} />
        </div>
      )}

      <div className="detail-section">
        <h2>Hoạt động gần đây</h2>
        {auditLogQuery.isLoading && <p>Đang tải…</p>}
        {auditLogQuery.isError && (
          <p className="form-error" role="alert">
            {auditLogQuery.error instanceof ApiError
              ? auditLogQuery.error.message
              : 'Không thể tải hoạt động gần đây.'}
          </p>
        )}
        {auditLogQuery.data && <RecentActivityFeed entries={auditLogQuery.data.items} />}
      </div>

      <h2>Truy cập nhanh</h2>
      <div className="shortcut-grid">
        {SHORTCUTS.map((shortcut) => (
          <Link key={shortcut.to} to={shortcut.to} className="shortcut-card">
            {shortcut.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
