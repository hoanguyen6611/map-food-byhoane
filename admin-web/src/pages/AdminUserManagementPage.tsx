/**
 * Screen 33 — Admin User Management (docs/04-screen-list.md §33).
 *
 * Suspend/reactivate/role-change are admin-only per PRD §10.11 (moderator
 * gets 403 — enforced server-side in AdminUserService, mirrored here by
 * disabling the buttons rather than hiding them, same convention as
 * `AdminRestaurantManagementPage`'s hard-delete gating). Self-suspend and
 * self-role-change are also blocked server-side; disabled here too for
 * immediate feedback instead of waiting on the 400 response.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AdminUserDetailDto, RoleCode, UserStatus } from '@foodmap/shared-types'
import { ApiError } from '../api/client'
import { adminUsersApi } from '../api/admin-users'
import { useAuth } from '../auth/AuthContext'
import { useDebouncedValue } from './restaurant-admin/useDebouncedValue'
import { ASSIGNABLE_ROLE_OPTIONS, ROLE_OPTIONS, roleLabel, STATUS_OPTIONS, statusLabel, formatDateTime } from './user-admin/constants'

const PAGE_SIZE = 20

export function AdminUserManagementPage() {
  const { session } = useAuth()
  const isAdmin = session?.user.role === 'admin'
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState('')
  const [role, setRole] = useState<RoleCode | ''>('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(searchInput, 400)

  const listQuery = useQuery({
    queryKey: ['admin-users', debouncedSearch, role, status, page],
    queryFn: () =>
      adminUsersApi.list({
        search: debouncedSearch || undefined,
        role: role || undefined,
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
  })

  function reportError(err: unknown) {
    if (err instanceof ApiError) {
      setActionError(err.message)
    } else {
      setActionError('Không thể kết nối máy chủ. Vui lòng thử lại.')
    }
  }

  function invalidate(userId: string) {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] })
  }

  const suspendMutation = useMutation({
    mutationFn: (id: string) => adminUsersApi.suspend(id),
    onSuccess: (_data, id) => {
      invalidate(id)
      setActionError(null)
    },
    onError: reportError,
  })
  const reactivateMutation = useMutation({
    mutationFn: (id: string) => adminUsersApi.reactivate(id),
    onSuccess: (_data, id) => {
      invalidate(id)
      setActionError(null)
    },
    onError: reportError,
  })

  const data = listQuery.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  function handleSuspend(id: string, email: string) {
    if (!window.confirm(`Tạm khoá tài khoản "${email}"?`)) return
    setActionError(null)
    suspendMutation.mutate(id)
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Quản lý Người dùng</h1>
          <p>Quản lý tài khoản người dùng — vai trò, trạng thái, xử lý vi phạm.</p>
        </div>
      </div>

      <div className="filter-bar">
        <label className="filter-field">
          <span>Tìm theo email/tên</span>
          <input
            type="text"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setPage(1)
            }}
            placeholder="Email hoặc tên hiển thị…"
          />
        </label>
        <label className="filter-field">
          <span>Vai trò</span>
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as RoleCode | '')
              setPage(1)
            }}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Trạng thái</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as UserStatus | '')
              setPage(1)
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
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
          {listQuery.error instanceof ApiError ? listQuery.error.message : 'Không thể tải danh sách người dùng.'}
        </p>
      )}

      {data && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Tên hiển thị</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Đăng nhập cuối</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="data-table-empty">
                    Không tìm thấy người dùng nào khớp bộ lọc.
                  </td>
                </tr>
              )}
              {data.items.map((item) => {
                const isSelf = item.id === session?.user.id
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td>{item.email}</td>
                      <td>{item.displayName ?? '—'}</td>
                      <td>{roleLabel(item.roleCode)}</td>
                      <td>
                        <span className={`status-badge status-badge-${item.status}`}>{statusLabel(item.status)}</span>
                      </td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatDateTime(item.lastLoginAt)}</td>
                      <td className="data-table-actions">
                        <button
                          type="button"
                          className="button button-small"
                          onClick={() => {
                            setActionError(null)
                            setExpandedId(expandedId === item.id ? null : item.id)
                          }}
                        >
                          {expandedId === item.id ? 'Đóng' : 'Chi tiết'}
                        </button>
                        {item.status === 'suspended' ? (
                          <button
                            type="button"
                            className="button button-small"
                            disabled={!isAdmin || reactivateMutation.isPending}
                            title={!isAdmin ? 'Chỉ admin mới có quyền mở khoá' : undefined}
                            onClick={() => {
                              setActionError(null)
                              reactivateMutation.mutate(item.id)
                            }}
                          >
                            Mở khoá
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button button-small button-danger"
                            disabled={!isAdmin || isSelf || suspendMutation.isPending}
                            title={!isAdmin ? 'Chỉ admin mới có quyền tạm khoá' : isSelf ? 'Không thể tự khoá chính mình' : undefined}
                            onClick={() => handleSuspend(item.id, item.email)}
                          >
                            Tạm khoá
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === item.id && (
                      <tr>
                        <td colSpan={7}>
                          <UserDetailPanel userId={item.id} isAdmin={isAdmin} isSelf={isSelf} onError={reportError} onRoleChanged={() => invalidate(item.id)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
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
              Trang {data.page} / {totalPages} ({data.total} mục)
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

interface UserDetailPanelProps {
  userId: string
  isAdmin: boolean
  isSelf: boolean
  onError: (err: unknown) => void
  onRoleChanged: () => void
}

function UserDetailPanel({ userId, isAdmin, isSelf, onError, onRoleChanged }: UserDetailPanelProps) {
  const [nextRole, setNextRole] = useState<RoleCode | ''>('')

  const detailQuery = useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: () => adminUsersApi.detail(userId),
  })

  const changeRoleMutation = useMutation({
    mutationFn: (roleCode: RoleCode) => adminUsersApi.changeRole(userId, { roleCode }),
    onSuccess: () => {
      onRoleChanged()
      setNextRole('')
    },
    onError,
  })

  if (detailQuery.isLoading) return <p>Đang tải chi tiết…</p>
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <p className="form-error" role="alert">
        {detailQuery.error instanceof ApiError ? detailQuery.error.message : 'Không thể tải chi tiết người dùng.'}
      </p>
    )
  }

  const detail: AdminUserDetailDto = detailQuery.data

  function handleChangeRole() {
    if (!nextRole || nextRole === detail.roleCode) return
    if (!window.confirm(`Đổi vai trò của "${detail.email}" thành "${roleLabel(nextRole as RoleCode)}"?`)) return
    changeRoleMutation.mutate(nextRole as RoleCode)
  }

  return (
    <div className="admin-form">
      <p>
        <strong>Số đánh giá:</strong> {detail.reviewCount} —{' '}
        <Link to={`/reviews?userId=${detail.id}`}>Xem đánh giá của người dùng này</Link>
      </p>
      <p>
        <strong>Số báo cáo bị nhận:</strong> {detail.reportsReceivedCount}
      </p>
      <div className="form-grid">
        <label className="form-field">
          <span>Đổi vai trò</span>
          <select
            value={nextRole || detail.roleCode}
            disabled={!isAdmin || isSelf}
            onChange={(event) => setNextRole(event.target.value as RoleCode)}
          >
            {ASSIGNABLE_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isSelf && <p className="moderation-labels">Không thể tự thay đổi vai trò của chính mình.</p>}
      <button
        type="button"
        className="button button-primary"
        disabled={!isAdmin || isSelf || !nextRole || nextRole === detail.roleCode || changeRoleMutation.isPending}
        onClick={handleChangeRole}
      >
        Xác nhận đổi vai trò
      </button>
    </div>
  )
}
