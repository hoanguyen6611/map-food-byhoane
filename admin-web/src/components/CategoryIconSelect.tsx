/**
 * Dropdown over the curated CATEGORY_ICON_OPTIONS set (not free text) —
 * keeps this a visual pick instead of requiring SVG/emoji knowledge. Shows
 * a live preview of the currently selected icon next to the select.
 */
import { CATEGORY_ICON_OPTIONS } from '@foodmap/shared-types'
import { CategoryIconPreview } from './CategoryIconPreview'

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function CategoryIconSelect({ value, onChange, disabled }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#f4f4f6',
          flexShrink: 0,
        }}
      >
        <CategoryIconPreview iconKey={value || undefined} />
      </span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">— Mặc định —</option>
        {CATEGORY_ICON_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
