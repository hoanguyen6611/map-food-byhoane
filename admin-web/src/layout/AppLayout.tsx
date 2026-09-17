import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { NotificationBell } from '../components/NotificationBell'

interface NavItem {
  to: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Tổng quan' },
  { to: '/restaurants', label: 'Quản lý Địa điểm' },
  { to: '/moderation', label: 'Danh sách Phê duyệt' },
  { to: '/reviews', label: 'Quản lý Đánh giá' },
  { to: '/users', label: 'Quản lý Người dùng' },
]

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link nav-link-active' : 'nav-link'
}

export function AppLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">Food Map Admin</div>
        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClassName}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <span>Admin Portal</span>
          <div className="admin-header-user">
            <NotificationBell />
            {session && (
              <span className="admin-header-email" title={session.user.role}>
                {session.user.email}
              </span>
            )}
            <button type="button" className="admin-logout-button" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
