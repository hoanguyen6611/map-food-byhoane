/**
 * Core-field form shared by the "Tạo quán mới" flow and the edit page's
 * top section — covers every field of `CreateRestaurantDto`/
 * `UpdateRestaurantDto` (name/description/category/price range/phone/
 * address/location/cuisines). Opening hours, facilities, menu items, and
 * photos are managed by separate sections on the edit page since they're
 * their own endpoints server-side and only make sense once a restaurant id
 * exists.
 */
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  AdminRestaurantDetailDto,
  CuisineCode,
  PriceRangeCode,
  RestaurantCategoryCode,
} from '@foodmap/shared-types'
import { VN_PROVINCES, findVnProvinceByName, findVnWardByName } from '@foodmap/shared-types'
import type { CreateRestaurantBody } from '../../api/admin-restaurants'
import { CATEGORY_OPTIONS, CUISINE_OPTIONS, PRICE_RANGE_OPTIONS } from './constants'

export interface CoreFormValues {
  name: string
  description: string
  categoryCode: RestaurantCategoryCode | ''
  priceRangeCode: PriceRangeCode | ''
  phone: string
  addressLine: string
  // Province/ward are select-driven — the value is the dataset `code`
  // (or, for legacy data that predates this dataset, the raw stored text
  // itself, injected as a synthetic option so it isn't silently blanked).
  addressProvinceCode: string
  addressWardCode: string
  lat: string
  lng: string
  cuisineCodes: CuisineCode[]
}

export const EMPTY_CORE_FORM_VALUES: CoreFormValues = {
  name: '',
  description: '',
  categoryCode: '',
  priceRangeCode: '',
  phone: '',
  addressLine: '',
  addressProvinceCode: '',
  addressWardCode: '',
  lat: '',
  lng: '',
  cuisineCodes: [],
}

export function coreFormValuesFromDetail(detail: AdminRestaurantDetailDto): CoreFormValues {
  const province = findVnProvinceByName(detail.address.province)
  const ward = detail.address.ward && province ? findVnWardByName(province, detail.address.ward) : undefined
  return {
    name: detail.name,
    description: detail.description ?? '',
    categoryCode: detail.categoryCode,
    priceRangeCode: detail.priceRange?.code ?? '',
    phone: detail.phone ?? '',
    addressLine: detail.address.line,
    // Fall back to the raw legacy text when it doesn't match the dataset
    // (older restaurants, pre-restructuring data) — the select renders it
    // as a clearly-labeled extra option rather than blanking the field.
    addressProvinceCode: province?.code ?? detail.address.province,
    addressWardCode: ward?.code ?? detail.address.ward ?? '',
    lat: String(detail.location.lat),
    lng: String(detail.location.lng),
    cuisineCodes: detail.cuisineCodes,
  }
}

type FieldErrors = Partial<Record<keyof CoreFormValues, string>>

function validate(values: CoreFormValues): FieldErrors {
  const errors: FieldErrors = {}

  if (values.name.trim().length < 2 || values.name.trim().length > 120) {
    errors.name = 'Tên phải từ 2 đến 120 ký tự.'
  }
  if (!values.categoryCode) {
    errors.categoryCode = 'Vui lòng chọn danh mục.'
  }
  if (!values.addressLine.trim()) {
    errors.addressLine = 'Vui lòng nhập địa chỉ (số nhà, đường).'
  }
  if (!values.addressProvinceCode) {
    errors.addressProvinceCode = 'Vui lòng chọn tỉnh/thành.'
  }
  if (!values.addressWardCode) {
    errors.addressWardCode = 'Vui lòng chọn phường/xã.'
  }

  const lat = Number(values.lat)
  if (values.lat.trim() === '' || Number.isNaN(lat) || lat < -90 || lat > 90) {
    errors.lat = 'Vĩ độ (lat) phải là số từ -90 đến 90.'
  }
  const lng = Number(values.lng)
  if (values.lng.trim() === '' || Number.isNaN(lng) || lng < -180 || lng > 180) {
    errors.lng = 'Kinh độ (lng) phải là số từ -180 đến 180.'
  }

  if (values.phone.trim() && !/^[0-9+\s()-]{6,20}$/.test(values.phone.trim())) {
    errors.phone = 'Số điện thoại không hợp lệ.'
  }

  return errors
}

// Resolves a select's `code` value back to the official name to submit —
// falls back to the raw value itself for legacy data that doesn't match
// any entry in the dataset (see coreFormValuesFromDetail's synthetic option).
function resolveProvinceName(provinceCode: string): string {
  const province = VN_PROVINCES.find((p) => p.code === provinceCode)
  return province ? province.name : provinceCode
}

function resolveWardName(provinceCode: string, wardCode: string): string {
  const province = VN_PROVINCES.find((p) => p.code === provinceCode)
  const ward = province?.wards.find((w) => w.code === wardCode)
  return ward ? ward.name : wardCode
}

export function coreFormValuesToBody(values: CoreFormValues): CreateRestaurantBody {
  return {
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    categoryCode: values.categoryCode as RestaurantCategoryCode,
    priceRangeCode: values.priceRangeCode || undefined,
    phone: values.phone.trim() || undefined,
    address: {
      line: values.addressLine.trim(),
      ward: resolveWardName(values.addressProvinceCode, values.addressWardCode),
      province: resolveProvinceName(values.addressProvinceCode),
    },
    location: {
      lat: Number(values.lat),
      lng: Number(values.lng),
    },
    cuisineCodes: values.cuisineCodes,
  }
}

interface RestaurantCoreFormProps {
  initialValues: CoreFormValues
  onSubmit: (body: CreateRestaurantBody) => void
  isSubmitting: boolean
  submitLabel: string
  serverError?: string | null
}

export function RestaurantCoreForm({
  initialValues,
  onSubmit,
  isSubmitting,
  submitLabel,
  serverError,
}: RestaurantCoreFormProps) {
  const [values, setValues] = useState<CoreFormValues>(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})

  function set<K extends keyof CoreFormValues>(key: K, value: CoreFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const selectedProvince = useMemo(
    () => VN_PROVINCES.find((p) => p.code === values.addressProvinceCode),
    [values.addressProvinceCode],
  )
  // Legacy data (pre-restructuring) may carry a province/ward whose code
  // doesn't exist in the current dataset — show it as an extra option
  // instead of silently blanking the field when the edit form loads.
  const provinceOptions = useMemo(() => {
    if (!values.addressProvinceCode || selectedProvince) return VN_PROVINCES
    return [{ code: values.addressProvinceCode, shortName: `${values.addressProvinceCode} (giá trị cũ)` }, ...VN_PROVINCES]
  }, [selectedProvince, values.addressProvinceCode])
  const wardOptions = useMemo(() => {
    const wards = selectedProvince?.wards ?? []
    if (!values.addressWardCode || wards.some((w) => w.code === values.addressWardCode)) return wards
    return [{ code: values.addressWardCode, shortName: `${values.addressWardCode} (giá trị cũ)` }, ...wards]
  }, [selectedProvince, values.addressWardCode])

  function handleProvinceChange(code: string) {
    setValues((current) => ({ ...current, addressProvinceCode: code, addressWardCode: '' }))
  }

  function toggleCuisine(code: CuisineCode) {
    setValues((current) => ({
      ...current,
      cuisineCodes: current.cuisineCodes.includes(code)
        ? current.cuisineCodes.filter((c) => c !== code)
        : [...current.cuisineCodes, code],
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fieldErrors = validate(values)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    onSubmit(coreFormValuesToBody(values))
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label className="form-field form-field-wide">
          <span>Tên nhà hàng *</span>
          <input
            type="text"
            value={values.name}
            disabled={isSubmitting}
            onChange={(event) => set('name', event.target.value)}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label className="form-field form-field-wide">
          <span>Mô tả</span>
          <textarea
            rows={3}
            value={values.description}
            disabled={isSubmitting}
            onChange={(event) => set('description', event.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Danh mục *</span>
          <select
            value={values.categoryCode}
            disabled={isSubmitting}
            onChange={(event) => set('categoryCode', event.target.value as RestaurantCategoryCode)}
          >
            <option value="">— Chọn —</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.categoryCode && <span className="field-error">{errors.categoryCode}</span>}
        </label>

        <label className="form-field">
          <span>Phân khúc giá</span>
          <select
            value={values.priceRangeCode}
            disabled={isSubmitting}
            onChange={(event) => set('priceRangeCode', event.target.value as PriceRangeCode | '')}
          >
            <option value="">— Không chọn —</option>
            {PRICE_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Số điện thoại</span>
          <input
            type="text"
            value={values.phone}
            disabled={isSubmitting}
            onChange={(event) => set('phone', event.target.value)}
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>

        <label className="form-field form-field-wide">
          <span>Địa chỉ (số nhà, đường) *</span>
          <input
            type="text"
            value={values.addressLine}
            disabled={isSubmitting}
            onChange={(event) => set('addressLine', event.target.value)}
          />
          {errors.addressLine && <span className="field-error">{errors.addressLine}</span>}
        </label>

        <label className="form-field">
          <span>Tỉnh/Thành *</span>
          <select
            value={values.addressProvinceCode}
            disabled={isSubmitting}
            onChange={(event) => handleProvinceChange(event.target.value)}
          >
            <option value="">— Chọn —</option>
            {provinceOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.shortName}
              </option>
            ))}
          </select>
          {errors.addressProvinceCode && <span className="field-error">{errors.addressProvinceCode}</span>}
        </label>

        <label className="form-field">
          <span>Phường/Xã *</span>
          <select
            value={values.addressWardCode}
            disabled={isSubmitting || !values.addressProvinceCode}
            onChange={(event) => set('addressWardCode', event.target.value)}
          >
            <option value="">{values.addressProvinceCode ? '— Chọn —' : '— Chọn tỉnh/thành trước —'}</option>
            {wardOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.shortName}
              </option>
            ))}
          </select>
          {errors.addressWardCode && <span className="field-error">{errors.addressWardCode}</span>}
        </label>

        <label className="form-field">
          <span>Vĩ độ (lat) *</span>
          <input
            type="text"
            inputMode="decimal"
            value={values.lat}
            disabled={isSubmitting}
            onChange={(event) => set('lat', event.target.value)}
          />
          {errors.lat && <span className="field-error">{errors.lat}</span>}
        </label>

        <label className="form-field">
          <span>Kinh độ (lng) *</span>
          <input
            type="text"
            inputMode="decimal"
            value={values.lng}
            disabled={isSubmitting}
            onChange={(event) => set('lng', event.target.value)}
          />
          {errors.lng && <span className="field-error">{errors.lng}</span>}
        </label>

        <div className="form-field form-field-wide">
          <span>Ẩm thực</span>
          <div className="checkbox-group">
            {CUISINE_OPTIONS.map((option) => (
              <label key={option.value} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={values.cuisineCodes.includes(option.value)}
                  disabled={isSubmitting}
                  onChange={() => toggleCuisine(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}

      <button type="submit" className="button button-primary" disabled={isSubmitting}>
        {isSubmitting ? 'Đang lưu…' : submitLabel}
      </button>
    </form>
  )
}
