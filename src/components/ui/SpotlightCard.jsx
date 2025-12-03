import { Link } from 'react-router-dom'
import { Card } from './Card'
import { Award, Club, Trophy, TrendingUp, Users } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import './SpotlightCard.css'

export function SpotlightCard({ 
  type = 'player', // 'player' or 'club'
  icon: Icon = Award,
  label,
  title,
  subtitle,
  loading = false,
  // Player specific props
  playerData,
  playerInfo, // Player info object with displayName, username, avatarUrl
  // Club specific props
  clubData,
  // Actions
  actions = [],
  className = ''
}) {
  const { t } = useLanguage()
  const [imageError, setImageError] = useState(false)

  return (
    <Card className={`spotlight-card ${className}`}>
      <div className="spotlight-card-header">
        <div className="spotlight-card-icon-wrapper">
          <Icon className="spotlight-card-icon" />
        </div>
        <div className="spotlight-card-title-wrapper">
          <p className="spotlight-card-label">{label}</p>
          {loading ? (
            <div className="spotlight-card-skeleton">
              <div className="spotlight-card-skeleton-line"></div>
              <div className="spotlight-card-skeleton-line short"></div>
            </div>
          ) : (
            <>
              <h3 className="spotlight-card-title">{title}</h3>
              {subtitle && <p className="spotlight-card-subtitle">{subtitle}</p>}
            </>
          )}
        </div>
      </div>

      {!loading && (
        <>
          {type === 'player' && playerData ? (
            <>
              <div className="spotlight-card-avatar-section">
                {playerInfo && !imageError && playerInfo.avatarUrl ? (
                  <img
                    src={playerInfo.avatarUrl}
                    alt={playerInfo.displayName}
                    className="spotlight-card-avatar"
                    onError={() => setImageError(true)}
                    loading="lazy"
                  />
                ) : (
                  <div className="spotlight-card-avatar-placeholder">
                    <Trophy className="spotlight-card-avatar-icon" />
                  </div>
                )}
                <div className="spotlight-card-avatar-stats">
                  <div className="spotlight-card-avatar-stat-row">
                    <span className="spotlight-card-stat-value">
                      {playerData.rating_earned > 0 ? '+' : ''}{playerData.rating_earned}
                    </span>
                    <span className="spotlight-card-stat-label">
                      <TrendingUp className="spotlight-card-stat-icon" />
                      {t('home.ratingGain') || 'Rating Gain'}
                    </span>
                  </div>
                  <p className="spotlight-card-stat-text">
                    {playerData.games_won} {t('home.gamesWonThisWeek') || 'Games Won This Week'}
                  </p>
                </div>
              </div>
              <blockquote className="spotlight-card-quote">
                "{t('home.outstandingPerformance') || 'Outstanding performance this week! Keep up the great work.'}"
              </blockquote>
            </>
          ) : type === 'player' && !playerData ? (
            <div className="spotlight-card-empty">
              <p className="spotlight-card-empty-text">{t('home.noFeaturedPlayer') || 'No featured player this week'}</p>
              <p className="spotlight-card-empty-desc">{t('home.featuredPlayerDesc') || 'Featured players are selected based on weekly performance'}</p>
            </div>
          ) : null}

          {type === 'club' && clubData && (
            <>
              <div className="spotlight-card-avatar-section">
                {clubData.logo_url && !imageError ? (
                  <img
                    src={clubData.logo_url}
                    alt={clubData.name}
                    className="spotlight-card-avatar"
                    onError={() => setImageError(true)}
                    loading="lazy"
                  />
                ) : (
                  <div className="spotlight-card-avatar-placeholder">
                    <Users className="spotlight-card-avatar-icon" />
                  </div>
                )}
                <div className="spotlight-card-avatar-stats">
                  <span className="spotlight-card-stat-value">
                    {clubData.members_count || clubData.members || '0'}+
                  </span>
                  <span className="spotlight-card-stat-label">
                    {t('home.activeMembers') || 'Active Members'}
                  </span>
                </div>
              </div>
              {clubData.description && (
                <p className="spotlight-card-description">{clubData.description}</p>
              )}
            </>
          )}

          {actions.length > 0 && (
            <div className="spotlight-card-actions">
              {actions.map((action, index) => (
                <Link
                  key={index}
                  to={action.to}
                  className={`spotlight-card-btn ${action.variant || 'secondary'}`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

