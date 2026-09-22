import { useEffect, useState } from 'react'
import { dismissToast, subscribeToasts, type ToastItem } from '../lib/toastStore'

/** Mounted once in main.tsx — renders whatever pushToast()/the global MutationCache pushes. */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => subscribeToasts(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.variant}`}>
          <span className="toast-message">{toast.message}</span>
          <button type="button" className="toast-close" aria-label="Đóng" onClick={() => dismissToast(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
