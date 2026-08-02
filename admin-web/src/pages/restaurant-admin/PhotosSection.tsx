/**
 * Photo attachment. There is no upload pipeline yet (Module 7 adds one) —
 * admin pastes an already-hosted HTTPS image URL directly, per
 * `AttachPhotoDto` (`url` HTTPS-only, optional `width`/`height`).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { PhotoDto } from '@foodmap/shared-types'
import { ApiError } from '../../api/client'
import { adminRestaurantsApi } from '../../api/admin-restaurants'
import type { AttachPhotoBody } from '../../api/admin-restaurants'

interface PhotosSectionProps {
  restaurantId: string
  photos: PhotoDto[]
}

export function PhotosSection({ restaurantId, photos }: PhotosSectionProps) {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [error, setError] = useState<string | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-restaurant', restaurantId] })
  }

  const addMutation = useMutation({
    mutationFn: (body: AttachPhotoBody) => adminRestaurantsApi.attachPhoto(restaurantId, body),
    onSuccess: () => {
      setUrl('')
      setWidth('')
      setHeight('')
      setError(null)
      invalidate()
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể thêm ảnh.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => adminRestaurantsApi.deletePhoto(photoId),
    onSuccess: invalidate,
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể xóa ảnh.'),
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedUrl = url.trim()
    if (!/^https:\/\/\S+/.test(trimmedUrl)) {
      setError('URL ảnh phải bắt đầu bằng https://')
      return
    }
    const widthNum = width.trim() ? Number(width) : undefined
    const heightNum = height.trim() ? Number(height) : undefined
    if (widthNum !== undefined && (!Number.isInteger(widthNum) || widthNum <= 0)) {
      setError('Chiều rộng phải là số nguyên dương.')
      return
    }
    if (heightNum !== undefined && (!Number.isInteger(heightNum) || heightNum <= 0)) {
      setError('Chiều cao phải là số nguyên dương.')
      return
    }
    addMutation.mutate({ url: trimmedUrl, width: widthNum, height: heightNum })
  }

  return (
    <section className="detail-section">
      <h2>Ảnh</h2>

      {photos.length === 0 && <p>Chưa có ảnh nào.</p>}
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
      </div>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="https://…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Rộng (px, tùy chọn)"
          value={width}
          onChange={(event) => setWidth(event.target.value)}
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Cao (px, tùy chọn)"
          value={height}
          onChange={(event) => setHeight(event.target.value)}
        />
        <button type="submit" className="button button-primary" disabled={addMutation.isPending}>
          {addMutation.isPending ? 'Đang thêm…' : 'Thêm ảnh'}
        </button>
      </form>
      {error && <p className="field-error">{error}</p>}
    </section>
  )
}
