import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2, CheckCircle2, XCircle, UserPlus } from 'lucide-react'
import { useAuthStore } from '../../store/auth-store'
import { Skeleton } from '../ui/Skeleton'
import { api } from '../../lib/api'
import { useLanguage } from '../../contexts/LanguageContext'
import './RegistrationPanel.css'

export function RegistrationPanel({ eventId, platform = 'chesscom', chesscomLink, lichessLink }) {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const [isRegistered, setIsRegistered] = useState(null)

  // Fetch Chess.com tournament settings if Chess.com event
  const { data: chesscomTournamentSettings, isLoading: chesscomLoading, error: chesscomError } = useQuery({
    queryKey: ['chesscom-tournament-settings', eventId],
    queryFn: () => api.getChesscomTournamentSettings(eventId),
    enabled: !!eventId && platform === 'chesscom' && !!user?.chesscom_username && !!user?.verified_at,
    refetchInterval: 30000,
    retry: 2,
    refetchOnWindowFocus: false,
  })

  // Fetch event data to get tournament ID for Lichess
  const { data: eventData } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId),
    enabled: !!eventId && platform === 'lichess',
    staleTime: 300000,
  })

  // Fetch Lichess tournament standings to check if user is registered
  // Note: getLichessTournamentStandings may not exist yet, so we'll handle gracefully
  const hasLichessStandingsFunction = typeof api.getLichessTournamentStandings === 'function'
  const { data: lichessStandings, isLoading: lichessStandingsLoading } = useQuery({
    queryKey: ['lichess-tournament-standings', eventId, eventData?.lichess_tournament_id],
    queryFn: async ({ signal }) => {
      if (!eventId || !hasLichessStandingsFunction) return null
      try {
        return await api.getLichessTournamentStandings(eventId, signal)
      } catch (error) {
        return null
      }
    },
    enabled: !!eventId && platform === 'lichess' && !!eventData?.lichess_tournament_id && !!user?.lichess_username && !!user?.lichess_verified_at && hasLichessStandingsFunction,
    staleTime: 30000,
    refetchInterval: 30000,
    retry: 2,
    refetchOnWindowFocus: false,
  })

  const tournamentData = chesscomTournamentSettings
  const isLoading = platform === 'lichess' ? lichessStandingsLoading : chesscomLoading
  const error = platform === 'lichess' ? null : chesscomError
  const participants = platform === 'chesscom' ? (chesscomTournamentSettings?.participants) : undefined

  useEffect(() => {
    // If still loading, keep as null
    if (isLoading) {
      setIsRegistered(null)
      return
    }

    // Chess.com logic - check participants list
    if (platform === 'chesscom') {
      // If there's an error or no tournament data, set to null to show error state
      if (error || !tournamentData) {
        setIsRegistered(null)
        return
      }

      // If tournament data exists but participants is explicitly undefined, we couldn't fetch it
      if (participants === undefined) {
        setIsRegistered(null)
        return
      }

      // If participants is an empty array, user is not registered
      if (participants.length === 0) {
        setIsRegistered(false)
        return
      }

      // Check if user is in participants list
      if (user?.chesscom_username) {
        const userChesscomUsername = user.chesscom_username.toLowerCase()
        const isParticipant = participants.some(
          (p) => p.username.toLowerCase() === userChesscomUsername
        )
        setIsRegistered(isParticipant)
      } else {
        setIsRegistered(false)
      }
      return
    }

    // Lichess logic - check standings to see if user is registered
    if (platform === 'lichess') {
      // Check if user is in standings (they appear in standings if registered and tournament has started)
      if (lichessStandings && user?.lichess_username) {
        const userLichessUsername = user.lichess_username.toLowerCase()
        const isInStandings = lichessStandings.some(
          (standing) => standing.username.toLowerCase() === userLichessUsername
        )
        setIsRegistered(isInStandings)
      } else if (lichessStandings && lichessStandings.length === 0) {
        // Tournament has started but no standings yet, or user not registered
        setIsRegistered(false)
      } else {
        // No standings data yet - tournament might not have started
        setIsRegistered(null)
      }
      return
    }

    // Default: can't determine
    setIsRegistered(null)
  }, [participants, lichessStandings, user?.chesscom_username, user?.lichess_username, isLoading, error, tournamentData, platform])

  if (!user) {
    return (
      <section className="event-detail-section">
        <div className="event-detail-section-header">
          <div className="event-detail-section-icon">
            <UserPlus className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentRegistration') || 'Tournament Registration'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.register') || 'Register'}
            </h2>
          </div>
        </div>
        <div className="event-detail-register-card">
          <div className="event-detail-register-content">
            <p className="event-detail-register-description">
              {t('events.pleaseSignIn') || 'Please sign in to view your registration status.'}
            </p>
          </div>
        </div>
      </section>
    )
  }

  // Check platform-specific verification requirements
  const needsVerification = (platform === 'chesscom' && (!user.chesscom_username || !user.verified_at)) ||
                            (platform === 'lichess' && (!user.lichess_username || !user.lichess_verified_at))

  if (needsVerification) {
    return (
      <section className="event-detail-section">
        <div className="event-detail-section-header">
          <div className="event-detail-section-icon">
            <UserPlus className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentRegistration') || 'Tournament Registration'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.register') || 'Register'}
            </h2>
          </div>
        </div>
        <div className="event-detail-register-card">
          <div className="event-detail-register-content">
            <p className="event-detail-register-description">
              {t('events.verifyUsername', { platform: platform === 'lichess' ? 'Lichess' : 'Chess.com' })}
            </p>
            <p className="event-detail-register-description" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {t('events.goToProfile') || 'Go to your Profile page to verify your username.'}
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (isLoading) {
    return (
      <section className="event-detail-section">
        <div className="event-detail-section-header">
          <div className="event-detail-section-icon">
            <UserPlus className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentRegistration') || 'Tournament Registration'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.register') || 'Register'}
            </h2>
          </div>
        </div>
        <div className="event-detail-register-card">
          <div className="event-detail-register-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Loader2 className="event-detail-register-loading-icon" />
              <p className="event-detail-register-description">
                {t('events.checkingRegistration') || 'Checking registration status...'}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (isRegistered === null) {
    // For Lichess, if we can't determine registration status (tournament hasn't started yet)
    if (platform === 'lichess') {
      return (
        <section className="event-detail-section">
          <div className="event-detail-section-header">
            <div className="event-detail-section-icon">
              <UserPlus className="event-detail-section-icon-svg" />
            </div>
            <div>
              <p className="event-detail-section-label">
                {t('events.tournamentRegistration') || 'Tournament Registration'}
              </p>
              <h2 className="event-detail-section-title">
                {t('events.register') || 'Register'}
              </h2>
            </div>
          </div>
          <div className="event-detail-register-card">
            <div className="event-detail-register-content">
              <p className="event-detail-register-description">
                {!lichessStandings 
                  ? (t('events.registrationStatusAvailable') || "Registration status will be available once the tournament starts. We can check if you're registered by looking at tournament standings.")
                  : (t('events.checkingStandings') || "Checking registration status from tournament standings...")}
              </p>
              {lichessLink ? (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <p className="event-detail-register-description" style={{ fontSize: '0.875rem' }}>
                    {!lichessStandings
                      ? (t('events.clickToRegisterLichess') || "Click the button below to open the tournament page on Lichess where you can register:")
                      : (t('events.openLichessTournament') || "Click the button below to open the tournament page on Lichess:")}
                  </p>
                  <a
                    href={lichessLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-detail-register-button"
                  >
                    {t('events.openTournamentPageLichess') || 'Open Tournament Page on Lichess'}
                    <ExternalLink className="event-detail-register-button-icon" />
                  </a>
                </div>
              ) : (
                <p className="event-detail-register-description" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {t('events.registerOnLichess') || 'Please register for this tournament on Lichess using the tournament link above.'}
                </p>
              )}
            </div>
          </div>
        </section>
      )
    }

    // Chess.com error handling
    if (error || (!isLoading && !tournamentData)) {
      return (
        <section className="event-detail-section">
          <div className="event-detail-section-header">
            <div className="event-detail-section-icon">
              <UserPlus className="event-detail-section-icon-svg" />
            </div>
            <div>
              <p className="event-detail-section-label">
                {t('events.tournamentRegistration') || 'Tournament Registration'}
              </p>
              <h2 className="event-detail-section-title">
                {t('events.register') || 'Register'}
              </h2>
            </div>
          </div>
          <div className="event-detail-register-card">
            <div className="event-detail-register-content">
              <p className="event-detail-register-description">
                {t('events.unableToCheckRegistration') || 'Unable to check registration status from Chess.com at this time. This may be due to network issues or API limitations.'}
              </p>
              {chesscomLink && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <p className="event-detail-register-description" style={{ fontSize: '0.875rem' }}>
                    {t('events.verifyOnChesscom') || 'Please verify your registration directly on Chess.com:'}
                  </p>
                  <a
                    href={chesscomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-detail-register-button"
                  >
                    {t('events.openTournamentPageChesscom') || 'Open Tournament Page on Chess.com'}
                    <ExternalLink className="event-detail-register-button-icon" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      )
    }

    // Chess.com loading state
    return (
      <section className="event-detail-section">
        <div className="event-detail-section-header">
          <div className="event-detail-section-icon">
            <UserPlus className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentRegistration') || 'Tournament Registration'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.register') || 'Register'}
            </h2>
          </div>
        </div>
        <div className="event-detail-register-card">
          <div className="event-detail-register-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 className="event-detail-register-loading-icon" />
              <p className="event-detail-register-description">
                {t('events.checkingChesscom') || 'Checking registration status from Chess.com...'}
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (isRegistered) {
    return (
      <section className="event-detail-section">
        <div className="event-detail-section-header">
          <div className="event-detail-section-icon">
            <UserPlus className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentRegistration') || 'Tournament Registration'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.register') || 'Register'}
            </h2>
          </div>
        </div>
        <div className="event-detail-register-card">
          <div className="event-detail-register-content">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="event-detail-register-badge">
                <CheckCircle2 className="event-detail-register-badge-icon" />
                <span className="event-detail-register-badge-text">
                  {t('events.registeredOn', { platform: platform === 'lichess' ? 'Lichess' : 'Chess.com' })}
                </span>
              </div>
              <p className="event-detail-register-description">
                {t('events.registrationManaged', { platform: platform === 'lichess' ? 'Lichess' : 'Chess.com' })}
              </p>
              {(platform === 'chesscom' ? chesscomLink : lichessLink) && (
                <div style={{ marginTop: '0.5rem' }}>
                  <a
                    href={platform === 'lichess' ? lichessLink || '' : chesscomLink || ''}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-detail-register-button-secondary"
                  >
                    {t('events.openTournamentPage') || 'Open Tournament Page'}
                    <ExternalLink className="event-detail-register-button-icon" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="event-detail-section">
      <div className="event-detail-section-header">
        <div className="event-detail-section-icon">
          <UserPlus className="event-detail-section-icon-svg" />
        </div>
        <div>
          <p className="event-detail-section-label">
            {t('events.tournamentRegistration') || 'Tournament Registration'}
          </p>
          <h2 className="event-detail-section-title">
            {t('events.register') || 'Register'}
          </h2>
        </div>
      </div>
      <div className="event-detail-register-card">
        <div className="event-detail-register-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="event-detail-register-badge event-detail-register-badge-not-registered">
              <XCircle className="event-detail-register-badge-icon" />
              <span className="event-detail-register-badge-text">
                {t('events.notRegistered')}
              </span>
            </div>
            <p className="event-detail-register-description">
              {t('events.notRegisteredYet', { platform: platform === 'lichess' ? 'Lichess' : 'Chess.com' })}
            </p>
            {(platform === 'chesscom' ? chesscomLink : lichessLink) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p className="event-detail-register-description" style={{ fontSize: '0.875rem' }}>
                  {t('events.clickToRegister', { platform: platform === 'lichess' ? 'Lichess' : 'Chess.com' })}
                </p>
                <a
                  href={platform === 'lichess' ? lichessLink || '' : chesscomLink || ''}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="event-detail-register-button"
                >
                  {t('events.registerOn', { platform: platform === 'lichess' ? 'Lichess' : 'Chess.com' })}
                  <ExternalLink className="event-detail-register-button-icon" />
                </a>
              </div>
            ) : (
              <p className="event-detail-register-description" style={{ fontSize: '0.875rem' }}>
                {t('events.registerUsingLink', { platform: platform === 'lichess' ? 'Lichess' : 'Chess.com' })}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

