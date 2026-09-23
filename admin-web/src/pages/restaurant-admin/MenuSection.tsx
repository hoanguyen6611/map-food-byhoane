/**
 * Menu items management. `POST /admin/restaurants/:id/menu-items` has no
 * menu-selection field in its body — the backend attaches new items to a
 * restaurant's (default) menu on its own — so the "add item" form only
 * covers `CreateMenuItemDto`'s own fields. Editing/removing an item use the
 * global `menu-items/:itemId` routes (not nested under the restaurant id).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { MenuDto, MenuItemDto } from '@foodmap/shared-types'
import { ApiError } from '../../api/client'
import { adminRestaurantsApi } from '../../api/admin-restaurants'
import type { CreateMenuItemBody } from '../../api/admin-restaurants'
import { formatVnd } from './constants'
import { MenuImportDialog } from './MenuImportDialog'
import { MenuPhotosSection } from './MenuPhotosSection'

const MAX_PRICE_VND = 10_000_000

interface MenuItemRowProps {
  restaurantId: string
  item: MenuItemDto
}

function MenuItemRow({ restaurantId, item }: MenuItemRowProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [priceVnd, setPriceVnd] = useState(String(item.priceVnd))
  const [category, setCategory] = useState(item.category ?? '')
  const [isPopular, setIsPopular] = useState(item.isPopular)
  const [error, setError] = useState<string | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-restaurant', restaurantId] })
  }

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof adminRestaurantsApi.updateMenuItem>[1]) =>
      adminRestaurantsApi.updateMenuItem(item.id, body),
    meta: { successMessage: 'Đã lưu món.' },
    onSuccess: () => {
      setIsEditing(false)
      setError(null)
      invalidate()
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể lưu món.'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => adminRestaurantsApi.deleteMenuItem(item.id),
    meta: { successMessage: 'Đã xoá món.' },
    onSuccess: invalidate,
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể xóa món.'),
  })

  function handleSave() {
    const trimmedName = name.trim()
    const price = Number(priceVnd)
    if (!trimmedName) {
      setError('Tên món không được để trống.')
      return
    }
    if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE_VND) {
      setError(`Giá phải là số nguyên từ 0 đến ${formatVnd(MAX_PRICE_VND)}.`)
      return
    }
    updateMutation.mutate({
      name: trimmedName,
      priceVnd: price,
      category: category.trim() || undefined,
      isPopular,
    })
  }

  function handleDelete() {
    if (!window.confirm(`Xóa món "${item.name}"?`)) return
    deleteMutation.mutate()
  }

  if (!isEditing) {
    return (
      <tr>
        <td>{item.name}</td>
        <td>{formatVnd(item.priceVnd)}</td>
        <td>{item.category ?? '—'}</td>
        <td>{item.isPopular ? 'Nổi bật' : ''}</td>
        <td className="data-table-actions">
          <button type="button" className="button button-small" onClick={() => setIsEditing(true)}>
            Sửa
          </button>
          <button
            type="button"
            className="button button-small button-danger"
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
          >
            Xóa
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
      </td>
      <td>
        <input
          type="text"
          inputMode="numeric"
          value={priceVnd}
          onChange={(event) => setPriceVnd(event.target.value)}
        />
      </td>
      <td>
        <input type="text" value={category} onChange={(event) => setCategory(event.target.value)} />
      </td>
      <td>
        <label className="checkbox-item">
          <input
            type="checkbox"
            checked={isPopular}
            onChange={(event) => setIsPopular(event.target.checked)}
          />
          Nổi bật
        </label>
      </td>
      <td className="data-table-actions">
        <button
          type="button"
          className="button button-small button-primary"
          disabled={updateMutation.isPending}
          onClick={handleSave}
        >
          Lưu
        </button>
        <button type="button" className="button button-small" onClick={() => setIsEditing(false)}>
          Hủy
        </button>
        {error && <span className="field-error">{error}</span>}
      </td>
    </tr>
  )
}

interface AddMenuItemFormProps {
  restaurantId: string
}

function AddMenuItemForm({ restaurantId }: AddMenuItemFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [priceVnd, setPriceVnd] = useState('')
  const [category, setCategory] = useState('')
  const [isPopular, setIsPopular] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (body: CreateMenuItemBody) => adminRestaurantsApi.createMenuItem(restaurantId, body),
    meta: { successMessage: 'Đã thêm món.' },
    onSuccess: () => {
      setName('')
      setPriceVnd('')
      setCategory('')
      setIsPopular(false)
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['admin-restaurant', restaurantId] })
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể thêm món.'),
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    const price = Number(priceVnd)
    if (!trimmedName) {
      setError('Tên món không được để trống.')
      return
    }
    if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE_VND) {
      setError(`Giá phải là số nguyên từ 0 đến ${formatVnd(MAX_PRICE_VND)}.`)
      return
    }
    mutation.mutate({
      name: trimmedName,
      priceVnd: price,
      category: category.trim() || undefined,
      isPopular,
    })
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Tên món"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        type="text"
        inputMode="numeric"
        placeholder="Giá (VNĐ)"
        value={priceVnd}
        onChange={(event) => setPriceVnd(event.target.value)}
      />
      <input
        type="text"
        placeholder="Nhóm món (tùy chọn)"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      />
      <label className="checkbox-item">
        <input
          type="checkbox"
          checked={isPopular}
          onChange={(event) => setIsPopular(event.target.checked)}
        />
        Nổi bật
      </label>
      <button type="submit" className="button button-primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Đang thêm…' : 'Thêm món'}
      </button>
      {error && <span className="field-error">{error}</span>}
    </form>
  )
}

interface MenuSectionProps {
  restaurantId: string
  menus: MenuDto[]
}

export function MenuSection({ restaurantId, menus }: MenuSectionProps) {
  return (
    <section className="detail-section">
      <div className="page-header-row">
        <h2>Thực đơn</h2>
        <MenuImportDialog restaurantId={restaurantId} />
      </div>
      {menus.length === 0 && <p>Chưa có món nào.</p>}
      {menus.map((menu) => (
        <div key={menu.id} className="menu-block">
          <h3>{menu.name ?? 'Menu chính'}</h3>
          {menu.items.length === 0 ? (
            <p>Chưa có món trong menu này.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên món</th>
                  <th>Giá</th>
                  <th>Nhóm món</th>
                  <th>Nổi bật</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {menu.items.map((item) => (
                  <MenuItemRow key={item.id} restaurantId={restaurantId} item={item} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      <MenuPhotosSection restaurantId={restaurantId} photos={menus[0]?.photos ?? []} />

      <AddMenuItemForm restaurantId={restaurantId} />
    </section>
  )
}
