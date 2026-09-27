import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { NotificationBell } from '../components/NotificationBell'
import { OwnerRestaurantProvider, useOwnerRestaurant } from '../owner/OwnerRestaurantContext'

interface NavItem {
  to: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/owner', label: 'Tổng quan' },
  { to: '/owner/info', label: 'Thông tin nhà hàng' },
  { to: '/owner/photos', label: 'Ảnh' },
  { to: '/owner/reviews', label: 'Đánh giá' },
]

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link nav-link-active' : 'nav-link'
}

// Always renders SOMETHING (a <select>, or a plain label) — never `null`.
// `.admin-header` relies on `justify-content: space-between` to push
// `.admin-header-user` to the right; with only one restaurant (the common
// case), this used to return `null`, leaving the header with a single flex
// child — `space-between` then has nothing to distribute space between, so
// the browser places that one child at the flex-start (left) instead,
// putting the notification bell/logout button right next to the sidebar
// instead of the header's right edge.
function HeaderRestaurantLabel() {
  const { restaurants, selected, selectedId, setSelectedId } = useOwnerRestaurant()
  if (restaurants.length > 1) {
    return (
      <select
        className="owner-restaurant-picker"
        value={selectedId ?? ''}
        onChange={(event) => setSelectedId(event.target.value)}
      >
        {restaurants.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    )
  }
  return <span className="owner-restaurant-label">{selected?.name ?? ''}</span>
}

export function OwnerLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <OwnerRestaurantProvider>
      <div className="admin-shell owner-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">Food Map — Chủ quán</div>
          <nav className="admin-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/owner'} className={navLinkClassName}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="admin-main">
          <header className="admin-header">
            <HeaderRestaurantLabel />
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
    </OwnerRestaurantProvider>
  )
}
