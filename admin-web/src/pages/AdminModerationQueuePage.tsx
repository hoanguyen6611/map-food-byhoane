/**
 * Screen 31 — Admin Moderation Queue (docs/04-screen-list.md §31,
 * docs/build-prompts/07-contribution-media-moderation-ai.md).
 *
 * Both `admin` and `moderator` can list/decide here — the backend applies
 * no method-level role override on this controller (unlike the restaurant
 * hard-delete action), so this page never gates the decision buttons on
 * `isAdmin` either.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ModerationDecision, ModerationTargetType, ReportDto } from '@foodmap/shared-types'
import { ApiError } from '../api/client'
import { adminModerationApi } from '../api/admin-moderation'
import {
  DECISION_OPTIONS,
  TARGET_TYPE_TABS,
  decisionLabel,
  formatDateTime,
  reportReasonLabel,
  riskScoreLabel,
} from './moderation-admin/constants'

const PAGE_SIZE = 20

export function AdminModerationQueuePage() {
  const queryClient = useQueryClient()

  // targetType/decision can arrive via deep-link (e.g. the Dashboard's KPI
  // cards) — only used to seed the INITIAL filter; the tabs/select below
  // manage it locally from then on, same "read once" idea as
  // AdminReviewManagementPage's restaurantId/userId deep-link params.
  const [searchParams] = useSearchParams()
  const [targetType, setTargetType] = useState<ModerationTargetType | ''>(
    () => (searchParams.get('targetType') as ModerationTargetType | null) ?? '',
  )
  const [decision, setDecision] = useState<ModerationDecision | ''>(
    () => (searchParams.get('decision') as ModerationDecision | null) ?? 'pending',
  )
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin-moderation-queue', targetType, decision, page],
    queryFn: () =>
      adminModerationApi.list({
        targetType: targetType || undefined,
        decision: decision || undefined,
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

  const decideMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: { decision: 'approved' | 'rejected' | 'edit_requested'; reason?: string }
    }) => adminModerationApi.decide(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moderation-queue'] })
      setExpandedId(null)
      setActionError(null)
    },
    onError: reportError,
  })

  const resolveReportMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'resolved' | 'dismissed' }) =>
      adminModerationApi.resolveReport(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moderation-queue'] })
      setActionError(null)
    },
    onError: reportError,
  })

  function handleTabChange(value: ModerationTargetType | '') {
    setTargetType(value)
    setPage(1)
  }

  function handleDecisionFilterChange(value: ModerationDecision | '') {
    setDecision(value)
    setPage(1)
  }

  const data = listQuery.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Hàng đợi Kiểm duyệt</h1>
          <p>Xét duyệt nội dung do cộng đồng đóng góp: đánh giá, quán mới, chỉnh sửa, ảnh.</p>
        </div>
      </div>

      <div className="tabs">
        {TARGET_TYPE_TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            className={`tab ${targetType === tab.value ? 'tab-active' : ''}`}
            onClick={() => handleTabChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <label className="filter-field">
          <span>Trạng thái</span>
          <select
            value={decision}
            onChange={(event) => handleDecisionFilterChange(event.target.value as ModerationDecision | '')}
          >
            {DECISION_OPTIONS.map((option) => (
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
          {listQuery.error instanceof ApiError
            ? listQuery.error.message
            : 'Không thể tải hàng đợi kiểm duyệt.'}
        </p>
      )}

      {data && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Nội dung</th>
                <th>Người gửi</th>
                <th>Ngày gửi</th>
                <th>Rủi ro</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="data-table-empty">
                    Không có mục nào trong hàng đợi.
                  </td>
                </tr>
              )}
              {data.items.map((item) => (
                <Fragment key={item.id}>
                  <tr>
                    <td>{item.contentKind}</td>
                    <td>{item.contentSummary}</td>
                    <td>{item.submitterDisplayName}</td>
                    <td>{formatDateTime(item.submittedAt)}</td>
                    <td>
                      {riskScoreLabel(item.riskScore)}
                      {item.labels.length > 0 && (
                        <div className="moderation-labels">{item.labels.join(', ')}</div>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-badge-${item.decision}`}>
                        {decisionLabel(item.decision)}
                      </span>
                      {item.relatedReports.length > 0 && (
                        <ReportsList
                          reports={item.relatedReports}
                          isPending={resolveReportMutation.isPending}
                          onResolve={(reportId, status) => {
                            setActionError(null)
                            resolveReportMutation.mutate({ id: reportId, status })
                          }}
                        />
                      )}
                    </td>
                    <td className="data-table-actions">
                      {item.decision === 'pending' ? (
                        <button
                          type="button"
                          className="button button-small"
                          onClick={() => {
                            setActionError(null)
                            setExpandedId(expandedId === item.id ? null : item.id)
                          }}
                        >
                          {expandedId === item.id ? 'Đóng' : 'Xử lý'}
                        </button>
                      ) : (
                        <span className="moderation-labels">Đã xử lý</span>
                      )}
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr>
                      <td colSpan={7}>
                        <DecisionPanel
                          aiReason={item.aiReason}
                          recommendedAction={item.recommendedAction}
                          isPending={decideMutation.isPending}
                          onSubmit={(body) => decideMutation.mutate({ id: item.id, body })}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
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

interface ReportsListProps {
  reports: ReportDto[]
  isPending: boolean
  onResolve: (reportId: string, status: 'resolved' | 'dismissed') => void
}

/**
 * Gap-fix: `PATCH /admin/reports/:id/resolve` and its client wrapper
 * (adminModerationApi.resolveReport) existed but nothing in the UI called
 * them — resolving a report required knowing its id out-of-band. Reused
 * here (rather than a separate "reports" page) since a report only becomes
 * queue-visible by riding along on a ModerationResult (see
 * ReportService.ensureQueueVisible), so this is already the one place an
 * admin sees it.
 */
function ReportsList({ reports, isPending, onResolve }: ReportsListProps) {
  return (
    <div className="moderation-labels">
      {reports.map((report) => (
        <div key={report.id} style={{ marginTop: 4 }}>
          <span>
            {reportReasonLabel(report.reason)}
            {report.description ? ` — ${report.description}` : ''}
          </span>
          {report.status === 'open' || report.status === 'escalated' ? (
            <span style={{ marginLeft: 8 }}>
              <button
                type="button"
                className="button button-small"
                disabled={isPending}
                onClick={() => onResolve(report.id, 'resolved')}
              >
                Đã xử lý
              </button>{' '}
              <button
                type="button"
                className="button button-small"
                disabled={isPending}
                onClick={() => onResolve(report.id, 'dismissed')}
              >
                Bỏ qua
              </button>
            </span>
          ) : (
            <span style={{ marginLeft: 8, fontStyle: 'italic' }}>
              ({report.status === 'resolved' ? 'đã xử lý' : 'đã bỏ qua'})
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

interface DecisionPanelProps {
  aiReason: string
  recommendedAction: string
  isPending: boolean
  onSubmit: (body: { decision: 'approved' | 'rejected' | 'edit_requested'; reason?: string }) => void
}

function DecisionPanel({ aiReason, recommendedAction, isPending, onSubmit }: DecisionPanelProps) {
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'edit_requested'>('approved')
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit() {
    if (decision !== 'approved' && !reason.trim()) {
      setValidationError('Cần nhập lý do khi từ chối hoặc yêu cầu chỉnh sửa.')
      return
    }
    setValidationError(null)
    onSubmit({ decision, reason: reason.trim() || undefined })
  }

  return (
    <div className="admin-form">
      <p>
        <strong>Gợi ý hệ thống:</strong> {recommendedAction} — {aiReason || '(không có lý do)'}
      </p>
      <div className="form-grid">
        <label className="form-field">
          <span>Quyết định</span>
          <select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}>
            <option value="approved">Duyệt</option>
            <option value="rejected">Từ chối</option>
            <option value="edit_requested">Yêu cầu chỉnh sửa</option>
          </select>
        </label>
        <label className="form-field form-field-wide">
          <span>Lý do {decision !== 'approved' && '(bắt buộc)'}</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Giải thích lý do cho người gửi…"
          />
        </label>
      </div>
      {validationError && (
        <p className="form-error" role="alert">
          {validationError}
        </p>
      )}
      <button type="button" className="button button-primary" disabled={isPending} onClick={handleSubmit}>
        Xác nhận
      </button>
    </div>
  )
}
