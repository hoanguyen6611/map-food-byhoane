/** Renders one CATEGORY_ICON_OPTIONS entry as the same 24x24 outline SVG web/mobile use. */
import { getCategoryIconPath } from '@foodmap/shared-types'

interface Props {
  iconKey: string | null | undefined
  size?: number
}

export function CategoryIconPreview({ iconKey, size = 20 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1c2024"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={getCategoryIconPath(iconKey)} />
    </svg>
  )
}
