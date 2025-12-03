import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth-store'
import { useToastStore } from '../store/toast-store'
import { UserPlus } from 'lucide-react'
import { Container } from '../components/ui/Container'
import { useLanguage } from '../contexts/LanguageContext'
import { generateVerificationEmail } from '../lib/utils/verification-email'
import { generateWelcomeEmail } from '../lib/utils/welcome-email'
import './Signup.css'

export function Signup() {
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
  
  const from = getReturnPath()
  const preservedState = getPreservedState()

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

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

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Check if user already exists by email (to merge accounts - reverse case)
      let profile = await api.getUser(user.uid)
      let isNewAccount = false
      
      if (!profile && user.email) {
        const existingUser = await api.getUserByEmail(user.email)
        if (existingUser) {
          // User exists with Google, but signed up with email/password (different UID)
          // Use the existing profile (merged account)
          profile = existingUser
          addToast({ 
            message: t('auth.accountLinkedEmailPassword') || 'Account linked successfully', 
            type: 'success' 
          })
        }
      }

      if (!profile) {
        // Create user profile
        isNewAccount = true
        profile = {
          id: user.uid,
          email: user.email,
          name: null,
          location: null,
          chesscom_username: null,
          verified_at: null,
          email_verified_at: null, // Will be set when user clicks verification link
          is_admin: false,
          profile_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        await api.updateUser(user.uid, profile)
        
        // Send custom email verification (fire and forget - don't block navigation)
        const userEmail = user.email
        // Send email asynchronously without blocking navigation
        ;(async () => {
          try {
            const { verificationLink } = await api.createEmailVerification(user.uid, userEmail)
            const emailHtml = generateVerificationEmail(null, verificationLink)
            await api.sendEmail(
              userEmail,
              'no-reply@chessbd.app',
              'Verify Your Email - Welcome to ChessBD!',
              emailHtml
            )
          } catch (emailError) {
            // Log error but don't affect user experience
            console.error('[Signup] Failed to send verification email:', emailError)
          }
        })()
      }
      
      setUser(profile)
      
      // For email/password signups, redirect to check email page
      // Use setTimeout to ensure Zustand store is updated before navigation
      if (isNewAccount) {
        setTimeout(() => {
          navigate('/check-email', { replace: true, state: { from, justSignedUp: true, ...preservedState } })
        }, 0)
      } else {
        // For merged accounts, go to complete profile
        navigate('/complete-profile', { state: { from, ...preservedState } })
      }
    } catch (error) {
      // Handle specific Firebase errors with user-friendly messages
      if (error.code === 'auth/email-already-in-use') {
        addToast({ 
          message: t('auth.accountExistsSignIn') || t('auth.emailAlreadyInUse') || 'This email is already registered. Please sign in instead.',
          type: 'error' 
        })
      } else if (error.code === 'auth/invalid-email') {
        addToast({ 
          message: t('auth.invalidEmail') || 'Invalid email address.',
          type: 'error' 
        })
      } else if (error.code === 'auth/weak-password') {
        addToast({ 
          message: t('auth.weakPassword') || 'Password is too weak. Please use a stronger password.',
          type: 'error' 
        })
      } else {
        addToast({ message: error.message || t('auth.toast.failedToCreateAccount') || t('auth.toast.failedToSignUp') || 'Failed to create account', type: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setLoading(true)
    try {
      if (!auth) {
        addToast({ message: t('auth.firebaseNotConfigured') || 'Firebase not configured', type: 'info' })
        return
      }

      const provider = new GoogleAuthProvider()
      const userCredential = await signInWithPopup(auth, provider)
      const user = userCredential.user

      // Validate Gmail-only email
      if (user.email) {
        const normalizedEmail = user.email.toLowerCase().trim()
        if (!normalizedEmail.endsWith('@gmail.com')) {
          addToast({ 
            message: t('auth.onlyGmailAllowed') || 'Only Gmail addresses are allowed', 
            type: 'error' 
          })
          setLoading(false)
          return
        }
      }

      // Check if user already exists by UID
      let existingProfile = await api.getUser(user.uid)
      
      // If no profile by UID, check if user exists by email (to merge accounts)
      if (!existingProfile && user.email) {
        const existingUser = await api.getUserByEmail(user.email)
        if (existingUser) {
          // User exists with email/password, but signed in with Google (different UID)
          // Use the existing profile (merged account)
          existingProfile = existingUser
          addToast({ 
            message: t('auth.accountLinkedGoogle') || 'Account linked successfully', 
            type: 'success' 
          })
        }
      }

      if (existingProfile) {
        setUser(existingProfile)
        addToast({ message: t('auth.toast.accountAlreadyExists') || t('auth.toast.signedUpWithGoogleSuccessfully') || 'Account created with Google successfully', type: 'success' })
        navigate(existingProfile.profile_completed ? from : '/complete-profile', { state: existingProfile.profile_completed ? preservedState : { from, ...preservedState } })
      } else {
        // Double-check by email before creating a new profile
        // This prevents creating duplicate profiles when accounts are merged
        let existingUserByEmail = null
        if (user.email) {
          try {
            existingUserByEmail = await api.getUserByEmail(user.email)
          } catch (error) {
            console.error('[Signup] Error checking for existing user by email:', error)
          }
        }
        
        if (existingUserByEmail) {
          // Found existing profile - use it instead of creating a duplicate
          setUser(existingUserByEmail)
          addToast({ 
            message: t('auth.accountLinkedGoogle') || 'Account linked successfully', 
            type: 'success' 
          })
          navigate(existingUserByEmail.profile_completed ? from : '/complete-profile', { state: existingUserByEmail.profile_completed ? preservedState : { from, ...preservedState } })
        } else {
          // No existing profile found - safe to create a new one
          const profile = {
            id: user.uid,
            email: user.email,
            name: user.displayName || null,
            location: null,
            chesscom_username: null,
            verified_at: null,
            email_verified_at: new Date().toISOString(), // Google already verified
            is_admin: false,
            profile_completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          await api.updateUser(user.uid, profile)
          setUser(profile)
          
          addToast({ message: t('auth.toast.accountCreatedWithGoogleSuccessfully') || t('auth.toast.signedUpWithGoogleSuccessfully') || 'Account created with Google successfully', type: 'success' })
          
          // Google sign-up doesn't need email verification (Google already verified the email)
          // Send welcome email (fire and forget - don't block navigation)
          const userEmail = user.email
          if (userEmail) {
            // Send email asynchronously without blocking navigation
            ;(async () => {
              try {
                const emailHtml = generateWelcomeEmail(user.displayName || null)
                const result = await api.sendEmail(
                  userEmail,
                  'no-reply@chessbd.app',
                  'Welcome to ChessBD!',
                  emailHtml
                )
                console.log('[Signup] Welcome email sent successfully:', result)
              } catch (emailError) {
                // Log error but don't affect user experience
                console.error('[Signup] Failed to send welcome email:', emailError)
              }
            })()
          }
          
          navigate('/complete-profile', { state: { from, ...preservedState } })
        }
      }
    } catch (error) {
      // Handle Firebase error for account exists with different credential
      if (error.code === 'auth/account-exists-with-different-credential') {
        addToast({ 
          message: t('auth.accountExistsSignIn') || 'Account exists. Please sign in instead.', 
          type: 'error' 
        })
      } else if (error.code === 'auth/popup-closed-by-user') {
        addToast({ 
          message: t('auth.signUpCancelled') || t('auth.signInCancelled') || 'Sign up cancelled', 
          type: 'info' 
        })
      } else if (error.code === 'auth/popup-blocked') {
        addToast({ 
          message: t('auth.popupBlocked') || 'Popup blocked. Please allow popups for this site.', 
          type: 'error' 
        })
      } else {
        addToast({ message: error.message || t('auth.toast.failedToSignUpWithGoogle') || 'Failed to sign up with Google', type: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container>
      <div className="signup-container">
        <div className="signup-content">
          {/* Hero Section */}
          <section className="signup-hero">
            <div className="signup-hero-content">
              <p className="signup-subtitle">
                {t('auth.createAccountSubtitle') || 'Join ChessBD'}
              </p>
              <h1 className="signup-title">
                {t('auth.signUp') || 'Sign Up'}
              </h1>
              <p className="signup-description">
                {t('auth.signupDescription') || 'Create your account to get started'}
              </p>
            </div>
          </section>

          {/* Signup Form Card */}
          <div className="signup-card-wrapper">
            <div className="signup-card">
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={loading}
                className="signup-google-btn"
              >
                {loading ? (
                  <div className="signup-spinner"></div>
                ) : (
                  <>
                    <svg className="google-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>{t('auth.signUpWithGoogle') || 'Sign up with Google'}</span>
                  </>
                )}
              </button>
              
              <div className="signup-divider">
                <div className="signup-divider-text">
                  <span>{t('auth.orContinueWith') || 'Or'}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="signup-form">
                <div className="signup-form-group">
                  <label htmlFor="email" className="signup-label">
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
                    className="signup-input"
                  />
                </div>
                <div className="signup-form-group">
                  <label htmlFor="password" className="signup-label">
                    {t('auth.password') || 'Password'}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder={t('auth.passwordCreatePlaceholder') || 'Create a password (min 6 characters)'}
                    className="signup-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="signup-submit-btn"
                >
                  {loading ? (
                    <div className="signup-spinner"></div>
                  ) : (
                    <>
                      <UserPlus className="signup-icon" size={16} />
                      <span>{t('auth.createAccount') || 'Create Account'}</span>
                    </>
                  )}
                </button>
              </form>

              <div className="signup-terms">
                {t('auth.agreeToTerms') || 'By signing up, you agree to our'}{' '}
                <Link to="/policy" className="signup-link">
                  {t('auth.privacyPolicy') || 'Privacy Policy'}
                </Link>
                {' '}&{' '}
                <Link to="/terms" className="signup-link">
                  {t('auth.termsOfService') || 'Terms of Service'}
                </Link>
              </div>

              <p className="signup-footer">
                {t('auth.alreadyHaveAccount') || 'Already have an account?'}{' '}
                <Link to="/login" state={{ from, ...preservedState }} className="signup-link">
                  {t('auth.signIn') || 'Sign In'}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}
