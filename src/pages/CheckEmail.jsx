import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store'
import { useToastStore } from '../store/toast-store'
import { api } from '../lib/api'
import { Container } from '../components/ui/Container'
import { Mail, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { generateVerificationEmail } from '../lib/utils/verification-email'
import './CheckEmail.css'

export function CheckEmail() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [resending, setResending] = useState(false)
  
  // Get the return path from location state, or default to home
  const getReturnPath = () => {
    const stateFrom = location.state?.from
    if (stateFrom) return stateFrom
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
  
  const preservedState = getPreservedState()

  useEffect(() => {
    // Check if we just signed up (from navigation state)
    const justSignedUp = location.state?.justSignedUp
    
    // If user is not logged in and we didn't just sign up, redirect to login
    if (!user && !justSignedUp) {
      const returnPath = getReturnPath()
      navigate('/login', { replace: true, state: { from: returnPath, ...preservedState } })
      return
    }

    // If user exists and email is already verified, redirect to complete profile or return path
    if (user && user.email_verified_at) {
      const returnPath = getReturnPath()
      if (!user.profile_completed) {
        navigate('/complete-profile', { replace: true, state: { from: returnPath, ...preservedState } })
      } else {
        navigate(returnPath, { replace: true, state: preservedState })
      }
    }
  }, [user, navigate, location])

  // Don't render if user is verified (but allow rendering if user is null but we just signed up)
  if (user && user.email_verified_at) {
    return null
  }
  
  // If no user and we didn't just sign up, don't render (will redirect in useEffect)
  if (!user && !location.state?.justSignedUp) {
    return null
  }

  const handleResendEmail = async () => {
    if (!user || !user.email) {
      addToast({ message: t('auth.unableToResendEmail') || 'Unable to resend email', type: 'error' })
      return
    }

    setResending(true)
    try {
      // Create new email verification
      const { verificationLink } = await api.createEmailVerification(user.id, user.email)
      
      // Send verification email
      const emailHtml = generateVerificationEmail(user.name || null, verificationLink)
      await api.sendEmail(
        user.email,
        'no-reply@chessbd.app',
        'Verify Your Email - Welcome to ChessBD!',
        emailHtml
      )
      
      addToast({ 
        message: t('auth.emailResent') || 'Verification email sent! Please check your inbox.', 
        type: 'success' 
      })
    } catch (error) {
      console.error('[CheckEmail] Failed to resend verification email:', error)
      addToast({ 
        message: t('auth.emailResendFailed') || 'Failed to resend email. Please try again later.', 
        type: 'error' 
      })
    } finally {
      setResending(false)
    }
  }

  return (
    <Container>
      <div className="check-email-container">
        <div className="check-email-content">
          {/* Hero Section */}
          <section className="check-email-hero">
            <div className="check-email-hero-content">
              <p className="check-email-subtitle">
                Email Verification
              </p>
              <h1 className="check-email-title">
                {t('auth.checkEmailTitle') || 'Verify Email'}
              </h1>
              <p className="check-email-description">
                {t('auth.checkEmailMessage') || 'We\'ve sent a verification link to your email address.'}
              </p>
            </div>
          </section>

          {/* Main Card */}
          <div className="check-email-card-wrapper">
            <div className="check-email-card">
              {/* Email Icon */}
              <div className="check-email-icon-wrapper">
                <div className="check-email-icon-bg"></div>
                <div className="check-email-icon">
                  <Mail className="check-email-icon-svg" />
                </div>
              </div>

              {/* Email Address */}
              <div className="check-email-address">
                <p className="check-email-address-label">Verification email sent to:</p>
                <p className="check-email-address-value">{user?.email || 'your email'}</p>
              </div>

              {/* What to do next */}
              <div className="check-email-info-box">
                <div className="check-email-info-box-bg"></div>
                <div className="check-email-info-box-content">
                  <div className="check-email-info-box-header">
                    <CheckCircle2 className="check-email-info-icon" />
                    <p className="check-email-info-title">
                      {t('auth.whatToDoNext') || 'What to do next:'}
                    </p>
                  </div>
                  <ol className="check-email-info-list">
                    <li>{t('auth.checkInbox') || 'Check your inbox for an email from ChessBD'}</li>
                    <li>{t('auth.clickVerificationLink') || 'Click the verification link in the email'}</li>
                    <li>{t('auth.returnToCompleteProfile') || 'Return here to complete your profile'}</li>
                  </ol>
                </div>
              </div>

              {/* Didn't receive email */}
              <div className="check-email-info-box">
                <div className="check-email-info-box-bg"></div>
                <div className="check-email-info-box-content">
                  <div className="check-email-info-box-header">
                    <AlertCircle className="check-email-info-icon" />
                    <p className="check-email-info-title">
                      {t('auth.didntReceiveEmail') || 'Didn\'t receive the email?'}
                    </p>
                  </div>
                  <ul className="check-email-info-list check-email-info-list-disc">
                    <li>{t('auth.checkSpamFolder') || 'Check your spam/junk folder'}</li>
                    <li>{t('auth.verifyEmailAddress') || 'Make sure you entered the correct email address'}</li>
                    <li>{t('auth.emailMayTakeTime') || 'The email may take a few minutes to arrive'}</li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="check-email-actions">
                <button
                  onClick={() => navigate('/')}
                  className="check-email-btn check-email-btn-secondary"
                >
                  <ArrowLeft className="check-email-btn-icon" />
                  <span>{t('auth.backToHome') || 'Back to Home'}</span>
                </button>
                <button
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="check-email-btn check-email-btn-primary"
                >
                  {resending ? (
                    <div className="check-email-spinner"></div>
                  ) : (
                    <>
                      <RefreshCw className="check-email-btn-icon" />
                      <span>{t('auth.resendEmail') || 'Send Email Again'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

