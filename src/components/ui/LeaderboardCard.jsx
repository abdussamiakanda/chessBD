import { Link } from 'react-router-dom'
import { Card } from './Card'
import { PlayerName } from '../PlayerName'
import { Crown, Medal, Award } from 'lucide-react'
import { ChesscomIcon } from './ChesscomIcon'
import { useLanguage } from '../../contexts/LanguageContext'
import './LeaderboardCard.css'

export function LeaderboardCard({ 
  player, 
  rank, 
  gameType = 'rapid',
  loading = false 
}) {
  const { t } = useLanguage()

  if (loading) {
    return (
      <Card className="leaderboard-card leaderboard-card-skeleton">
        <div className="leaderboard-card-skeleton-rank"></div>
        <div className="leaderboard-card-skeleton-info"></div>
        <div className="leaderboard-card-skeleton-stats"></div>
      </Card>
    )
  }

  if (!player) {
    return null
  }

  const getRankIcon = () => {
    if (rank === 1) return <Crown className="leaderboard-rank-icon leaderboard-rank-icon-crown" />
    if (rank === 2) return <Medal className="leaderboard-rank-icon leaderboard-rank-icon-medal" />
    if (rank === 3) return <Medal className="leaderboard-rank-icon leaderboard-rank-icon-medal-bronze" />
    return null
  }

  const getRankClass = () => {
    if (rank === 1) return 'leaderboard-card-rank-1'
    if (rank === 2) return 'leaderboard-card-rank-2'
    if (rank === 3) return 'leaderboard-card-rank-3'
    return ''
  }

  const getRatingColor = (rating) => {
    if (rating >= 2000) return 'leaderboard-rating-grandmaster'
    if (rating >= 1800) return 'leaderboard-rating-master'
    if (rating >= 1600) return 'leaderboard-rating-expert'
    if (rating >= 1400) return 'leaderboard-rating-advanced'
    return 'leaderboard-rating-beginner'
  }

  const getRatingBadge = (rating) => {
    if (rating === 0) return t('leaderboard.ratingBadge.unrated')
    if (rating >= 2000) return t('leaderboard.ratingBadge.grandmaster')
    if (rating >= 1800) return t('leaderboard.ratingBadge.master')
    if (rating >= 1600) return t('leaderboard.ratingBadge.expert')
    if (rating >= 1400) return t('leaderboard.ratingBadge.advanced')
    return t('leaderboard.ratingBadge.beginner')
  }

  const username = player.user.chesscom_username || player.user.lichess_username
  const profileUrl = username ? `/player/${username}` : '#'

  return (
    <Card className={`leaderboard-card ${getRankClass()}`}>
      <Link
        to={profileUrl}
        className={username ? 'leaderboard-card-link' : 'leaderboard-card-link leaderboard-card-link-disabled'}
      >
        <div className="leaderboard-card-content">
          {/* Left: Rank Badge and Player Info */}
          <div className="leaderboard-left-section">
            {/* Rank Badge */}
            <div className={`leaderboard-rank-badge ${getRankClass()}`}>
              {getRankIcon() || <span className="leaderboard-rank-number">{rank}</span>}
              {rank <= 3 && (
                <div className="leaderboard-rank-award">
                  <Award className="leaderboard-rank-award-icon" />
                </div>
              )}
            </div>

            {/* Player Info */}
            <div className="leaderboard-player-info">
              <div className="leaderboard-player-header">
              <h3 className="leaderboard-player-name">
                <PlayerName
                  username={username}
                  name={player.user.name}
                  name_bn={player.user.name_bn}
                  email={player.user.email}
                  showTitle={true}
                  platform={player.user.chesscom_username ? 'chesscom' : 'lichess'}
                />
              </h3>
              {player.user.location && (
                <p className="leaderboard-player-location">
                  {t(`locations.${player.user.location}`) || player.user.location}
                </p>
              )}
              {player.user.chesscom_username && player.chesscomStats && (
                <p className="leaderboard-player-verified">
                  <span>{t('profile.verifiedStatus')}</span>
                  <span className="leaderboard-player-platform">
                    <ChesscomIcon className="leaderboard-platform-icon" />
                    <span>{t('player.chesscom')}</span>
                  </span>
                </p>
              )}
            </div>

            {/* Mobile: Rating and Stats in a row */}
            <div className="leaderboard-mobile-stats">
              <div className="leaderboard-mobile-rating">
                <p className={`leaderboard-rating-value ${player.rating > 0 ? getRatingColor(player.rating) : 'leaderboard-rating-unrated'}`}>
                  {player.rating > 0 ? Math.round(player.rating) : '—'}
                </p>
                <p className="leaderboard-rating-badge-text">{getRatingBadge(player.rating)}</p>
                <p className="leaderboard-rating-type">
                  {gameType === 'all' 
                    ? (player.chesscomStats?.rapid ? t('player.rapid') :
                       player.chesscomStats?.blitz ? t('player.blitz') :
                       player.chesscomStats?.bullet ? t('player.bullet') :
                       player.chesscomStats?.daily ? t('player.daily') : t('player.chesscom'))
                    : (gameType === 'rapid' ? t('player.rapid') :
                       gameType === 'blitz' ? t('player.blitz') :
                       gameType === 'daily' ? t('player.daily') : t('player.chesscom'))}
                </p>
              </div>
              <div className="leaderboard-mobile-game-stats">
                <div className="leaderboard-stat-item">
                  <p className="leaderboard-stat-value">{player.totalGames}</p>
                  <p className="leaderboard-stat-label">{t('leaderboard.games')}</p>
                </div>
                <div className="leaderboard-stat-item">
                  <p className="leaderboard-stat-value">{player.wins}</p>
                  <p className="leaderboard-stat-label">{t('leaderboard.wins')}</p>
                </div>
                <div className="leaderboard-stat-item">
                  <p className="leaderboard-stat-value">{(player.winRate * 100).toFixed(1)}%</p>
                  <p className="leaderboard-stat-label">{t('leaderboard.winRate')}</p>
                </div>
              </div>
            </div>

            {/* Tablet: Rating inline with player info */}
            <div className="leaderboard-tablet-rating">
              <div className="leaderboard-tablet-rating-content">
                <p className={`leaderboard-rating-value-tablet ${player.rating > 0 ? getRatingColor(player.rating) : 'leaderboard-rating-unrated'}`}>
                  {player.rating > 0 ? Math.round(player.rating) : '—'}
                </p>
                <p className="leaderboard-rating-badge-text">{getRatingBadge(player.rating)}</p>
                <p className="leaderboard-rating-type">
                  {gameType === 'all' 
                    ? (player.chesscomStats?.rapid ? t('player.rapid') :
                       player.chesscomStats?.blitz ? t('player.blitz') :
                       player.chesscomStats?.bullet ? t('player.bullet') :
                       player.chesscomStats?.daily ? t('player.daily') : t('player.chesscom'))
                    : (gameType === 'rapid' ? t('player.rapid') :
                       gameType === 'blitz' ? t('player.blitz') :
                       gameType === 'daily' ? t('player.daily') : t('player.chesscom'))}
                </p>
              </div>
            </div>
          </div>

          {/* Tablet: Stats row below player info */}
          <div className="leaderboard-tablet-stats">
            {/* Primary Rating */}
            <div className="leaderboard-tablet-primary-rating">
              <p className={`leaderboard-rating-value-tablet ${player.rating > 0 ? getRatingColor(player.rating) : 'leaderboard-rating-unrated'}`}>
                {player.rating > 0 ? Math.round(player.rating) : '—'}
              </p>
              <p className="leaderboard-rating-badge-text">{getRatingBadge(player.rating)}</p>
              <p className="leaderboard-rating-type">
                {gameType === 'all' 
                  ? (player.chesscomStats?.rapid ? t('player.rapid') :
                     player.chesscomStats?.blitz ? t('player.blitz') :
                     player.chesscomStats?.bullet ? t('player.bullet') :
                     player.chesscomStats?.daily ? t('player.daily') : t('player.chesscom'))
                  : (gameType === 'rapid' ? t('player.rapid') :
                     gameType === 'blitz' ? t('player.blitz') :
                     gameType === 'daily' ? t('player.daily') : t('player.chesscom'))}
              </p>
            </div>

            {/* Chess.com Ratings */}
            {player.chesscomStats && (
              <div className="leaderboard-tablet-ratings-list">
                {player.chesscomStats.rapid && (
                  <div className="leaderboard-rating-item">
                    <p className="leaderboard-rating-item-value">{player.chesscomStats.rapid.rating}</p>
                    <p className="leaderboard-rating-item-label">{t('player.rapid')}</p>
                  </div>
                )}
                {player.chesscomStats.blitz && (
                  <div className="leaderboard-rating-item">
                    <p className="leaderboard-rating-item-value">{player.chesscomStats.blitz.rating}</p>
                    <p className="leaderboard-rating-item-label">{t('player.blitz')}</p>
                  </div>
                )}
                {player.chesscomStats.bullet && (
                  <div className="leaderboard-rating-item">
                    <p className="leaderboard-rating-item-value">{player.chesscomStats.bullet.rating}</p>
                    <p className="leaderboard-rating-item-label">{t('player.bullet')}</p>
                  </div>
                )}
                {player.chesscomStats.daily && (
                  <div className="leaderboard-rating-item">
                    <p className="leaderboard-rating-item-value">{player.chesscomStats.daily.rating}</p>
                    <p className="leaderboard-rating-item-label">{t('player.daily')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Game Stats */}
            <div className="leaderboard-tablet-game-stats">
              <div className="leaderboard-stat-item">
                <p className="leaderboard-stat-value">{player.totalGames}</p>
                <p className="leaderboard-stat-label">{t('leaderboard.games')}</p>
              </div>
              <div className="leaderboard-stat-item">
                <p className="leaderboard-stat-value">{player.wins}</p>
                <p className="leaderboard-stat-label">{t('leaderboard.wins')}</p>
              </div>
              <div className="leaderboard-stat-item">
                <p className="leaderboard-stat-value">{(player.winRate * 100).toFixed(1)}%</p>
                <p className="leaderboard-stat-label">{t('leaderboard.winRate')}</p>
              </div>
            </div>
          </div>
          </div>

          {/* Desktop Stats */}
          <div className="leaderboard-desktop-stats">
            {/* Primary Rating */}
            <div className="leaderboard-primary-rating">
              <p className={`leaderboard-rating-value-large ${player.rating > 0 ? getRatingColor(player.rating) : 'leaderboard-rating-unrated'}`}>
                {player.rating > 0 ? Math.round(player.rating) : '—'}
              </p>
              <p className="leaderboard-rating-badge-text">{getRatingBadge(player.rating)}</p>
              <p className="leaderboard-rating-type">
                {gameType === 'all' 
                  ? (player.chesscomStats?.rapid ? t('player.rapid') :
                     player.chesscomStats?.blitz ? t('player.blitz') :
                     player.chesscomStats?.bullet ? t('player.bullet') :
                     player.chesscomStats?.daily ? t('player.daily') : t('player.chesscom'))
                  : (gameType === 'rapid' ? t('player.rapid') :
                     gameType === 'blitz' ? t('player.blitz') :
                     gameType === 'daily' ? t('player.daily') : t('player.chesscom'))}
              </p>
            </div>

            {/* Chess.com Ratings */}
            {player.chesscomStats && (
              <div className="leaderboard-ratings-list">
                {player.chesscomStats.rapid && (
                  <div className="leaderboard-rating-item">
                    <p className="leaderboard-rating-item-value">{player.chesscomStats.rapid.rating}</p>
                    <p className="leaderboard-rating-item-label">{t('player.rapid')}</p>
                  </div>
                )}
                {player.chesscomStats.blitz && (
                  <div className="leaderboard-rating-item">
                    <p className="leaderboard-rating-item-value">{player.chesscomStats.blitz.rating}</p>
                    <p className="leaderboard-rating-item-label">{t('player.blitz')}</p>
                  </div>
                )}
                {player.chesscomStats.bullet && (
                  <div className="leaderboard-rating-item">
                    <p className="leaderboard-rating-item-value">{player.chesscomStats.bullet.rating}</p>
                    <p className="leaderboard-rating-item-label">{t('player.bullet')}</p>
                  </div>
                )}
                {player.chesscomStats.daily && (
                  <div className="leaderboard-rating-item">
                    <p className="leaderboard-rating-item-value">{player.chesscomStats.daily.rating}</p>
                    <p className="leaderboard-rating-item-label">{t('player.daily')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Game Stats */}
            <div className="leaderboard-game-stats">
              <div className="leaderboard-stat-item">
                <p className="leaderboard-stat-value">{player.totalGames}</p>
                <p className="leaderboard-stat-label">{t('leaderboard.games')}</p>
              </div>
              <div className="leaderboard-stat-item">
                <p className="leaderboard-stat-value">{player.wins}</p>
                <p className="leaderboard-stat-label">{t('leaderboard.wins')}</p>
              </div>
              <div className="leaderboard-stat-item">
                <p className="leaderboard-stat-value">{(player.winRate * 100).toFixed(1)}%</p>
                <p className="leaderboard-stat-label">{t('leaderboard.winRate')}</p>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </Card>
  )
}

