import { Link } from 'react-router-dom'
import { Card } from './Card'
import { Users, MapPin, Star, Clock, Club as ClubIcon } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { generateClubSlug } from '../../lib/utils/slug'
import './ClubCard.css'

export function ClubCard({ 
  club, 
  variant = 'default', // 'default' for Clubs page, 'compact' for Locations page
  showDescription = true,
  showLocation = true,
  showBadges = true
}) {
  const { t } = useLanguage()
  
  // Calculate members count from array length if members is an array, otherwise use members_count
  const membersCount = Array.isArray(club.members) 
    ? club.members.length 
    : (club.members_count || 0)

  // Generate slug for link
  const clubSlug = club.slug || (club.name ? generateClubSlug(club.name) : club.id)
  const clubUrl = `/clubs/${clubSlug}`

  const isCompact = variant === 'compact'

  return (
    <Link 
      to={clubUrl} 
      className={`club-card-link ${isCompact ? 'club-card-link-compact' : ''}`}
    >
      <Card className={`club-card ${isCompact ? 'club-card-compact' : ''}`}>
        {/* Badges - Top Right */}
        {showBadges && !isCompact && (
          <div className="club-card-badges">
            {club.featured && (
              <div className="club-card-badge club-card-badge-featured">
                <Star className="club-card-badge-icon" />
              </div>
            )}
            {!club.approved && (
              <div className="club-card-badge club-card-badge-pending">
                <Clock className="club-card-badge-icon" />
              </div>
            )}
          </div>
        )}

        {/* Logo and Name Section */}
        <div className={`club-card-header ${isCompact ? 'club-card-header-compact' : ''}`}>
          {/* Logo */}
          <div className="club-card-logo-wrapper">
            {club.logo_url ? (
              <img
                src={club.logo_url}
                alt={club.name}
                className="club-card-logo"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const parent = e.currentTarget.parentElement
                  if (parent) {
                    const placeholder = parent.querySelector('.club-card-logo-placeholder')
                    if (placeholder) {
                      placeholder.style.display = 'flex'
                    }
                  }
                }}
              />
            ) : null}
            <div className={`club-card-logo-placeholder ${club.logo_url ? 'club-card-logo-placeholder-hidden' : ''}`}>
              <ClubIcon className="club-card-logo-icon" />
            </div>
          </div>

          {/* Name and Location */}
          <div className={`club-card-info ${isCompact ? 'club-card-info-compact' : ''}`}>
            <div className={isCompact ? 'club-card-header-row' : ''}>
              <h3 className="club-card-title">{club.name}</h3>
              {isCompact && club.featured && (
                <div className="club-card-featured-badge">
                  <Star className="club-card-featured-icon" />
                  <span>{t('clubs.featured') || 'Featured'}</span>
                </div>
              )}
            </div>
            {showLocation && club.location && !isCompact && (
              <div className="club-card-location">
                <MapPin className="club-card-location-icon" />
                <span>{club.location}</span>
              </div>
            )}
            {isCompact && (
              <div className="club-card-members">
                <div className="club-card-members-icon-wrapper">
                  <Users className="club-card-members-icon" />
                </div>
                <p className="club-card-members-text">
                  <span className="club-card-members-count">{membersCount}</span>
                  <span className="club-card-members-label">
                    {membersCount === 1 ? t('clubs.member') || 'Member' : t('clubs.members') || 'Members'}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {showDescription && club.description && !isCompact && (
          <p className="club-card-description">
            {club.description}
          </p>
        )}

        {/* Footer with Member Count */}
        {!isCompact && (
          <div className="club-card-footer">
            <div className="club-card-members">
              <div className="club-card-members-icon-wrapper">
                <Users className="club-card-members-icon" />
              </div>
              <div className="club-card-members-text">
                <span className="club-card-members-count">{membersCount}</span>
                <span className="club-card-members-label">
                  {membersCount === 1 ? t('clubs.member') : t('clubs.members')}
                </span>
              </div>
            </div>
            
            {/* Arrow indicator */}
            <div className="club-card-arrow">
              <svg className="club-card-arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        )}

        {/* Arrow indicator for compact variant */}
        {isCompact && (
          <div className="club-card-arrow">
            <svg className="club-card-arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </Card>
    </Link>
  )
}

