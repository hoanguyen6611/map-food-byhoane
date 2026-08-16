/**
 * Hand-rolled SVG horizontal bar chart — same "no charting library" call as
 * `ActivityChart.tsx` (single-use visual, admin-web has none installed).
 */
import type { AdminDashboardRatingBucket } from '@foodmap/shared-types'

const ROW_HEIGHT = 28
const CHART_WIDTH = 100

interface RatingDistributionChartProps {
  buckets: AdminDashboardRatingBucket[]
}

export function RatingDistributionChart({ buckets }: RatingDistributionChartProps) {
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count))
  // Highest rating on top, reading top-to-bottom like a leaderboard.
  const rows = [...buckets].sort((a, b) => b.rating - a.rating)

  return (
    <div className="rating-chart">
      {rows.map((bucket) => {
        const widthPercent = (bucket.count / maxCount) * 100
        return (
          <div key={bucket.rating} className="rating-chart-row" style={{ height: ROW_HEIGHT }}>
            <span className="rating-chart-label">{bucket.rating}★</span>
            <svg viewBox={`0 0 ${CHART_WIDTH} 1`} preserveAspectRatio="none" className="rating-chart-bar-track" role="img" aria-label={`${bucket.rating} sao: ${bucket.count} đánh giá`}>
              <rect x={0} y={0} width={CHART_WIDTH} height={1} fill="var(--color-border)" />
              <rect x={0} y={0} width={widthPercent} height={1} fill="var(--color-accent)" />
            </svg>
            <span className="rating-chart-count">{bucket.count}</span>
          </div>
        )
      })}
    </div>
  )
}
