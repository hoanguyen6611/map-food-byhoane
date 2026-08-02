/**
 * 7-day opening-hours editor. The backend replaces the full week in one
 * `PUT /admin/restaurants/:id/opening-hours` call (not per-day patches), so
 * this section keeps all 7 rows in local state and submits them together.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { OpeningHourDto } from '@foodmap/shared-types'
import { ApiError } from '../../api/client'
import { adminRestaurantsApi } from '../../api/admin-restaurants'
import type { OpeningHourEntryInput } from '../../api/admin-restaurants'
import { DAY_LABELS } from './constants'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function buildInitialRows(openingHours: OpeningHourDto[]): OpeningHourEntryInput[] {
  const byDay = new Map(openingHours.map((entry) => [entry.dayOfWeek, entry]))
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const existing = byDay.get(dayOfWeek)
    return {
      dayOfWeek,
      openTime: existing?.openTime ?? '',
      closeTime: existing?.closeTime ?? '',
      isClosed: existing?.isClosed ?? true,
    }
  })
}

interface OpeningHoursSectionProps {
  restaurantId: string
  openingHours: OpeningHourDto[]
}

export function OpeningHoursSection({ restaurantId, openingHours }: OpeningHoursSectionProps) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<OpeningHourEntryInput[]>(() => buildInitialRows(openingHours))
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      adminRestaurantsApi.replaceOpeningHours(restaurantId, {
        days: rows.map((row) => ({
          dayOfWeek: row.dayOfWeek,
          isClosed: row.isClosed,
          openTime: row.isClosed ? undefined : row.openTime || undefined,
          closeTime: row.isClosed ? undefined : row.closeTime || undefined,
        })),
      }),
    onSuccess: () => {
      setSaved(true)
      setServerError(null)
      queryClient.invalidateQueries({ queryKey: ['admin-restaurant', restaurantId] })
    },
    onError: (err: unknown) => {
      setSaved(false)
      setServerError(err instanceof ApiError ? err.message : 'Không thể lưu giờ mở cửa.')
    },
  })

  function updateRow(dayOfWeek: number, patch: Partial<OpeningHourEntryInput>) {
    setSaved(false)
    setRows((current) =>
      current.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)),
    )
  }

  function handleSubmit() {
    const fieldErrors: Record<number, string> = {}
    for (const row of rows) {
      if (row.isClosed) continue
      const open = row.openTime?.trim() ?? ''
      const close = row.closeTime?.trim() ?? ''
      if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close)) {
        fieldErrors[row.dayOfWeek] = 'Định dạng giờ phải là HH:mm (ví dụ 08:00).'
      }
    }
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    mutation.mutate()
  }

  return (
    <section className="detail-section">
      <h2>Giờ mở cửa</h2>
      <table className="hours-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Đóng cửa cả ngày</th>
            <th>Giờ mở</th>
            <th>Giờ đóng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.dayOfWeek}>
              <td>{DAY_LABELS[row.dayOfWeek]}</td>
              <td>
                <input
                  type="checkbox"
                  checked={row.isClosed}
                  onChange={(event) => updateRow(row.dayOfWeek, { isClosed: event.target.checked })}
                />
              </td>
              <td>
                <input
                  type="text"
                  placeholder="08:00"
                  disabled={row.isClosed}
                  value={row.openTime ?? ''}
                  onChange={(event) => updateRow(row.dayOfWeek, { openTime: event.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  placeholder="22:00"
                  disabled={row.isClosed}
                  value={row.closeTime ?? ''}
                  onChange={(event) => updateRow(row.dayOfWeek, { closeTime: event.target.value })}
                />
              </td>
              <td>{errors[row.dayOfWeek] && <span className="field-error">{errors[row.dayOfWeek]}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}
      {saved && <p className="form-success">Đã lưu giờ mở cửa.</p>}

      <button
        type="button"
        className="button button-primary"
        disabled={mutation.isPending}
        onClick={handleSubmit}
      >
        {mutation.isPending ? 'Đang lưu…' : 'Lưu giờ mở cửa'}
      </button>
    </section>
  )
}
