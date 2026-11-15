/**
 * Nội dung & Cài đặt — admin-editable footer links, About page copy (vi/en)
 * and the real scoring/level rules behind it. Everything saves to the
 * backend's site_settings (see SiteSettingsService); the public web picks
 * changes up immediately (tag revalidation), and a new scoring threshold
 * re-scores every restaurant in the background.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_ABOUT_CONTENT_VI,
  type AboutContent,
  type SiteSettingKey,
  type SiteSettingsDto,
} from '@foodmap/shared-types'
import { ApiError } from '../api/client'
import { adminSiteSettingsApi } from '../api/admin-site-settings'
import { useAuth } from '../auth/AuthContext'

type TabKey = 'general' | 'score' | 'axes' | 'moderation' | 'data' | 'levels'

const TABS: { key: TabKey; label: string; saves: SiteSettingKey[] }[] = [
  { key: 'general', label: 'Chung', saves: ['footer', 'about'] },
  { key: 'score', label: 'Cách chấm điểm', saves: ['about', 'scoring'] },
  { key: 'axes', label: '7 tiêu chí', saves: ['about'] },
  { key: 'moderation', label: 'Kiểm duyệt đánh giá', saves: ['about'] },
  { key: 'data', label: 'Nguồn dữ liệu', saves: ['about'] },
  { key: 'levels', label: 'Cấp độ thành viên', saves: ['about', 'gamification'] },
]

// About copy fields shown per tab (paths into AboutContent). Labels below.
const TAB_TEXT_PATHS: Record<TabKey, string[]> = {
  general: ['pageTitle', 'navEyebrow', 'footerHeading', ...Object.keys(DEFAULT_ABOUT_CONTENT_VI.nav).map((k) => `nav.${k}`)],
  score: textPaths('score'),
  axes: textPaths('axes'),
  moderation: textPaths('moderation'),
  data: textPaths('data'),
  levels: textPaths('levels'),
}

const CRITERIA_NAMES: Record<string, string> = {
  food_quality: 'Chất lượng món ăn',
  space: 'Không gian',
  price: 'Giá cả',
  service: 'Phục vụ',
  hygiene: 'Vệ sinh',
  wifi: 'Wifi',
  parking: 'Chỗ để xe',
}
const BADGE_NAMES: Record<string, string> = {
  contributor_10: 'Huy hiệu đóng góp quán',
  coffee_hunter: 'Huy hiệu thợ săn cà phê',
  helpful_100: 'Huy hiệu lượt hữu ích',
}
const NAV_NAMES: Record<string, string> = {
  'cach-cham-diem': 'Cách chấm điểm',
  'tieu-chi': '7 tiêu chí',
  'kiem-duyet': 'Kiểm duyệt đánh giá',
  'du-lieu': 'Nguồn dữ liệu',
  'cap-do-thanh-vien': 'Cấp độ thành viên',
}

const FIELD_LABELS: Record<string, string> = {
  pageTitle: 'Tiêu đề trang (tab trình duyệt)',
  navEyebrow: 'Nhãn menu mục lục',
  footerHeading: 'Tiêu đề nhóm ở footer',
  title: 'Tiêu đề',
  body: 'Nội dung',
  factRestaurants: 'Nhãn ô "số quán"',
  factThreshold: 'Nhãn ô "số đánh giá để ổn định"',
  factCriteria: 'Nhãn ô "số tiêu chí"',
  calloutTitle: 'Tiêu đề hộp ghi chú',
  calloutBody: 'Nội dung hộp ghi chú',
  sourcesTitle: 'Tiêu đề khối nguồn',
  source1Name: 'Nguồn 1 — tên',
  source1Body: 'Nguồn 1 — mô tả',
  source2Name: 'Nguồn 2 — tên',
  source2Body: 'Nguồn 2 — mô tả',
  disclaimer: 'Ghi chú cuối trang',
  factReview: 'Nhãn ô "điểm / đánh giá"',
  factContribution: 'Nhãn ô "điểm / quán đóng góp"',
  factHelpful: 'Nhãn ô "điểm / lượt hữu ích"',
  thresholdsTitle: 'Tiêu đề "Mốc lên cấp"',
  levelLabel: 'Mẫu tên cấp — giữ {level}',
  levelThreshold: 'Mẫu mốc điểm — giữ {points}',
  badgesTitle: 'Tiêu đề "Huy hiệu"',
  label: 'Tên',
  note: 'Mô tả',
}

function textPaths(section: keyof AboutContent): string[] {
  const out: string[] = []
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') return out.push(path)
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, `${path}.${k}`)
  }
  walk(DEFAULT_ABOUT_CONTENT_VI[section], section)
  return out
}

function labelFor(path: string): string {
  const parts = path.split('.')
  const leaf = parts[parts.length - 1]
  if (parts[0] === 'nav') return `Tên mục "${NAV_NAMES[leaf] ?? leaf}"`
  if (parts[1] === 'items') return `${CRITERIA_NAMES[parts[2]] ?? parts[2]} — ${FIELD_LABELS[leaf] ?? leaf}`
  if (parts[1] === 'steps') return `Bước ${parts[2]} — ${FIELD_LABELS[leaf] ?? leaf}`
  if (parts[1] === 'badges') return `${BADGE_NAMES[parts[2]] ?? parts[2]} — ${FIELD_LABELS[leaf] ?? leaf}`
  return FIELD_LABELS[leaf] ?? path
}

function getPath(obj: unknown, path: string): string {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj) as string
}

function setPath<T>(obj: T, path: string, value: string): T {
  const keys = path.split('.')
  const clone = structuredClone(obj) as Record<string, unknown>
  let node = clone
  for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>
  node[keys[keys.length - 1]] = value
  return clone as T
}

function NumberField({
  label,
  value,
  onChange,
  hint,
  disabled,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  hint?: string
  disabled?: boolean
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input type="number" min={0} step={1} value={Number.isFinite(value) ? value : ''} disabled={disabled} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
      {hint ? <span className="settings-hint">{hint}</span> : null}
    </label>
  )
}

export function AdminSiteSettingsPage() {
  const { session } = useAuth()
  const isAdmin = session?.user.role === 'admin'
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabKey>('general')
  const [draft, setDraft] = useState<SiteSettingsDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({ queryKey: ['admin-site-settings'], queryFn: () => adminSiteSettingsApi.get() })
  useEffect(() => {
    if (query.data && !draft) setDraft(query.data)
  }, [query.data, draft])

  const saved = query.data
  const activeTab = TABS.find((t) => t.key === tab)!
  const dirtyKeys = useMemo(
    () => (draft && saved ? activeTab.saves.filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k])) : []),
    [draft, saved, activeTab],
  )
  const anyDirty = draft && saved ? (['footer', 'scoring', 'gamification', 'about'] as SiteSettingKey[]).some((k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k])) : false

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) return null
      let latest: SiteSettingsDto | null = null
      for (const key of dirtyKeys) latest = await adminSiteSettingsApi.update(key, draft[key])
      return latest
    },
    meta: { successMessage: 'Đã lưu. Website cập nhật ngay.' },
    onSuccess: (latest) => {
      setError(null)
      if (latest) {
        queryClient.setQueryData(['admin-site-settings'], latest)
        // Keep unsaved edits on other tabs, take server-normalised values for what was saved.
        setDraft((d) => (d ? { ...d, ...Object.fromEntries(dirtyKeys.map((k) => [k, latest[k]])) } : latest))
      }
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : 'Không thể lưu. Vui lòng thử lại.'),
  })

  if (query.isLoading || !draft) {
    return (
      <div className="page">
        <h1>Nội dung &amp; Cài đặt</h1>
        {query.isError ? (
          <p className="form-error" role="alert">
            {query.error instanceof ApiError ? query.error.message : 'Không thể tải cài đặt.'}
          </p>
        ) : (
          <p>Đang tải…</p>
        )}
      </div>
    )
  }

  const readOnly = !isAdmin
  const textRows = TAB_TEXT_PATHS[tab]
  const g = draft.gamification

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Nội dung &amp; Cài đặt</h1>
          <p className="settings-sub">
            Nội dung trang Giới thiệu, link ở footer và các luật tính điểm/cấp độ thật của hệ thống. Ô để trống sẽ dùng nội dung mặc định.
          </p>
        </div>
      </div>

      {readOnly ? <p className="settings-readonly">Bạn đang xem ở chế độ chỉ đọc — chỉ quản trị viên (admin) mới có quyền thay đổi.</p> : null}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'tab-active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-form">
        {tab === 'general' ? (
          <>
            <h2 className="settings-heading">Mạng xã hội (footer)</h2>
            <p className="settings-hint">Link đầy đủ https://… Để trống: icon vẫn hiện nhưng mờ, ghi "Sắp ra mắt".</p>
            <div className="form-grid">
              {(['facebook', 'instagram', 'tiktok'] as const).map((n) => (
                <label key={n} className="form-field">
                  <span>{n === 'facebook' ? 'Facebook' : n === 'instagram' ? 'Instagram' : 'TikTok'}</span>
                  <input
                    type="url"
                    placeholder="https://"
                    value={draft.footer.social[n]}
                    disabled={readOnly}
                    onChange={(e) => setDraft({ ...draft, footer: { ...draft.footer, social: { ...draft.footer.social, [n]: e.target.value } } })}
                  />
                </label>
              ))}
            </div>
            <h2 className="settings-heading">Link khác (footer)</h2>
            <p className="settings-hint">Đường dẫn trong web (/dieu-khoan), link https://… hoặc mailto:… Để trống: link bị ẩn.</p>
            <div className="form-grid">
              {(
                [
                  ['contact', 'Liên hệ'],
                  ['terms', 'Điều khoản'],
                  ['privacy', 'Quyền riêng tư'],
                  ['communityGuidelines', 'Quy tắc cộng đồng'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="form-field">
                  <span>{label}</span>
                  <input
                    type="text"
                    value={draft.footer.links[k]}
                    disabled={readOnly}
                    onChange={(e) => setDraft({ ...draft, footer: { ...draft.footer, links: { ...draft.footer.links, [k]: e.target.value } } })}
                  />
                </label>
              ))}
            </div>
            <h2 className="settings-heading">Tên các mục trang Giới thiệu</h2>
          </>
        ) : null}

        {tab === 'score' ? (
          <>
            <h2 className="settings-heading">Luật tính điểm quán</h2>
            <div className="form-grid">
              <NumberField
                label="Số đánh giá để điểm quán ổn định (m)"
                value={draft.scoring.minVotesThreshold}
                disabled={readOnly}
                hint="Quán có ít hơn số này sẽ bị kéo về điểm trung bình chung. Đổi số này sẽ tính lại điểm toàn bộ quán (chạy nền, vài phút)."
                onChange={(n) => setDraft({ ...draft, scoring: { minVotesThreshold: n } })}
              />
            </div>
          </>
        ) : null}

        {tab === 'levels' ? (
          <>
            <h2 className="settings-heading">Điểm cho mỗi hoạt động</h2>
            <div className="form-grid settings-grid-3">
              <NumberField label="Mỗi đánh giá được duyệt" value={g.pointsPerReview} disabled={readOnly} onChange={(n) => setDraft({ ...draft, gamification: { ...g, pointsPerReview: n } })} />
              <NumberField label="Mỗi quán đóng góp được duyệt" value={g.pointsPerContribution} disabled={readOnly} onChange={(n) => setDraft({ ...draft, gamification: { ...g, pointsPerContribution: n } })} />
              <NumberField label="Mỗi lượt hữu ích nhận được" value={g.pointsPerHelpfulVote} disabled={readOnly} onChange={(n) => setDraft({ ...draft, gamification: { ...g, pointsPerHelpfulVote: n } })} />
            </div>
            <h2 className="settings-heading">Mốc điểm lên cấp</h2>
            <p className="settings-hint">Cấp 1 luôn từ 0 điểm; mỗi cấp sau phải cao hơn cấp trước. Cấp độ được tính lại ngay, không cần chờ.</p>
            <div className="form-grid settings-grid-5">
              {g.levelThresholds.map((v, i) => (
                <NumberField
                  key={i}
                  label={`Cấp ${i + 1}`}
                  value={v}
                  disabled={readOnly || i === 0}
                  onChange={(n) => setDraft({ ...draft, gamification: { ...g, levelThresholds: g.levelThresholds.map((x, j) => (j === i ? n : x)) } })}
                />
              ))}
            </div>
            <h2 className="settings-heading">Điều kiện nhận huy hiệu</h2>
            <div className="form-grid settings-grid-3">
              <NumberField label="Đóng góp quán: số quán được duyệt" value={g.badgeThresholds.contributor_10} disabled={readOnly} onChange={(n) => setDraft({ ...draft, gamification: { ...g, badgeThresholds: { ...g.badgeThresholds, contributor_10: n } } })} />
              <NumberField label="Thợ săn cà phê: số đánh giá quán cà phê" value={g.badgeThresholds.coffee_hunter} disabled={readOnly} onChange={(n) => setDraft({ ...draft, gamification: { ...g, badgeThresholds: { ...g.badgeThresholds, coffee_hunter: n } } })} />
              <NumberField label="Lượt hữu ích: tổng lượt nhận được" value={g.badgeThresholds.helpful_100} disabled={readOnly} onChange={(n) => setDraft({ ...draft, gamification: { ...g, badgeThresholds: { ...g.badgeThresholds, helpful_100: n } } })} />
            </div>
            <p className="settings-hint">Nhớ cập nhật lại mô tả huy hiệu bên dưới nếu bạn đổi các con số này.</p>
          </>
        ) : null}

        {tab !== 'general' ? <h2 className="settings-heading">Nội dung hiển thị</h2> : null}
        <div className="settings-text-table">
          <div className="settings-text-head">
            <span />
            <span>Tiếng Việt</span>
            <span>English</span>
          </div>
          {textRows.map((path) => {
            const long = getPath(DEFAULT_ABOUT_CONTENT_VI, path).length > 70
            return (
              <div key={path} className="settings-text-row">
                <span className="settings-text-label">{labelFor(path)}</span>
                {(['vi', 'en'] as const).map((loc) => {
                  const value = getPath(draft.about[loc], path)
                  const onChange = (v: string) => setDraft({ ...draft, about: { ...draft.about, [loc]: setPath(draft.about[loc], path, v) } })
                  return long ? (
                    <textarea key={loc} aria-label={`${labelFor(path)} (${loc})`} rows={4} value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
                  ) : (
                    <input key={loc} aria-label={`${labelFor(path)} (${loc})`} type="text" value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
                  )
                })}
              </div>
            )
          })}
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="settings-actions">
          <button type="button" className="button button-primary" disabled={readOnly || dirtyKeys.length === 0 || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
          <button
            type="button"
            className="button"
            disabled={!anyDirty || saveMutation.isPending}
            onClick={() => {
              setDraft(saved ?? null)
              setError(null)
            }}
          >
            Hoàn tác
          </button>
          {anyDirty && dirtyKeys.length === 0 ? <span className="settings-hint">Có thay đổi chưa lưu ở tab khác.</span> : null}
        </div>
      </div>
    </div>
  )
}
