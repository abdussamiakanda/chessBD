import { Trophy, Medal, Award, ExternalLink } from 'lucide-react'
import { Skeleton } from '../ui/Skeleton'
import { PlayerName } from '../PlayerName'
import { useLanguage } from '../../contexts/LanguageContext'
import './StandingsTable.css'

export function StandingsTable({ standings, isLoading, error, platform = 'chesscom', tournamentStatus }) {
  const { t } = useLanguage()

  if (isLoading) {
    return (
      <section className="event-detail-section">
        <div className="event-detail-section-header">
          <div className="event-detail-section-icon">
            <Trophy className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentResults') || 'Tournament Results'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.standings') || 'Standings'}
            </h2>
          </div>
        </div>
        <div className="event-detail-standings-skeleton-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="event-detail-standings-skeleton-item" />
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
            <Trophy className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentResults') || 'Tournament Results'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.standings') || 'Standings'}
            </h2>
          </div>
        </div>
        <div className="event-detail-standings-card">
          <div className="event-detail-standings-content">
            <p className="event-detail-standings-description">
              {t('events.failedToLoadStandings') || 'Failed to load standings. Please try again later.'}
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (!standings || standings.length === 0) {
    return (
      <section className="event-detail-section">
        <div className="event-detail-section-header">
          <div className="event-detail-section-icon">
            <Trophy className="event-detail-section-icon-svg" />
          </div>
          <div>
            <p className="event-detail-section-label">
              {t('events.tournamentResults') || 'Tournament Results'}
            </p>
            <h2 className="event-detail-section-title">
              {t('events.standings') || 'Standings'}
            </h2>
          </div>
        </div>
        <div className="event-detail-standings-card">
          <div className="event-detail-standings-content">
            <div className="event-detail-standings-empty">
              <div className="event-detail-standings-empty-icon">
                <Trophy className="event-detail-standings-empty-icon-svg" />
              </div>
              <div>
                <h3 className="event-detail-standings-empty-title">
                  {tournamentStatus === 'finished'
                    ? (t('events.noStandingsAvailable') || 'No Standings Available')
                    : (t('events.standingsComingSoon') || 'Standings Coming Soon')}
                </h3>
                <p className="event-detail-standings-empty-description">
                  {tournamentStatus === 'finished'
                    ? (t('events.noStandingsDescription') || 'No standings are available for this tournament. The tournament may not have had any participants or standings data may not be available.')
                    : (t('events.standingsComingSoonDescription') || 'Standings will appear here once the tournament starts. Check back after the tournament begins to see player rankings and scores.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const getRankIcon = (rank) => {
    if (rank === 1) {
      return <Trophy className="event-detail-standing-rank-icon event-detail-standing-rank-icon-first" />
    } else if (rank === 2) {
      return <Medal className="event-detail-standing-rank-icon event-detail-standing-rank-icon-second" />
    } else if (rank === 3) {
      return <Medal className="event-detail-standing-rank-icon event-detail-standing-rank-icon-third" />
    }
    return <Award className="event-detail-standing-rank-icon event-detail-standing-rank-icon-other" />
  }

  const getRankBadge = (rank) => {
    if (rank <= 3) {
      return (
        <div className={`event-detail-standing-rank-badge ${
          rank === 1 ? 'event-detail-standing-rank-badge-first' :
          rank === 2 ? 'event-detail-standing-rank-badge-second' :
          'event-detail-standing-rank-badge-third'
        }`}>
          <span className={`event-detail-standing-rank-badge-text ${
            rank === 1 ? 'event-detail-standing-rank-badge-text-first' :
            rank === 2 ? 'event-detail-standing-rank-badge-text-second' :
            'event-detail-standing-rank-badge-text-third'
          }`}>
            {rank}
          </span>
        </div>
      )
    }
    return (
      <div className="event-detail-standing-rank-badge event-detail-standing-rank-badge-other">
        <span className="event-detail-standing-rank-badge-text event-detail-standing-rank-badge-text-other">
          {rank}
        </span>
      </div>
    )
  }

  return (
    <section className="event-detail-section">
      <div className="event-detail-section-header">
        <div className="event-detail-section-icon">
          <Trophy className="event-detail-section-icon-svg" />
        </div>
        <div>
          <p className="event-detail-section-label">
            {t('events.tournamentResults') || 'Tournament Results'}
          </p>
          <h2 className="event-detail-section-title">
            {t('events.standings') || 'Standings'}
          </h2>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="event-detail-standings-table-wrapper">
        <div className="event-detail-standings-table-container">
          <table className="event-detail-standings-table">
            <thead className="event-detail-standings-table-head">
              <tr>
                <th className="event-detail-standings-table-header">
                  {t('events.rank') || 'Rank'}
                </th>
                <th className="event-detail-standings-table-header">
                  {t('events.player') || 'Player'}
                </th>
                <th className="event-detail-standings-table-header event-detail-standings-table-header-center">
                  {t('events.points') || 'Points'}
                </th>
              </tr>
            </thead>
            <tbody className="event-detail-standings-table-body">
              {standings.map((standing) => (
                <tr
                  key={`${standing.rank}-${standing.username}`}
                  className="event-detail-standings-table-row"
                >
                  <td className="event-detail-standings-table-cell">
                    <div className="event-detail-standing-rank-cell">
                      {getRankIcon(standing.rank)}
                      <span className={`event-detail-standing-rank-number ${
                        standing.rank <= 3 ? 'event-detail-standing-rank-number-top' : ''
                      }`}>
                        {standing.rank}
                      </span>
                    </div>
                  </td>
                  <td className="event-detail-standings-table-cell">
                    <a
                      href={platform === 'lichess' 
                        ? `https://lichess.org/@/${standing.username}`
                        : `https://www.chess.com/member/${standing.username}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`event-detail-standing-player-link ${
                        standing.rank <= 3 ? 'event-detail-standing-player-link-top' : ''
                      }`}
                    >
                      <PlayerName username={standing.username} showTitle={true} platform={platform} />
                      <ExternalLink className="event-detail-standing-player-link-icon" />
                    </a>
                  </td>
                  <td className="event-detail-standings-table-cell event-detail-standings-table-cell-center">
                    <span className="event-detail-standing-score">
                      {standing.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="event-detail-standings-cards">
        {standings.map((standing) => (
          <div
            key={`${standing.rank}-${standing.username}`}
            className={`event-detail-standing-card ${
              standing.rank === 1 ? 'event-detail-standing-card-first' :
              standing.rank === 2 ? 'event-detail-standing-card-second' :
              standing.rank === 3 ? 'event-detail-standing-card-third' :
              'event-detail-standing-card-other'
            }`}
          >
            <div className="event-detail-standing-card-content">
              <div className="event-detail-standing-card-main">
                {getRankBadge(standing.rank)}
                <div className="event-detail-standing-card-player">
                  <a
                    href={platform === 'lichess' 
                      ? `https://lichess.org/@/${standing.username}`
                      : `https://www.chess.com/member/${standing.username}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`event-detail-standing-card-player-link ${
                      standing.rank <= 3 ? 'event-detail-standing-card-player-link-top' : ''
                    }`}
                  >
                    <span className="event-detail-standing-card-player-name">
                      <PlayerName username={standing.username} showTitle={true} platform={platform} />
                    </span>
                    <ExternalLink className="event-detail-standing-card-player-link-icon" />
                  </a>
                </div>
              </div>
              <div className="event-detail-standing-card-score">
                {getRankIcon(standing.rank)}
                <span className="event-detail-standing-card-score-value">
                  {standing.score}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

