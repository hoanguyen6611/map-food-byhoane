/**
 * Facility checkboxes. `PUT /admin/restaurants/:id/facilities` replaces the
 * full set every time, so this section submits the whole checked list.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FacilityType } from '@foodmap/shared-types'
import { ApiError } from '../../api/client'
import { adminRestaurantsApi } from '../../api/admin-restaurants'
import { FACILITY_OPTIONS } from './constants'

interface FacilitiesSectionProps {
  restaurantId: string
  facilities: FacilityType[]
}

export function FacilitiesSection({ restaurantId, facilities }: FacilitiesSectionProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<FacilityType[]>(facilities)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: () => adminRestaurantsApi.replaceFacilities(restaurantId, { facilities: selected }),
    onSuccess: () => {
      setSaved(true)
      setServerError(null)
      queryClient.invalidateQueries({ queryKey: ['admin-restaurant', restaurantId] })
    },
    onError: (err: unknown) => {
      setSaved(false)
      setServerError(err instanceof ApiError ? err.message : 'Không thể lưu tiện ích.')
    },
  })

  function toggle(value: FacilityType) {
    setSaved(false)
    setSelected((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    )
  }

  return (
    <section className="detail-section">
      <h2>Tiện ích</h2>
      <div className="checkbox-group">
        {FACILITY_OPTIONS.map((option) => (
          <label key={option.value} className="checkbox-item">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>

      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}
      {saved && <p className="form-success">Đã lưu tiện ích.</p>}

      <button
        type="button"
        className="button button-primary"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Đang lưu…' : 'Lưu tiện ích'}
      </button>
    </section>
  )
}
