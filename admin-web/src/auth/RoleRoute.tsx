/**
 * Role-scoped branch of the Admin Portal route tree — sits inside
 * `ProtectedRoute` (session already confirmed present) and additionally
 * checks `session.user.role` against `allow`. A session whose role isn't
 * allowed here is redirected to ITS OWN home instead of a blank/forbidden
 * page (owner -> /owner, staff -> /) — see App.tsx for how the staff and
 * owner route trees are split using this.
 */
import { Navigate, Outlet } from 'react-router-dom'
import type { RoleCode } from '@foodmap/shared-types'
import { useAuth } from './AuthContext'

interface Props {
  allow: RoleCode[]
}

export function RoleRoute({ allow }: Props) {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }
  if (!allow.includes(session.user.role)) {
    return <Navigate to={session.user.role === 'owner' ? '/owner' : '/'} replace />
  }

  return <Outlet />
}
