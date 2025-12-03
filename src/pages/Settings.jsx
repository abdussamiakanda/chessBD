import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store'
import { useToastStore } from '../store/toast-store'
import { api } from '../lib/api'
import { isDemoMode, db } from '../lib/firebase'
import { Container } from '../components/ui/Container'
import { User, Edit2, Copy, CheckCircle2, ExternalLink, AlertCircle, RefreshCw, Video, Radio, Upload, X } from 'lucide-react'
import { ChesscomIcon } from '../components/ui/ChesscomIcon'
import { LichessIcon } from '../components/ui/LichessIcon'
import { useLanguage } from '../contexts/LanguageContext'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { PageLoader } from '../components/ui/PageLoader'
import './Settings.css'

// Username validation regex
const usernameRegex = /^[a-z0-9_-]+$/

export function Settings() {
  const { t } = useLanguage()
  const { user, setUser, loading: authLoading } = useAuthStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState(user?.chesscom_username || '')
  const [lichessUsername, setLichessUsername] = useState(user?.lichess_username || '')
  const [name, setName] = useState(user?.name || '')
  const [nameBn, setNameBn] = useState(user?.name_bn || '')
  const [selectedLocation, setSelectedLocation] = useState(user?.location || '')
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyingLichess, setVerifyingLichess] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState('idle') // 'idle' | 'checking' | 'success' | 'error'
  const [lichessVerificationStatus, setLichessVerificationStatus] = useState('idle') // 'idle' | 'checking' | 'success' | 'error'
  const [editingChesscom, setEditingChesscom] = useState(false)
  const [editingLichess, setEditingLichess] = useState(false)
  const [isStreamer, setIsStreamer] = useState(user?.is_streamer || false)
  const [streamsChessOnly, setStreamsChessOnly] = useState(user?.streams_chess_only || false)
  const [twitchUsername, setTwitchUsername] = useState(user?.twitch_username || '')
  const [youtubeChannel, setYoutubeChannel] = useState(user?.youtube_channel || '')
  const [kickUsername, setKickUsername] = useState(user?.kick_username || '')
  const [streamDescription, setStreamDescription] = useState(user?.stream_description || '')
  const [isEditingStreamer, setIsEditingStreamer] = useState(false)
  const [savingStreamer, setSavingStreamer] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null)
  const [dragActive, setDragActive] = useState(false)
  const [fileInputRef, setFileInputRef] = useState(null)

  // Redirect if not logged in or email not verified
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    
    if (!user.email_verified_at) {
      navigate('/check-email', { replace: true })
      return
    }
  }, [user, navigate])

  // Sync avatar preview with user avatar_url
  useEffect(() => {
    if (user?.avatar_url !== avatarPreview && !isEditingProfile) {
      setAvatarPreview(user?.avatar_url || null)
    }
  }, [user?.avatar_url, isEditingProfile])

  // Check for existing verification code on mount and when editing starts
  useEffect(() => {
    const checkExistingCode = async () => {
      if (!user || isDemoMode || !db) return

      try {
        const challengesQuery = query(
          collection(db, 'verification_challenges'),
          where('user_id', '==', user.id),
          where('verified_at', '==', null)
        )
        const challengesSnapshot = await getDocs(challengesQuery)
        
        if (challengesSnapshot.empty) return

        const challenges = challengesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        const sortedChallenges = challenges.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

        if (sortedChallenges.length > 0) {
          setVerificationCode(sortedChallenges[0].code)
        }
      } catch (error) {
        // Silently fail if permission denied - code will be generated when user clicks the button
        // This is expected if Firestore rules don't allow reading verification_challenges
        if (error?.code !== 'permission-denied' && !error?.message?.includes('permission')) {
          console.error('[Settings] Error checking existing code:', error)
        }
      }
    }

    checkExistingCode()
  }, [user, editingChesscom, editingLichess])

  if (authLoading) {
    return <PageLoader />
  }

  if (!user) {
    return null // ProtectedRoute will handle redirect
  }

  const handleGenerateCode = async () => {
    setLoading(true)
    setVerificationStatus('idle')
    setCodeCopied(false)
    try {
      if (isDemoMode) {
        addToast({ message: t('profile.demoModeCode') || 'Demo mode: Use code DEMO123', type: 'info' })
        setVerificationCode('DEMO123')
        setLoading(false)
        return
      }

      const { code } = await api.createVerificationChallenge(user.id)
      setVerificationCode(code)
      addToast({
        message: t('profile.codeGenerated') || 'Verification code generated!',
        type: 'success',
      })
    } catch (error) {
      let errorMessage = error.message || t('profile.failedToGenerateCode') || 'Failed to generate code'
      if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        errorMessage = t('profile.permissionDenied') || 'Permission denied. Please update your database rules.'
      }
      addToast({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (!verificationCode) return
    try {
      await navigator.clipboard.writeText(verificationCode)
      setCodeCopied(true)
      addToast({ message: t('profile.codeCopiedToClipboard') || 'Code copied to clipboard!', type: 'success' })
      setTimeout(() => setCodeCopied(false), 2000)
    } catch (error) {
      addToast({ message: t('profile.failedToCopyCode') || 'Failed to copy code', type: 'error' })
    }
  }

  const handleVerify = async () => {
    if (!username.trim()) {
      addToast({ message: t('profile.usernameRequired') || 'Please enter your username', type: 'error' })
      return
    }

    if (!usernameRegex.test(username.toLowerCase())) {
      addToast({ 
        message: t('settings.usernameValidation') || 'Username can only contain lowercase letters, numbers, hyphens, and underscores', 
        type: 'error' 
      })
      return
    }

    if (!verificationCode) {
      addToast({ message: t('profile.verificationCodeRequired') || 'Please generate a verification code first', type: 'error' })
      return
    }

    setVerifying(true)
    setVerificationStatus('checking')
    try {
      // First update the username if it changed (this clears Chess.com verification)
      const usernameChanged = user.chesscom_username?.toLowerCase() !== username.toLowerCase()
      if (usernameChanged) {
        await api.updateUser(user.id, {
          chesscom_username: username.toLowerCase(),
          verified_at: null, // Clear Chess.com verification when username changes
        })
        // Refresh user data to get updated username
        const updatedUser = await api.getUser(user.id)
        if (updatedUser) {
          setUser(updatedUser)
        }
      }

      const verified = await api.verifyChesscomUsername(user.id, username.toLowerCase())

      if (verified) {
        // User profile is already updated by verifyChesscomUsername
        // Just refresh the user data
        const updated = await api.getUser(user.id)
        if (updated) {
          setUser(updated)
        }
        setVerificationStatus('success')
        addToast({ message: t('profile.chesscomVerifiedSuccess') || 'Chess.com username verified successfully!', type: 'success' })
        setVerificationCode('')
        setUsername('')
        setEditingChesscom(false)
      } else {
        setVerificationStatus('error')
        addToast({ 
          message: t('profile.verificationFailed') || 'Verification failed', 
          type: 'error' 
        })
      }
    } catch (error) {
      setVerificationStatus('error')
      console.error('[Settings] Verification error:', error)
      
      // Provide more specific error messages
      let errorMessage = error.message || t('profile.verificationFailed') || 'Verification failed'
      
      if (error.message?.includes('CORS') || error.message?.includes('fetch')) {
        errorMessage = t('profile.networkError') || 'Network error: Unable to reach Chess.com'
      } else if (error.message?.includes('not found') || error.message?.includes('404')) {
        errorMessage = t('profile.usernameNotFoundChesscom') || 'Username not found on Chess.com'
      } else if (error.message?.includes('permission') || error.message?.includes('Permission')) {
        errorMessage = t('profile.databasePermissionError') || 'Database permission error'
      }
      
      addToast({ message: errorMessage, type: 'error' })
    } finally {
      setVerifying(false)
    }
  }

  const handleUpdateProfile = async () => {
    if (!user) return

    setSavingProfile(true)
    try {
      const updated = await api.updateUser(user.id, {
        name: name.trim() || null,
        name_bn: nameBn.trim() || null,
        location: selectedLocation.trim() || null,
        avatar_url: avatarPreview,
      })
      setUser(updated)
      setAvatarPreview(updated.avatar_url || null)
      setIsEditingProfile(false)
      addToast({ message: t('profile.profileUpdated') || 'Profile updated successfully', type: 'success' })
    } catch (error) {
      addToast({ message: error.message || t('profile.failedToUpdateProfile') || 'Failed to update profile', type: 'error' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleAvatarUpload = async (file) => {
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      addToast({ message: t('settings.selectImageFile') || 'Please select an image file', type: 'error' })
      return
    }

    // Validate file size (max 1MB)
    if (file.size > 1 * 1024 * 1024) {
      addToast({ message: t('settings.imageSizeLimit') || 'Image size must be less than 1MB', type: 'error' })
      return
    }

    // Create preview immediately
    const reader = new FileReader()
    reader.onload = (e) => {
      setAvatarPreview(e.target.result)
    }
    reader.readAsDataURL(file)

    setUploadingAvatar(true)
    try {
      const result = await api.uploadImage(file, 'avatars')
      setAvatarPreview(result.public_url)
      
      // Update user profile with new avatar URL
      await api.updateUser(user.id, {
        avatar_url: result.public_url,
      })
      const updatedUser = await api.getUser(user.id)
      if (updatedUser) {
        setUser(updatedUser)
      }
      
      addToast({ message: t('settings.avatarUploadSuccess') || 'Avatar uploaded successfully', type: 'success' })
    } catch (error) {
      // Revert preview on error
      setAvatarPreview(user?.avatar_url || null)
      addToast({ message: error.message || t('settings.avatarUploadFailed') || 'Failed to upload avatar', type: 'error' })
    } finally {
      setUploadingAvatar(false)
      // Reset file input
      if (fileInputRef) {
        fileInputRef.value = ''
      }
    }
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      handleAvatarUpload(file)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (!isEditingProfile) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleAvatarUpload(file)
    }
  }

  const handleRemoveAvatar = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!user || removingAvatar || uploadingAvatar) return
    
    setRemovingAvatar(true)
    try {
      await api.updateUser(user.id, {
        avatar_url: null,
      })
      const updatedUser = await api.getUser(user.id)
      if (updatedUser) {
        setUser(updatedUser)
        setAvatarPreview(null)
      }
      addToast({ message: t('settings.avatarRemoved') || 'Avatar removed successfully', type: 'success' })
    } catch (error) {
      addToast({ message: error.message || t('settings.avatarRemoveFailed') || 'Failed to remove avatar', type: 'error' })
    } finally {
      setRemovingAvatar(false)
    }
  }

  const handleUpdateStreamer = async () => {
    if (!user) return

    // Validation: If user is a streamer, they must provide at least one platform and check chess only
    if (isStreamer) {
      const hasAtLeastOnePlatform = !!(
        twitchUsername.trim() ||
        youtubeChannel.trim() ||
        kickUsername.trim()
      )

      if (!hasAtLeastOnePlatform) {
        addToast({ 
          message: t('profile.provideStreamingPlatform') || 'Please provide at least one streaming platform', 
          type: 'error' 
        })
        return
      }

      if (!streamsChessOnly) {
        addToast({ 
          message: t('profile.checkChessOnly') || 'Please check that you stream chess content only', 
          type: 'error' 
        })
        return
      }
    }

    setSavingStreamer(true)
    try {
      const updated = await api.updateUser(user.id, {
        is_streamer: isStreamer,
        streams_chess_only: isStreamer ? streamsChessOnly : false,
        twitch_username: isStreamer ? (twitchUsername.trim() || null) : null,
        youtube_channel: isStreamer ? (youtubeChannel.trim() || null) : null,
        kick_username: isStreamer ? (kickUsername.trim() || null) : null,
        stream_description: isStreamer ? (streamDescription.trim() || null) : null,
      })
      setUser(updated)
      setIsEditingStreamer(false)
      addToast({ message: t('profile.streamerInfoUpdated') || 'Streamer information updated successfully', type: 'success' })
    } catch (error) {
      addToast({ message: error.message || t('profile.failedToUpdateStreamer') || 'Failed to update streamer information', type: 'error' })
    } finally {
      setSavingStreamer(false)
    }
  }

  const handleVerifyLichess = async () => {
    if (!lichessUsername.trim()) {
      addToast({ message: t('profile.usernameRequired') || 'Please enter your username', type: 'error' })
      return
    }

    if (!usernameRegex.test(lichessUsername.toLowerCase())) {
      addToast({ 
        message: t('settings.usernameValidation') || 'Username can only contain lowercase letters, numbers, hyphens, and underscores', 
        type: 'error' 
      })
      return
    }

    if (!verificationCode) {
      addToast({ message: t('profile.verificationCodeRequired') || 'Please generate a verification code first', type: 'error' })
      return
    }

    setVerifyingLichess(true)
    setLichessVerificationStatus('checking')
    try {
      // First update the username if it changed (this clears Lichess verification)
      const usernameChanged = user.lichess_username?.toLowerCase() !== lichessUsername.toLowerCase()
      if (usernameChanged) {
        await api.updateUser(user.id, {
          lichess_username: lichessUsername.toLowerCase(),
          lichess_verified_at: null, // Clear Lichess verification when username changes
        })
        // Refresh user data to get updated username
        const updatedUser = await api.getUser(user.id)
        if (updatedUser) {
          setUser(updatedUser)
        }
      }

      const verified = await api.verifyLichessUsername(user.id, lichessUsername.toLowerCase())

      if (verified) {
        const updated = await api.getUser(user.id)
        if (updated) {
          setUser(updated)
        }
        setLichessVerificationStatus('success')
        addToast({ message: t('profile.lichessVerifiedSuccess') || 'Lichess username verified successfully!', type: 'success' })
        setVerificationCode('')
        setLichessUsername('')
        setEditingLichess(false)
      } else {
        setLichessVerificationStatus('error')
        addToast({ 
          message: t('profile.verificationFailed') || 'Verification failed', 
          type: 'error' 
        })
      }
    } catch (error) {
      setLichessVerificationStatus('error')
      console.error('[Settings] Lichess verification error:', error)
      
      let errorMessage = error.message || t('profile.verificationFailed') || 'Verification failed'
      
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        errorMessage = t('profile.usernameNotFoundLichess') || 'Username not found on Lichess'
      } else if (error.message?.includes('permission') || error.message?.includes('Permission')) {
        errorMessage = t('profile.databasePermissionError') || 'Database permission error'
      }
      
      addToast({ message: errorMessage, type: 'error' })
    } finally {
      setVerifyingLichess(false)
    }
  }

  return (
    <Container>
      <div className="settings-container">
        <div className="settings-content">
          {/* Hero Section */}
          <section className="settings-hero">
            <div className="settings-hero-content">
              <p className="settings-subtitle">
                {t('settings.accountManagement') || 'Account Management'}
              </p>
              <h1 className="settings-title">
                {t('nav.settings') || 'Settings'}
              </h1>
              <p className="settings-description">
                {t('settings.description') || 'Manage your ChessBD profile, verify your chess accounts, and customize streamer visibility.'}
              </p>
            </div>
          </section>

          {/* Personal Information Card */}
          <div className="settings-card-wrapper">
            <div className="settings-card settings-card-main">
              <div className="settings-card-header">
                <div className="settings-card-header-content">
                  <div className="settings-card-icon">
                    <User className="settings-card-icon-svg" />
                  </div>
                  <div>
                    <p className="settings-card-label">
                      {t('common.personalInformation') || 'Personal Information'}
                    </p>
                    <h2 className="settings-card-title">
                      {t('settings.profileInformation') || 'Profile Information'}
                    </h2>
                  </div>
                </div>
                {!isEditingProfile && (
                  <button
                    onClick={() => {
                      setIsEditingProfile(true)
                      setName(user.name || '')
                      setNameBn(user.name_bn || '')
                      setSelectedLocation(user.location || '')
                      setAvatarPreview(user.avatar_url || null)
                    }}
                    className="settings-edit-btn"
                  >
                    <Edit2 className="settings-btn-icon" />
                    <span>{t('common.edit') || 'Edit'}</span>
                  </button>
                )}
              </div>

              {/* Profile Picture Section */}
              <div className="settings-avatar-section">
                <div 
                  className={`settings-avatar-wrapper ${dragActive ? 'settings-avatar-wrapper-drag' : ''} ${uploadingAvatar || removingAvatar ? 'settings-avatar-wrapper-uploading' : ''}`}
                  onDragEnter={!uploadingAvatar && !removingAvatar ? handleDrag : undefined}
                  onDragLeave={!uploadingAvatar && !removingAvatar ? handleDrag : undefined}
                  onDragOver={!uploadingAvatar && !removingAvatar ? handleDrag : undefined}
                  onDrop={!uploadingAvatar && !removingAvatar ? handleDrop : undefined}
                >
                  {(uploadingAvatar || removingAvatar) && (
                    <div className="settings-avatar-overlay">
                      <div className="settings-avatar-spinner"></div>
                    </div>
                  )}
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt={t('settings.profile') || 'Profile'}
                      className="settings-avatar-img"
                    />
                  ) : (
                    <div className="settings-avatar-placeholder">
                      <User className="settings-avatar-placeholder-icon" />
                    </div>
                  )}
                  {isEditingProfile && !uploadingAvatar && !removingAvatar && (
                    <div className="settings-avatar-actions">
                      <label 
                        htmlFor="avatar-upload-input"
                        className="settings-avatar-upload-btn"
                      >
                        <Upload className="settings-avatar-upload-icon" />
                        <input
                          id="avatar-upload-input"
                          ref={(el) => setFileInputRef(el)}
                          type="file"
                          accept="image/*"
                          onChange={handleFileInputChange}
                          disabled={uploadingAvatar || removingAvatar}
                          className="settings-avatar-input"
                        />
                      </label>
                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="settings-avatar-remove-btn"
                          title={t('settings.removeProfilePicture') || 'Remove profile picture'}
                          disabled={uploadingAvatar || removingAvatar}
                        >
                          {removingAvatar ? (
                            <div className="settings-avatar-remove-spinner"></div>
                          ) : (
                            <X className="settings-avatar-remove-icon" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  {isEditingProfile && dragActive && (
                    <div className="settings-avatar-drag-overlay">
                      <Upload className="settings-avatar-drag-icon" />
                      <p className="settings-avatar-drag-text">
                        {t('settings.dropImageHere') || 'Drop image here'}
                      </p>
                    </div>
                  )}
                </div>
                {(uploadingAvatar || removingAvatar) && (
                  <p className="settings-avatar-uploading">
                    {uploadingAvatar 
                      ? (t('settings.uploading') || 'Uploading...')
                      : (t('settings.removing') || 'Removing...')
                    }
                  </p>
                )}
              </div>

              <div className="settings-card-body">
                <div className="settings-field">
                  <label className="settings-label">
                    {t('common.email') || 'Email'}
                  </label>
                  <p className="settings-value">{user.email}</p>
                </div>
                
                {isEditingProfile ? (
                  <>
                    <div className="settings-field">
                      <label htmlFor="name" className="settings-label">
                        {t('profile.fullName') || 'Full Name'}
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('settings.fullNamePlaceholder') || 'Enter your full name'}
                        className="settings-input"
                      />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="nameBn" className="settings-label">
                        {t('profile.banglaName') || 'Bangla Name'}
                      </label>
                      <input
                        id="nameBn"
                        type="text"
                        value={nameBn}
                        onChange={(e) => setNameBn(e.target.value)}
                        placeholder="আপনার বাংলা নাম"
                        className="settings-input"
                      />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="location" className="settings-label">
                        {t('profile.location') || 'Location'}
                      </label>
                      <select
                        id="location"
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="settings-input"
                      >
                        <option value="" className="settings-option">
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
                          <option key={loc} value={loc} className="settings-option">
                            {t(`locations.${loc}`) || loc}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="settings-actions">
                      <button
                        onClick={handleUpdateProfile}
                        disabled={savingProfile}
                        className="settings-btn settings-btn-primary"
                      >
                        {savingProfile ? (
                          <div className="settings-spinner"></div>
                        ) : (
                          <span>{t('common.saveChanges') || 'Save Changes'}</span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingProfile(false)
                          setName(user.name || '')
                          setNameBn(user.name_bn || '')
                          setSelectedLocation(user.location || '')
                        }}
                        className="settings-btn settings-btn-secondary"
                      >
                        {t('common.cancel') || 'Cancel'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {user.name && (
                      <div className="settings-field">
                        <label className="settings-label">
                          {t('profile.fullName') || 'Full Name'}
                        </label>
                        <p className="settings-value">{user.name}</p>
                        {user.name_bn && (
                          <p className="settings-value-bn">{user.name_bn}</p>
                        )}
                      </div>
                    )}
                    {user.location && (
                      <div className="settings-field">
                        <label className="settings-label">
                          {t('profile.location') || 'Location'}
                        </label>
                        <p className="settings-value">
                          {t(`locations.${user.location}`) || user.location}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Chess.com Verification Section */}
              <div className="settings-verification-section">
                <div className="settings-verification-header">
                  <div className="settings-verification-header-content">
                    <div className="settings-verification-icon">
                      <ChesscomIcon className="settings-verification-icon-svg" />
                    </div>
                    <div>
                      <p className="settings-verification-label">
                        {t('settings.chesscom') || 'Chess.com'}
                      </p>
                      <h3 className="settings-verification-title">
                        {t('profile.chesscomUsername') || 'Chess.com Username'}
                      </h3>
                    </div>
                  </div>
                  {user.chesscom_username && !editingChesscom && (
                    <button
                      onClick={() => {
                        setUsername(user.chesscom_username || '')
                        setVerificationCode('')
                        setVerificationStatus('idle')
                        setEditingChesscom(true)
                      }}
                      className="settings-edit-btn settings-edit-btn-sm"
                    >
                      <Edit2 className="settings-btn-icon-sm" />
                      <span>{t('common.edit') || 'Edit'}</span>
                    </button>
                  )}
                </div>
                {user.chesscom_username && user.verified_at && !editingChesscom ? (
                  <div className="settings-verified-box">
                    <CheckCircle2 className="settings-verified-icon" />
                    <div className="settings-verified-content">
                      <p className="settings-verified-username">{user.chesscom_username}</p>
                      <p className="settings-verified-status">
                        {t('profile.verifiedStatus') || '✓ Verified'}
                      </p>
                      <a
                        href={`https://www.chess.com/member/${user.chesscom_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="settings-verified-link"
                      >
                        <ExternalLink className="settings-verified-link-icon" />
                        {t('profile.viewChesscomProfile') || 'View Chess.com Profile'}
                      </a>
                    </div>
                  </div>
                ) : user.chesscom_username && !user.verified_at && !editingChesscom ? (
                  <div className="settings-unverified-box">
                    <AlertCircle className="settings-unverified-icon" />
                    <div className="settings-unverified-content">
                      <p className="settings-unverified-username">{user.chesscom_username}</p>
                      <p className="settings-unverified-status">
                        {t('profile.notVerified') || 'Not Verified'}
                      </p>
                      <p className="settings-unverified-hint">
                        {t('profile.pleaseVerifyUsername') || 'Please verify this username or edit it.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="settings-verification-form">
                    <div className="settings-verification-input-group">
                      <div className="settings-verification-input-header">
                        <label className="settings-label">
                          {user.chesscom_username ? t('profile.updateChesscomUsername') : t('profile.enterChesscomUsername')}
                        </label>
                        {editingChesscom && (
                          <button
                            onClick={() => {
                              setEditingChesscom(false)
                              setUsername(user.chesscom_username || '')
                            }}
                            className="settings-cancel-btn"
                          >
                            {t('common.cancel') || 'Cancel'}
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="your-username"
                        className="settings-input settings-input-lowercase"
                      />
                      <p className="settings-hint">
                        {t('profile.usernameRules') || 'Lowercase letters, numbers, hyphens, and underscores only'}
                      </p>
                      {user.chesscom_username && username.toLowerCase() !== user.chesscom_username.toLowerCase() && (
                        <p className="settings-warning">
                          {t('profile.usernameChanged') || 'Username changed. You\'ll need to verify the new username.'}
                        </p>
                      )}
                    </div>

                    {/* Step 1 Card */}
                    <div className="settings-step-card">
                      <div className="settings-step-card-bg"></div>
                      <div className="settings-step-card-content">
                        <div className="settings-step-icon-wrapper">
                          <div className="settings-step-icon">
                            <ChesscomIcon className="settings-step-icon-svg" />
                          </div>
                        </div>
                        <div className="settings-step-content">
                          <h3 className="settings-step-title">{t('profile.step1') || 'Step 1: Generate Verification Code'}</h3>
                          <p className="settings-step-description">
                            {t('profile.step1Description') || 'Click the button below to generate a unique verification code.'}
                          </p>
                          {!verificationCode && (
                            <button
                              onClick={handleGenerateCode}
                              disabled={loading}
                              className="settings-btn settings-btn-primary settings-btn-sm"
                            >
                              {loading ? (
                                <div className="settings-spinner settings-spinner-sm"></div>
                              ) : (
                                <span>{t('profile.generateCode') || 'Generate Code'}</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {verificationCode && (
                      <div className="settings-code-box">
                        <div className="settings-code-header">
                          <p className="settings-code-label">{t('profile.verificationCode') || 'Your Verification Code'}</p>
                          <button
                            onClick={handleCopyCode}
                            className="settings-copy-btn"
                          >
                            {codeCopied ? (
                              <>
                                <CheckCircle2 className="settings-copy-icon" />
                                <span>{t('profile.codeCopied') || 'Copied!'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="settings-copy-icon" />
                                <span>{t('profile.copyCode') || 'Copy'}</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="settings-code-display">
                          <p className="settings-code-text">{verificationCode}</p>
                        </div>
                        <div className="settings-code-instructions">
                          <p className="settings-code-instructions-text">
                            <AlertCircle className="settings-code-instructions-icon" />
                            {t('profile.nextAddCode') || 'Next: Copy this code and add it to your Chess.com profile status (bio) or location field.'}
                          </p>
                          <a
                            href="https://www.chess.com/settings/profile"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="settings-code-link"
                          >
                            <ExternalLink className="settings-code-link-icon" />
                            {t('profile.openChesscomSettings') || 'Open Chess.com Profile Settings'}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Step 2 Card */}
                    <div className="settings-step-card">
                      <div className="settings-step-card-bg"></div>
                      <div className="settings-step-card-content">
                        <div className="settings-step-icon-wrapper">
                          <div className="settings-step-icon">
                            <CheckCircle2 className="settings-step-icon-svg" />
                          </div>
                        </div>
                        <div className="settings-step-content">
                          <h3 className="settings-step-title">{t('profile.step2') || 'Step 2: Verify Your Username'}</h3>
                          <p className="settings-step-description">
                            {t('profile.afterAddingCode') || 'After adding the code to your profile, click verify to confirm.'}
                          </p>
                          <div className="settings-step-actions">
                            <button
                              onClick={handleVerify}
                              disabled={verifying || !verificationCode}
                              className="settings-btn settings-btn-primary settings-btn-sm"
                            >
                              {verificationStatus === 'checking' && <RefreshCw className="settings-btn-icon-sm settings-btn-icon-spin" />}
                              {verificationStatus === 'success' && <CheckCircle2 className="settings-btn-icon-sm" />}
                              {verificationStatus === 'error' && <AlertCircle className="settings-btn-icon-sm" />}
                              <span>
                                {verificationStatus === 'idle' && t('profile.verifyButton')}
                                {verificationStatus === 'checking' && t('profile.checking')}
                                {verificationStatus === 'success' && t('profile.verified')}
                                {verificationStatus === 'error' && t('profile.tryAgain')}
                              </span>
                            </button>
                            {username && (
                              <a
                                href={`https://www.chess.com/member/${username.toLowerCase()}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="settings-view-link"
                              >
                                <ExternalLink className="settings-view-link-icon" />
                                {t('profile.viewProfile') || 'View Profile'}
                              </a>
                            )}
                          </div>
                          {verificationStatus === 'error' && (
                            <div className="settings-error-box">
                              <AlertCircle className="settings-error-icon" />
                              <p className="settings-error-text">
                                {t('profile.makeSureCodeAppears') || 'Make sure the code appears in your Chess.com profile location field.'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lichess Username Verification */}
              <div className="settings-verification-section">
                <div className="settings-verification-header">
                  <div className="settings-verification-header-content">
                    <div className="settings-verification-icon">
                      <LichessIcon className="settings-verification-icon-svg" />
                    </div>
                    <div>
                      <p className="settings-verification-label">
                        {t('settings.lichess') || 'Lichess'}
                      </p>
                      <h3 className="settings-verification-title">
                        {t('profile.lichessUsername') || 'Lichess Username'}
                      </h3>
                    </div>
                  </div>
                  {user.lichess_username && !editingLichess && (
                    <button
                      onClick={() => {
                        setLichessUsername(user.lichess_username || '')
                        setVerificationCode('')
                        setLichessVerificationStatus('idle')
                        setEditingLichess(true)
                      }}
                      className="settings-edit-btn settings-edit-btn-sm"
                    >
                      <Edit2 className="settings-btn-icon-sm" />
                      <span>{t('common.edit') || 'Edit'}</span>
                    </button>
                  )}
                </div>
                {user.lichess_username && user.lichess_verified_at && !editingLichess ? (
                  <div className="settings-verified-box">
                    <CheckCircle2 className="settings-verified-icon" />
                    <div className="settings-verified-content">
                      <p className="settings-verified-username">{user.lichess_username}</p>
                      <p className="settings-verified-status">
                        {t('profile.verifiedStatus') || '✓ Verified'}
                      </p>
                      <a
                        href={`https://lichess.org/@/${user.lichess_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="settings-verified-link"
                      >
                        <ExternalLink className="settings-verified-link-icon" />
                        {t('profile.viewLichessProfile') || 'View Lichess Profile'}
                      </a>
                    </div>
                  </div>
                ) : user.lichess_username && !user.lichess_verified_at && !editingLichess ? (
                  <div className="settings-unverified-box">
                    <AlertCircle className="settings-unverified-icon" />
                    <div className="settings-unverified-content">
                      <p className="settings-unverified-username">{user.lichess_username}</p>
                      <p className="settings-unverified-status">
                        {t('profile.notVerified') || 'Not Verified'}
                      </p>
                      <p className="settings-unverified-hint">
                        {t('profile.pleaseVerifyUsername') || 'Please verify this username or edit it.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="settings-verification-form">
                    <div className="settings-verification-input-group">
                      <div className="settings-verification-input-header">
                        <label className="settings-label">
                          {user.lichess_username ? t('profile.updateLichessUsername') : t('profile.enterLichessUsername')}
                        </label>
                        {editingLichess && (
                          <button
                            onClick={() => {
                              setEditingLichess(false)
                              setLichessUsername(user.lichess_username || '')
                            }}
                            className="settings-cancel-btn"
                          >
                            {t('common.cancel') || 'Cancel'}
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={lichessUsername}
                        onChange={(e) => setLichessUsername(e.target.value)}
                        placeholder="your-username"
                        className="settings-input settings-input-lowercase"
                      />
                      <p className="settings-hint">
                        {t('profile.usernameRules') || 'Lowercase letters, numbers, hyphens, and underscores only'}
                      </p>
                      {user.lichess_username && lichessUsername.toLowerCase() !== user.lichess_username.toLowerCase() && (
                        <p className="settings-warning">
                          {t('profile.usernameChanged') || 'Username changed. You\'ll need to verify the new username.'}
                        </p>
                      )}
                    </div>

                    {/* Step 1 Card */}
                    <div className="settings-step-card">
                      <div className="settings-step-card-bg"></div>
                      <div className="settings-step-card-content">
                        <div className="settings-step-icon-wrapper">
                          <div className="settings-step-icon">
                            <LichessIcon className="settings-step-icon-svg" />
                          </div>
                        </div>
                        <div className="settings-step-content">
                          <h3 className="settings-step-title">{t('profile.step1') || 'Step 1: Generate Verification Code'}</h3>
                          <p className="settings-step-description">
                            {t('profile.step1Description') || 'Click the button below to generate a unique verification code.'}
                          </p>
                          {!verificationCode && (
                            <button
                              onClick={handleGenerateCode}
                              disabled={loading}
                              className="settings-btn settings-btn-primary settings-btn-sm"
                            >
                              {loading ? (
                                <div className="settings-spinner settings-spinner-sm"></div>
                              ) : (
                                <span>{t('profile.generateCode') || 'Generate Code'}</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {verificationCode && (
                      <div className="settings-code-box">
                        <div className="settings-code-header">
                          <p className="settings-code-label">{t('profile.verificationCode') || 'Your Verification Code'}</p>
                          <button
                            onClick={handleCopyCode}
                            className="settings-copy-btn"
                          >
                            {codeCopied ? (
                              <>
                                <CheckCircle2 className="settings-copy-icon" />
                                <span>{t('profile.codeCopied') || 'Copied!'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="settings-copy-icon" />
                                <span>{t('profile.copyCode') || 'Copy'}</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="settings-code-display">
                          <p className="settings-code-text">{verificationCode}</p>
                        </div>
                        <div className="settings-code-instructions">
                          <p className="settings-code-instructions-text">
                            <AlertCircle className="settings-code-instructions-icon" />
                            {t('profile.nextAddCodeLichess') || 'Add the verification code to your Lichess profile bio or location field.'}
                          </p>
                          <a
                            href="https://lichess.org/account/profile"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="settings-code-link"
                          >
                            <ExternalLink className="settings-code-link-icon" />
                            {t('profile.openLichessSettings') || 'Open Lichess Profile Settings'}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Step 2 Card */}
                    <div className="settings-step-card">
                      <div className="settings-step-card-bg"></div>
                      <div className="settings-step-card-content">
                        <div className="settings-step-icon-wrapper">
                          <div className="settings-step-icon">
                            <CheckCircle2 className="settings-step-icon-svg" />
                          </div>
                        </div>
                        <div className="settings-step-content">
                          <h3 className="settings-step-title">{t('profile.step2') || 'Step 2: Verify Your Username'}</h3>
                          <p className="settings-step-description">
                            {t('profile.afterAddingCodeLichess') || 'Use the same verification code from above. Add it to your Lichess profile bio or location field, then click verify.'}
                          </p>
                          <div className="settings-step-actions">
                            <button
                              onClick={handleVerifyLichess}
                              disabled={verifyingLichess || !verificationCode}
                              className="settings-btn settings-btn-primary settings-btn-sm"
                            >
                              {lichessVerificationStatus === 'checking' && <RefreshCw className="settings-btn-icon-sm settings-btn-icon-spin" />}
                              {lichessVerificationStatus === 'success' && <CheckCircle2 className="settings-btn-icon-sm" />}
                              {lichessVerificationStatus === 'error' && <AlertCircle className="settings-btn-icon-sm" />}
                              <span>
                                {lichessVerificationStatus === 'idle' && t('profile.verifyLichessButton')}
                                {lichessVerificationStatus === 'checking' && t('profile.checking')}
                                {lichessVerificationStatus === 'success' && t('profile.verified')}
                                {lichessVerificationStatus === 'error' && t('profile.tryAgain')}
                              </span>
                            </button>
                            {lichessUsername && (
                              <a
                                href={`https://lichess.org/@/${lichessUsername.toLowerCase()}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="settings-view-link"
                              >
                                <ExternalLink className="settings-view-link-icon" />
                                {t('profile.viewProfile') || 'View Profile'}
                              </a>
                            )}
                          </div>
                          {lichessVerificationStatus === 'error' && (
                            <div className="settings-error-box">
                              <AlertCircle className="settings-error-icon" />
                              <p className="settings-error-text">
                                {t('profile.makeSureCodeAppearsLichess') || 'Make sure the code appears in your Lichess profile bio or location field.'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Streamer Section - Separate Card */}
          <div className="settings-card-wrapper">
            <div className="settings-card settings-card-main">
              <div className="settings-card-header">
                <div className="settings-card-header-content">
                  <div className="settings-card-icon">
                    <Video className="settings-card-icon-svg" />
                  </div>
                  <div>
                    <p className="settings-card-label">
                      {t('settings.streaming') || 'Streaming'}
                    </p>
                    <h2 className="settings-card-title">
                      {t('profile.streamerInformation') || 'Streamer Information'}
                    </h2>
                  </div>
                </div>
                {!isEditingStreamer && (
                  <button
                    onClick={() => {
                      setIsEditingStreamer(true)
                      setIsStreamer(user?.is_streamer || false)
                      setStreamsChessOnly(user?.streams_chess_only || false)
                      setTwitchUsername(user?.twitch_username || '')
                      setYoutubeChannel(user?.youtube_channel || '')
                      setKickUsername(user?.kick_username || '')
                      setStreamDescription(user?.stream_description || '')
                    }}
                    className="settings-edit-btn"
                  >
                    <Edit2 className="settings-btn-icon" />
                    <span>{user?.is_streamer ? t('common.edit') : t('common.add')}</span>
                  </button>
                )}
              </div>

              {isEditingStreamer ? (
                <div className="settings-card-body">
                  <div className="settings-checkbox-group">
                    <input
                      type="checkbox"
                      id="isStreamer"
                      checked={isStreamer}
                      onChange={(e) => setIsStreamer(e.target.checked)}
                      className="settings-checkbox"
                    />
                    <label htmlFor="isStreamer" className="settings-checkbox-label">
                      {t('profile.iAmStreamer') || 'I am a streamer'}
                    </label>
                  </div>

                  {isStreamer && (
                    <>
                      <div className="settings-checkbox-group">
                        <input
                          type="checkbox"
                          id="streamsChessOnly"
                          checked={streamsChessOnly}
                          onChange={(e) => setStreamsChessOnly(e.target.checked)}
                          className="settings-checkbox"
                        />
                        <label htmlFor="streamsChessOnly" className="settings-checkbox-label">
                          {t('profile.streamChessOnly') || 'I stream chess content only'}
                        </label>
                      </div>

                      <div className="settings-field">
                        <label htmlFor="twitchUsername" className="settings-label">
                          {t('profile.twitchUsername') || 'Twitch Username'}
                        </label>
                        <input
                          id="twitchUsername"
                          type="text"
                          value={twitchUsername}
                          onChange={(e) => setTwitchUsername(e.target.value)}
                          placeholder="your-twitch-username"
                          className="settings-input settings-input-lowercase"
                        />
                        <p className="settings-hint">
                          {t('profile.optionalLeaveEmpty') || 'Optional: Leave empty if you don\'t use this platform'}
                        </p>
                      </div>

                      <div className="settings-field">
                        <label htmlFor="youtubeChannel" className="settings-label">
                          {t('profile.youtubeChannel') || 'YouTube Channel (Username or Channel URL)'}
                        </label>
                        <input
                          id="youtubeChannel"
                          type="text"
                          value={youtubeChannel}
                          onChange={(e) => setYoutubeChannel(e.target.value)}
                          placeholder="your-channel-name or youtube.com/@yourchannel"
                          className="settings-input"
                        />
                        <p className="settings-hint">
                          {t('profile.optionalLeaveEmpty') || 'Optional: Leave empty if you don\'t use this platform'}
                        </p>
                      </div>

                      <div className="settings-field">
                        <label htmlFor="kickUsername" className="settings-label">
                          {t('profile.kickUsername') || 'Kick Username'}
                        </label>
                        <input
                          id="kickUsername"
                          type="text"
                          value={kickUsername}
                          onChange={(e) => setKickUsername(e.target.value)}
                          placeholder="your-kick-username"
                          className="settings-input settings-input-lowercase"
                        />
                        <p className="settings-hint">
                          {t('profile.optionalLeaveEmpty') || 'Optional: Leave empty if you don\'t use this platform'}
                        </p>
                      </div>

                      <div className="settings-field">
                        <label htmlFor="streamDescription" className="settings-label">
                          {t('profile.streamDescription') || 'Stream Description'}
                        </label>
                        <textarea
                          id="streamDescription"
                          value={streamDescription}
                          onChange={(e) => setStreamDescription(e.target.value)}
                          placeholder={t('settings.streamDescriptionPlaceholder') || 'Tell us about your stream...'}
                          rows={4}
                          className="settings-input settings-textarea"
                        />
                      </div>
                    </>
                  )}

                  <div className="settings-actions">
                    <button
                      onClick={handleUpdateStreamer}
                      disabled={savingStreamer}
                      className="settings-btn settings-btn-primary"
                    >
                      {savingStreamer ? (
                        <div className="settings-spinner"></div>
                      ) : (
                        <span>{t('common.saveChanges') || 'Save Changes'}</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingStreamer(false)
                        setIsStreamer(user?.is_streamer || false)
                        setStreamsChessOnly(user?.streams_chess_only || false)
                        setTwitchUsername(user?.twitch_username || '')
                        setYoutubeChannel(user?.youtube_channel || '')
                        setKickUsername(user?.kick_username || '')
                        setStreamDescription(user?.stream_description || '')
                      }}
                      className="settings-btn settings-btn-secondary"
                    >
                      {t('common.cancel') || 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : user?.is_streamer ? (
                <div className="settings-card-body">
                  <div className="settings-streamer-status">
                    <Radio className="settings-streamer-status-icon" />
                    <span className="settings-streamer-status-text">
                      {t('profile.streamerProfileActive') || 'Streamer Profile Active'}
                    </span>
                    {user.streams_chess_only && (
                      <span className="settings-streamer-badge">
                        {t('profile.chessOnly') || 'Chess Only'}
                      </span>
                    )}
                  </div>

                  {user.twitch_username && (
                    <div className="settings-field">
                      <label className="settings-label">
                        {t('settings.twitch') || 'Twitch'}
                      </label>
                      <a
                        href={`https://www.twitch.tv/${user.twitch_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="settings-link"
                      >
                        {user.twitch_username}
                        <ExternalLink className="settings-link-icon" />
                      </a>
                    </div>
                  )}

                  {user.youtube_channel && (
                    <div className="settings-field">
                      <label className="settings-label">
                        {t('settings.youtube') || 'YouTube'}
                      </label>
                      <a
                        href={user.youtube_channel.startsWith('http') ? user.youtube_channel : `https://www.youtube.com/@${user.youtube_channel}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="settings-link"
                      >
                        {user.youtube_channel}
                        <ExternalLink className="settings-link-icon" />
                      </a>
                    </div>
                  )}

                  {user.kick_username && (
                    <div className="settings-field">
                      <label className="settings-label">
                        {t('settings.kick') || 'Kick'}
                      </label>
                      <a
                        href={`https://kick.com/${user.kick_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="settings-link"
                      >
                        {user.kick_username}
                        <ExternalLink className="settings-link-icon" />
                      </a>
                    </div>
                  )}

                  {user.stream_description && (
                    <div className="settings-field">
                      <label className="settings-label">
                        {t('profile.description') || 'Description'}
                      </label>
                      <p className="settings-value">{user.stream_description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="settings-card-body">
                  <p className="settings-empty-text">
                    {t('profile.noStreamerInfo') || 'No streamer information added yet.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}
