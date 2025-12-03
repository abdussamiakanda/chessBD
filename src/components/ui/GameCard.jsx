import { ExternalLink, Users, Calendar, Clock, Brain } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from './Card'
import { PlayerName } from '../PlayerName'
import { useLanguage } from '../../contexts/LanguageContext'
import { formatLocalDate } from '../../lib/utils/date-format'
import './GameCard.css'

export function GameCard({ 
  game, 
  currentUsername = '', 
  loading = false,
  chesscomUsername = '',
  lichessUsername = '',
  onGameClick
}) {
  const { t } = useLanguage()

  if (loading) {
    return (
      <div className="game-card-wrapper">
        <div className="game-card-glow"></div>
        <Card className="game-card">
          <div className="game-card-skeleton-header"></div>
          <div className="game-card-skeleton-result"></div>
          <div className="game-card-skeleton-meta"></div>
        </Card>
      </div>
    )
  }

  if (!game) {
    return null
  }

  const white = (game.white || '').toLowerCase()
  const black = (game.black || '').toLowerCase()
  const currentUserLower = currentUsername.toLowerCase()
  const isWhite = white === currentUserLower
  const isBlack = black === currentUserLower

  // Get result color - matching chessbd logic
  const getResultColor = (result, whitePlayer, blackPlayer) => {
    const isWhiteWin = whitePlayer.toLowerCase() === chesscomUsername || whitePlayer.toLowerCase() === lichessUsername
    const isBlackWin = blackPlayer.toLowerCase() === chesscomUsername || blackPlayer.toLowerCase() === lichessUsername
    
    if (result === '1-0') {
      return isWhiteWin 
        ? 'game-card-result-win' 
        : 'game-card-result-loss'
    } else if (result === '0-1') {
      return isBlackWin 
        ? 'game-card-result-win' 
        : 'game-card-result-loss'
    } else {
      return 'game-card-result-draw'
    }
  }

  // Get result label - matching chessbd logic
  const getResultLabel = (result, whitePlayer) => {
    const isWhiteWin = whitePlayer.toLowerCase() === chesscomUsername || whitePlayer.toLowerCase() === lichessUsername
    
    if (result === '1-0') {
      return isWhiteWin ? (t('player.win') || 'Win') : (t('player.loss') || 'Loss')
    } else if (result === '0-1') {
      return isWhiteWin ? (t('player.loss') || 'Loss') : (t('player.win') || 'Win')
    } else {
      return t('player.draw') || 'Draw'
    }
  }

  return (
    <div 
      className="game-card-wrapper"
      onClick={() => game.pgn && onGameClick && onGameClick()}
    >
      <div className="game-card-glow"></div>
      <Card className="game-card">
        <div className="game-card-content">
          {/* Players */}
          <div className="game-card-header">
            <Users className="game-card-icon" />
            <div className="game-card-players">
              <div className="game-card-player-names">
                <span className={`game-card-player-name ${isWhite ? 'game-card-player-name-active' : ''}`}>
                  <PlayerName 
                    username={game.white} 
                    showTitle={true} 
                    platform={game.source === 'lichess' ? 'lichess' : 'chesscom'}
                  />
                </span>
                <span className="game-card-vs">{t('player.vs') || 'vs'}</span>
                <span className={`game-card-player-name ${isBlack ? 'game-card-player-name-active' : ''}`}>
                  <PlayerName 
                    username={game.black} 
                    showTitle={true} 
                    platform={game.source === 'lichess' ? 'lichess' : 'chesscom'}
                  />
                </span>
              </div>
              {game.event_name && game.event_id && (
                <Link
                  to={`/events/${game.event_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="game-card-event-link"
                >
                  {game.event_name}
                </Link>
              )}
              {game.event_name && !game.event_id && (
                <span className="game-card-event-name">
                  {game.event_name}
                </span>
              )}
            </div>
          </div>
          
          {/* Result */}
          <div className={`game-card-result ${getResultColor(game.result, game.white, game.black)}`}>
            <span className="game-card-result-score">{game.result}</span>
            <span className="game-card-result-label">
              ({getResultLabel(game.result, game.white)})
            </span>
          </div>
          
          {/* Date and Source */}
          <div className="game-card-meta">
            {game.end_time && (
              <div className="game-card-date">
                <Calendar className="game-card-meta-icon" />
                <span>{formatLocalDate(game.end_time, { format: 'date' })}</span>
              </div>
            )}
            {game.source && (
              <span className="game-card-source-badge">
                {game.time_control 
                  ? game.time_control 
                  : game.source === 'tournament' 
                    ? (t('player.tournament') || 'Tournament')
                    : game.source === 'lichess' 
                      ? (t('player.regular') || 'Regular')
                      : (t('player.regular') || 'Regular')}
              </span>
            )}
          </div>
          
          {/* Actions */}
          <div className="game-card-actions">
            {game.pgn && (
              <a
                href="/analysis"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  // Store PGN in sessionStorage BEFORE opening new tab
                  sessionStorage.setItem('analysis-pgn', game.pgn)
                  // Open in new tab after setting sessionStorage
                  window.open('/analysis', '_blank')
                }}
                className="game-card-action-btn game-card-action-btn-primary"
              >
                <Brain className="game-card-action-icon" />
                <span>{t('player.review') || 'Review'}</span>
              </a>
            )}
            {game.url && (
              <a
                href={game.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="game-card-action-btn game-card-action-btn-secondary"
              >
                <ExternalLink className="game-card-action-icon" />
                <span>{t('player.view') || 'View'}</span>
              </a>
            )}
            {game.pgn && !game.url && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onGameClick && onGameClick()
                }}
                className="game-card-action-btn game-card-action-btn-primary"
              >
                <span>{t('player.viewGame') || 'View Game'}</span>
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

