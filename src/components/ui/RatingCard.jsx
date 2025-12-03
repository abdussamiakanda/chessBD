import { Card } from './Card'
import { useLanguage } from '../../contexts/LanguageContext'
import './RatingCard.css'

export function RatingCard({ label, rating, games, wins, draws, losses, winRate, highest, loading = false }) {
  const { t } = useLanguage()

  if (loading) {
    return (
      <Card className="rating-card">
        <div className="rating-card-skeleton-label"></div>
        <div className="rating-card-skeleton-value"></div>
        <div className="rating-card-skeleton-stats">
          <div className="rating-card-skeleton-stat"></div>
          <div className="rating-card-skeleton-stat"></div>
          <div className="rating-card-skeleton-stat"></div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="rating-card">
      <div className="rating-card-glow"></div>
      <div className="rating-card-content">
        <div className="rating-card-label">{label}</div>
        <div className="rating-card-value">{rating || 'N/A'}</div>
        {highest ? (
          <div className="rating-card-highest">
            {t('player.highest') || 'Highest'}: {highest}
          </div>
        ) : (
          <div className="rating-card-stats">
            <div className="rating-card-stat-row">
              <span className="rating-card-stat-label">{t('player.gamesLabel') || 'Games:'}</span>
              <span className="rating-card-stat-value">{games || 0}</span>
            </div>
            <div className="rating-card-stat-row">
              <span className="rating-card-stat-label rating-card-stat-wins">{t('player.winsLabel') || 'Wins:'}</span>
              <span className="rating-card-stat-value">{wins || 0}</span>
            </div>
            <div className="rating-card-stat-row">
              <span className="rating-card-stat-label rating-card-stat-draws">{t('player.drawsLabel') || 'Draws:'}</span>
              <span className="rating-card-stat-value">{draws || 0}</span>
            </div>
            <div className="rating-card-stat-row">
              <span className="rating-card-stat-label rating-card-stat-losses">{t('player.lossesLabel') || 'Losses:'}</span>
              <span className="rating-card-stat-value">{losses || 0}</span>
            </div>
            <div className="rating-card-stat-row rating-card-stat-row-border">
              <span className="rating-card-stat-label">{t('player.winRateLabel') || 'Win Rate:'}</span>
              <span className="rating-card-stat-value rating-card-stat-winrate">
                {winRate ? `${(winRate * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

