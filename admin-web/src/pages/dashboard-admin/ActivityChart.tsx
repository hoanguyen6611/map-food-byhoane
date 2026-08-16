/**
 * Hand-rolled SVG grouped bar chart — admin-web has no charting library
 * installed and this is the only chart in the app so far; a single grouped
 * bar chart doesn't justify adding one (same "not worth a dependency" call
 * made elsewhere in this codebase for single-use decorative/visual needs).
 *
 * Date labels are rendered as plain HTML below the SVG (a flex row), not as
 * SVG `<text>` — the chart's viewBox is intentionally non-square
 * (`preserveAspectRatio="none"` stretches bars to fill the container width,
 * which is fine for rects) but would visually distort any text baked into
 * that same coordinate space.
 */
import type { AdminDashboardActivityPoint } from '@foodmap/shared-types'

const CHART_HEIGHT = 100
const BAR_GROUP_GAP = 4
const BAR_GAP = 1.5

const SERIES: { key: keyof Pick<AdminDashboardActivityPoint, 'newReviews' | 'newContributions' | 'newUsers'>; label: string; color: string }[] = [
  { key: 'newReviews', label: 'Đánh giá mới', color: 'var(--color-accent)' },
  { key: 'newContributions', label: 'Đóng góp mới', color: 'var(--color-chart-2)' },
  { key: 'newUsers', label: 'Người dùng mới', color: 'var(--color-chart-3)' },
]

function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

interface ActivityChartProps {
  points: AdminDashboardActivityPoint[]
}

export function ActivityChart({ points }: ActivityChartProps) {
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.newReviews, point.newContributions, point.newUsers]))
  const groupWidth = 100 / points.length
  const barWidth = (groupWidth - BAR_GROUP_GAP) / SERIES.length - BAR_GAP
  // Thin out x-axis labels so they don't overlap — roughly 6 regardless of
  // whether this is the 7-day or 30-day view.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div className="activity-chart">
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="activity-chart-svg"
        role="img"
        aria-label="Biểu đồ hoạt động"
      >
        {points.map((point, dayIndex) => {
          const groupX = dayIndex * groupWidth + BAR_GROUP_GAP / 2
          return (
            <g key={point.date}>
              {SERIES.map((series, seriesIndex) => {
                const value = point[series.key]
                const barHeight = (value / maxValue) * CHART_HEIGHT
                const x = groupX + seriesIndex * (barWidth + BAR_GAP)
                return (
                  <rect
                    key={series.key}
                    x={x}
                    y={CHART_HEIGHT - barHeight}
                    width={Math.max(0, barWidth)}
                    height={barHeight}
                    fill={series.color}
                  >
                    <title>
                      {series.label} — {point.date}: {value}
                    </title>
                  </rect>
                )
              })}
            </g>
          )
        })}
      </svg>

      <div className="activity-chart-axis">
        {points.map((point, dayIndex) => (
          <span key={point.date} className="activity-chart-axis-label">
            {dayIndex % labelEvery === 0 ? formatShortDate(point.date) : ''}
          </span>
        ))}
      </div>

      <div className="activity-chart-legend">
        {SERIES.map((series) => (
          <span key={series.key} className="activity-chart-legend-item">
            <span className="activity-chart-legend-swatch" style={{ background: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
    </div>
  )
}
