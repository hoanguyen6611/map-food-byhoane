import type { ReviewCriteriaBreakdownDto } from '@foodmap/shared-types';

interface Props {
  items: ReviewCriteriaBreakdownDto[];
  labelWidth?: number;
}

/**
 * The seven review-criteria bars (README's `AxisBars`). Skips any criterion
 * with `averageScore === null` — that DTO field is honestly null when nobody
 * has rated it yet (see its own doc comment), never fabricated as 0.
 */
export function AxisBars({ items, labelWidth = 112 }: Props) {
  const rated = items.filter((item) => item.averageScore !== null);
  if (rated.length === 0) return null;

  return (
    <div className="axis-bars">
      {rated.map((item) => (
        <div className="axis-row" key={item.code}>
          <span className="axis-label" style={{ width: labelWidth }}>
            {item.label}
          </span>
          <span className="axis-track">
            <span
              className="axis-fill"
              style={{ width: `${((item.averageScore ?? 0) / 5) * 100}%` }}
            />
          </span>
          <span className="axis-value">{item.averageScore?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}
