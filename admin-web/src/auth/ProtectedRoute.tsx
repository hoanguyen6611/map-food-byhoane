/**
 * Route guard for the Admin Portal shell (Module 2 — Authentication).
 *
 * Any route nested under this element requires a stored admin/moderator
 * session; otherwise the visitor is bounced to `/login`. `replace` avoids
 * polluting history with the page they were denied.
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
