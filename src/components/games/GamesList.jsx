import { Gamepad2, ExternalLink } from 'lucide-react'
import { Skeleton } from '../ui/Skeleton'
import { GameCard } from '../ui/GameCard'
import { useLanguage } from '../../contexts/LanguageContext'
import { useNavigate } from 'react-router-dom'
import './GamesList.css'

export function GamesList({ games, isLoading, error, platform = 'chesscom' }) {
  const { t } = useLanguage()
  const navigate = useNavigate()

  const handleGameClick = (game) => {
    if (game.pgn) {
      navigate('/analysis', { state: { pgn: game.pgn } })
    } else if (game.url) {
      window.open(game.url, '_blank', 'noopener,noreferrer')
    }
  }

  if (isLoading) {
    return (
      <section className="event-detail-section">
        <div className="event-detail-section-header">
          <div className="event-detail-section-icon">
            <Gamepad2 className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentGames') || 'Tournament Games'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.games') || 'Games'}
            </h2>
          </div>
        </div>
        <div className="event-detail-games-skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="event-detail-games-skeleton-item">
              <Skeleton className="h-full w-full" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="event-detail-section">
        <div className="event-detail-section-header">
          <div className="event-detail-section-icon">
            <Gamepad2 className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentGames') || 'Tournament Games'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.games') || 'Games'}
            </h2>
          </div>
        </div>
        <div className="event-detail-games-card">
          <div className="event-detail-games-content">
            <p className="event-detail-games-description">
              {t('events.failedToLoadGames') || 'Failed to load games. Please try again later.'}
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (!games || games.length === 0) {
    return (
      <section className="event-detail-section">
        <div className="event-detail-section-header">
          <div className="event-detail-section-icon">
            <Gamepad2 className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentGames') || 'Tournament Games'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.games') || 'Games'}
            </h2>
          </div>
        </div>
        <div className="event-detail-games-card">
          <div className="event-detail-games-content">
            <div className="event-detail-games-empty">
              <div className="event-detail-games-empty-icon">
                <Gamepad2 className="event-detail-games-empty-icon-svg" />
              </div>
              <div>
                <h3 className="event-detail-games-empty-title">
                  {t('events.noGamesAvailable') || 'No Games Available'}
                </h3>
                <p className="event-detail-games-empty-description">
                  {t('events.noGamesDescription') || 'Games will appear here once the tournament begins and games are played.'}
                </p>
              </div>
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
          <Gamepad2 className="event-detail-section-icon-svg" />
        </div>
        <div>
          <p className="event-detail-section-label">
            {t('events.tournamentGames') || 'Tournament Games'}
          </p>
          <h2 className="event-detail-section-title">
            {t('events.games') || 'Games'}
          </h2>
        </div>
      </div>

      <div className="event-detail-games-grid">
        {games.map((game, index) => (
          <GameCard
            key={`${game.white}-${game.black}-${game.end_time || game.url || index}`}
            game={{
              ...game,
              source: platform === 'lichess' ? 'lichess' : 'chesscom',
            }}
            onGameClick={() => handleGameClick(game)}
          />
        ))}
      </div>
    </section>
  )
}

