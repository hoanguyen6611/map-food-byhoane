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

const KPI_DEFS: { key: keyof AdminDashboardStatsDto['kpis']; label: string; to: string }[] = [
  { key: 'pendingRestaurants', label: 'Quán chờ duyệt', to: '/moderation?targetType=restaurant&decision=pending' },
  { key: 'pendingReviews', label: 'Review chờ duyệt', to: '/moderation?targetType=review&decision=pending' },
  // Reports don't have their own list/tab — they're nested inside each
  // moderation row's "relatedReports" — so this lands on the queue page
  // rather than a clean pre-filtered view (the honest limit for this one).
  { key: 'newReports', label: 'Báo cáo mới', to: '/moderation' },
  { key: 'activeUsers', label: 'Người dùng hoạt động', to: '/users' },
]

const SHORTCUTS = [
  { to: '/restaurants', label: 'Quản lý Nhà hàng' },
  { to: '/moderation', label: 'Hàng đợi Kiểm duyệt' },
  { to: '/reviews', label: 'Quản lý Đánh giá' },
  { to: '/users', label: 'Quản lý Người dùng' },
]

export function AdminDashboardPage() {
  const [days, setDays] = useState<7 | 30>(7)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: adminDashboardApi.getStats,
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
