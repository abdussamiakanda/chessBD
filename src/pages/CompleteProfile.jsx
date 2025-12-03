import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store'
import { api } from '../lib/api'
import { useToastStore } from '../store/toast-store'
import { Container } from '../components/ui/Container'
import { User, MapPin, UserCheck } from 'lucide-react'
import { ChesscomIcon } from '../components/ui/ChesscomIcon'
import { LichessIcon } from '../components/ui/LichessIcon'
import { useLanguage } from '../contexts/LanguageContext'
import './CompleteProfile.css'

// Username validation regex
const usernameRegex = /^[a-z0-9_-]+$/

export function CompleteProfile() {
  const { t } = useLanguage()
  const { user, setUser } = useAuthStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get the return path from location state, or default to home
  const from = location.state?.from || '/'
  
  // Get preserved state (like PGN) from location state
  const getPreservedState = () => {
    const preserved = {}
    if (location.state?.pgn) {
      preserved.pgn = location.state.pgn
    }
    return Object.keys(preserved).length > 0 ? preserved : undefined
  }
  
  const preservedState = getPreservedState()
  
  const [name, setName] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [chesscomUsername, setChesscomUsername] = useState('')
  const [lichessUsername, setLichessUsername] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    
    // For email/password signups, require email verification before accessing complete profile
    if (!user.email_verified_at) {
      navigate('/check-email', { replace: true })
      return
    }
  }, [user, navigate])

  if (!user) {
    return null
  }
  
  // Double check after render (in case user state changed)
  if (!user.email_verified_at) {
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate Chess.com username if provided
      if (chesscomUsername.trim()) {
        if (!usernameRegex.test(chesscomUsername.trim().toLowerCase())) {
          addToast({ 
            message: t('settings.usernameValidation') || 'Username can only contain lowercase letters, numbers, hyphens, and underscores', 
            type: 'error' 
          })
          setLoading(false)
          return
        }
      }

      // Validate Lichess username if provided
      if (lichessUsername.trim()) {
        if (!usernameRegex.test(lichessUsername.trim().toLowerCase())) {
          addToast({ 
            message: t('settings.usernameValidation') || 'Username can only contain lowercase letters, numbers, hyphens, and underscores', 
            type: 'error' 
          })
          setLoading(false)
          return
        }
      }

      const updates = {
        name: name.trim() || null,
        name_bn: nameBn.trim() || null,
        location: selectedLocation.trim() || null,
        chesscom_username: chesscomUsername.trim().toLowerCase() || null,
        lichess_username: lichessUsername.trim().toLowerCase() || null,
        profile_completed: true,
      }

      const updatedUser = await api.updateUser(user.id, updates)
      setUser(updatedUser)
      addToast({ message: t('completeProfile.profileCompleted') || 'Profile completed successfully!', type: 'success' })
      navigate('/settings')
    } catch (error) {
      addToast({ message: error.message || t('completeProfile.failedToUpdate') || 'Failed to update profile', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    setLoading(true)
    try {
      const updatedUser = await api.updateUser(user.id, { profile_completed: true })
      setUser(updatedUser)
      navigate(from, { state: preservedState })
    } catch (error) {
      addToast({ message: error.message || t('completeProfile.failedToUpdate') || 'Failed to update profile', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container>
      <div className="complete-profile-container">
        <div className="complete-profile-content">
          {/* Hero Section */}
          <section className="complete-profile-hero">
            <div className="complete-profile-hero-content">
              <p className="complete-profile-subtitle">
                Profile Setup
              </p>
              <h1 className="complete-profile-title">
                {t('completeProfile.title') || 'Complete Your Profile'}
              </h1>
              <p className="complete-profile-description">
                {t('completeProfile.description') || 'Add your information to get started with ChessBD'}
              </p>
            </div>
          </section>

          {/* Main Card */}
          <div className="complete-profile-card-wrapper">
            <div className="complete-profile-card">
              <form onSubmit={handleSubmit} className="complete-profile-form">
                <div className="complete-profile-field">
                  <label htmlFor="name" className="complete-profile-label">
                    <User className="complete-profile-label-icon" />
                    {t('completeProfile.fullName') || 'Full Name'}
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="complete-profile-input"
                  />
                </div>

                <div className="complete-profile-field">
                  <label htmlFor="nameBn" className="complete-profile-label">
                    <User className="complete-profile-label-icon" />
                    {t('completeProfile.banglaName') || 'Bangla Name'}
                  </label>
                  <input
                    id="nameBn"
                    type="text"
                    value={nameBn}
                    onChange={(e) => setNameBn(e.target.value)}
                    placeholder="আপনার বাংলা নাম"
                    className="complete-profile-input"
                  />
                </div>

                <div className="complete-profile-field">
                  <label htmlFor="location" className="complete-profile-label">
                    <MapPin className="complete-profile-label-icon" />
                    {t('completeProfile.location') || 'Location'}
                  </label>
                  <select
                    id="location"
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="complete-profile-input"
                  >
                    <option value="" className="complete-profile-option">
                      {t('locations.selectLocation') || 'Select Location'}
                    </option>
                    {[
                      "Bagerhat", "Bandarban", "Barguna", "Barisal", "Bhola", "Bogra", "Brahmanbaria",
                      "Chandpur", "Chittagong", "Chuadanga", "Comilla", "Cox's Bazar", "Dhaka", "Dinajpur",
                      "Faridpur", "Feni", "Gaibandha", "Gazipur", "Gopalganj", "Habiganj", "Jamalpur",
                      "Jessore", "Jhalokati", "Jhenaidah", "Joypurhat", "Khagrachari", "Khulna", "Kishoreganj",
                      "Kurigram", "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur", "Magura", "Manikganj",
                      "Maulvibazar", "Meherpur", "Munshiganj", "Mymensingh", "Narail", "Narayanganj", "Narsingdi",
                      "Naogaon", "Natore", "Nawabganj", "Netrokona", "Nilphamari", "Noakhali", "Pabna",
                      "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi", "Rangamati", "Rangpur",
                      "Satkhira", "Shariatpur", "Sherpur", "Sirajgonj", "Sunamganj", "Sylhet", "Tangail", "Thakurgaon"
                    ].map((loc) => (
                      <option key={loc} value={loc} className="complete-profile-option">
                        {t(`locations.${loc}`) || loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="complete-profile-field">
                  <label htmlFor="chesscom_username" className="complete-profile-label">
                    <ChesscomIcon className="complete-profile-label-icon" />
                    {t('completeProfile.chesscomUsername') || 'Chess.com Username'}
                  </label>
                  <input
                    id="chesscom_username"
                    type="text"
                    value={chesscomUsername}
                    onChange={(e) => setChesscomUsername(e.target.value)}
                    placeholder="your-username"
                    className="complete-profile-input complete-profile-input-lowercase"
                  />
                  <p className="complete-profile-hint">
                    {t('completeProfile.verifyLater') || 'You can verify this later from your profile page'} {t('profile.usernameRules') || '(lowercase letters, numbers, hyphens, and underscores)'}
                  </p>
                </div>

                <div className="complete-profile-field">
                  <label htmlFor="lichess_username" className="complete-profile-label">
                    <LichessIcon className="complete-profile-label-icon" />
                    {t('completeProfile.lichessUsername') || 'Lichess Username (Optional)'}
                  </label>
                  <input
                    id="lichess_username"
                    type="text"
                    value={lichessUsername}
                    onChange={(e) => setLichessUsername(e.target.value)}
                    placeholder="your-username"
                    className="complete-profile-input complete-profile-input-lowercase"
                  />
                  <p className="complete-profile-hint">
                    {t('completeProfile.optionalDescription') || 'Optional: Add your Lichess username to combine stats from both platforms'} {t('profile.usernameRules') || '(lowercase letters, numbers, hyphens, and underscores)'}
                  </p>
                </div>

                <div className="complete-profile-actions">
                  <button
                    type="submit"
                    disabled={loading}
                    className="complete-profile-btn complete-profile-btn-primary"
                  >
                    {loading ? (
                      <div className="complete-profile-spinner"></div>
                    ) : (
                      <>
                        <UserCheck className="complete-profile-btn-icon" />
                        <span>{t('completeProfile.completeProfile') || 'Complete Profile'}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={loading}
                    className="complete-profile-btn complete-profile-btn-secondary"
                  >
                    {loading ? (
                      <div className="complete-profile-spinner complete-profile-spinner-secondary"></div>
                    ) : (
                      <span>{t('completeProfile.skipForNow') || 'Skip for Now'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

