/**
 * Facility checkboxes. `PUT /admin/restaurants/:id/facilities` replaces the
 * full set every time, so this section submits the whole checked list.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FacilityType } from '@foodmap/shared-types'
import { ApiError } from '../../api/client'
import { adminRestaurantsApi } from '../../api/admin-restaurants'
import { adminFacilitiesApi } from '../../api/admin-facilities'

interface FacilitiesSectionProps {
  restaurantId: string
  facilities: FacilityType[]
}

export function FacilitiesSection({ restaurantId, facilities }: FacilitiesSectionProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<FacilityType[]>(facilities)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Live list (Quản lý Tiện ích) instead of a hardcoded array — facilities
  // were a fixed Postgres enum, now a real admin-editable table.
  const facilitiesQuery = useQuery({
    queryKey: ['admin-facilities'],
    queryFn: () => adminFacilitiesApi.list(),
  })
  const facilityOptions = facilitiesQuery.data ?? []

  const mutation = useMutation({
    mutationFn: () => adminRestaurantsApi.replaceFacilities(restaurantId, { facilities: selected }),
    meta: { successMessage: 'Đã lưu tiện ích.' },
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
        {facilityOptions.map((option) => (
          <label key={option.code} className="checkbox-item">
            <input
              type="checkbox"
              checked={selected.includes(option.code)}
              onChange={() => toggle(option.code)}
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
