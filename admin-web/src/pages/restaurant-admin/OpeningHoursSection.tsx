/**
 * 7-day opening-hours editor. The backend replaces the full week in one
 * `PUT /admin/restaurants/:id/opening-hours` call (not per-day patches), so
 * this section keeps all 7 rows in local state and submits them together.
 * Each day supports: closed all day, open 24h, or up to two time ranges
 * (e.g. 11:00-14:00 lunch + 17:00-22:00 dinner) — the second range's
 * inputs are always visible but optional; leaving both blank means "no
 * second range", same convention the backend already applies on write.
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
      isOpen24h: existing?.isOpen24h ?? false,
      openTime2: existing?.openTime2 ?? '',
      closeTime2: existing?.closeTime2 ?? '',
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
          isOpen24h: row.isOpen24h,
          openTime: row.isClosed || row.isOpen24h ? undefined : row.openTime || undefined,
          closeTime: row.isClosed || row.isOpen24h ? undefined : row.closeTime || undefined,
          openTime2: row.isClosed || row.isOpen24h ? undefined : row.openTime2 || undefined,
          closeTime2: row.isClosed || row.isOpen24h ? undefined : row.closeTime2 || undefined,
        })),
      }),
    meta: { successMessage: 'Đã lưu giờ mở cửa.' },
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

  // Closed and 24h are mutually exclusive — checking one clears the other,
  // rather than leaving both checked with the backend silently deciding
  // which wins (it does: isClosed wins — see admin-restaurant.service.ts).
  function setClosed(dayOfWeek: number, isClosed: boolean) {
    updateRow(dayOfWeek, isClosed ? { isClosed: true, isOpen24h: false } : { isClosed: false })
  }
  function setOpen24h(dayOfWeek: number, isOpen24h: boolean) {
    updateRow(dayOfWeek, isOpen24h ? { isOpen24h: true, isClosed: false } : { isOpen24h: false })
  }

  function handleSubmit() {
    const fieldErrors: Record<number, string> = {}
    for (const row of rows) {
      if (row.isClosed || row.isOpen24h) continue
      const open = row.openTime?.trim() ?? ''
      const close = row.closeTime?.trim() ?? ''
      if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close)) {
        fieldErrors[row.dayOfWeek] = 'Định dạng giờ phải là HH:mm (ví dụ 08:00).'
        continue
      }
      const open2 = row.openTime2?.trim() ?? ''
      const close2 = row.closeTime2?.trim() ?? ''
      if (open2 || close2) {
        if (!TIME_PATTERN.test(open2) || !TIME_PATTERN.test(close2)) {
          fieldErrors[row.dayOfWeek] = 'Khung giờ thứ 2: định dạng phải là HH:mm, hoặc để trống cả hai.'
        }
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
            <th>Mở cửa 24h</th>
            <th>Giờ mở</th>
            <th>Giờ đóng</th>
            <th>Giờ mở 2 (tuỳ chọn)</th>
            <th>Giờ đóng 2 (tuỳ chọn)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rangesDisabled = row.isClosed || row.isOpen24h
            return (
              <tr key={row.dayOfWeek}>
                <td>{DAY_LABELS[row.dayOfWeek]}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.isClosed}
                    onChange={(event) => setClosed(row.dayOfWeek, event.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.isOpen24h ?? false}
                    onChange={(event) => setOpen24h(row.dayOfWeek, event.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="08:00"
                    disabled={rangesDisabled}
                    value={row.openTime ?? ''}
                    onChange={(event) => updateRow(row.dayOfWeek, { openTime: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="22:00"
                    disabled={rangesDisabled}
                    value={row.closeTime ?? ''}
                    onChange={(event) => updateRow(row.dayOfWeek, { closeTime: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="17:00"
                    disabled={rangesDisabled}
                    value={row.openTime2 ?? ''}
                    onChange={(event) => updateRow(row.dayOfWeek, { openTime2: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="22:00"
                    disabled={rangesDisabled}
                    value={row.closeTime2 ?? ''}
                    onChange={(event) => updateRow(row.dayOfWeek, { closeTime2: event.target.value })}
                  />
                </td>
                <td>{errors[row.dayOfWeek] && <span className="field-error">{errors[row.dayOfWeek]}</span>}</td>
              </tr>
            )
          })}
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
