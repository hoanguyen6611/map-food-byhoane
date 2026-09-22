import { MutationCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'
import { pushToast } from '../lib/toastStore'

// Extends every `useMutation`'s options with an optional success message,
// shown as a toast by the MutationCache.onSuccess handler below — a single
// generic string per mutation, not a callback, so it stays trivial to add
// (`meta: { successMessage: 'Đã lưu.' }`) without restructuring each page's
// own onSuccess (which still runs after this and still owns cache
// invalidation / local state resets).
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      successMessage?: string
    }
  }
}

/**
 * Global mutation error/success feedback — added here once instead of at
 * each of this app's ~34 `useMutation` call sites, most of which previously
 * had zero user-visible success confirmation (see the toast rollout audit).
 * Each page's own onError/onSuccess still runs too (React Query calls both
 * the mutation-level and cache-level callbacks) — this only adds the toast,
 * it doesn't replace any existing inline `.form-error`/`.form-success` state.
 */
const mutationCache = new MutationCache({
  onError: (error) => {
    // A 401 already triggers a hard redirect to /login (see client.ts) —
    // showing an error toast in the same instant is just confusing noise
    // right as the page navigates away.
    if (error instanceof ApiError && error.status === 401) return
    const message =
      error instanceof ApiError ? error.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.'
    pushToast(message, 'error')
  },
  onSuccess: (_data, _variables, _context, mutation) => {
    const successMessage = mutation.options.meta?.successMessage
    if (successMessage) pushToast(successMessage, 'success')
  },
})

export const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
