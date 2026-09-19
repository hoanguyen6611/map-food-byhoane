/**
 * Quản lý Tiện ích — admin/moderator can list/create/edit; hard delete is
 * admin-only (same split as AdminCategoryManagementPage). Facility used to
 * be a fixed Postgres enum; it's now a real table (see the
 * facility_type_to_table migration), so this page is genuinely new — no
 * facility could be added/renamed at runtime before this.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FacilityDto } from '@foodmap/shared-types'
import { ApiError } from '../api/client'
import { adminFacilitiesApi } from '../api/admin-facilities'
import { useAuth } from '../auth/AuthContext'

export function AdminFacilityManagementPage() {
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
    queryKey: ['admin-facilities'],
    queryFn: () => adminFacilitiesApi.list(),
  })

  function reportError(err: unknown) {
    setActionError(err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.')
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-facilities'] })
  }

  const createMutation = useMutation({
    mutationFn: () => adminFacilitiesApi.create({ code: newCode.trim(), label: newLabel.trim(), icon: newIcon.trim() || undefined }),
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
    mutationFn: (id: string) => adminFacilitiesApi.update(id, { label: editLabel.trim(), icon: editIcon.trim() || undefined }),
    onSuccess: () => {
      setEditingId(null)
      setActionError(null)
      invalidate()
    },
    onError: reportError,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminFacilitiesApi.remove(id),
    onSuccess: () => {
      setActionError(null)
      invalidate()
    },
    onError: reportError,
  })

  function startEdit(facility: FacilityDto) {
    setEditingId(facility.id)
    setEditLabel(facility.label)
    setEditIcon(facility.icon ?? '')
  }

  return (
    <div>
      <h1>Quản lý Tiện ích</h1>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="detail-section">
        <h2>Thêm tiện ích mới</h2>
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
                placeholder="vd: rooftop"
                value={newCode}
                disabled={createMutation.isPending}
                onChange={(event) => setNewCode(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Tên hiển thị *</span>
              <input
                type="text"
                placeholder="vd: Sân thượng"
                value={newLabel}
                disabled={createMutation.isPending}
                onChange={(event) => setNewLabel(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Icon (không bắt buộc)</span>
              <input
                type="text"
                value={newIcon}
                disabled={createMutation.isPending}
                onChange={(event) => setNewIcon(event.target.value)}
              />
            </label>
          </div>
          <button
            type="submit"
            className="button button-primary"
            disabled={createMutation.isPending || !newCode.trim() || !newLabel.trim()}
          >
            {createMutation.isPending ? 'Đang thêm…' : 'Thêm tiện ích'}
          </button>
        </form>
      </section>

      {listQuery.isLoading && <p>Đang tải…</p>}
      {listQuery.isError && <p className="form-error">Không thể tải danh sách tiện ích.</p>}

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
            {listQuery.data.map((facility) => (
              <tr key={facility.id}>
                <td>
                  <code>{facility.code}</code>
                </td>
                <td>
                  {editingId === facility.id ? (
                    <input type="text" value={editLabel} onChange={(event) => setEditLabel(event.target.value)} />
                  ) : (
                    facility.label
                  )}
                </td>
                <td>
                  {editingId === facility.id ? (
                    <input type="text" value={editIcon} onChange={(event) => setEditIcon(event.target.value)} />
                  ) : (
                    facility.icon ?? '—'
                  )}
                </td>
                <td>
                  {editingId === facility.id ? (
                    <>
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={updateMutation.isPending || !editLabel.trim()}
                        onClick={() => updateMutation.mutate(facility.id)}
                      >
                        Lưu
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        Huỷ
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => startEdit(facility)}>
                        Sửa
                      </button>
                      <button
                        type="button"
                        disabled={!isAdmin || deleteMutation.isPending}
                        title={!isAdmin ? 'Chỉ admin mới được xoá' : undefined}
                        onClick={() => {
                          if (window.confirm(`Xoá tiện ích "${facility.label}"?`)) {
                            deleteMutation.mutate(facility.id)
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
