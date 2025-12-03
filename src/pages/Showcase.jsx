import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { Sparkles, Trophy, TrendingUp, Calendar, Crown, Users, MapPin, Award, Club as ClubIcon } from 'lucide-react'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { api } from '../lib/api'
import './Showcase.css'

// Helper function to calculate event status
function calculateEventStatus(event) {
  const now = new Date()
  const startTime = new Date(event.start_time)
  const endTime = new Date(event.end_time)

  if (now < startTime) {
    return 'upcoming'
  } else if (now >= startTime && now <= endTime) {
    return 'in_progress'
  } else {
    return 'finished'
  }
}

export function Showcase() {
  const { t } = useLanguage()
  useSEO({
    title: t('nav.showcase') || 'Showcase',
    description: 'Discover featured players and outstanding achievements from the ChessBD community.',
    keywords: 'chess showcase, featured players, chess achievements, ChessBD showcase',
    url: '/showcase',
  })
  
  // Fetch showcase data (player of day/week/month and tournament winners)
  const { data: showcaseData, isLoading: showcaseLoading, error: showcaseError } = useQuery({
    queryKey: ['showcase-data'],
    queryFn: () => api.getShowcaseData(),
    staleTime: 300000, // 5 minutes
  })

  // Fetch users for player of day/week/month
  const { data: usersMap } = useQuery({
    queryKey: ['showcase-users'],
    queryFn: async () => {
      if (!db) return {}
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = {}
      usersSnapshot.docs.forEach(doc => {
        users[doc.id] = { id: doc.id, ...doc.data() }
      })
      return users
    },
    staleTime: 300000,
  })

  // Fetch finished events for tournament winners
  const { data: finishedEvents } = useQuery({
    queryKey: ['finished-events'],
    queryFn: async () => {
      console.log('[Showcase] Fetching finished events...')
      if (!db) {
        console.log('[Showcase] Database not available')
        return []
      }
      const eventsSnapshot = await getDocs(collection(db, 'events'))
      const eventsList = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      console.log('[Showcase] Total events:', eventsList.length)
      
      // Filter for finished tournaments with chess.com tournament ID
      const finished = eventsList.filter((event) => {
        const calculatedStatus = calculateEventStatus(event)
        const isFinished = calculatedStatus === 'finished'
        const hasChesscomIds = !!(event.chesscom_tournament_id && event.chesscom_club_id)
        
        return isFinished && hasChesscomIds
      })
      return finished
    },
    staleTime: 300000,
  })

  // Fetch tournament winners from chess.com API
  const { data: tournamentWinners, isLoading: winnersLoading } = useQuery({
    queryKey: ['tournament-winners', finishedEvents],
    queryFn: async () => {
      if (!finishedEvents || finishedEvents.length === 0) {
        return []
      }
      
      const winners = []

      // Fetch winners for up to 6 most recent finished tournaments
      const recentEvents = finishedEvents
        .sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime())
        .slice(0, 6)
      
      for (const event of recentEvents) {
        try {
          // Try to get standings from API
          let winner = null
          try {
            // Check if the function exists
            if (api.getChesscomTournamentStandings) {
              const standings = await api.getChesscomTournamentStandings(event.id)
              if (standings && standings.length > 0) {
                const apiWinner = standings.find((s) => s.rank === 1)
                if (apiWinner) {
                  winner = {
                    username: apiWinner.username,
                    score: apiWinner.score,
                  }
                }
              }
            }
          } catch (apiError) {
            console.error('[Showcase] Error fetching tournament standings:', apiError)
          }
          
          // Add winner if found
          if (winner) {
            winners.push({
              eventId: event.id,
              eventName: event.name,
              eventSlug: event.slug || null,
              winnerUsername: winner.username,
              score: winner.score,
              finishedAt: event.end_time,
            })
          }
        } catch (error) {
          console.error('[Showcase] Error processing tournament:', error)
        }
      }

      return winners
    },
    enabled: !!finishedEvents && finishedEvents.length > 0,
    staleTime: 300000,
  })

  // Fetch clubs from database
  const { data: clubs, isLoading: clubsLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      if (!db) return []
      const clubsSnapshot = await getDocs(collection(db, 'clubs'))
      const clubsList = clubsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      return clubsList
    },
    staleTime: 300000,
  })

  const getPlayerInfo = (userIdOrUsername) => {
    if (!usersMap) return null
    
    // First, try to find by UID (in case it's a Firebase UID)
    let user = usersMap[userIdOrUsername]
    
    // If not found by UID, search by username (chesscom_username or lichess_username)
    if (!user) {
      const foundUser = Object.values(usersMap).find(
        (u) =>
          u.chesscom_username?.toLowerCase() === userIdOrUsername.toLowerCase() ||
          u.lichess_username?.toLowerCase() === userIdOrUsername.toLowerCase()
      )
      if (foundUser) {
        user = foundUser
      }
    }
    
    if (!user) return null
    
    const username = user.chesscom_username || user.lichess_username
    return {
      user,
      username,
      displayName: user.name || username || 'Anonymous',
      profileUrl: username ? `/player/${username}` : '#',
      avatarUrl: user.avatar_url || null,
    }
  }

  return (
    <Container>
      <div className="showcase-page">
        {/* Header Section */}
        <div className="showcase-header">
          <p className="showcase-header-label">
            {t('showcase.communitySpotlight') || 'Community Spotlight'}
          </p>
          <h1 className="showcase-header-title">
            <Sparkles className="showcase-header-icon" />
            {t('nav.showcase') || 'Showcase'}
          </h1>
          <p className="showcase-header-description">
            {t('showcase.description') || 'Celebrating outstanding players and their remarkable achievements in the ChessBD community.'}
          </p>
        </div>

        {/* Featured Players - Player of Day/Week/Month */}
        {showcaseError && (
          <Card className="showcase-error-card">
            <p className="showcase-error-text">
              {t('showcase.errorLoading') || 'Error loading showcase data:'} {String(showcaseError)}
            </p>
          </Card>
        )}
        {showcaseLoading ? (
          <section className="showcase-section">
            <div className="showcase-section-header">
              <p className="showcase-section-label">
                {t('showcase.featuredAchievements') || 'Featured Achievements'}
              </p>
              <h2 className="showcase-section-title">
                {t('showcase.featuredPlayers') || 'Featured Players'}
              </h2>
            </div>
            <div className="showcase-featured-grid">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="showcase-featured-card showcase-featured-card-skeleton">
                  <div className="showcase-featured-card-glow"></div>
                  <div className="showcase-featured-card-content">
                    <div className="showcase-featured-card-header">
                      <Skeleton className="showcase-featured-card-icon-skeleton" />
                      <div className="showcase-featured-card-title-wrapper">
                        <Skeleton className="showcase-featured-card-label-skeleton" />
                        <Skeleton className="showcase-featured-card-name-skeleton" />
                      </div>
                    </div>
                    <div className="showcase-featured-card-player">
                      <Skeleton className="showcase-featured-card-avatar-skeleton" />
                      <div className="showcase-featured-card-stats">
                        <Skeleton className="showcase-featured-card-rating-skeleton" />
                        <Skeleton className="showcase-featured-card-games-skeleton" />
                      </div>
                    </div>
                    <Skeleton className="showcase-featured-card-button-skeleton" />
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : showcaseData && (showcaseData.playerOfDay || showcaseData.playerOfWeek || showcaseData.playerOfMonth) ? (
          <section className="showcase-section">
            <div className="showcase-section-header">
              <p className="showcase-section-label">
                {t('showcase.featuredAchievements') || 'Featured Achievements'}
              </p>
              <h2 className="showcase-section-title">
                {t('showcase.featuredPlayers') || 'Featured Players'}
              </h2>
            </div>
            <div className="showcase-featured-grid">
              {/* Player of the Day */}
              {showcaseData.playerOfDay && (() => {
                const playerInfo = getPlayerInfo(showcaseData.playerOfDay.user_id)
                const displayName = playerInfo?.displayName || showcaseData.playerOfDay.user_id || t('showcase.unknownPlayer') || 'Unknown Player'
                const username = playerInfo?.username || showcaseData.playerOfDay.user_id || null
                const profileUrl = playerInfo?.profileUrl || (username ? `/player/${username}` : '#')
                const avatarUrl = playerInfo?.avatarUrl || null
                
                return (
                  <Card className="showcase-featured-card showcase-featured-card-day">
                    <div className="showcase-featured-card-glow"></div>
                    <div className="showcase-featured-card-content">
                      <div className="showcase-featured-card-header">
                        <div className="showcase-featured-card-icon showcase-featured-card-icon-day">
                          <Calendar className="showcase-featured-card-icon-svg" />
                        </div>
                        <div className="showcase-featured-card-title-wrapper">
                          <p className="showcase-featured-card-label">
                            {t('showcase.playerOfDay') || 'Player of the Day'}
                          </p>
                          <h3 className="showcase-featured-card-name">{displayName}</h3>
                          {username && <p className="showcase-featured-card-username">@{username}</p>}
                        </div>
                      </div>
                      <div className="showcase-featured-card-player">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="showcase-featured-card-avatar"
                            loading="lazy"
                          />
                        ) : (
                          <div className="showcase-featured-card-avatar-placeholder">
                            <Trophy className="showcase-featured-card-avatar-icon" />
                          </div>
                        )}
                        <div className="showcase-featured-card-stats">
                          <div className="showcase-featured-card-rating">
                            <span className="showcase-featured-card-rating-value">
                              {showcaseData.playerOfDay.rating_earned > 0 ? '+' : ''}{showcaseData.playerOfDay.rating_earned}
                            </span>
                            <span className="showcase-featured-card-rating-label">
                              <TrendingUp className="showcase-featured-card-rating-icon" />
                              {t('showcase.ratingGain') || 'Rating Gain'}
                            </span>
                          </div>
                          <p className="showcase-featured-card-games">
                            {showcaseData.playerOfDay.games_won} {t('showcase.gamesWonToday') || 'Games Won Today'}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={profileUrl}
                        className="showcase-featured-card-button"
                      >
                        {t('showcase.viewProfile') || 'View Profile'}
                      </Link>
                    </div>
                  </Card>
                )
              })()}

              {/* Player of the Week */}
              {showcaseData.playerOfWeek && (() => {
                const playerInfo = getPlayerInfo(showcaseData.playerOfWeek.user_id)
                const displayName = playerInfo?.displayName || showcaseData.playerOfWeek.user_id || t('showcase.unknownPlayer') || 'Unknown Player'
                const username = playerInfo?.username || showcaseData.playerOfWeek.user_id || null
                const profileUrl = playerInfo?.profileUrl || (username ? `/player/${username}` : '#')
                const avatarUrl = playerInfo?.avatarUrl || null
                
                return (
                  <Card className="showcase-featured-card showcase-featured-card-week">
                    <div className="showcase-featured-card-glow"></div>
                    <div className="showcase-featured-card-content">
                      <div className="showcase-featured-card-header">
                        <div className="showcase-featured-card-icon showcase-featured-card-icon-week">
                          <TrendingUp className="showcase-featured-card-icon-svg" />
                        </div>
                        <div className="showcase-featured-card-title-wrapper">
                          <p className="showcase-featured-card-label">
                            {t('showcase.playerOfWeek') || 'Player of the Week'}
                          </p>
                          <h3 className="showcase-featured-card-name">{displayName}</h3>
                          {username && <p className="showcase-featured-card-username">@{username}</p>}
                        </div>
                      </div>
                      <div className="showcase-featured-card-player">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="showcase-featured-card-avatar"
                            loading="lazy"
                          />
                        ) : (
                          <div className="showcase-featured-card-avatar-placeholder">
                            <Trophy className="showcase-featured-card-avatar-icon" />
                          </div>
                        )}
                        <div className="showcase-featured-card-stats">
                          <div className="showcase-featured-card-rating">
                            <span className="showcase-featured-card-rating-value">
                              {showcaseData.playerOfWeek.rating_earned > 0 ? '+' : ''}{showcaseData.playerOfWeek.rating_earned}
                            </span>
                            <span className="showcase-featured-card-rating-label">
                              <TrendingUp className="showcase-featured-card-rating-icon" />
                              {t('showcase.ratingGain') || 'Rating Gain'}
                            </span>
                          </div>
                          <p className="showcase-featured-card-games">
                            {showcaseData.playerOfWeek.games_won} {t('showcase.gamesWonThisWeek') || 'Games Won This Week'}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={profileUrl}
                        className="showcase-featured-card-button"
                      >
                        {t('showcase.viewProfile') || 'View Profile'}
                      </Link>
                    </div>
                  </Card>
                )
              })()}

              {/* Player of the Month */}
              {showcaseData.playerOfMonth && (() => {
                const playerInfo = getPlayerInfo(showcaseData.playerOfMonth.user_id)
                const displayName = playerInfo?.displayName || showcaseData.playerOfMonth.user_id || t('showcase.unknownPlayer') || 'Unknown Player'
                const username = playerInfo?.username || showcaseData.playerOfMonth.user_id || null
                const profileUrl = playerInfo?.profileUrl || (username ? `/player/${username}` : '#')
                const avatarUrl = playerInfo?.avatarUrl || null
                
                return (
                  <Card className="showcase-featured-card showcase-featured-card-month">
                    <div className="showcase-featured-card-glow"></div>
                    <div className="showcase-featured-card-content">
                      <div className="showcase-featured-card-header">
                        <div className="showcase-featured-card-icon showcase-featured-card-icon-month">
                          <Crown className="showcase-featured-card-icon-svg" />
                        </div>
                        <div className="showcase-featured-card-title-wrapper">
                          <p className="showcase-featured-card-label">
                            {t('showcase.playerOfMonth') || 'Player of the Month'}
                          </p>
                          <h3 className="showcase-featured-card-name">{displayName}</h3>
                          {username && <p className="showcase-featured-card-username">@{username}</p>}
                        </div>
                      </div>
                      <div className="showcase-featured-card-player">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="showcase-featured-card-avatar"
                            loading="lazy"
                          />
                        ) : (
                          <div className="showcase-featured-card-avatar-placeholder">
                            <Trophy className="showcase-featured-card-avatar-icon" />
                          </div>
                        )}
                        <div className="showcase-featured-card-stats">
                          <div className="showcase-featured-card-rating">
                            <span className="showcase-featured-card-rating-value">
                              {showcaseData.playerOfMonth.rating_earned > 0 ? '+' : ''}{showcaseData.playerOfMonth.rating_earned}
                            </span>
                            <span className="showcase-featured-card-rating-label">
                              <TrendingUp className="showcase-featured-card-rating-icon" />
                              {t('showcase.ratingGain') || 'Rating Gain'}
                            </span>
                          </div>
                          <p className="showcase-featured-card-games">
                            {showcaseData.playerOfMonth.games_won} {t('showcase.gamesWonThisMonth') || 'Games Won This Month'}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={profileUrl}
                        className="showcase-featured-card-button"
                      >
                        {t('showcase.viewProfile') || 'View Profile'}
                      </Link>
                    </div>
                  </Card>
                )
              })()}
            </div>
          </section>
        ) : (
          <section className="showcase-section">
            <Card className="showcase-empty-card">
              <div className="showcase-empty-content">
                <div className="showcase-empty-icon">
                  <Users className="showcase-empty-icon-svg" />
                </div>
                <div>
                  <h3 className="showcase-empty-title">
                    {t('showcase.noData') || 'No featured players at the moment'}
                  </h3>
                  <p className="showcase-empty-description">
                    {t('showcase.noDataDescription') || 'Check back later to see outstanding achievements from the ChessBD community.'}
                  </p>
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* Recent Tournament Winners */}
        <section className="showcase-section">
          <div className="showcase-section-header">
            <p className="showcase-section-label">
              {t('showcase.tournamentChampions') || 'Tournament Champions'}
            </p>
            <h2 className="showcase-section-title">
              {t('showcase.recentWinners') || 'Recent Tournament Winners'}
            </h2>
            <p className="showcase-section-description">
              {t('showcase.recentWinnersDesc') || 'Celebrating the champions who have triumphed in recent tournaments.'}
            </p>
          </div>

          {winnersLoading ? (
            <div className="showcase-winners-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="showcase-winner-card showcase-winner-card-skeleton">
                  <div className="showcase-winner-card-glow"></div>
                  <div className="showcase-winner-card-content">
                    <div className="showcase-winner-card-avatar-wrapper">
                      <Skeleton className="showcase-winner-card-avatar-skeleton" />
                      <div className="showcase-winner-card-trophy-badge">
                        <Skeleton className="showcase-winner-card-trophy-skeleton" />
                      </div>
                    </div>
                    <div className="showcase-winner-card-info">
                      <Skeleton className="showcase-winner-card-name-skeleton" />
                      <Skeleton className="showcase-winner-card-username-skeleton" />
                      <Skeleton className="showcase-winner-card-tournament-skeleton" />
                      <Skeleton className="showcase-winner-card-date-skeleton" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : tournamentWinners && tournamentWinners.length > 0 ? (
            <div className="showcase-winners-grid">
              {tournamentWinners.map((winner, index) => {
                const playerInfo = getPlayerInfo(winner.winnerUsername)
                const eventUrl = winner.eventSlug ? `/events/${winner.eventSlug}` : `/events/${winner.eventId}`
                const displayName = playerInfo?.displayName || winner.winnerUsername
                const username = playerInfo?.username || winner.winnerUsername
                const profileUrl = playerInfo?.profileUrl || (username ? `/player/${username}` : '#')
                const avatarUrl = playerInfo?.avatarUrl
                
                return (
                  <div key={index} className="showcase-winner-card">
                    <div className="showcase-winner-card-glow"></div>
                    <div className="showcase-winner-card-content">
                      <div className="showcase-winner-card-avatar-wrapper">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="showcase-winner-card-avatar"
                          />
                        ) : (
                          <div className="showcase-winner-card-avatar-placeholder">
                            <Users className="showcase-winner-card-avatar-icon" />
                          </div>
                        )}
                        <div className="showcase-winner-card-trophy-badge">
                          <Trophy className="showcase-winner-card-trophy-icon" />
                        </div>
                        <div className="showcase-winner-card-avatar-glow"></div>
                      </div>
                      <div className="showcase-winner-card-info">
                        <Link to={profileUrl} className="showcase-winner-card-name-link">
                          <h3 className="showcase-winner-card-name">{displayName}</h3>
                          {username && <p className="showcase-winner-card-username">@{username}</p>}
                        </Link>
                        <Link to={eventUrl} className="showcase-winner-card-tournament-link">
                          <p className="showcase-winner-card-tournament">{winner.eventName}</p>
                        </Link>
                        <div className="showcase-winner-card-meta">
                          <div className="showcase-winner-card-date">
                            <Calendar className="showcase-winner-card-date-icon" />
                            <span>
                              {new Date(winner.finishedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <span className="showcase-winner-card-separator">•</span>
                          <div className="showcase-winner-card-score">
                            <Trophy className="showcase-winner-card-score-icon" />
                            <span>
                              {t('showcase.score') || 'Score'}: {winner.score}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Card className="showcase-empty-card">
              <div className="showcase-empty-content">
                <div className="showcase-empty-icon">
                  <Trophy className="showcase-empty-icon-svg" />
                </div>
                <div>
                  <h3 className="showcase-empty-title">
                    {t('showcase.noTournamentWinners') || 'No recent tournament winners'}
                  </h3>
                  <p className="showcase-empty-description">
                    {t('showcase.noTournamentWinnersDesc') || 'Tournament winners will appear here after competitions conclude.'}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </section>

        {/* District of the Month Section */}
        <section className="showcase-section">
          <div className="showcase-section-header">
            <p className="showcase-section-label">
              {t('showcase.regionalExcellence') || 'Regional Excellence'}
            </p>
            <h2 className="showcase-section-title">
              {t('showcase.districtOfMonth') || 'District of the Month'}
            </h2>
            <p className="showcase-section-description">
              {t('showcase.districtOfMonthDesc') || 'Recognizing the district with outstanding chess achievements this month.'}
            </p>
          </div>

          <div className="showcase-district-grid">
            <Card className="showcase-district-card">
              <div className="showcase-district-card-glow"></div>
              <div className="showcase-district-card-content">
                <div className="showcase-district-card-header">
                  <div className="showcase-district-card-icon">
                    <MapPin className="showcase-district-card-icon-svg" />
                  </div>
                  <div className="showcase-district-card-title-wrapper">
                    <p className="showcase-district-card-label">
                      {t('showcase.districtOfMonth') || 'District of the Month'}
                    </p>
                    {showcaseData?.districtOfMonth ? (
                      <h3 className="showcase-district-card-name">
                        {showcaseData.districtOfMonth.location}
                      </h3>
                    ) : (
                      <h3 className="showcase-district-card-name">
                        {t('showcase.district') || 'District'}
                      </h3>
                    )}
                  </div>
                </div>

                {showcaseData?.districtOfMonth ? (
                  <>
                    <div className="showcase-district-card-stats">
                      <div className="showcase-district-card-icon-placeholder">
                        <Award className="showcase-district-card-icon-placeholder-svg" />
                      </div>
                      <div className="showcase-district-card-stats-content">
                        <div className="showcase-district-card-rating">
                          <span className="showcase-district-card-rating-value">
                            {showcaseData.districtOfMonth.avg_rating_earned > 0 ? '+' : ''}{showcaseData.districtOfMonth.avg_rating_earned}
                          </span>
                          <span className="showcase-district-card-rating-label">
                            <TrendingUp className="showcase-district-card-rating-icon" />
                            {t('showcase.avgRatingGain') || 'Avg Rating Gain'}
                          </span>
                        </div>
                        <p className="showcase-district-card-games">
                          {showcaseData.districtOfMonth.games_won} {t('showcase.gamesWon') || 'Games Won'}
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/locations"
                      className="showcase-district-card-button"
                    >
                      {t('showcase.viewLocations') || 'View Locations'}
                    </Link>
                  </>
                ) : (
                  <div className="showcase-district-card-empty">
                    <p className="showcase-district-card-empty-text">
                      {t('showcase.noDistrictOfMonth') || 'No District of the Month'}
                    </p>
                    <p className="showcase-district-card-empty-description">
                      {t('showcase.noDistrictOfMonthDesc') || 'District of the Month will appear here when data is available.'}
                    </p>
                    <Link
                      to="/locations"
                      className="showcase-district-card-button"
                    >
                      {t('showcase.viewLocations') || 'View Locations'}
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </section>

        {/* Club of the Month Section */}
        <section className="showcase-section">
          <div className="showcase-section-header">
            <p className="showcase-section-label">
              {t('showcase.communityExcellence') || 'Community Excellence'}
            </p>
            <h2 className="showcase-section-title">
              {t('showcase.clubOfMonth') || 'Club of the Month'}
            </h2>
            <p className="showcase-section-description">
              {t('showcase.clubOfMonthDesc') || 'Celebrating the talent and teamwork driving Bangladesh\'s chess growth.'}
            </p>
          </div>

          <div className="showcase-club-grid">
            <Card className="showcase-club-card">
              {clubsLoading ? (
                <>
                  <div className="showcase-club-card-header">
                    <Skeleton className="showcase-club-card-icon-skeleton" />
                    <div className="showcase-club-card-title-wrapper">
                      <Skeleton className="showcase-club-card-label-skeleton" />
                      <Skeleton className="showcase-club-card-name-skeleton" />
                    </div>
                  </div>
                  <div className="showcase-club-card-content">
                    <Skeleton className="showcase-club-card-logo-skeleton" />
                    <Skeleton className="showcase-club-card-members-skeleton" />
                  </div>
                </>
              ) : (
                <>
                  <div className="showcase-club-card-header">
                    <div className="showcase-club-card-icon">
                      <ClubIcon className="showcase-club-card-icon-svg" />
                    </div>
                    <div className="showcase-club-card-title-wrapper">
                      <p className="showcase-club-card-label">
                        {t('showcase.clubOfMonth') || 'Club of the Month'}
                      </p>
                      {clubs && clubs.length > 0 ? (() => {
                        const featuredClub = clubs.find((c) => c.featured === true)
                        if (featuredClub) {
                          return (
                            <>
                              <h3 className="showcase-club-card-name">
                                {featuredClub.name || t('showcase.chessClub') || 'Chess Club'}
                              </h3>
                              {featuredClub.location && (
                                <p className="showcase-club-card-location">{featuredClub.location}</p>
                              )}
                            </>
                          )
                        }
                        return <h3 className="showcase-club-card-name">{t('showcase.chessClub') || 'Chess Club'}</h3>
                      })() : (
                        <h3 className="showcase-club-card-name">{t('showcase.chessClub') || 'Chess Club'}</h3>
                      )}
                    </div>
                  </div>

                  {clubs && clubs.length > 0 ? (() => {
                    const featuredClub = clubs.find((c) => c.featured === true)
                    if (!featuredClub) {
                      return (
                        <div className="showcase-club-card-empty">
                          <p className="showcase-club-card-empty-text">
                            {t('showcase.noFeaturedClub') || 'No featured club available'}
                          </p>
                          <p className="showcase-club-card-empty-description">
                            {t('showcase.featuredClubWillAppear') || 'Featured clubs will appear here when available'}
                          </p>
                          <Link
                            to="/clubs"
                            className="showcase-club-card-button"
                          >
                            {t('showcase.discoverClubs') || 'Discover Clubs'}
                          </Link>
                        </div>
                      )
                    }
                    return (
                      <>
                        <div className="showcase-club-card-stats">
                          {featuredClub.logo_url ? (
                            <img
                              src={featuredClub.logo_url}
                              alt={featuredClub.name}
                              className="showcase-club-card-logo"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="showcase-club-card-logo-placeholder">
                              <Users className="showcase-club-card-logo-icon" />
                            </div>
                          )}
                          <div className="showcase-club-card-members">
                            <p className="showcase-club-card-members-value">
                              {featuredClub.members_count || featuredClub.members || '0'}+
                            </p>
                            <p className="showcase-club-card-members-label">
                              {t('showcase.activeMembers') || 'Active Members'}
                            </p>
                          </div>
                        </div>
                        {featuredClub.description && (
                          <p className="showcase-club-card-description">
                            {featuredClub.description}
                          </p>
                        )}
                        <Link
                          to="/clubs"
                          className="showcase-club-card-button"
                        >
                          {t('showcase.discoverClubs') || 'Discover Clubs'}
                        </Link>
                      </>
                    )
                  })() : (
                    <div className="showcase-club-card-empty">
                      <p className="showcase-club-card-empty-text">
                        {t('showcase.noClubsAvailable') || 'No clubs available'}
                      </p>
                      <p className="showcase-club-card-empty-description">
                        {t('showcase.clubsWillAppear') || 'Clubs will appear here when available'}
                      </p>
                      <Link
                        to="/clubs"
                        className="showcase-club-card-button"
                      >
                        {t('showcase.discoverClubs') || 'Discover Clubs'}
                      </Link>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        </section>
      </div>
    </Container>
  )
}

