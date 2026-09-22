/**
 * Screen 30 — create/edit + detail management for a single restaurant.
 *
 * Reached via `/restaurants/new` (create — id-less) and `/restaurants/:id`
 * (edit — core fields plus opening hours/facilities/menu/photos, all of
 * which require a real restaurant id to exist server-side). A create-time
 * save routes straight into the `:id` edit view so an admin can keep going
 * (add hours, menu items, photos) without a second navigation step.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { adminRestaurantsApi } from '../api/admin-restaurants'
import type { CreateRestaurantBody } from '../api/admin-restaurants'
import { useAuth } from '../auth/AuthContext'
import { FacilitiesSection } from './restaurant-admin/FacilitiesSection'
import { MenuSection } from './restaurant-admin/MenuSection'
import { OpeningHoursSection } from './restaurant-admin/OpeningHoursSection'
import { PhotosSection } from './restaurant-admin/PhotosSection'
import {
  EMPTY_CORE_FORM_VALUES,
  RestaurantCoreForm,
  coreFormValuesFromDetail,
} from './restaurant-admin/RestaurantCoreForm'
import { statusLabel } from './restaurant-admin/constants'

export function AdminRestaurantEditPage() {
  const { id } = useParams<{ id: string }>()
  const isCreate = !id
  const { session } = useAuth()
  const isAdmin = session?.user.role === 'admin'
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createError, setCreateError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [savedCore, setSavedCore] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['admin-restaurant', id],
    queryFn: () => adminRestaurantsApi.getById(id!),
    enabled: !isCreate,
  })

  const createMutation = useMutation({
    mutationFn: (body: CreateRestaurantBody) => adminRestaurantsApi.create(body),
    meta: { successMessage: 'Đã tạo nhà hàng.' },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] })
      navigate(`/restaurants/${created.id}`, { replace: true })
    },
    onError: (err: unknown) =>
      setCreateError(err instanceof ApiError ? err.message : 'Không thể tạo nhà hàng.'),
  })

  const updateMutation = useMutation({
    mutationFn: (body: CreateRestaurantBody) => adminRestaurantsApi.update(id!, body),
    meta: { successMessage: 'Đã lưu thông tin nhà hàng.' },
    onSuccess: () => {
      setSavedCore(true)
      setUpdateError(null)
      queryClient.invalidateQueries({ queryKey: ['admin-restaurant', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] })
    },
    onError: (err: unknown) => {
      setSavedCore(false)
      setUpdateError(err instanceof ApiError ? err.message : 'Không thể lưu thay đổi.')
    },
  })

  const hideMutation = useMutation({
    mutationFn: () => adminRestaurantsApi.hide(id!),
    meta: { successMessage: 'Đã ẩn nhà hàng.' },
    onSuccess: () => {
      setStatusError(null)
      queryClient.invalidateQueries({ queryKey: ['admin-restaurant', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] })
    },
    onError: (err: unknown) =>
      setStatusError(err instanceof ApiError ? err.message : 'Không thể ẩn nhà hàng.'),
  })

  const restoreMutation = useMutation({
    mutationFn: () => adminRestaurantsApi.restore(id!),
    meta: { successMessage: 'Đã khôi phục nhà hàng.' },
    onSuccess: () => {
      setStatusError(null)
      queryClient.invalidateQueries({ queryKey: ['admin-restaurant', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] })
    },
    onError: (err: unknown) =>
      setStatusError(err instanceof ApiError ? err.message : 'Không thể khôi phục nhà hàng.'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => adminRestaurantsApi.remove(id!),
    meta: { successMessage: 'Đã xoá nhà hàng.' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] })
      navigate('/restaurants', { replace: true })
    },
    onError: (err: unknown) =>
      setStatusError(err instanceof ApiError ? err.message : 'Không thể xóa nhà hàng.'),
  })

  function handleDelete() {
    if (!isAdmin || !id) return
    const detail = detailQuery.data
    const confirmed = window.confirm(
      `Xóa vĩnh viễn nhà hàng "${detail?.name ?? ''}"? Hành động này không thể hoàn tác từ giao diện.`,
    )
    if (!confirmed) return
    setStatusError(null)
    deleteMutation.mutate()
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <Link to="/restaurants" className="back-link">
            ← Quay lại danh sách
          </Link>
          <h1>{isCreate ? 'Tạo quán mới' : 'Chỉnh sửa nhà hàng'}</h1>
        </div>
      </div>

      {isCreate && (
        <RestaurantCoreForm
          initialValues={EMPTY_CORE_FORM_VALUES}
          onSubmit={(body) => {
            setCreateError(null)
            createMutation.mutate(body)
          }}
          isSubmitting={createMutation.isPending}
          submitLabel="Tạo nhà hàng"
          serverError={createError}
        />
      )}

      {!isCreate && detailQuery.isLoading && <p>Đang tải…</p>}
      {!isCreate && detailQuery.isError && (
        <p className="form-error" role="alert">
          {detailQuery.error instanceof ApiError
            ? detailQuery.error.message
            : 'Không thể tải thông tin nhà hàng.'}
        </p>
      )}

      {id && detailQuery.data && (
        <>
          <div className="status-bar">
            <span className={`status-badge status-badge-${detailQuery.data.publicationStatus}`}>
              {statusLabel(detailQuery.data.publicationStatus)}
            </span>

            {detailQuery.data.publicationStatus === 'hidden' ? (
              <button
                type="button"
                className="button"
                disabled={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate()}
              >
                Khôi phục
              </button>
            ) : (
              <button
                type="button"
                className="button"
                disabled={hideMutation.isPending || detailQuery.data.publicationStatus === 'removed'}
                onClick={() => hideMutation.mutate()}
              >
                Ẩn
              </button>
            )}

            <button
              type="button"
              className="button button-danger"
              disabled={
                !isAdmin || deleteMutation.isPending || detailQuery.data.publicationStatus === 'removed'
              }
              title={
                isAdmin ? undefined : 'Chỉ quản trị viên (admin) mới có quyền xóa vĩnh viễn nhà hàng.'
              }
              onClick={handleDelete}
            >
              Xóa vĩnh viễn
            </button>

            {statusError && (
              <span className="form-error" role="alert">
                {statusError}
              </span>
            )}
          </div>

          <RestaurantCoreForm
            initialValues={coreFormValuesFromDetail(detailQuery.data)}
            onSubmit={(body) => {
              setUpdateError(null)
              setSavedCore(false)
              updateMutation.mutate(body)
            }}
            isSubmitting={updateMutation.isPending}
            submitLabel="Lưu thay đổi"
            serverError={updateError}
          />
          {savedCore && <p className="form-success">Đã lưu thông tin nhà hàng.</p>}

          <OpeningHoursSection restaurantId={id} openingHours={detailQuery.data.openingHours} />
          <FacilitiesSection restaurantId={id} facilities={detailQuery.data.facilities} />
          <MenuSection restaurantId={id} menus={detailQuery.data.menus} />
          <PhotosSection
            restaurantId={id}
            photos={detailQuery.data.photos}
            coverPhotoId={detailQuery.data.coverPhotoId}
          />
        </>
      )}
    </div>
  )
}
