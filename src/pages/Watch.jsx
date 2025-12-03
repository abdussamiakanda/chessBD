import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { Video, Trophy, Radio, Eye, ExternalLink, Clock, X, Circle } from 'lucide-react'
import { TwitchIcon } from '../components/ui/TwitchIcon'
import { YouTubeIcon } from '../components/ui/YouTubeIcon'
import { KickIcon } from '../components/ui/KickIcon'
import { ChesscomIcon } from '../components/ui/ChesscomIcon'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { api } from '../lib/api'
import { PlayerName } from '../components/PlayerName'
import { generateEventSlug } from '../lib/utils/slug'
import './Watch.css'

export function Watch() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('streamers')

  useSEO({
    title: t('watch.title'),
    description: t('watch.description'),
    keywords: 'live chess, chess streamers, chess matches, tournament games, live chess games',
    url: '/watch',
  })

  // Fetch active events for live tournament games
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.getEvents(),
    staleTime: 30000,
  })

  // Fetch live games for ChessBD users
  const { data: liveGames, isLoading: liveGamesLoading, error: liveGamesError } = useQuery({
    queryKey: ['chessbd-live-games'],
    queryFn: () => api.getChessBDLiveGames(),
    staleTime: 10000, // Refresh every 10 seconds
    refetchInterval: 15000, // Auto-refetch every 15 seconds
    refetchOnWindowFocus: true,
  })

  // Fetch live streamers
  const { data: liveStreamers, isLoading: streamersLoading } = useQuery({
    queryKey: ['live-streamers'],
    queryFn: () => api.getLiveStreamers(),
    staleTime: 30000, // Refresh every 30 seconds
    refetchInterval: 60000, // Auto-refetch every 60 seconds
    refetchOnWindowFocus: true,
  })

  const activeEvents = events?.filter(e => e.status === 'in_progress') || []
  const [selectedGameIndex, setSelectedGameIndex] = useState(null)
  const [selectedGameId, setSelectedGameId] = useState(null)

  // Fetch updated game data when a game is selected for live viewing
  const { data: updatedGameData } = useQuery({
    queryKey: ['lichess-current-game', selectedGameId],
    queryFn: () => {
      if (!selectedGameId || !liveGames) return null
      const game = liveGames.find(g => g.id === selectedGameId)
      if (!game) return null
      // Find the ChessBD user's username
      const chessbdUsername = game.chessbdUser.lichess_username
      return api.getLichessCurrentGame(chessbdUsername)
    },
    enabled: !!selectedGameId && selectedGameIndex !== null,
    refetchInterval: () => {
      // Only refetch if modal is open and game is still live
      return selectedGameIndex !== null ? 1000 : false // Poll every 1 second for near real-time updates
    },
    staleTime: 0, // Always consider stale to get fresh data
  })

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && selectedGameIndex !== null) {
        setSelectedGameIndex(null)
        setSelectedGameId(null)
      }
    }

    if (selectedGameIndex !== null) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [selectedGameIndex])

  const selectedGameData = selectedGameIndex !== null && liveGames ? liveGames[selectedGameIndex] : null
  
  // Use updated game data if available, otherwise fall back to original
  // Always prioritize the latest PGN from updatedGameData
  const displayGameData = selectedGameIndex !== null && selectedGameData
    ? (updatedGameData && updatedGameData.pgn
        ? {
            ...selectedGameData,
            pgn: updatedGameData.pgn,
            white: updatedGameData.white || selectedGameData.white,
            black: updatedGameData.black || selectedGameData.black,
          }
        : selectedGameData)
    : null

  // Format time control for display
  const formatTimeControl = (clock, perf) => {
    if (clock) {
      const minutes = Math.floor(clock.initial / 60)
      const seconds = clock.initial % 60
      const increment = clock.increment
      if (minutes > 0) {
        return `${minutes}+${increment}`
      }
      return `${seconds}+${increment}`
    }
    // Fallback to perf name
    if (perf) {
      const perfMap = {
        'rapid': t('player.rapid') || 'Rapid',
        'blitz': t('player.blitz') || 'Blitz',
        'bullet': t('player.bullet') || 'Bullet',
        'classical': t('player.classical') || 'Classical',
        'ultraBullet': t('player.ultraBullet') || 'Ultra Bullet',
      }
      return perfMap[perf] || perf.charAt(0).toUpperCase() + perf.slice(1)
    }
    return t('watch.unknown') || 'Unknown'
  }

  return (
    <Container>
      <div className="watch-page">
        {/* Hero Section */}
        <section className="watch-hero">
          <div className="watch-hero-content">
            <p className="watch-hero-label">
              {t('watch.liveAction') || 'Live Action'}
            </p>
            <h1 className="watch-hero-title">
              {t('watch.title')}
            </h1>
            <p className="watch-hero-description">
              {t('watch.description')}
            </p>
          </div>
        </section>

        {/* Tabs */}
        <div className="watch-tabs">
          <button
            onClick={() => setActiveTab('streamers')}
            className={`watch-tab ${activeTab === 'streamers' ? 'watch-tab-active' : ''}`}
          >
            <Radio className="watch-tab-icon" />
            {t('watch.streamers')}
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`watch-tab ${activeTab === 'matches' ? 'watch-tab-active' : ''}`}
          >
            <Video className="watch-tab-icon" />
            {t('watch.liveMatches')}
          </button>
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`watch-tab ${activeTab === 'tournaments' ? 'watch-tab-active' : ''}`}
          >
            <Trophy className="watch-tab-icon" />
            {t('watch.tournamentGames')}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'matches' && (
          <section className="watch-section">
            <div className="watch-section-header">
              <div>
                <p className="watch-section-label">{t('watch.liveGames') || 'Live games'}</p>
                <h2 className="watch-section-title">
                  {t('watch.liveMatches')}
                </h2>
                <p className="watch-section-description">
                  {t('watch.liveMatchDescription')}
                </p>
              </div>
            </div>
            {liveGamesLoading ? (
              <div className="watch-grid">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="watch-skeleton" />
                ))}
              </div>
            ) : liveGamesError ? (
              <Card className="watch-error-card">
                <div className="watch-error-content">
                  <div className="watch-error-icon">
                    <Video className="watch-error-icon-svg" />
                  </div>
                  <div>
                    <h3 className="watch-error-title">{t('watch.errorLoadingGames') || 'Error Loading Live Games'}</h3>
                    <p className="watch-error-description">{t('watch.errorLoadingGamesDescription') || 'Failed to fetch live games. Please try again later.'}</p>
                    <p className="watch-error-message">{liveGamesError?.message || (t('watch.unknownError') || 'Unknown error')}</p>
                  </div>
                </div>
              </Card>
            ) : liveGames && liveGames.length > 0 ? (
              <>
                <div className="watch-grid">
                  {liveGames.map((game, index) => {
                  const chessbdPlayer = game.chessbdUser
                  const isWhite = game.white.username.toLowerCase() === chessbdPlayer.lichess_username.toLowerCase()
                  
                  return (
                    <Card key={game.id} className="watch-game-card">
                      <div className="watch-game-card-glow"></div>
                      {/* Live indicator */}
                      <div className="watch-game-live-indicator">
                        <span className="watch-live-badge">
                          <Circle className="watch-live-dot" />
                          {t('watch.live')}
                        </span>
                      </div>
                      <div className="watch-game-card-content">
                        <div className="watch-game-time-control">
                          <Clock className="watch-game-time-icon" />
                          <span className="watch-game-time-text">
                            {formatTimeControl(game.clock, game.perf)}
                          </span>
                        </div>
                        
                        <div className="watch-game-players">
                          <div className="watch-game-player">
                            <div className="watch-game-player-label">{t('watch.white') || 'White'}</div>
                            <div className="watch-game-player-info">
                              <PlayerName 
                                username={game.white.username} 
                                showTitle={true} 
                                platform="lichess"
                              />
                              {game.white.rating && (
                                <span className="watch-game-player-rating">({game.white.rating})</span>
                              )}
                            </div>
                            {isWhite && (
                              <span className="watch-game-chessbd-badge">
                                {t('common.chessBD') || 'ChessBD'}
                              </span>
                            )}
                          </div>
                          
                          <div className="watch-game-vs">VS</div>
                          
                          <div className="watch-game-player">
                            <div className="watch-game-player-label">{t('watch.black') || 'Black'}</div>
                            <div className="watch-game-player-info">
                              <PlayerName 
                                username={game.black.username} 
                                showTitle={true} 
                                platform="lichess"
                              />
                              {game.black.rating && (
                                <span className="watch-game-player-rating">({game.black.rating})</span>
                              )}
                            </div>
                            {!isWhite && (
                              <span className="watch-game-chessbd-badge">
                                {t('common.chessBD') || 'ChessBD'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="watch-game-actions">
                          {game.url && (
                            <a
                              href={game.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="watch-game-action-btn watch-game-action-btn-secondary"
                            >
                              <ExternalLink className="watch-game-action-icon" />
                              <span>{t('watch.view') || 'View'}</span>
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setSelectedGameIndex(selectedGameIndex === index ? null : index)
                              setSelectedGameId(selectedGameIndex === index ? null : game.id)
                            }}
                            className="watch-game-action-btn watch-game-action-btn-primary"
                            disabled={!game.pgn}
                          >
                            <Eye className="watch-game-action-icon" />
                            {t('watch.seeLive') || 'See Live'}
                          </button>
                        </div>
                      </div>
                    </Card>
                  )
                  })}
                </div>

                {/* Modal Overlay */}
                {displayGameData?.pgn && (
                  <div
                    className="watch-modal-overlay"
                    onClick={() => {
                      setSelectedGameIndex(null)
                      setSelectedGameId(null)
                    }}
                  >
                    {/* Backdrop */}
                    <div className="watch-modal-backdrop" />
                    
                    {/* Modal Content */}
                    <div
                      className="watch-modal-content"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="watch-modal-card">
                        <div className="watch-modal-header">
                          <div className="watch-modal-header-left">
                            <h3 className="watch-modal-title">{t('watch.gameViewer') || 'Game Viewer'}</h3>
                            <span className="watch-live-badge">
                              {t('watch.live')}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedGameIndex(null)
                              setSelectedGameId(null)
                            }}
                            className="watch-modal-close-btn"
                            aria-label={t('common.close') || 'Close modal'}
                          >
                            <X className="watch-modal-close-icon" />
                            <span>{t('common.close') || 'Close'}</span>
                          </button>
                        </div>
                        {displayGameData.pgn && (
                          <div className="watch-modal-game-viewer">
                            <p className="watch-modal-game-info">
                              {t('watch.white') || 'White'}: {displayGameData.white.username} 
                              {displayGameData.white.rating && ` (${displayGameData.white.rating})`}
                            </p>
                            <p className="watch-modal-game-info">
                              {t('watch.black') || 'Black'}: {displayGameData.black.username}
                              {displayGameData.black.rating && ` (${displayGameData.black.rating})`}
                            </p>
                            <div className="watch-modal-pgn-container">
                              <pre className="watch-modal-pgn">{displayGameData.pgn}</pre>
                            </div>
                            {displayGameData.url && (
                              <a
                                href={displayGameData.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="watch-modal-view-link"
                              >
                                <ExternalLink className="watch-modal-view-link-icon" />
                                {t('watch.view') || 'View'} on Lichess
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Card className="watch-empty-card">
                <div className="watch-empty-content">
                  <div className="watch-empty-icon">
                    <Video className="watch-empty-icon-svg" />
                  </div>
                  <div>
                    <h3 className="watch-empty-title">
                      {t('watch.noLiveMatches')}
                    </h3>
                    <p className="watch-empty-description">
                      {t('watch.noLiveMatchesDescription') || 'No live matches at the moment. Check back soon!'}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </section>
        )}

        {activeTab === 'streamers' && (
          <section className="watch-section">
            <div className="watch-section-header">
              <div>
                <p className="watch-section-label">{t('watch.liveStreaming') || 'Live streaming'}</p>
                <h2 className="watch-section-title">
                  {t('watch.streamers')}
                </h2>
                <p className="watch-section-description">
                  {t('watch.streamerDescription')}
                </p>
              </div>
            </div>
            {streamersLoading ? (
              <div className="watch-grid">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="watch-skeleton" />
                ))}
              </div>
            ) : liveStreamers && liveStreamers.length > 0 ? (
              <div className="watch-grid">
                {liveStreamers.map((streamer) => {
                  // Check if this is a ManualStream or User
                  const isManualStream = 'platform' in streamer && !('email' in streamer)
                  
                  const getPlatformUrl = () => {
                    if (isManualStream) {
                      const manualStream = streamer
                      switch (manualStream.livePlatform) {
                        case 'twitch':
                          return `https://www.twitch.tv/${manualStream.username}`
                        case 'youtube':
                          return manualStream.username.startsWith('http')
                            ? manualStream.username
                            : `https://www.youtube.com/@${manualStream.username}`
                        case 'kick':
                          return `https://kick.com/${manualStream.username}`
                        case 'chesscom':
                          return `https://www.chess.com/member/${manualStream.username}`
                        default:
                          return '#'
                      }
                    } else {
                      const userStreamer = streamer
                      switch (userStreamer.livePlatform) {
                        case 'twitch':
                          return `https://www.twitch.tv/${userStreamer.twitch_username}`
                        case 'youtube':
                          return userStreamer.youtube_channel?.startsWith('http') 
                            ? userStreamer.youtube_channel 
                            : `https://www.youtube.com/@${userStreamer.youtube_channel}`
                        case 'kick':
                          return `https://kick.com/${userStreamer.kick_username}`
                        case 'chesscom':
                          return `https://www.chess.com/member/${userStreamer.chesscom_username}`
                        default:
                          return '#'
                      }
                    }
                  }

                  const getPlatformIcon = () => {
                    switch (streamer.livePlatform) {
                      case 'twitch':
                        return <TwitchIcon className="watch-streamer-platform-icon watch-streamer-platform-icon-twitch" />
                      case 'youtube':
                        return <YouTubeIcon className="watch-streamer-platform-icon watch-streamer-platform-icon-youtube" />
                      case 'kick':
                        return <KickIcon className="watch-streamer-platform-icon watch-streamer-platform-icon-kick" />
                      case 'chesscom':
                        return <ChesscomIcon className="watch-streamer-platform-icon watch-streamer-platform-icon-chesscom" />
                      default:
                        return null
                    }
                  }

                  const getPlatformName = () => {
                    switch (streamer.livePlatform) {
                      case 'twitch':
                        return 'Twitch'
                      case 'youtube':
                        return 'YouTube'
                      case 'kick':
                        return 'Kick'
                      case 'chesscom':
                        return 'Chess.com'
                      default:
                        return 'Streaming'
                    }
                  }

                  const getPlatformButtonClasses = () => {
                    switch (streamer.livePlatform) {
                      case 'twitch':
                        return 'watch-streamer-btn watch-streamer-btn-twitch'
                      case 'youtube':
                        return 'watch-streamer-btn watch-streamer-btn-youtube'
                      case 'kick':
                        return 'watch-streamer-btn watch-streamer-btn-kick'
                      case 'chesscom':
                        return 'watch-streamer-btn watch-streamer-btn-chesscom'
                      default:
                        return 'watch-streamer-btn watch-streamer-btn-chesscom'
                    }
                  }

                  return (
                    <Card key={streamer.id} className="watch-streamer-card">
                      <div className="watch-streamer-card-glow"></div>
                      {/* Live indicator */}
                      <div className="watch-streamer-live-indicator">
                        <span className="watch-live-badge">
                          <Circle className="watch-live-dot" />
                          {t('watch.live')}
                        </span>
                      </div>

                      <div className="watch-streamer-card-content">
                        <div className="watch-streamer-header">
                          <div className={`watch-streamer-platform-icon-wrapper watch-streamer-platform-icon-wrapper-${streamer.livePlatform}`}>
                            {getPlatformIcon()}
                          </div>
                          <div className="watch-streamer-info">
                            <h3 className="watch-streamer-name">
                              {isManualStream ? (
                                streamer.name
                              ) : (
                                <PlayerName
                                  username={streamer.chesscom_username || streamer.lichess_username || streamer.email}
                                  name={streamer.name}
                                  email={streamer.email}
                                  showTitle={true}
                                  platform={streamer.chesscom_username ? 'chesscom' : 'lichess'}
                                />
                              )}
                            </h3>
                            <p className="watch-streamer-platform-name">{getPlatformName()}</p>
                          </div>
                        </div>

                        {streamer.liveInfo?.title && (
                          <div className="watch-streamer-title">
                            <p className="watch-streamer-title-text">{streamer.liveInfo.title}</p>
                          </div>
                        )}

                        {streamer.liveInfo?.viewerCount !== undefined && (
                          <div className="watch-streamer-viewers">
                            <Eye className="watch-streamer-viewers-icon" />
                            <span>{streamer.liveInfo.viewerCount.toLocaleString()} {t('watch.viewers') || 'viewers'}</span>
                          </div>
                        )}

                        <a
                          href={getPlatformUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={getPlatformButtonClasses()}
                        >
                          <ExternalLink className="watch-streamer-btn-icon" />
                          {t('watch.watchOn') || 'Watch on'} {getPlatformName()}
                        </a>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="watch-empty-card">
                <div className="watch-empty-content">
                  <div className="watch-empty-icon">
                    <Radio className="watch-empty-icon-svg" />
                  </div>
                  <div>
                    <h3 className="watch-empty-title">
                      {t('watch.noStreamers')}
                    </h3>
                    <p className="watch-empty-description">
                      {t('watch.noStreamersDescription') || 'No streamers are live at the moment. Check back soon!'}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </section>
        )}

        {activeTab === 'tournaments' && (
          <section className="watch-section">
            <div className="watch-section-header">
              <div>
                <p className="watch-section-label">{t('watch.activeTournaments') || 'Active tournaments'}</p>
                <h2 className="watch-section-title">
                  {t('watch.tournamentGames')}
                </h2>
                <p className="watch-section-description">
                  {t('watch.tournamentGameDescription')}
                </p>
              </div>
            </div>
            {eventsLoading ? (
              <div className="watch-grid">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="watch-skeleton" />
                ))}
              </div>
            ) : activeEvents.length > 0 ? (
              <div className="watch-grid">
                {activeEvents.map((event) => {
                  // Use slug if available, otherwise generate it from name
                  const eventUrl = event.slug || (event.name ? generateEventSlug(event.name) : event.id)
                  
                  return (
                    <Card key={event.id} className="watch-tournament-card">
                      <div className="watch-tournament-card-glow"></div>
                      {/* Live indicator */}
                      <div className="watch-tournament-live-indicator">
                        <span className="watch-live-badge">
                          <Circle className="watch-live-dot" />
                          {t('watch.live')}
                        </span>
                      </div>
                      <div className="watch-tournament-card-content">
                        <div className="watch-tournament-header">
                          <div className="watch-tournament-icon-wrapper">
                            <Trophy className="watch-tournament-icon" />
                          </div>
                          <div className="watch-tournament-info">
                            <Link
                              to={`/events/${eventUrl}`}
                              className="watch-tournament-name"
                            >
                              {event.name}
                            </Link>
                          </div>
                        </div>
                        {event.description && (
                          <div className="watch-tournament-description">
                            <p className="watch-tournament-description-text">{event.description}</p>
                          </div>
                        )}
                        <Link
                          to={`/events/${eventUrl}`}
                          className="watch-tournament-btn"
                        >
                          <Eye className="watch-tournament-btn-icon" />
                          {t('watch.viewGame')}
                        </Link>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="watch-empty-card">
                <div className="watch-empty-content">
                  <div className="watch-empty-icon">
                    <Trophy className="watch-empty-icon-svg" />
                  </div>
                  <div>
                    <h3 className="watch-empty-title">
                      {t('watch.noTournamentGames')}
                    </h3>
                    <p className="watch-empty-description">
                      {t('watch.noTournamentGamesDescription') || 'No active tournaments at the moment. Check back soon!'}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </section>
        )}
      </div>
    </Container>
  )
}

