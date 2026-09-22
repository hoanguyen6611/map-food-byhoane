/**
 * Quản lý Ẩm thực — admin/moderator can list/create/edit; hard delete is
 * admin-only (same split as AdminCategoryManagementPage/AdminFacilityManagementPage).
 * Cuisine was already a real table (unlike Category/Facility's history), so
 * this page is just the admin-editable front-end that was missing — the
 * "Ẩm thực" checkboxes on RestaurantCoreForm.tsx read from the same
 * adminCuisinesApi.list() as this page. No `icon` field — Cuisine has no
 * icon column, unlike Category/Facility.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CuisineDto } from '@foodmap/shared-types'
import { ApiError } from '../api/client'
import { adminCuisinesApi } from '../api/admin-cuisines'
import { useAuth } from '../auth/AuthContext'

export function AdminCuisineManagementPage() {
  const { session } = useAuth()
  const isAdmin = session?.user.role === 'admin'
  const queryClient = useQueryClient()

  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin-cuisines'],
    queryFn: () => adminCuisinesApi.list(),
  })

  function reportError(err: unknown) {
    setActionError(err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.')
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-cuisines'] })
  }

  const createMutation = useMutation({
    mutationFn: () => adminCuisinesApi.create({ code: newCode.trim(), label: newLabel.trim() }),
    meta: { successMessage: 'Đã thêm ẩm thực.' },
    onSuccess: () => {
      setNewCode('')
      setNewLabel('')
      setActionError(null)
      invalidate()
    },
    onError: reportError,
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => adminCuisinesApi.update(id, { label: editLabel.trim() }),
    meta: { successMessage: 'Đã lưu ẩm thực.' },
    onSuccess: () => {
      setEditingId(null)
      setActionError(null)
      invalidate()
    },
    onError: reportError,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCuisinesApi.remove(id),
    meta: { successMessage: 'Đã xoá ẩm thực.' },
    onSuccess: () => {
      setActionError(null)
      invalidate()
    },
    onError: reportError,
  })

  function startEdit(cuisine: CuisineDto) {
    setEditingId(cuisine.id)
    setEditLabel(cuisine.label)
  }

  return (
    <div>
      <h1>Quản lý Ẩm thực</h1>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="detail-section">
        <h2>Thêm ẩm thực mới</h2>
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
                placeholder="vd: mon_han_quoc"
                value={newCode}
                disabled={createMutation.isPending}
                onChange={(event) => setNewCode(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Tên hiển thị *</span>
              <input
                type="text"
                placeholder="vd: Món Hàn Quốc"
                value={newLabel}
                disabled={createMutation.isPending}
                onChange={(event) => setNewLabel(event.target.value)}
              />
            </label>
          </div>
          <button
            type="submit"
            className="button button-primary"
            disabled={createMutation.isPending || !newCode.trim() || !newLabel.trim()}
          >
            {createMutation.isPending ? 'Đang thêm…' : 'Thêm ẩm thực'}
          </button>
        </form>
      </section>

      {listQuery.isLoading && <p>Đang tải…</p>}
      {listQuery.isError && <p className="form-error">Không thể tải danh sách ẩm thực.</p>}

      {listQuery.data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên hiển thị</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {listQuery.data.map((cuisine) => (
              <tr key={cuisine.id}>
                <td>
                  <code>{cuisine.code}</code>
                </td>
                <td>
                  {editingId === cuisine.id ? (
                    <input type="text" value={editLabel} onChange={(event) => setEditLabel(event.target.value)} />
                  ) : (
                    cuisine.label
                  )}
                </td>
                <td>
                  {editingId === cuisine.id ? (
                    <>
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={updateMutation.isPending || !editLabel.trim()}
                        onClick={() => updateMutation.mutate(cuisine.id)}
                      >
                        Lưu
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        Huỷ
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => startEdit(cuisine)}>
                        Sửa
                      </button>
                      <button
                        type="button"
                        disabled={!isAdmin || deleteMutation.isPending}
                        title={!isAdmin ? 'Chỉ admin mới được xoá' : undefined}
                        onClick={() => {
                          if (window.confirm(`Xoá ẩm thực "${cuisine.label}"?`)) {
                            deleteMutation.mutate(cuisine.id)
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
