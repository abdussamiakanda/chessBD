import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { 
  Play, Target, GraduationCap, Users, Info, 
  Swords, Cpu, Puzzle, Bot, Brain,
  Calendar, Sparkles, Trophy,
  BookOpen, Video,
  MapPin, Club, MessageSquare, Newspaper,
  Briefcase, Search, Menu, X, ChevronDown,
  Settings, User as UserIcon, LayoutDashboard, LogOut
} from 'lucide-react'
import { Logo } from './ui/Logo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeSwitcher } from './ThemeSwitcher'
import { SearchBar } from './SearchBar'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuthStore } from '../store/auth-store'
import { auth } from '../lib/firebase'
import './Navbar.css'

/**
 * Main Navigation Component
 * Features:
 * - Desktop sidebar navigation with collapsible dropdowns
 * - Mobile-responsive top bar with hamburger menu
 * - Keyboard navigation support
 * - Accessible ARIA labels
 * - Smooth animations and transitions
 */
function Navbar() {
  const { t } = useLanguage()
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const handleSignOut = async () => {
    if (auth) {
      const { signOut: firebaseSignOut } = await import('firebase/auth')
      await firebaseSignOut(auth)
    }
    await signOut()
    navigate('/')
    setShowMobileMenu(false)
    setShowUserMenu(false)
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const target = e.target
      if (!target.closest('[data-dropdown]') && !target.closest('.navbar-user-menu-wrapper') && !target.closest('.navbar-mobile-user-avatar')) {
        setActiveDropdown(null)
        setShowUserMenu(false)
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null)
        setShowUserMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [activeDropdown, showUserMenu])

  // Close mobile menu when clicking outside or pressing Escape
  useEffect(() => {
    if (showMobileMenu) {
      const handleClickOutside = (e) => {
        const target = e.target
        if (!target.closest('nav')) {
          setShowMobileMenu(false)
        }
      }
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          setShowMobileMenu(false)
        }
      }
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('click', handleClickOutside)
        document.removeEventListener('keydown', handleEscape)
        document.body.style.overflow = ''
      }
    }
  }, [showMobileMenu])

  // Keyboard navigation for dropdowns
  const handleDropdownKeyDown = useCallback((e, itemId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setActiveDropdown(activeDropdown === itemId ? null : itemId)
    } else if (e.key === 'Escape') {
      setActiveDropdown(null)
    }
  }, [activeDropdown])

  // Keyboard shortcut for search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl+K (Windows/Linux) or Cmd+K (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
        setActiveDropdown(null)
      }
      // Also support Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showSearch])

  // Detect if Mac for keyboard shortcut display
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

  // Helper function to check if a path is active
  const isPathActive = useCallback((path) => {
    if (!path) return false
    const currentPath = location.pathname
    // Exact match
    if (currentPath === path) return true
    // Handle puzzles route
    if (path === '/puzzles' && currentPath === '/puzzles') return true
    // Check if current path starts with the nav path (for nested routes)
    if (currentPath.startsWith(path) && path !== '/') return true
    return false
  }, [location.pathname])

  // Check if any child item in a nav group is active
  const hasActiveChild = useCallback((items) => {
    return items.some(item => isPathActive(item.path))
  }, [isPathActive])

  const navItems = [
    {
      id: 'play',
      labelKey: 'nav.play',
      icon: Play,
      items: [
        { path: '/arena', labelKey: 'nav.arena', icon: Swords },
        { path: '/engine', labelKey: 'nav.engine', icon: Cpu },
        { path: '/puzzles', labelKey: 'nav.puzzles', icon: Puzzle },
        { path: '/bots', labelKey: 'nav.bots', icon: Bot },
        { path: '/analysis', labelKey: 'nav.analysis', icon: Brain },
      ]
    },
    {
      id: 'compete',
      labelKey: 'nav.compete',
      icon: Target,
      items: [
        { path: '/events', labelKey: 'nav.events', icon: Calendar },
        { path: '/showcase', labelKey: 'nav.showcase', icon: Sparkles },
        { path: '/leaderboard', labelKey: 'nav.leaderboard', icon: Trophy },
      ]
    },
    {
      id: 'learn',
      labelKey: 'nav.learn',
      icon: GraduationCap,
      items: [
        { path: '/learn', labelKey: 'nav.learn', icon: BookOpen },
        { path: '/watch', labelKey: 'nav.watch', icon: Video },
      ]
    },
    {
      id: 'community',
      labelKey: 'nav.community',
      icon: Users,
      items: [
        { path: '/locations', labelKey: 'nav.locations', icon: MapPin },
        { path: '/clubs', labelKey: 'nav.clubs', icon: Club },
        { path: '/forum', labelKey: 'nav.forum', icon: MessageSquare },
        { path: '/news', labelKey: 'nav.news', icon: Newspaper },
      ]
    },
    {
      id: 'info',
      labelKey: 'nav.info',
      icon: Info,
      items: [
        { path: '/about', labelKey: 'nav.about', icon: Info },
        { path: '/jobs', labelKey: 'nav.jobs', icon: Briefcase },
      ]
    },
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="navbar-desktop" role="navigation">
        {/* Logo Section */}
        <div className="navbar-logo-section">
          <Link to="/" className="navbar-logo-link">
            <div className="navbar-logo-icon-wrapper">
              <Logo className="navbar-logo-icon" style={{ color: 'var(--color-text-primary)' }} />
            </div>
            <span className="navbar-logo-text">ChessBD</span>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="navbar-nav-section">
          <div className="navbar-nav-list">
            {navItems.map((item) => {
              const isExpanded = activeDropdown === item.id
              const Icon = item.icon
              const hasActive = hasActiveChild(item.items)
              
              return (
                <div key={item.id} className="navbar-dropdown" data-dropdown>
                  <button
                    onClick={() => setActiveDropdown(isExpanded ? null : item.id)}
                    onKeyDown={(e) => handleDropdownKeyDown(e, item.id)}
                    className={`navbar-dropdown-btn ${isExpanded || hasActive ? 'active' : ''}`}
                    aria-expanded={isExpanded}
                    aria-haspopup="true"
                    aria-label={`${t(item.labelKey)} menu`}
                  >
                    <div>
                      <Icon className="navbar-icon" size={20} aria-hidden="true" />
                      <span className="navbar-dropdown-label">{t(item.labelKey)}</span>
                    </div>
                    <ChevronDown 
                      className={`navbar-chevron-icon ${isExpanded ? 'expanded' : ''}`} 
                      size={16}
                      aria-hidden="true"
                    />
                  </button>
                  
                  {isExpanded && (
                    <div className="navbar-dropdown-menu">
                      {item.items.map((subItem) => {
                        const SubIcon = subItem.icon
                        const isActive = isPathActive(subItem.path)
                        return (
                          <Link
                            key={subItem.path}
                            to={subItem.path}
                            onClick={() => setActiveDropdown(null)}
                            className={`navbar-dropdown-item ${isActive ? 'active' : ''}`}
                            aria-label={t(subItem.labelKey)}
                          >
                            <SubIcon className="navbar-icon" size={16} aria-hidden="true" />
                            <span>{t(subItem.labelKey)}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom Section - Search, User */}
        <div className="navbar-bottom-section">
          {/* Search */}
          <button 
            className="navbar-search-btn"
            onClick={() => {
              setShowSearch(true)
              setActiveDropdown(null)
            }}
            aria-label={t('common.search')}
            title={`${t('common.search')} (⌘K or Ctrl+K)`}
          >
            <div className="navbar-search-btn-content">
              <Search className="navbar-icon" size={20} aria-hidden="true" />
              <span>{t('common.search')}</span>
            </div>
            <kbd className="navbar-kbd" aria-label="Keyboard shortcut">
              {isMac ? (
                <>
                  <span>⌘</span>
                  <span>K</span>
                </>
              ) : (
                <>
                  <span>Ctrl</span>
                  <span>K</span>
                </>
              )}
            </kbd>
          </button>

          {/* Language Switcher and Theme Switcher */}
          <div className="navbar-switchers">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>

          {/* User Section */}
          {user && user.email_verified_at ? (
            <div className="navbar-user-section">
              <div className="navbar-user-menu-wrapper">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="navbar-user-btn"
                >
                  <div className="navbar-user-avatar">
                    {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="navbar-user-info">
                    <p className="navbar-user-name">{user.name || user.email}</p>
                    <p className="navbar-user-label">{t('nav.profile')}</p>
                  </div>
                  <ChevronDown 
                    className={`navbar-user-chevron ${showUserMenu ? 'expanded' : ''}`} 
                    size={16}
                  />
                </button>
                {showUserMenu && (
                  <div className="navbar-user-dropdown">
                    <Link
                      to="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="navbar-user-dropdown-item"
                    >
                      <Settings className="navbar-icon" size={16} />
                      <span>{t('nav.settings')}</span>
                    </Link>
                    {user.chesscom_username && user.verified_at && (
                      <Link
                        to={`/player/${user.chesscom_username}`}
                        onClick={() => setShowUserMenu(false)}
                        className="navbar-user-dropdown-item"
                      >
                        <UserIcon className="navbar-icon" size={16} />
                        <span>{t('nav.profile')}</span>
                      </Link>
                    )}
                    {user.is_admin && (
                      <Link
                        to="/dashboard"
                        onClick={() => setShowUserMenu(false)}
                        className="navbar-user-dropdown-item"
                      >
                        <LayoutDashboard className="navbar-icon" size={16} />
                        <span>{t('nav.dashboard')}</span>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        handleSignOut()
                      }}
                      className="navbar-user-dropdown-item navbar-user-logout"
                    >
                      <LogOut className="navbar-icon" size={16} />
                      <span>{t('nav.logout')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="navbar-user-section">
              <button 
                className="btn-login"
                aria-label={t('nav.login')}
                onClick={() => {
                  const currentPath = location.pathname + location.search + location.hash
                  navigate('/login', { state: { from: currentPath } })
                }}
              >
                {t('nav.login')}
              </button>
              <button 
                className="btn-signup"
                aria-label={t('nav.signup')}
                onClick={() => {
                  const currentPath = location.pathname + location.search + location.hash
                  navigate('/signup', { state: { from: currentPath } })
                }}
              >
                {t('nav.signup')}
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Top Bar */}
      <nav className="navbar-mobile" role="navigation">
        <div className="navbar-mobile-container">
          <Link to="/" className="navbar-mobile-logo">
            <Logo className="navbar-mobile-logo-icon" size={28} style={{ color: 'var(--color-text-primary)' }} />
            <span>ChessBD</span>
          </Link>
          
          <div className="navbar-mobile-actions">
            {user && user.email_verified_at && (
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu)
                  setShowMobileMenu(false)
                }}
                className="navbar-mobile-user-avatar"
              >
                {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMobileMenu(!showMobileMenu)
              }}
              className="navbar-mobile-toggle"
              aria-label={t('nav.toggleMenu')}
            >
              {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {showMobileMenu && (
          <div className="navbar-mobile-menu">
            <div className="navbar-mobile-menu-content">
              {navItems.map((item) => {
                const isExpanded = activeDropdown === item.id
                const Icon = item.icon
                const hasActive = hasActiveChild(item.items)
                
                return (
                  <div key={item.id} className="navbar-mobile-dropdown" data-dropdown>
                    <button
                      onClick={() => setActiveDropdown(isExpanded ? null : item.id)}
                      onKeyDown={(e) => handleDropdownKeyDown(e, item.id)}
                      className={`navbar-mobile-dropdown-btn ${isExpanded || hasActive ? 'active' : ''}`}
                      aria-expanded={isExpanded}
                      aria-haspopup="true"
                      aria-label={`${t(item.labelKey)} menu`}
                    >
                      <Icon className="navbar-icon" size={20} aria-hidden="true" />
                      <span>{t(item.labelKey)}</span>
                      <ChevronDown 
                        className={`navbar-chevron-icon ${isExpanded ? 'expanded' : ''}`} 
                        size={16}
                        aria-hidden="true"
                      />
                    </button>
                    
                    {isExpanded && (
                      <div className="navbar-mobile-dropdown-menu">
                        {item.items.map((subItem) => {
                          const SubIcon = subItem.icon
                          const isActive = isPathActive(subItem.path)
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              onClick={() => {
                                setShowMobileMenu(false)
                                setActiveDropdown(null)
                              }}
                              className={`navbar-mobile-dropdown-item ${isActive ? 'active' : ''}`}
                              aria-label={t(subItem.labelKey)}
                            >
                              <SubIcon className="navbar-icon" size={16} aria-hidden="true" />
                              <span>{t(subItem.labelKey)}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              
              <div className="navbar-mobile-actions-section">
                <button
                  onClick={() => {
                    setShowSearch(true)
                    setShowMobileMenu(false)
                  }}
                  className="navbar-mobile-search-btn"
                  aria-label={t('common.search')}
                >
                  <Search className="navbar-icon" size={20} aria-hidden="true" />
                  <span>{t('common.search')}</span>
                  <kbd className="navbar-kbd" aria-label="Keyboard shortcut">
                    {isMac ? (
                      <>
                        <span>⌘</span>
                        <span>K</span>
                      </>
                    ) : (
                      <>
                        <span>Ctrl</span>
                        <span>K</span>
                      </>
                    )}
                  </kbd>
                </button>
                <div className="navbar-mobile-switchers">
                  <LanguageSwitcher />
                  <ThemeSwitcher />
                </div>
                {!user || !user.email_verified_at ? (
                  <>
                    <button 
                      className="btn-login"
                      aria-label={t('nav.login')}
                      onClick={() => {
                        const currentPath = location.pathname + location.search + location.hash
                        navigate('/login', { state: { from: currentPath } })
                        setShowMobileMenu(false)
                      }}
                    >
                      {t('nav.login')}
                    </button>
                    <button 
                      className="btn-signup"
                      aria-label={t('nav.signup')}
                      onClick={() => {
                        const currentPath = location.pathname + location.search + location.hash
                        navigate('/signup', { state: { from: currentPath } })
                        setShowMobileMenu(false)
                      }}
                    >
                      {t('nav.signup')}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* User Menu for Mobile */}
        {showUserMenu && user && user.email_verified_at && (
          <div className="navbar-mobile-user-menu">
            <Link
              to="/settings"
              onClick={() => {
                setShowUserMenu(false)
                setShowMobileMenu(false)
              }}
              className="navbar-mobile-user-menu-item"
            >
              <Settings className="navbar-icon" size={16} />
              <span>{t('nav.settings')}</span>
            </Link>
            {user.chesscom_username && user.verified_at && (
              <Link
                to={`/player/${user.chesscom_username}`}
                onClick={() => {
                  setShowUserMenu(false)
                  setShowMobileMenu(false)
                }}
                className="navbar-mobile-user-menu-item"
              >
                <UserIcon className="navbar-icon" size={16} />
                <span>{t('nav.profile')}</span>
              </Link>
            )}
            {user.is_admin && (
              <Link
                to="/dashboard"
                onClick={() => {
                  setShowUserMenu(false)
                  setShowMobileMenu(false)
                }}
                className="navbar-mobile-user-menu-item"
              >
                <LayoutDashboard className="navbar-icon" size={16} />
                <span>{t('nav.dashboard')}</span>
              </Link>
            )}
            <button
              onClick={() => {
                setShowUserMenu(false)
                handleSignOut()
              }}
              className="navbar-mobile-user-menu-item navbar-mobile-user-logout"
            >
              <LogOut className="navbar-icon" size={16} />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        )}

        {/* Mobile Overlay */}
        {(showMobileMenu || showUserMenu) && (
          <div
            className="navbar-mobile-overlay"
            onClick={() => {
              setShowMobileMenu(false)
              setShowUserMenu(false)
            }}
          />
        )}
      </nav>

      {/* Search Overlay */}
      {showSearch && (
        <div 
          className="navbar-search-overlay"
          onClick={() => setShowSearch(false)}
        >
          <div 
            className="navbar-search-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="navbar-search-modal-header">
              <h2 className="navbar-search-modal-title">{t('common.search')}</h2>
              <button
                onClick={() => setShowSearch(false)}
                className="navbar-search-modal-close"
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>
            <div className="navbar-search-modal-content">
              <SearchBar onClose={() => setShowSearch(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Navbar

