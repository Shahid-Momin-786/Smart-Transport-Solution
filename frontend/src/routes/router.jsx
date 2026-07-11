import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

// Layouts
import AuthLayout from '@/layouts/AuthLayout'
import PassengerLayout from '@/layouts/PassengerLayout'
import AdminLayout from '@/layouts/AdminLayout'

// Public pages
import LoginPage from '@/pages/public/LoginPage'
import ForgotPasswordPage from '@/pages/public/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/public/ResetPasswordPage'
import RegisterPage from '@/pages/public/RegisterPage'

// Passenger pages
import PassengerDashboard from '@/pages/passenger/Dashboard'
import PassengerRoutes from '@/pages/passenger/Routes'
import BusTimings from '@/pages/passenger/BusTimings'
import PassengerTickets from '@/pages/passenger/Tickets'
import PassengerNotifications from '@/pages/passenger/Notifications'
import PassengerProfile from '@/pages/passenger/Profile'

// Passenger — Pass Management pages
import DailyPass from '@/pages/passenger/passes/DailyPass'
import ApplyPass from '@/pages/passenger/passes/ApplyPass'
import MyApplications from '@/pages/passenger/passes/MyApplications'
import MyPasses from '@/pages/passenger/passes/MyPasses'

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminUsers from '@/pages/admin/Users'
import AdminBuses from '@/pages/admin/Buses'
import AdminRoutes from '@/pages/admin/Routes'
import AdminSchedules from '@/pages/admin/Schedules'
import AdminTickets from '@/pages/admin/Tickets'
import AdminPasses from '@/pages/admin/Passes'
import AdminReports from '@/pages/admin/Reports'
import AdminNotifications from '@/pages/admin/Notifications'
import AdminSettings from '@/pages/admin/Settings'

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="skeleton w-8 h-8 rounded-full" /></div>
  if (!user) return <Navigate to="/" replace />
  if (requiredRole && user.role !== requiredRole && !user.is_superuser) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
  }
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
  return children
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicRoute><AuthLayout /></PublicRoute>,
    children: [
      { index: true, element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    path: '/',
    element: <ProtectedRoute requiredRole="PASSENGER"><PassengerLayout /></ProtectedRoute>,
    children: [
      { path: 'dashboard', element: <PassengerDashboard /> },
      { path: 'routes', element: <PassengerRoutes /> },
      { path: 'bus-timings', element: <BusTimings /> },
      // Legacy redirect: /tracking → /bus-timings
      { path: 'tracking', element: <Navigate to="/bus-timings" replace /> },
      { path: 'tickets', element: <PassengerTickets /> },
      { path: 'notifications', element: <PassengerNotifications /> },
      { path: 'profile', element: <PassengerProfile /> },
      // Pass Management sub-routes
      { path: 'passes', element: <Navigate to="/passes/my" replace /> },
      { path: 'passes/daily', element: <DailyPass /> },
      { path: 'passes/apply', element: <ApplyPass /> },
      { path: 'passes/applications', element: <MyApplications /> },
      { path: 'passes/my', element: <MyPasses /> },
    ],
  },
  {
    path: '/admin',
    element: <ProtectedRoute requiredRole="ADMIN"><AdminLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'users', element: <AdminUsers /> },
      { path: 'buses', element: <AdminBuses /> },
      { path: 'routes', element: <AdminRoutes /> },
      { path: 'schedules', element: <AdminSchedules /> },
      { path: 'tickets', element: <AdminTickets /> },
      { path: 'passes', element: <AdminPasses /> },
      { path: 'reports', element: <AdminReports /> },
      { path: 'notifications', element: <AdminNotifications /> },
      { path: 'settings', element: <AdminSettings /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

export default router
