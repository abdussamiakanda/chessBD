import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { ExternalLink, User, MapPin, Calendar, Gamepad2, Video, ArrowLeft, BarChart3, Users, Clock } from 'lucide-react'
import { ChesscomIcon } from '../components/ui/ChesscomIcon'
import { LichessIcon } from '../components/ui/LichessIcon'
import { TwitchIcon } from '../components/ui/TwitchIcon'
import { YouTubeIcon } from '../components/ui/YouTubeIcon'
import { KickIcon } from '../components/ui/KickIcon'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { RatingCard } from '../components/ui/RatingCard'
import { GameCard } from '../components/ui/GameCard'
import { PageLoader } from '../components/ui/PageLoader'
import { api } from '../lib/api'
import { usePlayer, usePlayerGames } from '../hooks/use-player'
import { useLanguage } from '../contexts/LanguageContext'
import { formatLocalDate } from '../lib/utils/date-format'
import './Player.css'

export function Player() {
  const { t } = useLanguage()
  const { username } = useParams()
  const { data: player, isLoading: playerLoading } = usePlayer(username || '')

  const { data: chesscomStats, isLoading: chesscomStatsLoading } = useQuery({
    queryKey: ['chesscom-stats', username],
    queryFn: () => player?.chesscom_username ? api.getChesscomStats(player.chesscom_username) : null,
    enabled: !!player?.chesscom_username,
    staleTime: 300000,
  })

  const { data: lichessStats, isLoading: lichessStatsLoading } = useQuery({
    queryKey: ['lichess-stats', username],
    queryFn: () => player?.lichess_username && player?.lichess_verified_at ? api.getLichessStats(player.lichess_username) : null,
    enabled: !!player?.lichess_username && !!player?.lichess_verified_at,
    staleTime: 300000,
  })

  const { data: games, isLoading: gamesLoading, error: gamesError, refetch: refetchGames } = usePlayerGames(username || '')

  // Fetch Chess.com profile for avatar if player doesn't have one
  const { data: chesscomProfile } = useQuery({
    queryKey: ['chesscom-profile', player?.chesscom_username],
    queryFn: async () => {
      if (!player?.chesscom_username || player?.avatar_url) {
        return null
      }
      return await api.getChesscomPlayerProfile(player.chesscom_username)
    },
    enabled: !!player?.chesscom_username && !player?.avatar_url && !playerLoading,
    staleTime: 300000,
  })

  // Determine avatar URL: use player's avatar_url, or fallback to Chess.com avatar
  const avatarUrl = player?.avatar_url || chesscomProfile?.avatar || null
  const [avatarError, setAvatarError] = useState(false)

  // Reset error state when avatar URL changes
  useEffect(() => {
    setAvatarError(false)
  }, [avatarUrl])

  if (playerLoading) {
    return <PageLoader />
  }

  if (!player) {
    return (
      <Container>
        <div className="player-not-found">
          <Card className="player-not-found-card">
            <div className="player-not-found-content">
              <div className="player-not-found-icon">
                <User className="player-not-found-icon-svg" />
              </div>
              <div className="player-not-found-text">
                <h1 className="player-not-found-title">
                  {t('player.playerNotFound') || 'Player Not Found'}
                </h1>
                <p className="player-not-found-description">
                  {t('player.playerNotFoundDescription') || 'The player you are looking for does not exist or has not been registered yet.'}
                </p>
                <Link
                  to="/leaderboard"
                  className="player-not-found-link"
                >
                  <ArrowLeft className="player-not-found-link-icon" />
                  <span>{t('player.backToLeaderboard') || 'Back to Leaderboard'}</span>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </Container>
    )
  }

  const playerName = player.name || player.chesscom_username || player.lichess_username || username || 'Player'

  // Filter games to exclude Lichess if not verified
  const filteredGames = player?.lichess_verified_at 
    ? (games || [])
    : (games || []).filter(g => g.source !== 'lichess')

  // Calculate statistics from Chess.com and Lichess stats API (accurate totals)
  // This matches the data shown in rating cards
  const chesscomUsername = player?.chesscom_username?.toLowerCase() || ''
  const lichessUsername = (player?.lichess_username && player?.lichess_verified_at) ? player.lichess_username.toLowerCase() : ''
  
  const safeGames = Array.isArray(filteredGames) ? filteredGames : []
  
  // Calculate stats from API data (more accurate than counting filteredGames)
  let totalGames = 0
  let totalWins = 0
  let totalDraws = 0
  let totalLosses = 0
  
  // Add Chess.com stats
  if (chesscomStats) {
    if (chesscomStats.rapid) {
      totalGames += chesscomStats.rapid.games || 0
      totalWins += chesscomStats.rapid.wins || 0
      totalDraws += chesscomStats.rapid.draws || 0
      totalLosses += chesscomStats.rapid.losses || 0
    }
    if (chesscomStats.blitz) {
      totalGames += chesscomStats.blitz.games || 0
      totalWins += chesscomStats.blitz.wins || 0
      totalDraws += chesscomStats.blitz.draws || 0
      totalLosses += chesscomStats.blitz.losses || 0
    }
    if (chesscomStats.bullet) {
      totalGames += chesscomStats.bullet.games || 0
      totalWins += chesscomStats.bullet.wins || 0
      totalDraws += chesscomStats.bullet.draws || 0
      totalLosses += chesscomStats.bullet.losses || 0
    }
    if (chesscomStats.daily) {
      totalGames += chesscomStats.daily.games || 0
      totalWins += chesscomStats.daily.wins || 0
      totalDraws += chesscomStats.daily.draws || 0
      totalLosses += chesscomStats.daily.losses || 0
    }
    if (chesscomStats.classical) {
      totalGames += chesscomStats.classical.games || 0
      totalWins += chesscomStats.classical.wins || 0
      totalDraws += chesscomStats.classical.draws || 0
      totalLosses += chesscomStats.classical.losses || 0
    }
  }
  
  // Add Lichess stats
  if (lichessStats) {
    if (lichessStats.rapid && lichessStats.rapid.games > 0) {
      totalGames += lichessStats.rapid.games || 0
      totalWins += lichessStats.rapid.wins || 0
      totalDraws += lichessStats.rapid.draws || 0
      totalLosses += lichessStats.rapid.losses || 0
    }
    if (lichessStats.blitz && lichessStats.blitz.games > 0) {
      totalGames += lichessStats.blitz.games || 0
      totalWins += lichessStats.blitz.wins || 0
      totalDraws += lichessStats.blitz.draws || 0
      totalLosses += lichessStats.blitz.losses || 0
    }
    if (lichessStats.bullet && lichessStats.bullet.games > 0) {
      totalGames += lichessStats.bullet.games || 0
      totalWins += lichessStats.bullet.wins || 0
      totalDraws += lichessStats.bullet.draws || 0
      totalLosses += lichessStats.bullet.losses || 0
    }
    if (lichessStats.classical && lichessStats.classical.games > 0) {
      totalGames += lichessStats.classical.games || 0
      totalWins += lichessStats.classical.wins || 0
      totalDraws += lichessStats.classical.draws || 0
      totalLosses += lichessStats.classical.losses || 0
    }
  }
  
  // Fallback to counting filteredGames if stats API data is not available
  const stats = {
    total: totalGames > 0 ? totalGames : safeGames.length,
    wins: totalWins > 0 ? totalWins : safeGames.filter(g => {
      if (!g) return false
      const white = (g.white || '').toLowerCase()
      const black = (g.black || '').toLowerCase()
      const isWhite = white === chesscomUsername || white === lichessUsername
      const isBlack = black === chesscomUsername || black === lichessUsername
      return (isWhite && g.result === '1-0') || (isBlack && g.result === '0-1')
    }).length,
    draws: totalDraws > 0 ? totalDraws : safeGames.filter(g => g && g.result === '1/2-1/2').length,
    losses: totalLosses > 0 ? totalLosses : safeGames.filter(g => {
      if (!g) return false
      const white = (g.white || '').toLowerCase()
      const black = (g.black || '').toLowerCase()
      const isWhite = white === chesscomUsername || white === lichessUsername
      const isBlack = black === chesscomUsername || black === lichessUsername
      return (isWhite && g.result === '0-1') || (isBlack && g.result === '1-0')
    }).length,
  }

  // Get current username for GameCard
  const currentUsername = chesscomUsername || lichessUsername || ''

  return (
    <Container>
      <div className="player-page">
        {/* Hero Section */}
        <section className="player-hero">
          <div className="player-hero-content">
            {/* Avatar */}
            <div className="player-avatar-wrapper">
              {avatarUrl && !avatarError ? (
                <img
                  src={avatarUrl}
                  alt={playerName}
                  className="player-avatar"
                  onError={() => {
                    setAvatarError(true)
                  }}
                />
              ) : (
                <div className="player-avatar-placeholder">
                  <User className="player-avatar-icon" />
                </div>
              )}
              <div className="player-avatar-glow"></div>
            </div>

            {/* Name and Location */}
            <div className="player-hero-text">
              <p className="player-hero-label">
                {t('player.playerProfile') || 'Player Profile'}
              </p>
              <h1 className="player-hero-title">
                {playerName}
              </h1>
              {(player.location || player.country) && (
                <div className="player-hero-location">
                  <MapPin className="player-hero-location-icon" />
                  <span>
                    {player.location ? `${player.location}, ` : ''}{player.country || t('common.bangladesh') || 'Bangladesh'}
                  </span>
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="player-badges">
              {player.chesscom_username && player.verified_at && (
                <div className="player-badge">
                  <div className="player-badge-glow"></div>
                  <span className="player-badge-content">
                    <ChesscomIcon className="player-badge-icon" />
                    {t('player.chesscomVerified') || 'Chess.com Verified'}
                  </span>
                </div>
              )}
              {player.lichess_username && player.lichess_verified_at && (
                <div className="player-badge">
                  <div className="player-badge-glow"></div>
                  <span className="player-badge-content">
                    <LichessIcon className="player-badge-icon" />
                    {t('player.lichessVerified') || 'Lichess Verified'}
                  </span>
                </div>
              )}
              {player.is_streamer && (
                <div className="player-badge">
                  <div className="player-badge-glow"></div>
                  <span className="player-badge-content">
                    <Video className="player-badge-icon" />
                    {t('player.streamer') || 'Streamer'}
                  </span>
                </div>
              )}
              {player.created_at && (
                <div className="player-badge player-badge-secondary">
                  <div className="player-badge-glow"></div>
                  <span className="player-badge-content">
                    <Calendar className="player-badge-icon" />
                    {t('player.joined') || 'Joined'} {formatLocalDate(player.created_at, { format: 'date' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Chess Profiles Section */}
        {(player.chesscom_username || (player.lichess_username && player.lichess_verified_at)) && (
          <section className="player-section">
            <div className="player-section-header">
              <div className="player-section-icon">
                <Gamepad2 className="player-section-icon-svg" />
              </div>
              <div>
                <p className="player-section-label">{t('player.chessPlatforms') || 'Chess Platforms'}</p>
                <h2 className="player-section-title">{t('player.chessProfiles') || 'Chess Profiles'}</h2>
              </div>
            </div>

            <div className="player-platforms-grid">
              {player.chesscom_username && (
                <a
                  href={`https://www.chess.com/member/${player.chesscom_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="player-platform-card"
                >
                  <div className="player-platform-card-glow"></div>
                  <div className="player-platform-card-content">
                    <div className="player-platform-card-icon">
                      <ChesscomIcon className="player-platform-card-icon-svg" />
                    </div>
                    <div className="player-platform-card-text">
                      <div className="player-platform-card-label">{t('player.chesscom') || 'Chess.com'}</div>
                      <div className="player-platform-card-username">{player.chesscom_username}</div>
                    </div>
                    <ExternalLink className="player-platform-card-link" />
                  </div>
                </a>
              )}

              {player.lichess_username && player.lichess_verified_at && (
                <a
                  href={`https://lichess.org/@/${player.lichess_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="player-platform-card"
                >
                  <div className="player-platform-card-glow"></div>
                  <div className="player-platform-card-content">
                    <div className="player-platform-card-icon">
                      <LichessIcon className="player-platform-card-icon-svg" />
                    </div>
                    <div className="player-platform-card-text">
                      <div className="player-platform-card-label">{t('player.lichess') || 'Lichess'}</div>
                      <div className="player-platform-card-username">{player.lichess_username}</div>
                    </div>
                    <ExternalLink className="player-platform-card-link" />
                  </div>
                </a>
              )}
            </div>
          </section>
        )}

        {/* Chess.com Ratings Section */}
        {player.chesscom_username && (
          <section className="player-section">
            <div className="player-section-header">
              <div className="player-section-icon">
                <ChesscomIcon className="player-section-icon-svg" />
              </div>
              <div>
                <p className="player-section-label">{t('player.chesscom') || 'Chess.com'}</p>
                <h2 className="player-section-title">{t('player.chesscomRatings') || 'Chess.com Ratings'}</h2>
              </div>
            </div>

            {chesscomStatsLoading ? (
              <div className="player-ratings-grid">
                {[1, 2, 3, 4].map((i) => (
                  <RatingCard key={i} loading={true} />
                ))}
              </div>
            ) : chesscomStats ? (
              <div className="player-ratings-grid player-ratings-grid-main">
                {chesscomStats.rapid && (
                  <RatingCard
                    label={t('player.rapid') || 'Rapid'}
                    rating={chesscomStats.rapid.rating}
                    games={chesscomStats.rapid.games}
                    wins={chesscomStats.rapid.wins}
                    draws={chesscomStats.rapid.draws}
                    losses={chesscomStats.rapid.losses}
                    winRate={chesscomStats.rapid.winRate}
                  />
                )}
                {chesscomStats.blitz && (
                  <RatingCard
                    label={t('player.blitz') || 'Blitz'}
                    rating={chesscomStats.blitz.rating}
                    games={chesscomStats.blitz.games}
                    wins={chesscomStats.blitz.wins}
                    draws={chesscomStats.blitz.draws}
                    losses={chesscomStats.blitz.losses}
                    winRate={chesscomStats.blitz.winRate}
                  />
                )}
                {chesscomStats.bullet && (
                  <RatingCard
                    label={t('player.bullet') || 'Bullet'}
                    rating={chesscomStats.bullet.rating}
                    games={chesscomStats.bullet.games}
                    wins={chesscomStats.bullet.wins}
                    draws={chesscomStats.bullet.draws}
                    losses={chesscomStats.bullet.losses}
                    winRate={chesscomStats.bullet.winRate}
                  />
                )}
                {chesscomStats.daily && (
                  <RatingCard
                    label={t('player.daily') || 'Daily'}
                    rating={chesscomStats.daily.rating}
                    games={chesscomStats.daily.games}
                    wins={chesscomStats.daily.wins}
                    draws={chesscomStats.daily.draws}
                    losses={chesscomStats.daily.losses}
                    winRate={chesscomStats.daily.winRate}
                  />
                )}
                {chesscomStats.classical && (
                  <RatingCard
                    label={t('player.classical') || 'Classical'}
                    rating={chesscomStats.classical.rating}
                    games={chesscomStats.classical.games}
                    wins={chesscomStats.classical.wins}
                    draws={chesscomStats.classical.draws}
                    losses={chesscomStats.classical.losses}
                    winRate={chesscomStats.classical.winRate}
                  />
                )}
                {chesscomStats.puzzle && (
                  <RatingCard
                    label={t('player.puzzle') || 'Puzzle'}
                    rating={chesscomStats.puzzle.rating}
                    highest={chesscomStats.puzzle.highest?.rating}
                  />
                )}
              </div>
            ) : (
              <Card className="player-no-ratings">
                <p>{t('player.noRatings') || 'No ratings available'}</p>
              </Card>
            )}
          </section>
        )}

        {/* Streamer Section */}
        {player.is_streamer && (
          <section className="player-section">
            <div className="player-section-header">
              <div className="player-section-icon">
                <Video className="player-section-icon-svg" />
              </div>
              <div>
                <p className="player-section-label">{t('player.streaming') || 'Streaming'}</p>
                <h2 className="player-section-title">{t('player.streamerProfile') || 'Streamer Profile'}</h2>
              </div>
            </div>

            {(player.twitch_username || player.youtube_channel || player.kick_username) && (
              <div className="player-platforms-grid">
                {player.twitch_username && (
                  <a
                    href={`https://www.twitch.tv/${player.twitch_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="player-platform-card"
                  >
                    <div className="player-platform-card-glow"></div>
                    <div className="player-platform-card-content">
                      <div className="player-platform-card-icon">
                        <TwitchIcon className="player-platform-card-icon-svg" />
                      </div>
                      <div className="player-platform-card-text">
                        <div className="player-platform-card-label">{t('player.twitch') || 'Twitch'}</div>
                        <div className="player-platform-card-username">{player.twitch_username}</div>
                      </div>
                      <ExternalLink className="player-platform-card-link" />
                    </div>
                  </a>
                )}

                {player.youtube_channel && (
                  <a
                    href={player.youtube_channel.startsWith('http') ? player.youtube_channel : `https://www.youtube.com/@${player.youtube_channel}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="player-platform-card"
                  >
                    <div className="player-platform-card-glow"></div>
                    <div className="player-platform-card-content">
                      <div className="player-platform-card-icon">
                        <YouTubeIcon className="player-platform-card-icon-svg" />
                      </div>
                      <div className="player-platform-card-text">
                        <div className="player-platform-card-label">{t('player.youtube') || 'YouTube'}</div>
                        <div className="player-platform-card-username">
                          {player.youtube_channel.replace('https://www.youtube.com/@', '').replace('https://youtube.com/@', '')}
                        </div>
                      </div>
                      <ExternalLink className="player-platform-card-link" />
                    </div>
                  </a>
                )}

                {player.kick_username && (
                  <a
                    href={`https://kick.com/${player.kick_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="player-platform-card"
                  >
                    <div className="player-platform-card-glow"></div>
                    <div className="player-platform-card-content">
                      <div className="player-platform-card-icon">
                        <KickIcon className="player-platform-card-icon-svg" />
                      </div>
                      <div className="player-platform-card-text">
                        <div className="player-platform-card-label">{t('player.kick') || 'Kick'}</div>
                        <div className="player-platform-card-username">{player.kick_username}</div>
                      </div>
                      <ExternalLink className="player-platform-card-link" />
                    </div>
                  </a>
                )}
              </div>
            )}

            {player.stream_description && (
              <Card className="player-stream-description">
                <div className="player-stream-description-header">
                  <p className="player-stream-description-label">{t('player.aboutTheStream') || 'About the Stream'}</p>
                </div>
                <p className="player-stream-description-text">{player.stream_description}</p>
              </Card>
            )}
          </section>
        )}

        {/* Lichess Ratings Section */}
        {player.lichess_username && player.lichess_verified_at && (
          <section className="player-section">
            <div className="player-section-header">
              <div className="player-section-icon">
                <LichessIcon className="player-section-icon-svg" />
              </div>
              <div>
                <p className="player-section-label">{t('player.lichess') || 'Lichess'}</p>
                <h2 className="player-section-title">{t('player.lichessRatings') || 'Lichess Ratings'}</h2>
              </div>
            </div>

            {lichessStatsLoading ? (
              <div className="player-ratings-grid">
                {[1, 2, 3, 4].map((i) => (
                  <RatingCard key={i} loading={true} />
                ))}
              </div>
            ) : lichessStats ? (
              <div className="player-ratings-grid player-ratings-grid-main">
                {lichessStats.rapid && lichessStats.rapid.games > 0 && (
                  <RatingCard
                    label={t('player.rapid') || 'Rapid'}
                    rating={lichessStats.rapid.rating}
                    games={lichessStats.rapid.games}
                    wins={lichessStats.rapid.wins}
                    draws={lichessStats.rapid.draws}
                    losses={lichessStats.rapid.losses}
                    winRate={lichessStats.rapid.winRate}
                  />
                )}
                {lichessStats.blitz && lichessStats.blitz.games > 0 && (
                  <RatingCard
                    label={t('player.blitz') || 'Blitz'}
                    rating={lichessStats.blitz.rating}
                    games={lichessStats.blitz.games}
                    wins={lichessStats.blitz.wins}
                    draws={lichessStats.blitz.draws}
                    losses={lichessStats.blitz.losses}
                    winRate={lichessStats.blitz.winRate}
                  />
                )}
                {lichessStats.bullet && lichessStats.bullet.games > 0 && (
                  <RatingCard
                    label={t('player.bullet') || 'Bullet'}
                    rating={lichessStats.bullet.rating}
                    games={lichessStats.bullet.games}
                    wins={lichessStats.bullet.wins}
                    draws={lichessStats.bullet.draws}
                    losses={lichessStats.bullet.losses}
                    winRate={lichessStats.bullet.winRate}
                  />
                )}
                {lichessStats.classical && lichessStats.classical.games > 0 && (
                  <RatingCard
                    label={t('player.classical') || 'Classical'}
                    rating={lichessStats.classical.rating}
                    games={lichessStats.classical.games}
                    wins={lichessStats.classical.wins}
                    draws={lichessStats.classical.draws}
                    losses={lichessStats.classical.losses}
                    winRate={lichessStats.classical.winRate}
                  />
                )}
                {lichessStats.puzzle && lichessStats.puzzle.rating && (
                  <RatingCard
                    label={t('player.puzzle') || 'Puzzle'}
                    rating={lichessStats.puzzle.rating}
                  />
                )}
              </div>
            ) : (
              <Card className="player-no-ratings">
                <p>{t('player.noRatings') || 'No ratings available'}</p>
              </Card>
            )}
          </section>
        )}

        {/* Statistics Section */}
        <section className="player-section">
          <div className="player-section-header">
            <div className="player-section-icon">
              <BarChart3 className="player-section-icon-svg" />
            </div>
            <div>
              <p className="player-section-label">{t('player.performance') || 'Performance'}</p>
              <h2 className="player-section-title">{t('player.statistics') || 'Statistics'}</h2>
            </div>
          </div>

          {gamesLoading ? (
            <div className="player-stats-grid">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="player-stat-card">
                  <div className="player-skeleton-rating-label"></div>
                  <div className="player-skeleton-rating-value"></div>
                </Card>
              ))}
            </div>
          ) : (
            <dl className="player-stats-grid">
              <Card className="player-stat-card">
                <dt className="player-stat-label">{t('player.totalGames') || 'Total Games'}</dt>
                <dd className="player-stat-value">{stats.total}</dd>
              </Card>
              <Card className="player-stat-card player-stat-card-win">
                <dt className="player-stat-label">{t('player.wins') || 'Wins'}</dt>
                <dd className="player-stat-value">{stats.wins}</dd>
              </Card>
              <Card className="player-stat-card player-stat-card-draw">
                <dt className="player-stat-label">{t('player.draws') || 'Draws'}</dt>
                <dd className="player-stat-value">{stats.draws}</dd>
              </Card>
              <Card className="player-stat-card player-stat-card-loss">
                <dt className="player-stat-label">{t('player.losses') || 'Losses'}</dt>
                <dd className="player-stat-value">{stats.losses}</dd>
              </Card>
            </dl>
          )}
        </section>

        {/* Game History Section */}
        <section className="player-section">
          <div className="player-section-header">
            <div className="player-section-icon">
              <Gamepad2 className="player-section-icon-svg" />
            </div>
            <div>
              <p className="player-section-label">{t('player.gameHistory') || 'Game History'}</p>
              <h2 className="player-section-title">{t('player.games') || 'Games'}</h2>
            </div>
            {gamesError && (
              <button
                onClick={() => refetchGames()}
                className="player-retry-btn"
              >
                {t('player.retry') || 'Retry'}
              </button>
            )}
          </div>

          {gamesError && (
            <Card className="player-warning-card">
              <p>{t('player.gamesLoadingWarning') || 'Some games may not be loading. Chess.com games may take longer to fetch on mobile devices.'}</p>
            </Card>
          )}

          {gamesLoading ? (
            <div className="player-games-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <GameCard key={i} loading={true} />
              ))}
            </div>
          ) : safeGames && safeGames.length > 0 ? (
            <div className="player-games-grid">
              {safeGames.slice(0, 30).map((game, index) => (
                <GameCard
                  key={`${game.white}-${game.black}-${game.end_time}-${index}`}
                  game={game}
                  currentUsername={currentUsername}
                  chesscomUsername={chesscomUsername}
                  lichessUsername={lichessUsername}
                />
              ))}
            </div>
          ) : (
            <Card className="player-no-games">
              <p>{t('player.noGames') || 'No games found.'}</p>
            </Card>
          )}
        </section>
      </div>
    </Container>
  )
}

