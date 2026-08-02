/**
 * Persisted Admin Portal session (Module 2 — Authentication, screen 28).
 *
 * Stored in `localStorage` (not `sessionStorage`) so an admin/moderator
 * doesn't get logged out just from closing the tab or restarting the
 * browser — the short 15-minute access-token TTL already bounds how long a
 * stolen/leaked value is useful, and this is an internal tool, not a
 * high-sensitivity consumer surface.
 */
import type { AuthUserDto } from '@foodmap/shared-types'

export interface AdminSession {
  accessToken: string
  user: AuthUserDto
}

const STORAGE_KEY = 'foodmap.admin.session'

export function loadStoredSession(): AdminSession | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<AdminSession>
    if (!parsed.accessToken || !parsed.user) return null
    return parsed as AdminSession
  } catch {
    return null
  }
}

export function saveStoredSession(session: AdminSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearStoredSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}
