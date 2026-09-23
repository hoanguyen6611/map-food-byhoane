/**
 * "Ảnh menu" — up to MAX_PHOTOS photos of the physical menu (a menu board,
 * a printed card), separate from each MenuItem's own name/price/category
 * and from the restaurant's general photo gallery (PhotosSection.tsx). Same
 * ImageKit-direct-upload-then-attach flow as PhotosSection, just simpler:
 * no cover-photo concept, one Menu per restaurant in practice.
 *
 * Keyed off `restaurantId`, not a menuId — most restaurants have no Menu row
 * at all until their first menu item is added, so this always renders
 * (MenuSection.tsx mounts it once, outside the per-menu `.map()`) and the
 * backend find-or-creates the Menu row on first upload.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { upload } from '@imagekit/javascript'
import type { AdminRestaurantDetailDto, PhotoDto } from '@foodmap/shared-types'
import { ApiError } from '../../api/client'
import { adminRestaurantsApi } from '../../api/admin-restaurants'
import type { AttachPhotoBody } from '../../api/admin-restaurants'
import { adminMediaApi } from '../../api/admin-media'
import { pushToast } from '../../lib/toastStore'

const MAX_PHOTOS = 20

interface MenuPhotosSectionProps {
  restaurantId: string
  photos: PhotoDto[]
}

export function MenuPhotosSection({ restaurantId, photos }: MenuPhotosSectionProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-restaurant', restaurantId] })
  }

  const addMutation = useMutation({
    mutationFn: (body: AttachPhotoBody) => adminRestaurantsApi.attachMenuPhoto(restaurantId, body),
    onSuccess: invalidate,
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể thêm ảnh menu.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => adminRestaurantsApi.deletePhoto(photoId),
    meta: { successMessage: 'Đã xoá ảnh menu.' },
    onSuccess: (_data, photoId) => {
      // Patch the cached detail immediately rather than only invalidating —
      // the delete otherwise stayed visible until the next manual page
      // reload happened to refetch it (background invalidation alone
      // wasn't reliably re-rendering this list).
      queryClient.setQueryData<AdminRestaurantDetailDto>(['admin-restaurant', restaurantId], (old) =>
        old
          ? {
              ...old,
              menus: old.menus.map((menu) => ({
                ...menu,
                photos: menu.photos.filter((photo) => photo.id !== photoId),
              })),
            }
          : old,
      )
      invalidate()
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể xóa ảnh menu.'),
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
    <div className="menu-photos-block">
      <h4>Ảnh menu ({photos.length}/{MAX_PHOTOS})</h4>
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
    </div>
  )
}
