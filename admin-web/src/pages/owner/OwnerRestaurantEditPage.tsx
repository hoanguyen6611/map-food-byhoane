/**
 * Owner-facing "edit restaurant info" — unlike AdminRestaurantEditPage's
 * sections (direct staff writes via PUT/PATCH), every change here goes
 * through the community edit_suggestion Contribution pipeline: one
 * `POST /restaurants/:id/edit-suggestions` call per changed field, exactly
 * like any other contributor, just submitted by an `owner`-role user (which
 * forces hold_for_review server-side — see contribution.service.ts). This
 * page diffs the current form against the last-loaded snapshot and only
 * submits fields that actually changed.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  VN_PROVINCES,
  findVnProvinceByName,
  findVnWardByName,
  type EditableRestaurantField,
  type FacilityDto,
  type OwnerRestaurantDetailDto,
} from '@foodmap/shared-types'
import { ApiError } from '../../api/client'
import { ownerRestaurantsApi } from '../../api/owner-restaurants'
import { contributionsApi } from '../../api/contributions'
import { catalogApi } from '../../api/catalog'
import { useOwnerRestaurant } from '../../owner/OwnerRestaurantContext'
import { SearchableSelect } from '../../components/SearchableSelect'
import { DAY_LABELS } from '../restaurant-admin/constants'
import { pushToast } from '../../lib/toastStore'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_NEW_FACILITY_LABELS = 5

interface HourRow {
  dayOfWeek: number
  openTime: string
  closeTime: string
  isClosed: boolean
}

interface FormState {
  name: string
  description: string
  phone: string
  addressLine: string
  // Select-driven (SearchableSelect over VN_PROVINCES), not free text — same
  // convention as admin-web's own RestaurantCoreForm.tsx, so an owner can't
  // typo a province/ward name into something that won't match anything.
  // Resolved back to the actual name string only at diff/submit time (see
  // resolveProvinceName/resolveWardName below).
  addressProvinceCode: string
  addressWardCode: string
  lat: string
  lng: string
  facebookUrl: string
  instagramUrl: string
  tiktokUrl: string
  websiteUrl: string
  facilities: string[]
  hours: HourRow[]
}

function toFormState(detail: OwnerRestaurantDetailDto): FormState {
  const byDay = new Map(detail.openingHours.map((h) => [h.dayOfWeek, h]))
  const province = findVnProvinceByName(detail.address.province)
  const ward = detail.address.ward && province ? findVnWardByName(province, detail.address.ward) : undefined
  return {
    name: detail.name,
    description: detail.description ?? '',
    phone: detail.phone ?? '',
    addressLine: detail.address.line,
    // Legacy data whose province/ward name doesn't match the current
    // dataset falls back to the raw name as its own "code" — the option
    // lists below add a matching legacy entry so it still displays instead
    // of silently blanking the field out.
    addressProvinceCode: province?.code ?? detail.address.province,
    addressWardCode: ward?.code ?? detail.address.ward ?? '',
    lat: String(detail.location.lat),
    lng: String(detail.location.lng),
    facebookUrl: detail.facebookUrl ?? '',
    instagramUrl: detail.instagramUrl ?? '',
    tiktokUrl: detail.tiktokUrl ?? '',
    websiteUrl: detail.websiteUrl ?? '',
    facilities: detail.facilities,
    hours: Array.from({ length: 7 }, (_, dayOfWeek) => {
      const existing = byDay.get(dayOfWeek)
      return {
        dayOfWeek,
        openTime: existing?.openTime ?? '',
        closeTime: existing?.closeTime ?? '',
        isClosed: existing?.isClosed ?? true,
      }
    }),
  }
}

function resolveProvinceName(provinceCode: string): string {
  const province = VN_PROVINCES.find((p) => p.code === provinceCode)
  return province ? province.name : provinceCode
}
function resolveWardName(provinceCode: string, wardCode: string): string {
  const province = VN_PROVINCES.find((p) => p.code === provinceCode)
  const ward = province?.wards.find((w) => w.code === wardCode)
  return ward ? ward.name : wardCode
}

// One entry per EDITABLE_FIELDS value this page can change — `read` pulls
// the current form value, `newValue` shapes it exactly as
// CreateEditSuggestionRequest.newValue expects for that field.
const FIELD_DEFS: {
  fieldName: EditableRestaurantField
  changed: (a: FormState, b: FormState) => boolean
  newValue: (form: FormState) => unknown
}[] = [
  { fieldName: 'name', changed: (a, b) => a.name !== b.name, newValue: (f) => f.name },
  { fieldName: 'description', changed: (a, b) => a.description !== b.description, newValue: (f) => f.description || null },
  { fieldName: 'phone', changed: (a, b) => a.phone !== b.phone, newValue: (f) => f.phone || null },
  { fieldName: 'address.line', changed: (a, b) => a.addressLine !== b.addressLine, newValue: (f) => f.addressLine },
  {
    fieldName: 'address.ward',
    changed: (a, b) => a.addressWardCode !== b.addressWardCode,
    newValue: (f) => resolveWardName(f.addressProvinceCode, f.addressWardCode),
  },
  {
    fieldName: 'address.province',
    changed: (a, b) => a.addressProvinceCode !== b.addressProvinceCode,
    newValue: (f) => resolveProvinceName(f.addressProvinceCode),
  },
  {
    fieldName: 'location',
    changed: (a, b) => a.lat !== b.lat || a.lng !== b.lng,
    newValue: (f) => ({ lat: Number(f.lat), lng: Number(f.lng) }),
  },
  { fieldName: 'facebookUrl', changed: (a, b) => a.facebookUrl !== b.facebookUrl, newValue: (f) => f.facebookUrl || null },
  { fieldName: 'instagramUrl', changed: (a, b) => a.instagramUrl !== b.instagramUrl, newValue: (f) => f.instagramUrl || null },
  { fieldName: 'tiktokUrl', changed: (a, b) => a.tiktokUrl !== b.tiktokUrl, newValue: (f) => f.tiktokUrl || null },
  { fieldName: 'websiteUrl', changed: (a, b) => a.websiteUrl !== b.websiteUrl, newValue: (f) => f.websiteUrl || null },
  {
    fieldName: 'facilities',
    changed: (a, b) => JSON.stringify(a.facilities) !== JSON.stringify(b.facilities),
    newValue: (f) => f.facilities,
  },
  {
    fieldName: 'openingHours',
    changed: (a, b) => JSON.stringify(a.hours) !== JSON.stringify(b.hours),
    newValue: (f) =>
      f.hours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        isClosed: h.isClosed,
        openTime: h.isClosed ? undefined : h.openTime || undefined,
        closeTime: h.isClosed ? undefined : h.closeTime || undefined,
      })),
  },
]

export function OwnerRestaurantEditPage() {
  const { selected, selectedId } = useOwnerRestaurant()
  const detailQuery = useQuery({
    queryKey: ['owner-restaurant-detail', selectedId],
    queryFn: () => ownerRestaurantsApi.getDetail(selectedId!),
    enabled: selectedId !== null,
  })
  const facilitiesQuery = useQuery({ queryKey: ['catalog-facilities'], queryFn: catalogApi.listFacilities })

  const [snapshot, setSnapshot] = useState<FormState | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [hourErrors, setHourErrors] = useState<Record<number, string>>({})
  const [latError, setLatError] = useState<string | null>(null)
  const [lngError, setLngError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // "+ Thêm mới" facility labels — kept separate from `form.facilities`
  // (which only ever holds real catalog codes) since these don't have a
  // code yet; the backend slugifies each into one on submit (see
  // ContributionService.createEditSuggestion) and creates it isPublic:
  // false until this edit suggestion is approved.
  const [newFacilityLabels, setNewFacilityLabels] = useState<string[]>([])
  const [newFacilityInput, setNewFacilityInput] = useState('')
  // Google Maps link → lat/lng, same UX as web's AddRestaurantForm (paste,
  // blur, or the Apply button all trigger a resolve; `resolvedLink` tracks
  // which value the current `linkStatus` reflects so a stray onChange/onBlur
  // doesn't re-trigger a resolve that's already in flight for that exact
  // paste — see resolveMapLink below).
  const [mapLink, setMapLink] = useState('')
  const [resolvedLink, setResolvedLink] = useState<string | null>(null)
  const [linkStatus, setLinkStatus] = useState<'idle' | 'resolving' | 'resolved' | 'error'>('idle')

  useEffect(() => {
    if (detailQuery.data) {
      const next = toFormState(detailQuery.data)
      setSnapshot(next)
      setForm(next)
    }
  }, [detailQuery.data])

  // Same legacy-value-fallback pattern as RestaurantCoreForm.tsx: if the
  // loaded province/ward code isn't in the current dataset (renamed/merged
  // administrative unit), keep it selectable as its own one-off option
  // instead of silently disappearing from the dropdown.
  const selectedProvince = useMemo(
    () => VN_PROVINCES.find((p) => p.code === form?.addressProvinceCode),
    [form?.addressProvinceCode],
  )
  const provinceOptions = useMemo(() => {
    if (!form?.addressProvinceCode || selectedProvince) return VN_PROVINCES
    return [{ code: form.addressProvinceCode, shortName: `${form.addressProvinceCode} (giá trị cũ)` }, ...VN_PROVINCES]
  }, [selectedProvince, form?.addressProvinceCode])
  const wardOptions = useMemo(() => {
    const wards = selectedProvince?.wards ?? []
    if (!form?.addressWardCode || wards.some((w) => w.code === form.addressWardCode)) return wards
    return [{ code: form.addressWardCode, shortName: `${form.addressWardCode} (giá trị cũ)` }, ...wards]
  }, [selectedProvince, form?.addressWardCode])
  const provinceSelectOptions = useMemo(
    () => provinceOptions.map((option) => ({ value: option.code, label: option.shortName })),
    [provinceOptions],
  )
  const wardSelectOptions = useMemo(
    () => wardOptions.map((option) => ({ value: option.code, label: option.shortName })),
    [wardOptions],
  )

  function update(patch: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...patch } : current))
  }
  function handleProvinceChange(code: string) {
    setForm((current) => (current ? { ...current, addressProvinceCode: code, addressWardCode: '' } : current))
  }
  function updateHour(dayOfWeek: number, patch: Partial<HourRow>) {
    setForm((current) =>
      current
        ? { ...current, hours: current.hours.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h)) }
        : current,
    )
  }
  function toggleFacility(code: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            facilities: current.facilities.includes(code)
              ? current.facilities.filter((c) => c !== code)
              : [...current.facilities, code],
          }
        : current,
    )
  }
  function addNewFacilityLabel() {
    const label = newFacilityInput.trim()
    if (!label || newFacilityLabels.length >= MAX_NEW_FACILITY_LABELS) return
    if (newFacilityLabels.some((l) => l.toLowerCase() === label.toLowerCase())) return
    setNewFacilityLabels((current) => [...current, label])
    setNewFacilityInput('')
  }
  function removeNewFacilityLabel(label: string) {
    setNewFacilityLabels((current) => current.filter((l) => l !== label))
  }

  async function resolveMapLink(link: string) {
    const trimmed = link.trim()
    if (!trimmed) return
    setLinkStatus('resolving')
    setResolvedLink(trimmed)
    try {
      const { location } = await contributionsApi.resolveMapLink(trimmed)
      if (location) {
        update({ lat: String(location.lat), lng: String(location.lng) })
        setLinkStatus('resolved')
      } else {
        setLinkStatus('error')
      }
    } catch {
      setLinkStatus('error')
    }
  }

  async function handleSubmit() {
    if (!form || !snapshot || !selectedId) return

    const fieldErrors: Record<number, string> = {}
    for (const row of form.hours) {
      if (row.isClosed) continue
      if (!TIME_PATTERN.test(row.openTime) || !TIME_PATTERN.test(row.closeTime)) {
        fieldErrors[row.dayOfWeek] = 'Định dạng giờ phải là HH:mm (ví dụ 08:00).'
      }
    }
    setHourErrors(fieldErrors)

    const lat = Number(form.lat)
    const nextLatError =
      form.lat.trim() === '' || Number.isNaN(lat) || lat < -90 || lat > 90
        ? 'Vĩ độ (lat) phải là số từ -90 đến 90.'
        : null
    const lng = Number(form.lng)
    const nextLngError =
      form.lng.trim() === '' || Number.isNaN(lng) || lng < -180 || lng > 180
        ? 'Kinh độ (lng) phải là số từ -180 đến 180.'
        : null
    setLatError(nextLatError)
    setLngError(nextLngError)

    if (Object.keys(fieldErrors).length > 0 || nextLatError || nextLngError) return

    // facilities is handled separately below — it needs to submit even when
    // the checked set itself didn't change, as long as there are pending
    // "+ Thêm mới" labels to propose.
    const changedFields = FIELD_DEFS.filter(
      (def) => def.fieldName !== 'facilities' && def.changed(form, snapshot),
    )
    const facilitiesDef = FIELD_DEFS.find((def) => def.fieldName === 'facilities')!
    const hasNewFacilityLabels = newFacilityLabels.length > 0
    const submitFacilities = facilitiesDef.changed(form, snapshot) || hasNewFacilityLabels

    if (changedFields.length === 0 && !submitFacilities) {
      pushToast('Không có thay đổi nào để gửi.', 'error')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    let succeeded = 0
    let failed = 0
    for (const def of changedFields) {
      try {
        await contributionsApi.createEditSuggestion(selectedId, {
          fieldName: def.fieldName,
          newValue: def.newValue(form),
        })
        succeeded += 1
      } catch {
        failed += 1
      }
    }
    if (submitFacilities) {
      try {
        await contributionsApi.createEditSuggestion(selectedId, {
          fieldName: 'facilities',
          newValue: facilitiesDef.newValue(form),
          ...(hasNewFacilityLabels ? { newFacilityLabels } : {}),
        })
        succeeded += 1
      } catch {
        failed += 1
      }
    }
    setIsSubmitting(false)

    if (succeeded > 0) {
      pushToast(
        `Đã gửi ${succeeded} đề xuất chỉnh sửa để duyệt.` + (failed > 0 ? ` (${failed} mục gửi thất bại.)` : ''),
        failed > 0 ? 'error' : 'success',
      )
      setSnapshot(form)
      setNewFacilityLabels([])
    }
    if (failed > 0 && succeeded === 0) {
      setSubmitError('Không thể gửi đề xuất chỉnh sửa. Vui lòng thử lại.')
    }
  }

  if (!selected) {
    return (
      <div className="page">
        <h1>Thông tin nhà hàng</h1>
        <p>Bạn chưa quản lý quán ăn nào.</p>
      </div>
    )
  }
  if (detailQuery.isLoading || !form) {
    return <div className="page">Đang tải…</div>
  }
  if (detailQuery.isError) {
    return (
      <div className="page">
        <p className="form-error" role="alert">
          {detailQuery.error instanceof ApiError ? detailQuery.error.message : 'Không thể tải thông tin quán.'}
        </p>
      </div>
    )
  }

  const facilityOptions: FacilityDto[] = facilitiesQuery.data ?? []

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Thông tin nhà hàng</h1>
          <p>Mọi thay đổi sẽ được gửi đến quản trị viên để duyệt trước khi áp dụng công khai.</p>
        </div>
      </div>

      <section className="detail-section">
        <h2>Thông tin cơ bản</h2>
        <label className="form-field">
          <span>Tên quán</span>
          <input type="text" value={form.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className="form-field">
          <span>Mô tả</span>
          <textarea value={form.description} onChange={(e) => update({ description: e.target.value })} rows={4} />
        </label>
        <label className="form-field">
          <span>Số điện thoại</span>
          <input type="text" value={form.phone} onChange={(e) => update({ phone: e.target.value })} />
        </label>
      </section>

      <section className="detail-section">
        <h2>Địa chỉ</h2>
        <label className="form-field">
          <span>Số nhà, đường</span>
          <input type="text" value={form.addressLine} onChange={(e) => update({ addressLine: e.target.value })} />
        </label>
        <label className="form-field">
          <span>Tỉnh/Thành phố</span>
          <SearchableSelect
            value={form.addressProvinceCode}
            onChange={handleProvinceChange}
            options={provinceSelectOptions}
            placeholder="— Chọn —"
            noResultsText="Không tìm thấy kết quả"
          />
        </label>
        <label className="form-field">
          <span>Phường/Xã</span>
          <SearchableSelect
            value={form.addressWardCode}
            disabled={!form.addressProvinceCode}
            onChange={(code) => update({ addressWardCode: code })}
            options={wardSelectOptions}
            placeholder={form.addressProvinceCode ? '— Chọn —' : '— Chọn tỉnh/thành trước —'}
            noResultsText="Không tìm thấy kết quả"
          />
        </label>
        <label className="form-field">
          <span>Dán link Google Maps để tự lấy toạ độ</span>
          <div className="owner-map-link-row">
            <input
              type="url"
              placeholder="https://maps.app.goo.gl/…"
              value={mapLink}
              onChange={(e) => {
                const value = e.target.value
                setMapLink(value)
                if (value.trim() !== resolvedLink) setLinkStatus('idle')
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text')
                if (pasted) {
                  // Without this, the browser's own default paste ALSO
                  // inserts the clipboard text on top of the value this sets
                  // via state — both writes landing in the same uncontrolled
                  // instant duplicates the pasted text in the field.
                  e.preventDefault()
                  setMapLink(pasted)
                  void resolveMapLink(pasted)
                }
              }}
              onBlur={() => {
                if (linkStatus === 'idle' && mapLink.trim() !== resolvedLink) void resolveMapLink(mapLink)
              }}
            />
            <button
              type="button"
              className="button button-small"
              disabled={!mapLink.trim() || linkStatus === 'resolving'}
              onClick={() => void resolveMapLink(mapLink)}
            >
              {linkStatus === 'resolving' ? 'Đang xử lý…' : 'Áp dụng'}
            </button>
          </div>
          {linkStatus === 'resolved' && (
            <span className="owner-map-link-resolved">
              Đã lấy toạ độ: {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
            </span>
          )}
          {linkStatus === 'error' && (
            <span className="field-error">Không đọc được toạ độ từ link này. Vui lòng kiểm tra lại link.</span>
          )}
        </label>
        <label className="form-field">
          <span>Vĩ độ (lat)</span>
          <input type="text" inputMode="decimal" value={form.lat} onChange={(e) => update({ lat: e.target.value })} />
          {latError && <span className="field-error">{latError}</span>}
        </label>
        <label className="form-field">
          <span>Kinh độ (lng)</span>
          <input type="text" inputMode="decimal" value={form.lng} onChange={(e) => update({ lng: e.target.value })} />
          {lngError && <span className="field-error">{lngError}</span>}
        </label>
      </section>

      <section className="detail-section">
        <h2>Liên kết mạng xã hội</h2>
        <label className="form-field">
          <span>Facebook</span>
          <input type="text" value={form.facebookUrl} onChange={(e) => update({ facebookUrl: e.target.value })} />
        </label>
        <label className="form-field">
          <span>Instagram</span>
          <input type="text" value={form.instagramUrl} onChange={(e) => update({ instagramUrl: e.target.value })} />
        </label>
        <label className="form-field">
          <span>TikTok</span>
          <input type="text" value={form.tiktokUrl} onChange={(e) => update({ tiktokUrl: e.target.value })} />
        </label>
        <label className="form-field">
          <span>Website</span>
          <input type="text" value={form.websiteUrl} onChange={(e) => update({ websiteUrl: e.target.value })} />
        </label>
      </section>

      <section className="detail-section">
        <h2>Tiện ích</h2>
        <div className="checkbox-group">
          {facilityOptions.map((option) => (
            <label key={option.code} className="checkbox-item">
              <input
                type="checkbox"
                checked={form.facilities.includes(option.code)}
                onChange={() => toggleFacility(option.code)}
              />
              {option.label}
            </label>
          ))}
        </div>

        {newFacilityLabels.length > 0 && (
          <div className="owner-new-facility-chips">
            {newFacilityLabels.map((label) => (
              <span key={label} className="status-badge status-badge-pending owner-new-facility-chip">
                {label}
                <button
                  type="button"
                  aria-label={`Bỏ đề xuất "${label}"`}
                  onClick={() => removeNewFacilityLabel(label)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {newFacilityLabels.length < MAX_NEW_FACILITY_LABELS && (
          <div className="owner-new-facility-row">
            <input
              type="text"
              placeholder="Tên tiện ích mới…"
              value={newFacilityInput}
              maxLength={50}
              onChange={(e) => setNewFacilityInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addNewFacilityLabel()
                }
              }}
            />
            <button
              type="button"
              className="button button-small"
              disabled={!newFacilityInput.trim()}
              onClick={addNewFacilityLabel}
            >
              + Thêm mới
            </button>
          </div>
        )}
        <p className="owner-new-facility-hint">
          Tiện ích mới sẽ chỉ hiển thị công khai cho người dùng khác sau khi quản trị viên duyệt.
        </p>
      </section>

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
            {form.hours.map((row) => (
              <tr key={row.dayOfWeek}>
                <td>{DAY_LABELS[row.dayOfWeek]}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.isClosed}
                    onChange={(e) => updateHour(row.dayOfWeek, { isClosed: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="08:00"
                    disabled={row.isClosed}
                    value={row.openTime}
                    onChange={(e) => updateHour(row.dayOfWeek, { openTime: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="22:00"
                    disabled={row.isClosed}
                    value={row.closeTime}
                    onChange={(e) => updateHour(row.dayOfWeek, { closeTime: e.target.value })}
                  />
                </td>
                <td>{hourErrors[row.dayOfWeek] && <span className="field-error">{hourErrors[row.dayOfWeek]}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}

      <button type="button" className="button button-primary" disabled={isSubmitting} onClick={handleSubmit}>
        {isSubmitting ? 'Đang gửi…' : 'Gửi đề xuất chỉnh sửa'}
      </button>
    </div>
  )
}
