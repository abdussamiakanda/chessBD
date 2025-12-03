import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth-store'
import { PageLoader } from '../ui/PageLoader'

export function AuthGate({ children, requireAdmin = false }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading) {
    return <PageLoader />
  }

  if (!user) {
    navigate('/login', { replace: true, state: { from: location.pathname + location.search + location.hash } })
    return <PageLoader />
  }

  if (requireAdmin && !user.is_admin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-red-600">Access denied. Admin privileges required.</div>
      </div>
    )
  }

  return <>{children}</>
}

