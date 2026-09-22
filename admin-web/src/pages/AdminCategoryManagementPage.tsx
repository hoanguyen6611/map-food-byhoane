/**
 * Quản lý Danh mục — admin/moderator can list/create/edit; hard delete is
 * admin-only (same split as every other destructive admin action in this
 * app — see AdminRestaurantManagementPage/AdminUserManagementPage).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CategoryDto } from '@foodmap/shared-types'
import { ApiError } from '../api/client'
import { adminCategoriesApi } from '../api/admin-categories'
import { useAuth } from '../auth/AuthContext'
import { CategoryIconPreview } from '../components/CategoryIconPreview'
import { CategoryIconSelect } from '../components/CategoryIconSelect'

export function AdminCategoryManagementPage() {
  const { session } = useAuth()
  const isAdmin = session?.user.role === 'admin'
  const queryClient = useQueryClient()

  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminCategoriesApi.list(),
  })

  function reportError(err: unknown) {
    setActionError(err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.')
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
  }

  const createMutation = useMutation({
    mutationFn: () => adminCategoriesApi.create({ code: newCode.trim(), label: newLabel.trim(), icon: newIcon.trim() || undefined }),
    meta: { successMessage: 'Đã thêm danh mục.' },
    onSuccess: () => {
      setNewCode('')
      setNewLabel('')
      setNewIcon('')
      setActionError(null)
      invalidate()
    },
    onError: reportError,
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => adminCategoriesApi.update(id, { label: editLabel.trim(), icon: editIcon.trim() || undefined }),
    meta: { successMessage: 'Đã lưu danh mục.' },
    onSuccess: () => {
      setEditingId(null)
      setActionError(null)
      invalidate()
    },
    onError: reportError,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCategoriesApi.remove(id),
    meta: { successMessage: 'Đã xoá danh mục.' },
    onSuccess: () => {
      setActionError(null)
      invalidate()
    },
    onError: reportError,
  })

  function startEdit(category: CategoryDto) {
    setEditingId(category.id)
    setEditLabel(category.label)
    setEditIcon(category.icon ?? '')
  }

  return (
    <div>
      <h1>Quản lý Danh mục</h1>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="detail-section">
        <h2>Thêm danh mục mới</h2>
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault()
            createMutation.mutate()
          }}
        >
          <div className="form-grid">
            <label className="form-field">
              <span>Mã (code) *</span>
              <input
                type="text"
                placeholder="vd: quan_lau"
                value={newCode}
                disabled={createMutation.isPending}
                onChange={(event) => setNewCode(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Tên hiển thị *</span>
              <input
                type="text"
                placeholder="vd: Quán lẩu"
                value={newLabel}
                disabled={createMutation.isPending}
                onChange={(event) => setNewLabel(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Icon (tùy chọn)</span>
              <CategoryIconSelect value={newIcon} disabled={createMutation.isPending} onChange={setNewIcon} />
            </label>
          </div>
          <button
            type="submit"
            className="button button-primary"
            disabled={createMutation.isPending || !newCode.trim() || !newLabel.trim()}
          >
            {createMutation.isPending ? 'Đang thêm…' : 'Thêm danh mục'}
          </button>
        </form>
      </section>

      {listQuery.isLoading && <p>Đang tải…</p>}
      {listQuery.isError && <p className="form-error">Không thể tải danh sách danh mục.</p>}

      {listQuery.data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên hiển thị</th>
              <th>Icon</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {listQuery.data.map((category) => (
              <tr key={category.id}>
                <td>
                  <code>{category.code}</code>
                </td>
                <td>
                  {editingId === category.id ? (
                    <input type="text" value={editLabel} onChange={(event) => setEditLabel(event.target.value)} />
                  ) : (
                    category.label
                  )}
                </td>
                <td>
                  {editingId === category.id ? (
                    <CategoryIconSelect value={editIcon} onChange={setEditIcon} />
                  ) : (
                    <CategoryIconPreview iconKey={category.icon} />
                  )}
                </td>
                <td>
                  {editingId === category.id ? (
                    <>
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={updateMutation.isPending || !editLabel.trim()}
                        onClick={() => updateMutation.mutate(category.id)}
                      >
                        Lưu
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        Huỷ
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => startEdit(category)}>
                        Sửa
                      </button>
                      <button
                        type="button"
                        disabled={!isAdmin || deleteMutation.isPending}
                        title={!isAdmin ? 'Chỉ admin mới được xoá' : undefined}
                        onClick={() => {
                          if (window.confirm(`Xoá danh mục "${category.label}"?`)) {
                            deleteMutation.mutate(category.id)
                          }
                        }}
                      >
                        Xoá
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
