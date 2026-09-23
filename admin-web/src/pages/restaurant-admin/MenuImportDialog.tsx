/**
 * "Nhập từ Excel" — bulk-add menu items by uploading a spreadsheet instead
 * of typing them in one at a time via AddMenuItemForm. Parsed entirely in
 * the browser (SheetJS `xlsx`, installed from SheetJS's own CDN — see
 * package.json's comment-free but deliberate URL dependency: the
 * npm-registry-published `xlsx` build is stuck on an old, unpatched version)
 * — nothing is uploaded until "Nhập N món" posts the parsed rows as one
 * batch to `POST /admin/restaurants/:id/menu-items/bulk`. `xlsx` is a ~1 MB
 * parser nobody but this dialog needs, so it's dynamically imported the
 * first time this dialog is actually opened rather than bundled into
 * admin-web's main chunk.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type * as XLSXType from 'xlsx'
import { ApiError } from '../../api/client'
import { adminRestaurantsApi } from '../../api/admin-restaurants'
import type { CreateMenuItemBody } from '../../api/admin-restaurants'
import { formatVnd } from './constants'

const MAX_PRICE_VND = 10_000_000

// Exact headers the parser looks for — also what "Tải file mẫu" writes, so
// an admin who starts from the template never hits a header-mismatch error.
const HEADER = {
  name: 'Tên món',
  price: 'Giá (VNĐ)',
  category: 'Danh mục',
  popular: 'Món phổ biến',
} as const

const TRUTHY_VALUES = new Set(['x', 'co', 'có', 'yes', 'true', '1'])

function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  return TRUTHY_VALUES.has(String(value ?? '').trim().toLowerCase())
}

interface ParsedRow {
  rowNumber: number // 1-based, matching the spreadsheet's own row numbers (header = row 1)
  name: string
  priceVnd: number
  category?: string
  isPopular: boolean
  error: string | null
}

function parseRow(raw: Record<string, unknown>, rowNumber: number): ParsedRow {
  const name = String(raw[HEADER.name] ?? '').trim()
  const priceRaw = raw[HEADER.price]
  const priceVnd =
    typeof priceRaw === 'number' ? Math.round(priceRaw) : Number(String(priceRaw ?? '').replace(/[.,\s]/g, ''))
  const category = String(raw[HEADER.category] ?? '').trim() || undefined
  const isPopular = isTruthy(raw[HEADER.popular])

  let error: string | null = null
  if (!name) {
    error = 'Thiếu tên món'
  } else if (!Number.isInteger(priceVnd) || priceVnd < 0 || priceVnd > MAX_PRICE_VND) {
    error = `Giá không hợp lệ (0–${formatVnd(MAX_PRICE_VND)})`
  }

  return { rowNumber, name, priceVnd, category, isPopular, error }
}

async function downloadTemplate() {
  const XLSX: typeof XLSXType = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet([
    { [HEADER.name]: 'Phở bò tái', [HEADER.price]: 45000, [HEADER.category]: 'Món chính', [HEADER.popular]: 'x' },
    { [HEADER.name]: 'Trà đá', [HEADER.price]: 5000, [HEADER.category]: 'Đồ uống', [HEADER.popular]: '' },
  ])
  XLSX.utils.book_append_sheet(wb, ws, 'Thực đơn')
  XLSX.writeFile(wb, 'mau-thuc-don.xlsx')
}

interface MenuImportDialogProps {
  restaurantId: string
}

export function MenuImportDialog({ restaurantId }: MenuImportDialogProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  const validRows = rows.filter((row) => !row.error)

  function reset() {
    setFileName(null)
    setRows([])
    setParseError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    try {
      const XLSX: typeof XLSXType = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        setParseError('File không có sheet nào.')
        setRows([])
        return
      }
      const sheet = workbook.Sheets[firstSheetName]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      if (json.length === 0) {
        setParseError('Không tìm thấy dòng dữ liệu nào (kiểm tra lại tiêu đề cột).')
        setRows([])
        return
      }
      setRows(json.map((raw, i) => parseRow(raw, i + 2))) // +2: row 1 is the header
    } catch {
      setParseError('Không đọc được file. Vui lòng dùng file .xlsx/.xls/.csv đúng định dạng mẫu.')
      setRows([])
    }
  }

  const importMutation = useMutation({
    mutationFn: (items: CreateMenuItemBody[]) => adminRestaurantsApi.bulkCreateMenuItems(restaurantId, { items }),
    meta: { successMessage: 'Đã nhập món từ Excel.' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurant', restaurantId] })
      reset()
      setIsOpen(false)
    },
    onError: (err: unknown) => setParseError(err instanceof ApiError ? err.message : 'Không thể nhập món.'),
  })

  function handleImport() {
    const items: CreateMenuItemBody[] = validRows.map((row) => ({
      name: row.name,
      priceVnd: row.priceVnd,
      category: row.category,
      isPopular: row.isPopular,
    }))
    if (items.length === 0) return
    importMutation.mutate(items)
  }

  if (!isOpen) {
    return (
      <button type="button" className="button" onClick={() => setIsOpen(true)}>
        Nhập từ Excel
      </button>
    )
  }

  return (
    <div className="menu-import-panel">
      <div className="page-header-row">
        <h3 style={{ margin: 0 }}>Nhập món từ Excel</h3>
        <button
          type="button"
          className="button button-small"
          onClick={() => {
            reset()
            setIsOpen(false)
          }}
        >
          Đóng
        </button>
      </div>

      <p className="dashboard-empty" style={{ margin: '4px 0 12px' }}>
        File cần đúng 4 cột: <strong>{HEADER.name}</strong>, <strong>{HEADER.price}</strong>,{' '}
        {HEADER.category} (tùy chọn), {HEADER.popular} (tùy chọn — điền "x" nếu món nổi bật).
      </p>

      <div className="inline-form">
        <button type="button" className="button button-small" onClick={downloadTemplate}>
          Tải file mẫu
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
        />
      </div>

      {parseError && (
        <p className="form-error" role="alert">
          {parseError}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <p style={{ margin: '12px 0 8px' }}>
            {fileName} — {validRows.length}/{rows.length} dòng hợp lệ
            {rows.length > validRows.length ? ' (dòng lỗi sẽ bị bỏ qua khi nhập)' : ''}.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Dòng</th>
                <th>Tên món</th>
                <th>Giá</th>
                <th>Nhóm món</th>
                <th>Nổi bật</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowNumber}>
                  <td>{row.rowNumber}</td>
                  <td>{row.name || '—'}</td>
                  <td>{Number.isFinite(row.priceVnd) ? formatVnd(row.priceVnd) : '—'}</td>
                  <td>{row.category ?? '—'}</td>
                  <td>{row.isPopular ? 'Nổi bật' : ''}</td>
                  <td>
                    {row.error ? <span className="field-error">{row.error}</span> : 'Hợp lệ'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="inline-form" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="button button-primary"
              disabled={validRows.length === 0 || importMutation.isPending}
              onClick={handleImport}
            >
              {importMutation.isPending ? 'Đang nhập…' : `Nhập ${validRows.length} món`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
