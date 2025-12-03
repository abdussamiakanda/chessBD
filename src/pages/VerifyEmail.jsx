import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useToastStore } from '../store/toast-store'
import { useAuthStore } from '../store/auth-store'
import { Container } from '../components/ui/Container'
import { CheckCircle2, XCircle, Loader2, LogIn, UserPlus } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import './VerifyEmail.css'

export function VerifyEmail() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { addToast } = useToastStore()
  const { setUser, user, signOut } = useAuthStore()
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (!token) {
      setStatus('error')
      setMessage(t('auth.invalidVerificationLink') || 'Invalid verification link')
      return
    }

    // Check if user is logged in
    if (!user) {
      // Redirect to login with verify-email URL as return path
      const verifyEmailUrl = `/verify-email?token=${token}`
      navigate('/login', { replace: true, state: { from: verifyEmailUrl } })
      return
    }

    const verifyEmail = async () => {
      try {
        const result = await api.verifyEmail(token)
        
        if (result.success) {
          setStatus('success')
          setMessage(result.message)
          addToast({ message: result.message, type: 'success' })
          
          // Refresh user data to get updated email_verified_at
          if (result.userId) {
            try {
              const updatedUser = await api.getUser(result.userId)
              if (updatedUser) {
                setUser(updatedUser)
              }
            } catch (error) {
              console.error('Failed to refresh user data:', error)
            }
          }
          
          // Redirect to complete profile after 2 seconds
          setTimeout(() => {
            navigate('/complete-profile')
          }, 2000)
        } else {
          setStatus('error')
          // Translate common error messages
          let translatedMessage = result.message
          if (result.message === 'Invalid or already used verification token') {
            translatedMessage = t('auth.invalidOrUsedVerificationToken') || result.message
          } else if (result.message === 'Verification token has expired') {
            translatedMessage = t('auth.verificationTokenExpired') || result.message
          } else {
            // Try to translate the message if it matches a translation key
            translatedMessage = t(`auth.${result.message}`) || result.message
          }
          setMessage(translatedMessage)
          addToast({ message: translatedMessage, type: 'error' })
        }
      } catch (error) {
        setStatus('error')
        const errorMessage = error.message || t('auth.failedToVerifyEmail') || 'Failed to verify email'
        setMessage(errorMessage)
        addToast({ message: errorMessage, type: 'error' })
      }
    }

    verifyEmail()
  }, [searchParams, navigate, addToast, user, setUser, signOut, t])

  return (
    <Container>
      <div className="verify-email-container">
        <div className="verify-email-content">
          {/* Hero Section */}
          <section className="verify-email-hero">
            <div className="verify-email-hero-content">
              <p className="verify-email-subtitle">
                {t('auth.emailVerification') || 'Email Verification'}
              </p>
              <h1 className="verify-email-title">
                {status === 'loading' 
                  ? (t('auth.verifyingYourEmail') || 'Verifying Email')
                  : status === 'success'
                  ? (t('auth.emailVerified') || 'Email Verified')
                  : (t('auth.verificationFailed') || 'Verification Failed')
                }
              </h1>
              <p className="verify-email-description">
                {status === 'loading'
                  ? (t('auth.pleaseWaitVerifying') || 'Please wait while we verify your email address...')
                  : status === 'success'
                  ? (t('auth.emailVerifiedSuccess') || 'Your email has been successfully verified!')
                  : (t('auth.verificationFailedDescription') || 'We couldn\'t verify your email address. Please try again.')
                }
              </p>
            </div>
          </section>

          {/* Main Card */}
          <div className="verify-email-card-wrapper">
            <div className="verify-email-card">
              {/* Icon */}
              <div className="verify-email-icon-wrapper">
                <div className="verify-email-icon-bg"></div>
                <div className="verify-email-icon">
                  {status === 'loading' && (
                    <Loader2 className="verify-email-icon-svg verify-email-icon-spin" />
                  )}
                  {status === 'success' && (
                    <CheckCircle2 className="verify-email-icon-svg verify-email-icon-success" />
                  )}
                  {status === 'error' && (
                    <XCircle className="verify-email-icon-svg verify-email-icon-error" />
                  )}
                </div>
              </div>

              {/* Status Message */}
              {status === 'success' && (
                <div className="verify-email-message">
                  <p className="verify-email-message-text">{message}</p>
                  <p className="verify-email-message-subtext">
                    {t('auth.redirectingToCompleteProfile') || 'Redirecting to complete your profile...'}
                  </p>
                </div>
              )}

              {status === 'error' && (
                <div className="verify-email-message">
                  <p className="verify-email-message-text">{message}</p>
                </div>
              )}

              {/* Action Buttons */}
              {status === 'success' && (
                <div className="verify-email-actions">
                  <Link to="/complete-profile" className="verify-email-link">
                    <button className="verify-email-btn verify-email-btn-primary">
                      <UserPlus className="verify-email-btn-icon" />
                      <span>{t('auth.completeYourProfile') || 'Complete Your Profile'}</span>
                    </button>
                  </Link>
                </div>
              )}

              {status === 'error' && (
                <div className="verify-email-actions">
                  <button
                    onClick={async () => {
                      await signOut()
                      navigate('/signup')
                    }}
                    className="verify-email-btn verify-email-btn-secondary"
                  >
                    <UserPlus className="verify-email-btn-icon" />
                    <span>{t('auth.signUpAgain') || 'Sign Up Again'}</span>
                  </button>
                  <button
                    onClick={async () => {
                      await signOut()
                      navigate('/login')
                    }}
                    className="verify-email-btn verify-email-btn-primary"
                  >
                    <LogIn className="verify-email-btn-icon" />
                    <span>{t('auth.goToLogin') || 'Go to Login'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

