import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth-store'
import { useToastStore } from '../store/toast-store'
import { LogIn } from 'lucide-react'
import { Container } from '../components/ui/Container'
import { useLanguage } from '../contexts/LanguageContext'
import './Login.css'

export function Login() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, setUser } = useAuthStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()
  const location = useLocation()

  // Get the return path from location state, or default to home
  const getReturnPath = () => {
    const stateFrom = location.state?.from
    if (stateFrom) return stateFrom
    
    // Fallback: try to get from document.referrer if it's from the same origin
    if (typeof document !== 'undefined' && document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer)
        const currentOrigin = window.location.origin
        if (referrerUrl.origin === currentOrigin) {
          const referrerPath = referrerUrl.pathname + referrerUrl.search + referrerUrl.hash
          // Don't redirect back to login or signup pages
          if (referrerPath && !referrerPath.startsWith('/login') && !referrerPath.startsWith('/signup')) {
            return referrerPath
          }
        }
      } catch (e) {
        // Invalid URL, ignore
      }
    }
    
    return '/'
  }
  
  // Get preserved state (like PGN) from location state
  const getPreservedState = () => {
    const preserved = {}
    if (location.state?.pgn) {
      preserved.pgn = location.state.pgn
    }
    return Object.keys(preserved).length > 0 ? preserved : undefined
  }
  
  // Redirect if user is already logged in
  useEffect(() => {
    if (user && user.email_verified_at) {
      const returnPath = getReturnPath()
      // Don't redirect back to login/signup pages
      if (returnPath && !returnPath.startsWith('/login') && !returnPath.startsWith('/signup')) {
        navigate(returnPath, { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [user, navigate, location])
  
  const from = getReturnPath()
  const preservedState = getPreservedState()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!auth) {
        addToast({ message: t('auth.firebaseNotConfigured') || 'Firebase not configured', type: 'info' })
        navigate('/')
        return
      }

      // Validate Gmail-only email
      const normalizedEmail = email.toLowerCase().trim()
      if (!normalizedEmail.endsWith('@gmail.com')) {
        addToast({ 
          message: t('auth.onlyGmailAllowed') || 'Only Gmail addresses are allowed', 
          type: 'error' 
        })
        setLoading(false)
        return
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user

      // Fetch user profile by UID first
      let profile = await api.getUser(firebaseUser.uid)
      
      // If no profile by UID, check if user exists by email (to merge accounts)
      if (!profile && firebaseUser.email) {
        const existingUser = await api.getUserByEmail(firebaseUser.email)
        if (existingUser) {
          // User exists with Google, but signed in with email/password (different UID)
          // Use the existing profile (merged account)
          profile = existingUser
          addToast({ 
            message: t('auth.accountLinkedEmailPassword') || 'Account linked successfully', 
            type: 'success' 
          })
        }
      }

      if (profile) {
        setUser(profile)
        addToast({ message: t('auth.toast.signedInSuccessfully') || 'Signed in successfully', type: 'success' })
        // If returning to verify-email, prioritize that
        if (from.startsWith('/verify-email')) {
          navigate(from, { replace: true })
        } else if (!profile.email_verified_at) {
          // Email not verified - redirect to check email page
          navigate('/check-email', { replace: true })
        } else if (!profile.profile_completed) {
          // Email verified but profile not completed - go to complete-profile
          navigate('/complete-profile', { state: { from } })
        } else {
          // Profile completed and email verified - proceed normally
          navigate(from, { state: preservedState })
        }
      } else {
        // Create profile if doesn't exist (for email/password login)
        const newProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || null,
          location: null,
          chesscom_username: null,
          verified_at: null,
          email_verified_at: null, // Email/password signup - needs verification
          is_admin: false,
          profile_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        await api.updateUser(firebaseUser.uid, newProfile)
        setUser(newProfile)
        addToast({ message: t('auth.toast.signedInSuccessfully') || 'Signed in successfully', type: 'success' })
        // If returning to verify-email, prioritize that
        if (from.startsWith('/verify-email')) {
          navigate(from, { replace: true })
        } else {
          // For email/password signups, email_verified_at will be null
          // Redirect to check email page if not verified
          navigate('/check-email', { replace: true })
        }
      }
    } catch (error) {
      // Handle Firebase error for account exists with different credential
      if (error.code === 'auth/account-exists-with-different-credential') {
        addToast({ 
          message: t('auth.accountExistsUseGoogle') || 'Account exists. Please use Google sign-in.', 
          type: 'error' 
        })
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        addToast({ 
          message: t('auth.invalidCredentials') || 'Invalid email or password', 
          type: 'error' 
        })
      } else {
        addToast({ message: error.message || t('auth.toast.failedToSignIn') || 'Failed to sign in', type: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      if (!auth) {
        addToast({ message: t('auth.firebaseNotConfigured') || 'Firebase not configured', type: 'info' })
        return
      }

      const provider = new GoogleAuthProvider()
      const userCredential = await signInWithPopup(auth, provider)
      const firebaseUser = userCredential.user

      // Validate Gmail-only email
      if (firebaseUser.email) {
        const normalizedEmail = firebaseUser.email.toLowerCase().trim()
        if (!normalizedEmail.endsWith('@gmail.com')) {
          addToast({ 
            message: t('auth.onlyGmailAllowed') || 'Only Gmail addresses are allowed', 
            type: 'error' 
          })
          setLoading(false)
          return
        }
      }

      // Check if user profile exists by UID first
      let profile = await api.getUser(firebaseUser.uid)
      
      // If no profile by UID, check if user exists by email (to merge accounts)
      if (!profile && firebaseUser.email) {
        const existingUser = await api.getUserByEmail(firebaseUser.email)
        if (existingUser) {
          // User exists with email/password, but signed in with Google (different UID)
          // Use the existing profile (merged account)
          profile = existingUser
          addToast({ 
            message: t('auth.accountLinkedGoogle') || 'Account linked successfully', 
            type: 'success' 
          })
        }
      }

      if (profile) {
        setUser(profile)
        addToast({ message: t('auth.toast.signedInWithGoogleSuccessfully') || 'Signed in with Google successfully', type: 'success' })
        // If returning to verify-email, prioritize that
        if (from.startsWith('/verify-email')) {
          navigate(from, { replace: true })
        } else if (!profile.profile_completed) {
          // Prioritize profile_completed - if false, go to complete-profile
          navigate('/complete-profile', { state: { from, ...preservedState } })
        } else {
          navigate(from, { state: preservedState })
        }
      } else {
        // Double-check by email before creating a new profile
        let existingUserByEmail = null
        if (firebaseUser.email) {
          try {
            existingUserByEmail = await api.getUserByEmail(firebaseUser.email)
          } catch (error) {
            console.error('[Login] Error checking for existing user by email:', error)
          }
        }
        
        if (existingUserByEmail) {
          // Found existing profile - use it instead of creating a duplicate
          setUser(existingUserByEmail)
          addToast({ 
            message: t('auth.accountLinkedGoogle') || 'Account linked successfully', 
            type: 'success' 
          })
          // If returning to verify-email, prioritize that
          if (from.startsWith('/verify-email')) {
            navigate(from, { replace: true })
          } else if (!existingUserByEmail.profile_completed) {
            // Prioritize profile_completed - if false, go to complete-profile
            navigate('/complete-profile', { state: { from, ...preservedState } })
          } else {
            navigate(from, { state: preservedState })
          }
        } else {
          // No existing profile found - safe to create a new one
          const newProfile = {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || null,
            location: null,
            chesscom_username: null,
            verified_at: null,
            email_verified_at: new Date().toISOString(), // Google already verified
            is_admin: false,
            profile_completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          await api.updateUser(firebaseUser.uid, newProfile)
          setUser(newProfile)
          addToast({ message: t('auth.toast.signedInWithGoogleSuccessfully') || 'Signed in with Google successfully', type: 'success' })
          // If returning to verify-email, prioritize that
          if (from.startsWith('/verify-email')) {
            navigate(from, { replace: true })
          } else {
            navigate('/complete-profile', { state: { from } })
          }
        }
      }
    } catch (error) {
      // Handle Firebase error for account exists with different credential
      if (error.code === 'auth/account-exists-with-different-credential') {
        addToast({ 
          message: t('auth.accountExistsUseEmailPassword') || 'Account exists. Please use email/password sign-in.', 
          type: 'error' 
        })
      } else if (error.code === 'auth/popup-closed-by-user') {
        addToast({ 
          message: t('auth.signInCancelled') || 'Sign in cancelled', 
          type: 'info' 
        })
      } else if (error.code === 'auth/popup-blocked') {
        addToast({ 
          message: t('auth.popupBlocked') || 'Popup blocked. Please allow popups for this site.', 
          type: 'error' 
        })
      } else {
        addToast({ message: error.message || t('auth.toast.failedToSignInWithGoogle') || 'Failed to sign in with Google', type: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container>
      <div className="login-container">
        <div className="login-content">
          {/* Hero Section */}
          <section className="login-hero">
            <div className="login-hero-content">
              <p className="login-subtitle">
                {t('auth.welcomeBack') || 'Welcome Back'}
              </p>
              <h1 className="login-title">
                {t('auth.signIn') || 'Sign In'}
              </h1>
              <p className="login-description">
                {t('auth.loginDescription') || 'Sign in to your account to continue'}
              </p>
            </div>
          </section>

          {/* Login Form Card */}
          <div className="login-card-wrapper">
            <div className="login-card">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="login-google-btn"
              >
                {loading ? (
                  <div className="login-spinner"></div>
                ) : (
                  <>
                    <svg className="google-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>{t('auth.signInWithGoogle') || 'Sign in with Google'}</span>
                  </>
                )}
              </button>
              
              <div className="login-divider">
                <div className="login-divider-text">
                  <span>{t('auth.orContinueWith') || 'Or'}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="login-form">
                <div className="login-form-group">
                  <label htmlFor="email" className="login-label">
                    {t('auth.email') || 'Email'}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    pattern="[a-zA-Z0-9._%+-]+@gmail\.com$"
                    title={t('auth.onlyGmailAllowed') || 'Only Gmail addresses are allowed'}
                    placeholder={t('auth.emailPlaceholder') || 'your.email@gmail.com'}
                    className="login-input"
                  />
                </div>
                <div className="login-form-group">
                  <label htmlFor="password" className="login-label">
                    {t('auth.password') || 'Password'}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={t('auth.passwordPlaceholder') || 'Enter your password'}
                    className="login-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="login-submit-btn"
                >
                  {loading ? (
                    <div className="login-spinner"></div>
                  ) : (
                    <>
                      <LogIn className="login-icon" size={16} />
                      <span>{t('auth.signIn') || 'Sign In'}</span>
                    </>
                  )}
                </button>
              </form>

              <p className="login-footer">
                {t('auth.dontHaveAccount') || "Don't have an account?"}{' '}
                <Link to="/signup" state={{ from }} className="login-link">
                  {t('auth.signUp') || 'Sign Up'}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}
