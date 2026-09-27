/**
 * Owner-facing photo/menu-photo management — direct, unmoderated writes
 * (same as staff's PhotosSection.tsx/MenuPhotosSection.tsx), just scoped to
 * the owner's own restaurant via OwnerRestaurantGuard server-side. Unlike
 * OwnerRestaurantEditPage, these do NOT go through the edit_suggestion
 * queue — photos/menu photos aren't "restaurant info" in that sense, and
 * staff already has this exact same direct-write privilege.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { upload } from '@imagekit/javascript'
import type { OwnerRestaurantDetailDto } from '@foodmap/shared-types'
import { ApiError } from '../../api/client'
import { ownerRestaurantsApi } from '../../api/owner-restaurants'
import type { AttachPhotoBody } from '../../api/admin-restaurants'
import { adminMediaApi } from '../../api/admin-media'
import { useOwnerRestaurant } from '../../owner/OwnerRestaurantContext'
import { pushToast } from '../../lib/toastStore'

const MAX_PHOTOS = 10
const MAX_MENU_PHOTOS = 20

function useOwnerRestaurantDetail(restaurantId: string | null) {
  return useQuery({
    queryKey: ['owner-restaurant-detail', restaurantId],
    queryFn: () => ownerRestaurantsApi.getDetail(restaurantId!),
    enabled: restaurantId !== null,
  })
}

interface RestaurantPhotosBlockProps {
  restaurantId: string
  photos: OwnerRestaurantDetailDto['photos']
  coverPhotoId: string | null
}

function RestaurantPhotosBlock({ restaurantId, photos, coverPhotoId }: RestaurantPhotosBlockProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['owner-restaurant-detail', restaurantId] })
  }

  const addMutation = useMutation({
    mutationFn: (body: AttachPhotoBody) => ownerRestaurantsApi.attachPhoto(restaurantId, body),
    onSuccess: invalidate,
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể thêm ảnh.'),
  })
  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => ownerRestaurantsApi.deletePhoto(restaurantId, photoId),
    meta: { successMessage: 'Đã xoá ảnh.' },
    onSuccess: (_data, photoId) => {
      queryClient.setQueryData<OwnerRestaurantDetailDto>(['owner-restaurant-detail', restaurantId], (old) =>
        old ? { ...old, photos: old.photos.filter((p) => p.id !== photoId) } : old,
      )
      invalidate()
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể xóa ảnh.'),
  })
  const coverMutation = useMutation({
    mutationFn: (photoId: string) => ownerRestaurantsApi.setCoverPhoto(restaurantId, photoId),
    meta: { successMessage: 'Đã đặt ảnh đại diện.' },
    onSuccess: invalidate,
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể đặt ảnh đại diện.'),
  })

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError(null)
    const files = Array.from(fileList).slice(0, MAX_PHOTOS - photos.length)
    setIsUploading(true)
    try {
      let hadError = false
      let uploadedCount = 0
      for (const file of files) {
        try {
          const auth = await adminMediaApi.getImageKitAuth()
          const result = await upload({
            file,
            fileName: file.name,
            folder: '/foodmap/restaurant',
            publicKey: auth.publicKey,
            signature: auth.signature,
            expire: auth.expire,
            token: auth.token,
          })
          if (result.url) {
            await addMutation.mutateAsync({ url: result.url, width: result.width, height: result.height })
            uploadedCount += 1
          } else {
            hadError = true
          }
        } catch {
          hadError = true
        }
      }
      if (uploadedCount > 0) {
        pushToast(uploadedCount === 1 ? 'Đã thêm 1 ảnh.' : `Đã thêm ${uploadedCount} ảnh.`, 'success')
      }
      if (hadError) setError('Không tải được ảnh này. Vui lòng thử lại.')
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="detail-section">
      <h2>Ảnh quán ({photos.length}/{MAX_PHOTOS})</h2>
      <div className="photo-grid">
        {photos.map((photo) => {
          const isCover = photo.id === coverPhotoId
          return (
            <div key={photo.id} className="photo-tile">
              <img src={photo.url} alt="" loading="lazy" />
              <button
                type="button"
                className={`button button-small ${isCover ? 'button-primary' : ''}`}
                disabled={coverMutation.isPending || isCover}
                onClick={() => coverMutation.mutate(photo.id)}
              >
                {isCover ? '★ Ảnh đại diện' : '☆ Đặt đại diện'}
              </button>
              <button
                type="button"
                className="button button-small button-danger"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(photo.id)}
              >
                Xóa
              </button>
            </div>
          )
        })}
        {photos.length < MAX_PHOTOS && (
          <label className="photo-tile photo-tile-add">
            <span>{isUploading ? 'Đang tải lên…' : '+ Thêm ảnh'}</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={isUploading}
              onChange={(event) => handleFiles(event.target.files)}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </section>
  )
}

interface MenuPhotosBlockProps {
  restaurantId: string
  photos: OwnerRestaurantDetailDto['menuPhotos']
}

function MenuPhotosBlock({ restaurantId, photos }: MenuPhotosBlockProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['owner-restaurant-detail', restaurantId] })
  }

  const addMutation = useMutation({
    mutationFn: (body: AttachPhotoBody) => ownerRestaurantsApi.attachMenuPhoto(restaurantId, body),
    onSuccess: invalidate,
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể thêm ảnh menu.'),
  })
  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => ownerRestaurantsApi.deletePhoto(restaurantId, photoId),
    meta: { successMessage: 'Đã xoá ảnh menu.' },
    onSuccess: (_data, photoId) => {
      queryClient.setQueryData<OwnerRestaurantDetailDto>(['owner-restaurant-detail', restaurantId], (old) =>
        old ? { ...old, menuPhotos: old.menuPhotos.filter((p) => p.id !== photoId) } : old,
      )
      invalidate()
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể xóa ảnh menu.'),
  })

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError(null)
    const files = Array.from(fileList).slice(0, MAX_MENU_PHOTOS - photos.length)
    setIsUploading(true)
    try {
      let hadError = false
      let uploadedCount = 0
      for (const file of files) {
        try {
          const auth = await adminMediaApi.getImageKitAuth()
          const result = await upload({
            file,
            fileName: file.name,
            folder: '/foodmap/menu',
            publicKey: auth.publicKey,
            signature: auth.signature,
            expire: auth.expire,
            token: auth.token,
          })
          if (result.url) {
            await addMutation.mutateAsync({ url: result.url, width: result.width, height: result.height })
            uploadedCount += 1
          } else {
            hadError = true
          }
        } catch {
          hadError = true
        }
      }
      if (uploadedCount > 0) {
        pushToast(uploadedCount === 1 ? 'Đã thêm 1 ảnh menu.' : `Đã thêm ${uploadedCount} ảnh menu.`, 'success')
      }
      if (hadError) setError('Không tải được ảnh này. Vui lòng thử lại.')
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="detail-section">
      <h2>Ảnh menu ({photos.length}/{MAX_MENU_PHOTOS})</h2>
      <div className="photo-grid">
        {photos.map((photo) => (
          <div key={photo.id} className="photo-tile">
            <img src={photo.url} alt="" loading="lazy" />
            <button
              type="button"
              className="button button-small button-danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(photo.id)}
            >
              Xóa
            </button>
          </div>
        ))}
        {photos.length < MAX_MENU_PHOTOS && (
          <label className="photo-tile photo-tile-add">
            <span>{isUploading ? 'Đang tải lên…' : '+ Thêm ảnh'}</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={isUploading}
              onChange={(event) => handleFiles(event.target.files)}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </section>
  )
}

export function OwnerPhotosPage() {
  const { selected, selectedId } = useOwnerRestaurant()
  const detailQuery = useOwnerRestaurantDetail(selectedId)

  if (!selected) {
    return (
      <div className="page">
        <h1>Ảnh</h1>
        <p>Bạn chưa quản lý quán ăn nào.</p>
      </div>
    )
  }
  if (detailQuery.isLoading || !detailQuery.data) {
    return <div className="page">Đang tải…</div>
  }

  return (
    <div className="page">
      <h1>Ảnh — {selected.name}</h1>
      <RestaurantPhotosBlock
        restaurantId={selectedId!}
        photos={detailQuery.data.photos}
        coverPhotoId={detailQuery.data.coverPhotoId}
      />
      <MenuPhotosBlock restaurantId={selectedId!} photos={detailQuery.data.menuPhotos} />
    </div>
  )
}
