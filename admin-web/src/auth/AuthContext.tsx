/**
 * Admin Portal auth state (Module 2 — Authentication, screen 28).
 *
 * The backend has no separate "admin login" endpoint — `/auth/login` is
 * shared with the mobile app and returns a token for ANY valid credential
 * pair, regardless of role. It is this admin frontend's job to refuse to
 * establish a session for any role other than `admin`/`moderator`, with a
 * distinct message rather than the generic "wrong credentials" error (per
 * docs/build-prompts/02-auth.md, "Admin web — Admin Login only").
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthResponse, RoleCode } from '@foodmap/shared-types'
import { apiClient } from '../api/client'
import { clearStoredSession, loadStoredSession, saveStoredSession } from './session'
import type { AdminSession } from './session'

const ADMIN_PORTAL_ROLES: ReadonlySet<RoleCode> = new Set(['admin', 'moderator'])

/** Thrown by `login()` when credentials are valid but the role may not use the admin portal. */
export class NotAuthorizedForAdminError extends Error {
  constructor() {
    super('Tài khoản này không có quyền truy cập Admin Portal.')
    this.name = 'NotAuthorizedForAdminError'
  }
}

interface AuthContextValue {
  session: AdminSession | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(() => loadStoredSession())

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient.post<AuthResponse>('/auth/login', { email, password })

    if (!ADMIN_PORTAL_ROLES.has(response.user.role)) {
      // Deliberately do not store the token or set session state — an
      // authenticated-but-unauthorized account must not be logged into the
      // admin app at all.
      throw new NotAuthorizedForAdminError()
    }

    const nextSession: AdminSession = { accessToken: response.accessToken, user: response.user }
    saveStoredSession(nextSession)
    setSession(nextSession)
  }, [])

  const logout = useCallback(() => {
    clearStoredSession()
    setSession(null)
  }, [])

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
