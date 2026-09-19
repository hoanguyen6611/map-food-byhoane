import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route element={<ProtectedRoute />}>
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
    </Routes>
  )
}

export default App
