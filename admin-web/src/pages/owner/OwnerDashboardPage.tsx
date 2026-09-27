import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../../api/client'
import { ownerRestaurantsApi } from '../../api/owner-restaurants'
import { useOwnerRestaurant } from '../../owner/OwnerRestaurantContext'

export function OwnerDashboardPage() {
  const { selected, selectedId, isLoading: isLoadingRestaurants } = useOwnerRestaurant()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['owner-restaurant-stats', selectedId],
    queryFn: () => ownerRestaurantsApi.getStats(selectedId!),
    enabled: selectedId !== null,
  })

  if (isLoadingRestaurants) return <div className="page">Đang tải…</div>
  if (!selected) {
    return (
      <div className="page">
        <h1>Tổng quan</h1>
        <p>Bạn chưa quản lý quán ăn nào.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>{selected.name}</h1>
          <p>Số liệu tổng — đây là tổng cộng từ trước tới nay, không phải theo tuần/tháng.</p>
        </div>
      </div>

      {isError && (
        <p className="form-error" role="alert">
          {error instanceof ApiError ? error.message : 'Không thể tải số liệu.'}{' '}
          <button type="button" className="button button-small" onClick={() => refetch()}>
            Thử lại
          </button>
        </p>
      )}

      <div className="kpi-grid">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="kpi-card kpi-card-skeleton" />)}
        {data && (
          <>
            <div className="kpi-card">
              <span className="kpi-card-value">{data.viewCount}</span>
              <span className="kpi-card-label">Lượt xem</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card-value">{data.reviewCount}</span>
              <span className="kpi-card-label">Số đánh giá</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card-value">{data.compositeScore?.toFixed(1) ?? '—'}</span>
              <span className="kpi-card-label">Điểm trung bình</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card-value">
                {data.lastReviewAt ? new Date(data.lastReviewAt).toLocaleDateString('vi-VN') : '—'}
              </span>
              <span className="kpi-card-label">Đánh giá gần nhất</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
