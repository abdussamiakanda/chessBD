import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store'
import { PageLoader } from './ui/PageLoader'

/**
 * ProtectedRoute component that redirects users to complete-profile
 * if their profile is not completed (and email is verified)
 */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Don't redirect while loading
    if (loading) return

    if (!user) {
      // Not logged in, redirect to login
      navigate('/login', { replace: true, state: { from: location.pathname } })
      return
    }

    if (!user.email_verified_at) {
      // Logged in but email not verified, redirect to check email
      navigate('/check-email', { replace: true, state: { from: location.pathname } })
      return
    }

    // If user is logged in and email is verified but profile is not completed
    // Redirect to complete-profile (unless already there)
    if (user && user.email_verified_at && !user.profile_completed) {
      if (location.pathname !== '/complete-profile') {
        navigate('/complete-profile', { 
          replace: true, 
          state: { from: location.pathname } 
        })
      }
    }
  }, [user, loading, navigate, location])

  // Show loading animation while checking auth state
  if (loading) {
    return <PageLoader />
  }

  // Don't render children if redirecting
  if (!user) {
    return <PageLoader />
  }

  if (!user.email_verified_at) {
    return <PageLoader />
  }

  if (user && user.email_verified_at && !user.profile_completed) {
    if (location.pathname !== '/complete-profile') {
      return <PageLoader />
    }
  }

  return children
}

