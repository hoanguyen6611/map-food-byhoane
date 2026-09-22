/**
 * Plain-JS toast store (no React dependency) — needed because mutation
 * errors are pushed from `queryClient.ts`'s global `MutationCache`, a plain
 * module created before any component renders, not from inside a component
 * tree. `ToastContainer` subscribes to this and renders the actual UI; any
 * other module can call `pushToast()` directly.
 */
export type ToastVariant = 'success' | 'error'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

const AUTO_DISMISS_MS = 4000

let toasts: ToastItem[] = []
let listeners: Array<(items: ToastItem[]) => void> = []

function notify() {
  for (const listener of listeners) listener(toasts)
}

export function pushToast(message: string, variant: ToastVariant = 'success') {
  const id = crypto.randomUUID()
  toasts = [...toasts, { id, message, variant }]
  notify()
  setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  notify()
}

export function subscribeToasts(listener: (items: ToastItem[]) => void): () => void {
  listeners.push(listener)
  listener(toasts)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}
