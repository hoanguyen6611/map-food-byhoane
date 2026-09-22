/**
 * Screen 30 — Admin Restaurant Management (docs/04-screen-list.md §30).
 *
 * List/search/filter view. Create/edit and the opening-hours/facilities/menu/
 * photo management sections live on `AdminRestaurantEditPage`
 * (`/restaurants/new` and `/restaurants/:id`) — a nested route keeps this
 * list page focused on browsing, and keeps the (fairly large) edit form out
 * of the way until an admin actually opens a restaurant.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import type { RestaurantPublicationStatus } from '@foodmap/shared-types'
import { VN_PROVINCES } from '@foodmap/shared-types'
import { ApiError } from '../api/client'
import { adminRestaurantsApi } from '../api/admin-restaurants'
import { adminCategoriesApi } from '../api/admin-categories'
import { useAuth } from '../auth/AuthContext'
import { SearchableSelect } from '../components/SearchableSelect'
import { formatDateTime, statusLabel, STATUS_OPTIONS } from './restaurant-admin/constants'
import { useDebouncedValue } from './restaurant-admin/useDebouncedValue'

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export function AdminRestaurantManagementPage() {
  const { session } = useAuth()
  const isAdmin = session?.user.role === 'admin'
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState<RestaurantPublicationStatus | ''>('')
  // Province/Ward select the dataset's `code`, resolved to `.name` (the
  // format actually stored on Address.province/Address.ward) before being
  // sent to the API — same code/name split as RestaurantCoreForm.tsx.
  const [provinceCode, setProvinceCode] = useState('')
  const [wardCode, setWardCode] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [actionError, setActionError] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(searchInput, 400)

  // Live list, same reasoning as RestaurantCoreForm.tsx — categories are a
  // real admin-editable table now, not a fixed compile-time set, so this
  // list's own label column needs live data too (not just the create/edit
  // form) or a newly-added category would show its raw code here.
  const categoriesQuery = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminCategoriesApi.list(),
  })
  const categoryLabelByCode = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.code, c.label])),
    [categoriesQuery.data],
  )

  const selectedProvince = useMemo(() => VN_PROVINCES.find((p) => p.code === provinceCode), [provinceCode])
  const wardOptions = selectedProvince?.wards ?? []
  const province = selectedProvince?.name
  const ward = selectedProvince?.wards.find((w) => w.code === wardCode)?.name

  const provinceSelectOptions = useMemo(
    () => [{ value: '', label: 'Tất cả' }, ...VN_PROVINCES.map((p) => ({ value: p.code, label: p.shortName }))],
    [],
  )
  const wardSelectOptions = [
    { value: '', label: provinceCode ? 'Tất cả' : '— Chọn tỉnh/thành trước —' },
    ...wardOptions.map((w) => ({ value: w.code, label: w.shortName })),
  ]

  const listQuery = useQuery({
    queryKey: ['admin-restaurants', debouncedSearch, status, province, ward, page, pageSize],
    queryFn: () =>
      adminRestaurantsApi.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        province,
        ward,
        page,
        pageSize,
      }),
    placeholderData: (previous) => previous,
  })

  function resetToFirstPage() {
    setPage(1)
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchInput(event.target.value)
    resetToFirstPage()
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    setStatus(event.target.value as RestaurantPublicationStatus | '')
    resetToFirstPage()
  }

  function handleProvinceChange(code: string) {
    setProvinceCode(code)
    setWardCode('') // previous ward belongs to the old province
    resetToFirstPage()
  }

  function handleWardChange(code: string) {
    setWardCode(code)
    resetToFirstPage()
  }

  function handlePageSizeChange(event: ChangeEvent<HTMLSelectElement>) {
    setPageSize(Number(event.target.value))
    resetToFirstPage()
  }

  function reportError(err: unknown) {
    if (err instanceof ApiError) {
      setActionError(err.message)
    } else {
      setActionError('Không thể kết nối máy chủ. Vui lòng thử lại.')
    }
  }

  const hideMutation = useMutation({
    mutationFn: (id: string) => adminRestaurantsApi.hide(id),
    meta: { successMessage: 'Đã ẩn quán.' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] }),
    onError: reportError,
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => adminRestaurantsApi.restore(id),
    meta: { successMessage: 'Đã khôi phục quán.' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] }),
    onError: reportError,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminRestaurantsApi.remove(id),
    meta: { successMessage: 'Đã xoá quán.' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] }),
    onError: reportError,
  })

  const data = listQuery.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  function handleDelete(id: string, name: string) {
    if (!isAdmin) return
    const confirmed = window.confirm(
      `Xóa vĩnh viễn nhà hàng "${name}"? Hành động này không thể hoàn tác từ giao diện.`,
    )
    if (!confirmed) return
    setActionError(null)
    deleteMutation.mutate(id)
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Quản lý Địa điểm</h1>
          <p>Tìm kiếm, chỉnh sửa và quản lý trạng thái nhà hàng.</p>
        </div>
        <Link to="/restaurants/new" className="button button-primary">
          Tạo quán mới
        </Link>
      </div>

      <div className="filter-bar">
        <label className="filter-field">
          <span>Tìm kiếm</span>
          <input
            type="text"
            placeholder="Tên nhà hàng…"
            value={searchInput}
            onChange={handleSearchChange}
          />
        </label>

        <label className="filter-field">
          <span>Trạng thái</span>
          <select value={status} onChange={handleStatusChange}>
            <option value="">Tất cả</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Tỉnh/Thành</span>
          <SearchableSelect
            value={provinceCode}
            onChange={handleProvinceChange}
            options={provinceSelectOptions}
            placeholder="Tất cả"
            noResultsText="Không tìm thấy kết quả"
          />
        </label>

        <label className="filter-field">
          <span>Phường/Xã</span>
          <SearchableSelect
            value={wardCode}
            onChange={handleWardChange}
            options={wardSelectOptions}
            placeholder={provinceCode ? 'Tất cả' : '— Chọn tỉnh/thành trước —'}
            noResultsText="Không tìm thấy kết quả"
            disabled={!provinceCode}
          />
        </label>

        <label className="filter-field">
          <span>Số dòng/trang</span>
          <select value={pageSize} onChange={handlePageSizeChange}>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {listQuery.isLoading && <p>Đang tải…</p>}
      {listQuery.isError && (
        <p className="form-error" role="alert">
          {listQuery.error instanceof ApiError
            ? listQuery.error.message
            : 'Không thể tải danh sách nhà hàng.'}
        </p>
      )}

      {data && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Danh mục</th>
                <th>Tỉnh/Thành</th>
                <th>Phường/Xã</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="data-table-empty">
                    Không tìm thấy nhà hàng nào.
                  </td>
                </tr>
              )}
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{categoryLabelByCode.get(item.categoryCode) ?? item.categoryCode}</td>
                  <td>{item.province}</td>
                  <td>{item.ward ?? '—'}</td>
                  <td>
                    <span className={`status-badge status-badge-${item.publicationStatus}`}>
                      {statusLabel(item.publicationStatus)}
                    </span>
                  </td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td className="data-table-actions">
                    <Link to={`/restaurants/${item.id}`} className="button button-small">
                      Sửa
                    </Link>
                    {item.publicationStatus === 'hidden' ? (
                      <button
                        type="button"
                        className="button button-small"
                        disabled={restoreMutation.isPending}
                        onClick={() => {
                          setActionError(null)
                          restoreMutation.mutate(item.id)
                        }}
                      >
                        Khôi phục
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-small"
                        disabled={hideMutation.isPending || item.publicationStatus === 'removed'}
                        onClick={() => {
                          setActionError(null)
                          hideMutation.mutate(item.id)
                        }}
                      >
                        Ẩn
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-small button-danger"
                      disabled={!isAdmin || deleteMutation.isPending || item.publicationStatus === 'removed'}
                      title={
                        isAdmin
                          ? undefined
                          : 'Chỉ quản trị viên (admin) mới có quyền xóa vĩnh viễn nhà hàng.'
                      }
                      onClick={() => handleDelete(item.id, item.name)}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination-bar">
            <button
              type="button"
              className="button button-small"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              ← Trước
            </button>
            <span>
              Trang {data.page} / {totalPages} ({data.total} nhà hàng)
            </span>
            <button
              type="button"
              className="button button-small"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Sau →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
