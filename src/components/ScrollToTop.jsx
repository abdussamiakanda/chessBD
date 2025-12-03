import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop component that scrolls to the top of the page
 * on initial load and whenever the route changes
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Scroll to top immediately on mount and route changes
    // Use instant scroll for initial load, smooth for navigation
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant', // Instant scroll for better UX on page load
    })
  }, [pathname])

  // Also ensure page is at top on initial mount
  useEffect(() => {
    // Handle page reload or initial page open
    if (window.history.scrollRestoration) {
      window.history.scrollRestoration = 'manual'
    }
    
    // Scroll to top immediately on mount
    window.scrollTo(0, 0)
  }, [])

  return null
}

