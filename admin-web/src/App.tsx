import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RoleRoute } from './auth/RoleRoute'
import { AppLayout } from './layout/AppLayout'
import { OwnerLayout } from './layout/OwnerLayout'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { AdminModerationQueuePage } from './pages/AdminModerationQueuePage'
import { AdminRestaurantEditPage } from './pages/AdminRestaurantEditPage'
import { AdminRestaurantManagementPage } from './pages/AdminRestaurantManagementPage'
import { AdminReviewManagementPage } from './pages/AdminReviewManagementPage'
import { AdminUserManagementPage } from './pages/AdminUserManagementPage'
import { AdminCategoryManagementPage } from './pages/AdminCategoryManagementPage'
import { AdminFacilityManagementPage } from './pages/AdminFacilityManagementPage'
import { AdminCuisineManagementPage } from './pages/AdminCuisineManagementPage'
import { OwnerDashboardPage } from './pages/owner/OwnerDashboardPage'
import { OwnerRestaurantEditPage } from './pages/owner/OwnerRestaurantEditPage'
import { OwnerPhotosPage } from './pages/owner/OwnerPhotosPage'
import { OwnerReviewsPage } from './pages/owner/OwnerReviewsPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allow={['admin', 'moderator']} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<AdminDashboardPage />} />
            <Route path="/restaurants" element={<AdminRestaurantManagementPage />} />
            <Route path="/restaurants/new" element={<AdminRestaurantEditPage />} />
            <Route path="/restaurants/:id" element={<AdminRestaurantEditPage />} />
            <Route path="/moderation" element={<AdminModerationQueuePage />} />
            <Route path="/reviews" element={<AdminReviewManagementPage />} />
            <Route path="/users" element={<AdminUserManagementPage />} />
            <Route path="/categories" element={<AdminCategoryManagementPage />} />
            <Route path="/facilities" element={<AdminFacilityManagementPage />} />
            <Route path="/cuisines" element={<AdminCuisineManagementPage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute allow={['owner']} />}>
          <Route element={<OwnerLayout />}>
            <Route path="/owner" element={<OwnerDashboardPage />} />
            <Route path="/owner/info" element={<OwnerRestaurantEditPage />} />
            <Route path="/owner/photos" element={<OwnerPhotosPage />} />
            <Route path="/owner/reviews" element={<OwnerReviewsPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
