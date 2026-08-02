/**
 * Typed API client for the Admin Portal.
 *
 * Since Module 2 (Authentication), authenticated requests automatically
 * attach `Authorization: Bearer <accessToken>` from the stored admin
 * session (see `../auth/session.ts`) — callers don't need to pass it
 * manually. There is no refresh-token wiring for the admin app in this
 * pass (access tokens expire after 15 minutes); a 401 on an
 * already-authenticated request is surfaced as a normal `ApiError` and the
 * caller (or a future interceptor) should force a re-login rather than
 * silently retrying. TODO(module-2+): add refresh-token rotation if the
 * admin portal needs longer-lived sessions.
 */
import { loadStoredSession } from '../auth/session'

const API_BASE_URL = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Best-effort extraction of a human-readable message from an error
 * response. NestJS's default error shape is `{ statusCode, message, error }`
 * (`message` is a string, or a string array for validation errors) — fall
 * back to raw text, then to the HTTP status text, so callers always get
 * something displayable instead of a stringified JSON blob.
 */
async function extractErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  if (text) {
    try {
      const data = JSON.parse(text) as { message?: string | string[] }
      if (Array.isArray(data.message)) return data.message.join(', ')
      if (typeof data.message === 'string') return data.message
    } catch {
      return text
    }
  }
  return response.statusText || `Request failed with status ${response.status}`
}

/**
 * Generic typed request helper. Callers supply the expected response type,
 * e.g. `request<HealthCheckResponse>('/health')`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers } = options
  const session = loadStoredSession()

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const message = await extractErrorMessage(response)
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const apiClient = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'GET', headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'POST', body, headers }),
  put: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PUT', body, headers }),
  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PATCH', body, headers }),
  delete: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'DELETE', headers }),
}
