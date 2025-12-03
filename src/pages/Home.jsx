import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { ActionCard } from '../components/ui/ActionCard'
import { EventCard } from '../components/ui/EventCard'
import { NewsCard } from '../components/ui/NewsCard'
import { SpotlightCard } from '../components/ui/SpotlightCard'
import { TestimonialCard } from '../components/ui/TestimonialCard'
import { PartnerLogo } from '../components/ui/PartnerLogo'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuthStore } from '../store/auth-store'
import { useStats } from '../hooks/use-stats'
import { useEvents } from '../hooks/use-events'
import { api } from '../lib/api'
import { ArrowRight, Trophy, Users, Gamepad2, UserCheck, BarChart3, GraduationCap, TrendingUp, Crown, Calendar, Zap, Award, Newspaper, Club, Quote, Mail, User } from 'lucide-react'
import { PageLoader } from '../components/ui/PageLoader'
import './Home.css'

export function Home() {
  const { t } = useLanguage()
  const { user, loading: authLoading } = useAuthStore()
  
  // Fetch real data from database
  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: events, isLoading: eventsLoading } = useEvents()
  
  // Filter events
  // Note: API returns 'upcoming', 'live', 'completed' - map to expected values
  const upcoming = events?.filter(e => e.status === 'upcoming') || []
  const inProgress = events?.filter(e => e.status === 'live' || e.status === 'in_progress') || []
  const finished = events?.filter(e => e.status === 'completed' || e.status === 'finished') || []
  
  // Fetch news
  const { data: news, isLoading: newsLoading } = useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      const result = await api.getNews(true)
      return result
    },
    staleTime: 300000,
  })
  
  // Fetch showcase data
  const { data: showcaseData, isLoading: showcaseLoading } = useQuery({
    queryKey: ['showcase-data'],
    queryFn: async () => {
      const result = await api.getShowcaseData()
      return result
    },
    staleTime: 300000,
  })
  
  // Fetch users for player info
  const { data: usersMap } = useQuery({
    queryKey: ['showcase-users'],
    queryFn: () => api.getUsers(),
    staleTime: 300000,
  })
  
  // Fetch clubs from database
  const { data: clubs, isLoading: clubsLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => api.getClubs(),
    staleTime: 300000,
  })
  
  // Helper function to get player info
  const getPlayerInfo = (userIdOrUsername) => {
    if (!usersMap) return null
    let user = usersMap[userIdOrUsername]
    
    // If not found by ID, try to find by username
    if (!user) {
      user = Object.values(usersMap).find(u => 
        u.username === userIdOrUsername || 
        u.chesscom_username === userIdOrUsername ||
        u.lichess_username === userIdOrUsername
      )
    }
    
    if (!user) return null
    
    // Get display name
    const displayName = user.name || user.full_name || user.chesscom_username || user.lichess_username || user.email || userIdOrUsername
    const username = user.username || user.chesscom_username || user.lichess_username
    const avatarUrl = user.avatar_url || user.avatarUrl
    
    return {
      ...user,
      displayName,
      username,
      avatarUrl,
    }
  }
  
  // Get featured club
  const featuredClub = clubs?.find(c => c.featured === true) || null
  
  // Fetch testimonials from database
  const { data: testimonials, isLoading: testimonialsLoading } = useQuery({
    queryKey: ['testimonials'],
    queryFn: () => api.getTestimonials(),
    staleTime: 300000,
  })
  
  // Fetch partners from database
  const { data: partners } = useQuery({
    queryKey: ['partners'],
    queryFn: () => api.getPartners(),
    staleTime: 300000,
  })
  
  const latestNews = news?.slice(0, 3) || []
  
  // Fetch rating snapshot data
  const { data: ratingSnapshot, isLoading: ratingSnapshotLoading, error: ratingSnapshotError } = useQuery({
    queryKey: ['rating-snapshot'],
    queryFn: async () => {
      try {
        return await api.getRatingSnapshot()
      } catch (error) {
        // Return fallback data on error
        return {
          averageRating: 0,
          playerCount: 0,
          barData: [50, 50, 50, 50, 50, 50, 50],
          dailyAverages: [0, 0, 0, 0, 0, 0, 0],
          change: 0,
        }
      }
    },
    staleTime: 600000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })
  
  // Format numbers for display
  const formatNumber = (num) => {
    if (!num && num !== 0) return '0+'
    if (num >= 1000) {
      const k = num / 1000
      if (k % 1 === 0) {
        return `${k}k+`
      }
      return `${k.toFixed(1)}k+`
    }
    return `${num}+`
  }
  
  if (authLoading) {
    return <PageLoader />
  }
  
  return (
    <Container>
      <div className="home-wrapper">
        {/* Hero Section - Split Layout */}
        <section className="home-hero-section">
          <div className="home-hero-grid">
            {/* Left Column - Text Content */}
            <div className="home-hero-left">
              <div className="home-hero-badge-wrapper">
                <p className="home-badge">
                  <span>🇧🇩</span> <span>{t('home.badge') || 'Crafted for the Bangladeshi chess community'}</span>
                </p>
              </div>
              
              <div className="home-hero-text">
                <h1 className="home-title">
                  <Crown className="home-title-icon" />
                  {t('home.title') || 'ChessBD'}
                </h1>
                <p className="home-subtitle">
                  {t('home.subtitle') || "Bangladesh's Premier Chess Community"}
                </p>
                <p className="home-description">
                  {t('home.description') || 'Join tournaments, track your progress, and compete with the best players in Bangladesh. All your games sync automatically from Chess.com.'}
                </p>
              </div>

              {/* Call to Action Buttons */}
              <div className="home-actions">
                {!user && (
                  <Link
                    to="/signup"
                    className="home-btn home-btn-primary"
                  >
                    <span>{t('home.joinCommunity') || 'Join Community'}</span>
                    <ArrowRight className="home-btn-icon" />
                  </Link>
                )}
                {user && user.email_verified_at && (
                  <>
                    <Link
                      to="/leaderboard"
                      className="home-btn home-btn-primary"
                    >
                      <Trophy className="home-btn-icon-left" />
                      <span>{t('home.viewLeaderboard') || 'View Leaderboard'}</span>
                      <ArrowRight className="home-btn-icon-right" />
                    </Link>
                    <Link
                      to="/events"
                      className="home-btn home-btn-secondary"
                    >
                      <Calendar className="home-btn-icon-left" />
                      <span>{t('home.viewEvents') || 'View Events'}</span>
                      <ArrowRight className="home-btn-icon-right" />
                    </Link>
                  </>
                )}
              </div>

              {/* Quick Stats */}
              <dl className="home-hero-stats">
                <Card className="home-stat-card">
                  <dt className="home-stat-label">{t('home.livePlayers') || 'Live Players'}</dt>
                  {statsLoading || !stats ? (
                    <dd className="home-stat-skeleton"></dd>
                  ) : (
                    <>
                      <dd className="home-stat-value">{formatNumber(stats.activePlayers || 0)}</dd>
                      <dd className="home-stat-badge">{t('home.activeNow') || 'Active Now'}</dd>
                      <dd className="home-stat-subtext">{t('home.acrossChessBD') || 'Across ChessBD'}</dd>
                    </>
                  )}
                </Card>
                <Card className="home-stat-card">
                  <dt className="home-stat-label">{t('home.nextTournament') || 'Next Tournament'}</dt>
                  {eventsLoading ? (
                    <dd className="home-stat-skeleton"></dd>
                  ) : upcoming.length === 0 ? (
                    <>
                      <dd className="home-stat-value-small home-stat-empty">{t('home.noUpcomingTournaments') || 'No upcoming tournaments'}</dd>
                      <dd className="home-stat-badge-tournament">
                        <Calendar className="home-stat-icon" />
                        {t('home.checkBackSoon') || 'Check back soon'}
                      </dd>
                    </>
                  ) : (
                    <>
                      <dd className="home-stat-value-small">{upcoming[0]?.name || t('home.comingSoon') || 'Coming Soon'}</dd>
                      <dd className="home-stat-badge-tournament">
                        <Trophy className="home-stat-icon" />
                        {upcoming[0]?.type || t('home.tournament') || 'Tournament'}
                      </dd>
                    </>
                  )}
                </Card>
              </dl>
            </div>

            {/* Right Column - Visual Cards */}
            <div className="home-hero-visual">
              <div className="home-hero-visual-bg"></div>
              <div className="home-hero-visual-content">
                {/* Rating Snapshot Card */}
                <Card className="home-snapshot-card">
                  <div className="home-snapshot-header">
                    <div className="home-snapshot-header-content">
                      <p className="home-snapshot-label">{t('home.ratingSnapshot') || 'Rating Snapshot'}</p>
                      {ratingSnapshotLoading || !ratingSnapshot ? (
                        <div className="home-snapshot-skeleton"></div>
                      ) : (
                        <>
                          <div className="home-snapshot-rating">
                            <p className="home-snapshot-value">{formatNumber(ratingSnapshot.averageRating || 0)}</p>
                            {ratingSnapshot.change !== 0 && (
                              <span className={`home-snapshot-change ${ratingSnapshot.change > 0 ? 'home-snapshot-change-positive' : 'home-snapshot-change-negative'}`}>
                                <TrendingUp className={`home-snapshot-change-icon ${ratingSnapshot.change < 0 ? 'home-snapshot-change-icon-rotated' : ''}`} />
                                {ratingSnapshot.change > 0 ? '+' : ''}{ratingSnapshot.change}
                              </span>
                            )}
                          </div>
                          <p className="home-snapshot-meta">
                            {t('home.rapid') || 'Rapid'} · {ratingSnapshot ? `${ratingSnapshot.playerCount || 0} ${t('home.players') || 'players'}` : t('common.loading') || 'Loading...'} · {t('home.last7Days') || 'Last 7 days'}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="home-snapshot-badge">
                      {t('home.rapid') || 'Rapid'}
                    </div>
                  </div>
                  <div className="home-snapshot-chart">
                    <div className="home-snapshot-chart-header">
                      <span>{t('home.sevenDaysAgo') || '7 days ago'}</span>
                      <span>{t('home.today') || 'Today'}</span>
                    </div>
                    <div className="home-snapshot-chart-bars">
                      {ratingSnapshotLoading ? (
                        Array.from({ length: 7 }).map((_, idx) => (
                          <div key={idx} className="home-snapshot-bar-skeleton"></div>
                        ))
                      ) : ratingSnapshot && ratingSnapshot.barData && ratingSnapshot.barData.length > 0 ? (
                        ratingSnapshot.barData.map((height, idx) => {
                          const dayLabel = idx === 0 ? '7d' : idx === 6 ? 'Today' : `${7 - idx}d`
                          const dailyAvg = ratingSnapshot.dailyAverages?.[idx] || 0
                          // Ensure minimum height for visibility, especially on mobile
                          const minHeightPercent = 15 // Minimum 15% height for visibility
                          const heightPercent = `${Math.max(height, minHeightPercent)}%`
                          return (
                            <div key={idx} className="home-snapshot-bar-wrapper">
                              <div
                                className="home-snapshot-bar"
                                style={{ height: heightPercent }}
                                title={`Day ${idx + 1}: ${dailyAvg} avg`}
                              />
                              <span className="home-snapshot-bar-label">{dayLabel}</span>
                            </div>
                          )
                        })
                      ) : (
                        <div className="home-snapshot-empty">
                          <p>{t('home.noRatingData') || 'No rating data available'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>


        {/* Stats Section */}
        <section className="home-stats-section">
          <div className="home-stats-header">
            <p className="home-section-label">{t('home.realTimeMetrics') || 'Real-time metrics'}</p>
            <h2 className="home-section-title">{t('home.trustedByNational') || 'Trusted by the national chess scene'}</h2>
            <p className="home-section-description">{t('home.realTimeMetricsDesc') || 'Real-time metrics from verified players across ChessBD.'}</p>
          </div>
          <div className="home-stats-grid">
            <StatCard
              icon={UserCheck}
              label={t('home.verifiedPlayers') || 'Verified Players'}
              value={formatNumber(stats?.verifiedUsers || 0)}
              subtext={t('home.chesscomLichessFeeds') || 'Chess.com + Lichess feeds'}
              loading={statsLoading}
            />
            <StatCard
              icon={Trophy}
              label={t('home.tournaments') || 'Tournaments'}
              value={formatNumber(stats?.totalEvents || 0)}
              subtext={t('home.nationalAndOnline') || 'National & Online'}
              loading={statsLoading}
            />
            <StatCard
              icon={Gamepad2}
              label={t('home.gamesPlayed') || 'Games Played'}
              value={formatNumber(stats?.totalGames || 0)}
              subtext={t('home.autoSyncedGames') || 'Auto-synced games'}
              loading={statsLoading}
            />
            <StatCard
              icon={Users}
              label={t('home.communityMembers') || 'Community Members'}
              value={formatNumber(stats?.totalUsers || 0)}
              subtext={t('home.activeCommunity') || 'Active community'}
              loading={statsLoading}
            />
          </div>
        </section>

        {/* Action Panels */}
        <section className="home-action-panels">
          <div className="home-action-header">
            <p className="home-section-label">{t('home.yourJourney') || 'Your journey'}</p>
            <h2 className="home-section-title">{t('home.pickTheLane') || 'Pick the lane that matches your goals'}</h2>
            <p className="home-section-description">{t('home.journeyDescription') || 'Compete in national arenas, track your progress, or level up with bilingual lessons.'}</p>
          </div>
          <div className="home-stats-grid home-stats-grid-3">
            <ActionCard
              icon={Trophy}
              title={t('home.compete') || 'Compete'}
              description={t('home.competeDescription') || 'Play in rated tournaments hosted across the country — online and over the board.'}
              actionLabel={t('home.quickActions') || 'Quick actions'}
              actionText={t('home.viewEvents') || 'View Events'}
              actionTo="/events"
            />
            <ActionCard
              icon={BarChart3}
              title={t('home.track') || 'Track'}
              description={t('home.trackDescription') || 'See your Chess.com & Lichess ratings update live, compare with the national leaderboard.'}
              actionLabel={t('home.quickActions') || 'Quick actions'}
              actionText={t('home.viewLeaderboard') || 'View Leaderboard'}
              actionTo="/leaderboard"
            />
            <ActionCard
              icon={GraduationCap}
              title={t('home.learn') || 'Learn'}
              description={t('home.learnDescription') || 'Progress through curated lesson plans in Bangla & English, designed by top coaches.'}
              actionLabel={t('home.quickActions') || 'Quick actions'}
              actionText={t('home.startLearning') || 'Start Learning'}
              actionTo="/learn"
            />
          </div>
        </section>

        {/* Upcoming Events Section */}
        {(!eventsLoading && upcoming.length > 0) || eventsLoading ? (
          <section className="home-events-section">
            <div className="home-events-header">
              <div>
                <p className="home-section-label">{t('home.calendarHighlights') || 'Calendar highlights'}</p>
                <h2 className="home-section-title">{t('home.upcomingEvents') || 'Upcoming Events'}</h2>
                <p className="home-section-description">{t('home.upcomingEventsDesc') || 'Register for elite championships, community leagues, and weekly online arenas curated for ChessBD players.'}</p>
              </div>
              <Link
                to="/events?status=upcoming"
                className="home-view-all-btn"
              >
                {t('home.viewAll') || 'View All'}
                <Trophy className="home-view-all-btn-icon" />
              </Link>
            </div>
            {eventsLoading ? (
              <div className="home-events-grid">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="home-event-card-skeleton">
                    <div className="home-event-skeleton-image"></div>
                    <div className="home-event-skeleton-content">
                      <div className="home-event-skeleton-title"></div>
                      <div className="home-event-skeleton-meta"></div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="home-events-grid">
                {upcoming.slice(0, 3).map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* In Progress Events Section */}
        {(!eventsLoading && inProgress.length > 0) || eventsLoading ? (
          <section className="home-events-section">
            <div className="home-events-header">
              <div>
                <p className="home-section-label">{t('home.liveNow') || 'Live now'}</p>
                <h2 className="home-section-title">{t('home.inProgress') || 'In Progress'}</h2>
                <p className="home-section-description">{t('home.inProgressDesc') || 'Watch live tournaments and follow the action as it happens in real-time.'}</p>
              </div>
              <Link
                to="/events?status=in_progress"
                className="home-view-all-btn"
              >
                {t('home.viewAll') || 'View All'}
                <Zap className="home-view-all-btn-icon" />
              </Link>
            </div>
            {eventsLoading ? (
              <div className="home-events-grid">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="home-event-card-skeleton">
                    <div className="home-event-skeleton-image"></div>
                    <div className="home-event-skeleton-content">
                      <div className="home-event-skeleton-title"></div>
                      <div className="home-event-skeleton-meta"></div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="home-events-grid">
                {inProgress.slice(0, 3).map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* Finished Events Section */}
        {(!eventsLoading && finished.length > 0) || eventsLoading ? (
          <section className="home-events-section">
            <div className="home-events-header">
              <div>
                <p className="home-section-label">{t('home.recentResults') || 'Recent results'}</p>
                <h2 className="home-section-title">{t('home.recentEvents') || 'Recent Events'}</h2>
                <p className="home-section-description">{t('home.recentEventsDesc') || 'Review past tournaments, check final standings, and relive the best moments.'}</p>
              </div>
              <Link
                to="/events?status=finished"
                className="home-view-all-btn"
              >
                {t('home.viewAll') || 'View All'}
                <Award className="home-view-all-btn-icon" />
              </Link>
            </div>
            {eventsLoading ? (
              <div className="home-events-grid">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="home-event-card-skeleton">
                    <div className="home-event-skeleton-image"></div>
                    <div className="home-event-skeleton-content">
                      <div className="home-event-skeleton-title"></div>
                      <div className="home-event-skeleton-meta"></div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="home-events-grid">
                {finished.slice(0, 3).map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* Latest News Section */}
        <section className="home-events-section">
          <div className="home-events-header">
            <div>
              <p className="home-section-label">{t('home.staySharp') || 'Stay sharp'}</p>
              <h2 className="home-section-title">{t('home.latestNews') || 'Latest News'}</h2>
              <p className="home-section-description">{t('home.latestNewsDesc') || 'Stay updated with national chess news, tactical lessons, and live coverage of tournaments.'}</p>
            </div>
            <Link
              to="/news"
              className="home-view-all-btn"
            >
              {t('home.exploreContent') || 'Explore content'}
              <Newspaper className="home-view-all-btn-icon" />
            </Link>
          </div>
          {newsLoading ? (
            <div className="home-events-grid">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="home-event-card-skeleton">
                  <div className="home-event-skeleton-image"></div>
                  <div className="home-event-skeleton-content">
                    <div className="home-event-skeleton-title"></div>
                    <div className="home-event-skeleton-meta"></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="home-events-grid">
              {latestNews.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </section>

        {/* Community Spotlight Section */}
        <section className="home-spotlight-section">
          <div className="home-spotlight-container">
            <div className="home-spotlight-bg"></div>
            <div className="home-spotlight-content">
              <div className="home-spotlight-header">
                <p className="home-section-label">{t('home.communitySpotlight') || 'Community spotlight'}</p>
                <h2 className="home-section-title">
                  {t('home.playersAndClubs') || 'Players and clubs making headlines'}
                </h2>
                <p className="home-section-description">
                  {t('home.communitySpotlightDesc') || 'Celebrating the talent and teamwork driving Bangladesh\'s chess growth.'}
                </p>
              </div>

              <div className="home-spotlight-grid">
                {/* Player of the Week */}
                <SpotlightCard
                  type="player"
                  icon={Award}
                  label={t('home.playerOfWeek') || 'Player of the Week'}
                  title={(() => {
                    if (showcaseLoading) return ''
                    if (showcaseData?.playerOfWeek) {
                      const playerInfo = getPlayerInfo(showcaseData.playerOfWeek.user_id)
                      return playerInfo?.displayName || showcaseData.playerOfWeek.user_id || t('home.unknownPlayer') || 'Unknown Player'
                    }
                    return t('home.featuredPlayer') || 'Featured Player'
                  })()}
                  subtitle={(() => {
                    if (showcaseLoading) return ''
                    if (showcaseData?.playerOfWeek) {
                      const playerInfo = getPlayerInfo(showcaseData.playerOfWeek.user_id)
                      const username = playerInfo?.username
                      return username ? `@${username}` : ''
                    }
                    return t('home.checkBackSoon') || 'Check back soon'
                  })()}
                  loading={showcaseLoading}
                  playerData={showcaseData?.playerOfWeek || null}
                  playerInfo={showcaseData?.playerOfWeek ? getPlayerInfo(showcaseData.playerOfWeek.user_id) : null}
                  actions={showcaseData?.playerOfWeek ? (() => {
                    const playerInfo = getPlayerInfo(showcaseData.playerOfWeek.user_id)
                    const actions = [
                      { to: '/showcase', label: t('home.viewShowcase') || 'View Showcase', variant: 'secondary' }
                    ]
                    if (playerInfo?.username) {
                      actions.push({ to: `/player/${playerInfo.username}`, label: t('home.playerProfile') || 'Player Profile', variant: 'primary' })
                    } else if (showcaseData.playerOfWeek.user_id) {
                      actions.push({ to: `/player/${showcaseData.playerOfWeek.user_id}`, label: t('home.playerProfile') || 'Player Profile', variant: 'primary' })
                    }
                    return actions
                  })() : []}
                />

                {/* Club of the Month */}
                <SpotlightCard
                  type="club"
                  icon={Club}
                  label={t('home.clubOfMonth') || 'Club of the Month'}
                  title={(() => {
                    if (clubsLoading) return ''
                    if (featuredClub) {
                      return featuredClub.name || t('home.chessClub') || 'Chess Club'
                    }
                    return t('home.chessClub') || 'Chess Club'
                  })()}
                  subtitle={(() => {
                    if (clubsLoading) return ''
                    if (featuredClub && featuredClub.location) {
                      return featuredClub.location
                    }
                    return t('common.bangladesh') || 'Bangladesh'
                  })()}
                  loading={clubsLoading}
                  clubData={featuredClub}
                  actions={(() => {
                    const actions = [
                      { to: '/clubs', label: t('home.discoverClubs') || 'Discover Clubs', variant: 'secondary' }
                    ]
                    if (featuredClub) {
                      const clubSlug = featuredClub.slug || featuredClub.id
                      actions.push({ to: `/clubs/${clubSlug}`, label: t('home.viewClub') || 'View Club', variant: 'primary' })
                    }
                    return actions
                  })()}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section - Only show if there are testimonials */}
        {(!testimonialsLoading && testimonials && testimonials.length > 0) && (
          <section className="home-testimonials-section">
            <div className="home-testimonials-container">
              <div className="home-testimonials-header">
                <Quote className="home-testimonials-icon" />
                <p className="home-section-label">{t('home.testimonials') || 'Testimonials'}</p>
                <h2 className="home-section-title">{t('home.voicesFromBoard') || 'Voices from the Board'}</h2>
                <p className="home-section-description">
                  {t('home.voicesFromBoardDesc') || 'Trusted by titled players, coaches, and streamers across Bangladesh. ChessBD brings the community together under one powerful platform.'}
                </p>
              </div>

              <div className="home-testimonials-grid">
                {testimonials.map((testimonial, idx) => {
                  const gradients = [
                    { gradient: 'bg-[var(--color-bg-secondary)]', border: 'border-[var(--color-border)]/30', iconColor: 'text-[var(--color-text-primary)]/70' },
                    { gradient: 'bg-[var(--color-bg-secondary)]', border: 'border-[var(--color-border)]/30', iconColor: 'text-[var(--color-text-primary)]/70' },
                    { gradient: 'bg-[var(--color-bg-secondary)]', border: 'border-[var(--color-border)]/30', iconColor: 'text-[var(--color-text-primary)]/70' },
                  ]
                  const style = gradients[idx] || gradients[0]
                  const userFromMap = usersMap && testimonial.user_id ? usersMap[testimonial.user_id] : null
                  const userInfo = testimonial.user_id ? getPlayerInfo(testimonial.user_id) : null
                  const combinedUserInfo = userInfo || userFromMap ? {
                    ...userInfo,
                    ...userFromMap,
                    displayName: userInfo?.displayName || userFromMap?.name || userFromMap?.chesscom_username || userFromMap?.email || 'Chess Player',
                    avatarUrl: userInfo?.avatarUrl || userFromMap?.avatar_url || null,
                    is_streamer: userFromMap?.is_streamer || false,
                    is_admin: userFromMap?.is_admin || false,
                  } : null

                  return (
                    <TestimonialCard
                      key={testimonial.id || idx}
                      testimonial={testimonial}
                      userInfo={combinedUserInfo}
                      style={style}
                    />
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* Partners Section */}
        {partners && partners.filter(p => p.featured).length > 0 && (
          <section className="home-partners-section">
            <div className="home-partners-container">
              <div className="home-partners-header">
                <p className="home-section-label">{t('home.trustedByPartners') || 'Trusted by partners & federations'}</p>
                <h2 className="home-section-title">{t('home.partnersTitle') || 'Our Partners'}</h2>
                <p className="home-section-description">
                  {t('home.partnersDesc') || 'Working together with leading organizations to grow chess in Bangladesh.'}
                </p>
              </div>
              <div className="home-partners-grid">
                {partners
                  .filter(p => p.featured)
                  .sort((a, b) => {
                    const orderA = a.order ?? 999
                    const orderB = b.order ?? 999
                    return orderA - orderB
                  })
                  .map((partner) => {
                    const content = <PartnerLogo partner={partner} />
                    
                    return partner.url ? (
                      <a
                        key={partner.id}
                        href={partner.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="home-partner-link"
                      >
                        {content}
                      </a>
                    ) : (
                      <span key={partner.id} className="home-partner-link">
                        {content}
                      </span>
                    )
                  })}
              </div>
            </div>
          </section>
        )}

        {/* Newsletter Banner - Only show if user is not logged in */}
        {!user && (
          <section className="home-newsletter-section">
            <div className="home-newsletter-container">
              <p className="home-section-label">{t('home.stayInLoop') || 'Stay in the loop'}</p>
              <h2 className="home-section-title">
                {t('home.newsletterTitle') || 'Ready to become Bangladesh\'s next chess star?'}
              </h2>
              <p className="home-section-description">
                {t('home.newsletterDesc') || 'Receive curated training plans, event reminders, and community highlights straight to your inbox. No spam — only winning moves.'}
              </p>
              <Link
                to="/signup"
                className="home-newsletter-btn"
              >
                <Mail className="home-newsletter-btn-icon" />
                {t('home.joinChessBD') || 'Join ChessBD'}
              </Link>
              <p className="home-newsletter-disclaimer">
                {t('home.newsletterDisclaimer') || 'By joining you agree to our updates. You can manage preferences anytime.'}
              </p>
            </div>
          </section>
        )}
      </div>
    </Container>
  )
}

