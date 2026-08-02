/**
 * Screen 28 — Admin Login (docs/04-screen-list.md §28).
 *
 * Reuses the shared `/auth/login` endpoint (there is no admin-only login
 * endpoint on the backend) but this page is the gatekeeper: only
 * `admin`/`moderator` roles are allowed to establish an admin-portal
 * session (see `../auth/AuthContext.tsx`). Any other role gets a distinct,
 * clear "not authorized for admin portal" message instead of the generic
 * credentials error, and is never logged into the admin app.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { NotAuthorizedForAdminError, useAuth } from '../auth/AuthContext'

export function AdminLoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notAuthorized, setNotAuthorized] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setErrorMessage(null)
    setNotAuthorized(false)
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof NotAuthorizedForAdminError) {
        setNotAuthorized(true)
      } else if (err instanceof ApiError) {
        // Backend's generic credentials-failure message (or another API
        // error) — surfaced as-is, never more specific than what the
        // backend chose to reveal.
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Không thể kết nối máy chủ. Vui lòng thử lại.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page page-login">
      <h1>Đăng nhập Quản trị</h1>
      <p>Dành cho quản trị viên và moderator.</p>
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <label className="login-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            disabled={isSubmitting}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="login-field">
          <span>Mật khẩu</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={isSubmitting}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {notAuthorized && (
          <p className="login-error login-error-not-authorized" role="alert">
            Tài khoản này không có quyền truy cập Admin Portal.
          </p>
        )}
        {errorMessage && (
          <p className="login-error" role="alert">
            {errorMessage}
          </p>
        )}

        <button type="submit" className="login-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}
