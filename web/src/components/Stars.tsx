import { StarIcon } from './icons';

interface Props {
  value: number;
  size?: number;
  emptyColor?: string;
}

/** Row of 5 star glyphs — filled up to `value` (rounded down), matches README's `Stars` spec. */
export function Stars({ value, size = 13, emptyColor = 'var(--color-star-empty)' }: Props) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon
          key={i}
          size={size}
          filled={i <= Math.round(value)}
          style={i <= Math.round(value) ? { color: 'var(--color-star)' } : { color: emptyColor }}
        />
      ))}
    </span>
  );
}
