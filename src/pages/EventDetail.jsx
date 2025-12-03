import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEvent } from '../hooks/use-events'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { formatEventDateTime, calculateEventStatus } from '../lib/utils/event-status'
import { Users, Clock, ExternalLink, Calendar, Award, Gamepad2, ArrowLeft } from 'lucide-react'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { api } from '../lib/api'
import { RegistrationPanel } from '../components/events/RegistrationPanel'
import { StandingsTable } from '../components/standings/StandingsTable'
import { GamesList } from '../components/games/GamesList'
import { PageLoader } from '../components/ui/PageLoader'
import './EventDetail.css'

export function EventDetail() {
  const { t } = useLanguage()
  const { id } = useParams()
  const { data: event, isLoading } = useEvent(id || '')

  // Set SEO based on event data
  useSEO({
    title: event?.name || (t('events.eventDetails') || 'Event Details'),
    description: event?.description
      ? `${event.description.substring(0, 150)}...`
      : `${event?.name || 'This chess tournament'} - View tournament details, standings, and games.`,
    keywords: event?.name ? `chess tournament, ${event.name}, chess event, tournament standings, chess games` : 'chess tournament, chess event',
    url: event?.id ? `/events/${event.id}` : '/events',
  })

  // Calculate status using the same logic as other pages
  const displayStatus = event ? calculateEventStatus(event) : 'upcoming'

  // Only show register tab for upcoming or in_progress events
  const showRegisterTab = displayStatus === 'upcoming' || displayStatus === 'in_progress'

  // Determine platform and enable queries accordingly
  const platform = event?.platform || (event?.chesscom_tournament_id ? 'chesscom' : event?.lichess_tournament_id ? 'lichess' : null)
  const chesscomQueryEnabled = !!event?.id && !!event?.chesscom_tournament_id && !!event?.chesscom_club_id && platform === 'chesscom'
  const lichessQueryEnabled = !!event?.id && !!event?.lichess_tournament_id && platform === 'lichess'

  // Fetch Chess.com tournament settings (if Chess.com event)
  const { data: chesscomTournamentSettings, isLoading: chesscomSettingsLoading } = useQuery({
    queryKey: ['chesscom-tournament-settings', event?.id],
    queryFn: () => api.getChesscomTournamentSettings(event?.id || ''),
    enabled: chesscomQueryEnabled,
    staleTime: 60000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  // Fetch standings (platform-specific)
  const { data: chesscomStandings, isLoading: chesscomStandingsLoading, error: chesscomStandingsError } = useQuery({
    queryKey: ['chesscom-tournament-standings', event?.id],
    queryFn: () => api.getChesscomTournamentStandings(event?.id || ''),
    enabled: chesscomQueryEnabled,
    staleTime: 300000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 2,
  })

  // Fetch Lichess tournament standings (if Lichess event and function exists)
  const hasLichessStandingsFunction = typeof api.getLichessTournamentStandings === 'function'
  const { data: lichessStandings, isLoading: lichessStandingsLoading, error: lichessStandingsError } = useQuery({
    queryKey: ['lichess-tournament-standings', event?.id],
    queryFn: async ({ signal }) => {
      if (!event?.id || !hasLichessStandingsFunction) return null
      try {
        return await api.getLichessTournamentStandings(event.id, signal)
      } catch (error) {
        return null
      }
    },
    enabled: lichessQueryEnabled && hasLichessStandingsFunction,
    staleTime: 300000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 2,
  })

  // Use settings data
  const tournamentSettings = chesscomTournamentSettings
  const isLoadingSettings = chesscomSettingsLoading

  // Combine platform-specific standings data
  const standings = platform === 'lichess' ? lichessStandings : chesscomStandings
  const standingsLoading = platform === 'lichess' ? lichessStandingsLoading : chesscomStandingsLoading
  const standingsError = platform === 'lichess' ? lichessStandingsError : chesscomStandingsError

  // Fetch games (platform-specific)
  // Note: API functions for tournament games may not exist yet, so we'll handle gracefully
  const hasChesscomGamesFunction = typeof api.getChesscomTournamentGames === 'function'
  const { data: chesscomGames, isLoading: chesscomGamesLoading, error: chesscomGamesError } = useQuery({
    queryKey: ['chesscom-tournament-games', event?.id],
    queryFn: async ({ signal }) => {
      if (!event?.id || !hasChesscomGamesFunction) return null
      try {
        return await api.getChesscomTournamentGames(event.id, signal)
      } catch (error) {
        return null
      }
    },
    enabled: chesscomQueryEnabled && hasChesscomGamesFunction,
    staleTime: 300000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 2,
  })

  const hasLichessGamesFunction = typeof api.getLichessTournamentGames === 'function'
  const { data: lichessGames, isLoading: lichessGamesLoading, error: lichessGamesError } = useQuery({
    queryKey: ['lichess-tournament-games', event?.id],
    queryFn: async ({ signal }) => {
      if (!event?.id || !hasLichessGamesFunction) return null
      try {
        return await api.getLichessTournamentGames(event.id, signal)
      } catch (error) {
        return null
      }
    },
    enabled: lichessQueryEnabled && hasLichessGamesFunction,
    staleTime: 300000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 2,
  })

  // Combine platform-specific games data
  const games = platform === 'lichess' ? lichessGames : chesscomGames
  const gamesLoading = platform === 'lichess' ? lichessGamesLoading : chesscomGamesLoading
  const gamesError = platform === 'lichess' ? lichessGamesError : chesscomGamesError

  // Get valid tabs based on event status
  const getValidTabs = useCallback(() => {
    const tabs = ['overview']
    if (showRegisterTab) {
      tabs.push('register')
    }
    tabs.push('standings', 'games')
    return tabs
  }, [showRegisterTab])

  const [activeTab, setActiveTab] = useState('overview')

  // Update URL hash when tab changes
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab)
    // Update URL hash (overview doesn't need a hash)
    if (tab === 'overview') {
      window.history.replaceState(null, '', window.location.pathname)
    } else {
      window.history.replaceState(null, '', `${window.location.pathname}#${tab}`)
    }
  }, [])

  // Handle URL hash changes and validate on mount
  useEffect(() => {
    if (!event) return // Wait for event to load

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      const validTabs = getValidTabs()

      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash)
      } else if (!hash) {
        setActiveTab('overview')
      } else {
        // Invalid hash (e.g., #register on finished event) - redirect to overview
        setActiveTab('overview')
        window.history.replaceState(null, '', window.location.pathname)
      }
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)

    // Check hash on mount and when dependencies change
    handleHashChange()

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [event, getValidTabs])

  // Redirect to overview if trying to access register tab for finished events
  useEffect(() => {
    if (event && activeTab === 'register' && !showRegisterTab) {
      setActiveTab('overview')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [event, activeTab, showRegisterTab])

  if (isLoading) {
    return <PageLoader />
  }

  if (!event) {
    return (
      <Container>
        <div className="event-detail-page">
          <div className="event-detail-not-found">
            <p>{t('events.eventNotFound') || 'Event not found'}</p>
            <Link to="/events" className="event-detail-back-link">
              <ArrowLeft className="event-detail-back-icon" />
              <span>{t('events.backToEvents') || 'Back to Events'}</span>
            </Link>
          </div>
        </div>
      </Container>
    )
  }

  const tabs = [
    { id: 'overview', label: t('events.overview') || 'Overview' },
    ...(showRegisterTab ? [{ id: 'register', label: t('events.register') || 'Register' }] : []),
    { id: 'standings', label: t('events.standings') || 'Standings' },
    { id: 'games', label: t('events.games') || 'Games' },
  ]

  return (
    <Container>
      <div className="event-detail-page">
        {/* Back Button */}
        <Link
          to="/events"
          className="event-detail-back-link"
        >
          <ArrowLeft className="event-detail-back-icon" />
          <span>{t('events.backToEvents') || 'Back to Events'}</span>
        </Link>

        {/* Hero Section */}
        <section className="event-detail-hero">
          <div className="event-detail-hero-content">
            <p className="event-detail-hero-label">
              {t('events.chessTournament') || 'Chess Tournament'}
            </p>
            <h1 className="event-detail-hero-title">
              {event.name}
            </h1>
            <div className="event-detail-hero-status">
              {displayStatus.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </div>

            {/* Quick Info Pills */}
            <div className="event-detail-hero-info">
              <div className="event-detail-info-pill">
                <Clock className="event-detail-info-icon" />
                {formatEventDateTime(event.start_time, event.timezone, 'short')}
              </div>
              {event.type && (
                <div className="event-detail-info-pill">
                  <Gamepad2 className="event-detail-info-icon" />
                  {event.type}
                </div>
              )}
              {event.time_control && (
                <div className="event-detail-info-pill">
                  <Clock className="event-detail-info-icon" />
                  {event.time_control}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="event-detail-tabs">
          <nav className="event-detail-tabs-nav" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`event-detail-tab ${activeTab === tab.id ? 'active' : ''}`}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="event-detail-content">
            {/* Event Details */}
            <section className="event-detail-section">
              <div className="event-detail-section-header">
                <div className="event-detail-section-icon">
                  <Award className="event-detail-section-icon-svg" />
                </div>
                <div>
                  <p className="event-detail-section-label">
                    {t('events.tournamentInformation') || 'Tournament Information'}
                  </p>
                  <h2 className="event-detail-section-title">
                    {t('events.eventDetails') || 'Event Details'}
                  </h2>
                </div>
              </div>

              <div className="event-detail-details-grid">
                <Card className="event-detail-detail-card">
                  <dt className="event-detail-detail-label">
                    <Calendar className="event-detail-detail-icon" />
                    {t('events.startTime') || 'Start Time'}
                  </dt>
                  <dd className="event-detail-detail-value">
                    {formatEventDateTime(event.start_time, event.timezone, 'short')}
                  </dd>
                </Card>
                <Card className="event-detail-detail-card">
                  <dt className="event-detail-detail-label">
                    <Calendar className="event-detail-detail-icon" />
                    {t('events.endTime') || 'End Time'}
                  </dt>
                  <dd className="event-detail-detail-value">
                    {formatEventDateTime(event.end_time, event.timezone, 'short')}
                  </dd>
                </Card>
                {/* Show loading skeleton if tournament data is loading */}
                {isLoadingSettings && chesscomQueryEnabled && (
                  <>
                    <Card className="event-detail-detail-card">
                      <dt className="event-detail-detail-label">
                        <Users className="event-detail-detail-icon" />
                        {t('events.registeredPlayers') || 'Registered Players'}
                      </dt>
                      <dd className="event-detail-detail-value">
                        <Skeleton className="h-5 w-16" />
                      </dd>
                    </Card>
                    <Card className="event-detail-detail-card">
                      <dt className="event-detail-detail-label">
                        <Clock className="event-detail-detail-icon" />
                        {t('events.timeClass') || 'Time Class'}
                      </dt>
                      <dd className="event-detail-detail-value">
                        <Skeleton className="h-5 w-20" />
                      </dd>
                    </Card>
                  </>
                )}

                {/* Show actual data when loaded (Chess.com) */}
                {!isLoadingSettings && chesscomQueryEnabled && tournamentSettings?.settings?.registered_user_count !== undefined && (
                  <Card className="event-detail-detail-card">
                    <dt className="event-detail-detail-label">
                      <Users className="event-detail-detail-icon" />
                      {t('events.registeredPlayers') || 'Registered Players'}
                    </dt>
                    <dd className="event-detail-detail-value">
                      {tournamentSettings.settings.registered_user_count}
                    </dd>
                  </Card>
                )}
                {!isLoadingSettings && chesscomQueryEnabled && tournamentSettings?.settings?.time_class && (
                  <Card className="event-detail-detail-card">
                    <dt className="event-detail-detail-label">
                      <Clock className="event-detail-detail-icon" />
                      {t('events.timeClass') || 'Time Class'}
                    </dt>
                    <dd className="event-detail-detail-value">
                      {tournamentSettings.settings.time_class.charAt(0).toUpperCase() + tournamentSettings.settings.time_class.slice(1)}
                    </dd>
                  </Card>
                )}

                {/* Fallback to event data if API data not available */}
                {!chesscomQueryEnabled && (event.registered_players !== undefined || event.registered_user_count !== undefined) && (
                  <Card className="event-detail-detail-card">
                    <dt className="event-detail-detail-label">
                      <Users className="event-detail-detail-icon" />
                      {t('events.registeredPlayers') || 'Registered Players'}
                    </dt>
                    <dd className="event-detail-detail-value">
                      {event.registered_players ?? event.registered_user_count ?? 0}
                    </dd>
                  </Card>
                )}
                {!chesscomQueryEnabled && (event.time_class || event.time_control) && (
                  <Card className="event-detail-detail-card">
                    <dt className="event-detail-detail-label">
                      <Clock className="event-detail-detail-icon" />
                      {t('events.timeClass') || 'Time Class'}
                    </dt>
                    <dd className="event-detail-detail-value">
                      {event.time_class || event.time_control}
                    </dd>
                  </Card>
                )}
                {event.chesscom_link && (
                  <Card className="event-detail-detail-card">
                    <dt className="event-detail-detail-label">
                      <ExternalLink className="event-detail-detail-icon" />
                      {t('events.chesscomLink') || 'Chess.com Link'}
                    </dt>
                    <dd className="event-detail-detail-value">
                      <a
                        href={event.chesscom_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="event-detail-external-link"
                      >
                        {t('events.openTournamentPage') || 'Open Tournament Page'}
                        <ExternalLink className="event-detail-external-link-icon" />
                      </a>
                    </dd>
                  </Card>
                )}
                {event.lichess_link && (
                  <Card className="event-detail-detail-card">
                    <dt className="event-detail-detail-label">
                      <ExternalLink className="event-detail-detail-icon" />
                      {t('events.lichessLink') || 'Lichess Link'}
                    </dt>
                    <dd className="event-detail-detail-value">
                      <a
                        href={event.lichess_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="event-detail-external-link"
                      >
                        {t('events.openTournamentPage') || 'Open Tournament Page'}
                        <ExternalLink className="event-detail-external-link-icon" />
                      </a>
                    </dd>
                  </Card>
                )}
              </div>
            </section>

            {/* Description */}
            {event.description && (
              <section className="event-detail-section">
                <div className="event-detail-section-header">
                  <div className="event-detail-section-icon">
                    <Award className="event-detail-section-icon-svg" />
                  </div>
                  <div>
                    <p className="event-detail-section-label">
                      {t('events.tournamentInformation') || 'Tournament Information'}
                    </p>
                    <h2 className="event-detail-section-title">
                      {t('events.eventDescription')}
                    </h2>
                  </div>
                </div>

                <Card className="event-detail-description-card">
                  <div className="event-detail-description-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="event-detail-markdown-p">{children}</p>,
                        h1: ({ children }) => <h1 className="event-detail-markdown-h1">{children}</h1>,
                        h2: ({ children }) => <h2 className="event-detail-markdown-h2">{children}</h2>,
                        h3: ({ children }) => <h3 className="event-detail-markdown-h3">{children}</h3>,
                        ul: ({ children }) => <ul className="event-detail-markdown-ul">{children}</ul>,
                        ol: ({ children }) => <ol className="event-detail-markdown-ol">{children}</ol>,
                        li: ({ children }) => <li className="event-detail-markdown-li">{children}</li>,
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="event-detail-markdown-a"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {event.description}
                    </ReactMarkdown>
                  </div>
                </Card>
              </section>
            )}
          </div>
        )}

        {activeTab === 'register' && showRegisterTab && (
          <div className="event-detail-content">
            <RegistrationPanel
              eventId={event.id}
              platform={platform || 'chesscom'}
              chesscomLink={event.chesscom_link}
              lichessLink={event.lichess_link}
            />
          </div>
        )}

        {activeTab === 'standings' && (
          <div className="event-detail-content">
            <StandingsTable
              standings={standings}
              isLoading={standingsLoading}
              error={standingsError}
              platform={platform || 'chesscom'}
              tournamentStatus={displayStatus}
            />
          </div>
        )}

        {activeTab === 'games' && (
          <div className="event-detail-content">
            <GamesList
              games={games}
              isLoading={gamesLoading}
              error={gamesError}
              platform={platform || 'chesscom'}
            />
          </div>
        )}
      </div>
    </Container>
  )
}

