/**
 * Photo attachment — uploads straight from the browser to ImageKit.io
 * (`@imagekit/javascript`'s `upload()`), authorized by a short-lived
 * signature `GET /admin/media/imagekit-auth` mints server-side from the
 * ImageKit PRIVATE key (admin-web has no server of its own to hold that
 * key — see AdminMediaService's doc comment). The resulting URL is then
 * attached the same way any HTTPS photo URL always has been, via the
 * existing `POST /admin/restaurants/:id/photos` (PhotoService.attach,
 * admin/moderator-gated, no origin restriction) — that part is unchanged.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { upload } from '@imagekit/javascript'
import type { PhotoDto } from '@foodmap/shared-types'
import { ApiError } from '../../api/client'
import { adminRestaurantsApi } from '../../api/admin-restaurants'
import type { AttachPhotoBody } from '../../api/admin-restaurants'
import { adminMediaApi } from '../../api/admin-media'

interface PhotosSectionProps {
  restaurantId: string
  photos: PhotoDto[]
  /** Which photo (if any) is the explicitly-chosen "ảnh đại diện" — null falls back to the oldest-photo default. */
  coverPhotoId: string | null
}

const MAX_PHOTOS = 10

export function PhotosSection({ restaurantId, photos, coverPhotoId }: PhotosSectionProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-restaurant', restaurantId] })
  }

  const addMutation = useMutation({
    mutationFn: (body: AttachPhotoBody) => adminRestaurantsApi.attachPhoto(restaurantId, body),
    onSuccess: invalidate,
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể thêm ảnh.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => adminRestaurantsApi.deletePhoto(photoId),
    onSuccess: invalidate,
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể xóa ảnh.'),
  })

  const coverMutation = useMutation({
    mutationFn: (photoId: string) => adminRestaurantsApi.setCoverPhoto(restaurantId, photoId),
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
          } else {
            hadError = true
          }
        } catch {
          hadError = true
        }
      }
      if (hadError) setError('Không tải được ảnh này. Vui lòng thử lại.')
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="detail-section">
      <h2>Ảnh</h2>

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
                title={isCover ? 'Đang là ảnh đại diện' : 'Đặt làm ảnh đại diện'}
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
