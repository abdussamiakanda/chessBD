import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { PageLoader } from '../components/ui/PageLoader'
import { StatCard } from '../components/ui/StatCard'
import { ClubCard } from '../components/ui/ClubCard'
import { DistrictMap } from '../components/maps/DistrictMap'
import { MapPin, Users, Trophy, Award, BarChart3, ArrowLeft, Club as ClubIcon, Crown, Medal } from 'lucide-react'
import { PlayerName } from '../components/PlayerName'
import { useSEO } from '../hooks/use-seo'
import { api } from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'
import { db } from '../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import './DistrictDetail.css'

export function DistrictDetail() {
  const { t } = useLanguage()
  const { district_name } = useParams()
  const navigate = useNavigate()
  
  // Normalize district name (capitalize first letter of each word)
  const normalizedDistrictName = useMemo(() => {
    if (!district_name) return ''
    return district_name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }, [district_name])
  
  // Fetch users and calculate district stats
  const { data: districtData, isLoading: statsLoading } = useQuery({
    queryKey: ['district-stats', normalizedDistrictName],
    queryFn: async () => {
      if (!db || !normalizedDistrictName) return null
      
      // Get all users
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      // Get verified users with Chess.com usernames from this district
      const districtUsers = users.filter((user) => 
        user.chesscom_username && 
        user.verified_at && 
        user.location &&
        user.location.trim().toLowerCase() === normalizedDistrictName.toLowerCase()
      )
      
      // Fetch clubs
      const allClubs = await api.getClubs()
      
      // Get clubs in this district (approved only)
      const approvedClubs = allClubs?.filter(club => 
        club.location && 
        club.location.trim().toLowerCase() === normalizedDistrictName.toLowerCase() &&
        club.status === 'approved'
      ) || []
      
      if (districtUsers.length === 0) {
        return {
          location: normalizedDistrictName,
          playerCount: 0,
          clubCount: approvedClubs.length,
          topPlayers: [],
          averageRating: 0,
          totalGames: 0,
          clubs: approvedClubs,
        }
      }
      
      // Fetch stats for all district users
      const statsPromises = districtUsers.map(async (user) => {
        try {
          const chesscomStats = await api.getChesscomStats(user.chesscom_username || '')
          return { user, chesscomStats }
        } catch {
          return { user, chesscomStats: null }
        }
      })
      
      const statsResults = await Promise.all(statsPromises)
      
      // Calculate ratings and stats for each player
      const playerStats = statsResults.map(({ user, chesscomStats }) => {
        let rating = 0
        let totalGames = 0
        let wins = 0
        let draws = 0
        
        if (chesscomStats) {
          // Use rapid rating as primary, fallback to blitz, then daily
          rating = chesscomStats.rapid?.rating || 
                   chesscomStats.blitz?.rating || 
                   chesscomStats.daily?.rating || 0
          
          // Sum games across all time controls
          totalGames = (chesscomStats.rapid?.games || 0) +
                      (chesscomStats.blitz?.games || 0) +
                      (chesscomStats.bullet?.games || 0) +
                      (chesscomStats.daily?.games || 0)
          
          wins = (chesscomStats.rapid?.wins || 0) +
                 (chesscomStats.blitz?.wins || 0) +
                 (chesscomStats.bullet?.wins || 0) +
                 (chesscomStats.daily?.wins || 0)
          
          draws = (chesscomStats.rapid?.draws || 0) +
                  (chesscomStats.blitz?.draws || 0) +
                  (chesscomStats.bullet?.draws || 0) +
                  (chesscomStats.daily?.draws || 0)
        }
        
        return {
          user,
          rating,
          totalGames,
          wins,
          draws,
        }
      })
      
      // Calculate district stats
      const validRatings = playerStats.filter(p => p.rating > 0).map(p => p.rating)
      const averageRating = validRatings.length > 0
        ? validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length
        : 0
      
      const totalGames = playerStats.reduce((sum, p) => sum + p.totalGames, 0)
      
      // Get top 10 players by rating
      const topPlayers = playerStats
        .filter(p => p.rating > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 10)
        .map((p, index) => ({
          ...p,
          rank: index + 1,
        }))
      
      return {
        location: normalizedDistrictName,
        playerCount: districtUsers.length,
        clubCount: approvedClubs.length,
        topPlayers,
        averageRating,
        totalGames,
        clubs: approvedClubs,
      }
    },
    enabled: !!normalizedDistrictName,
    staleTime: 300000,
  })
  
  useSEO({
    title: districtData?.location 
      ? `${t(`locations.${districtData.location}`) || districtData.location} - ${t('nav.locations') || 'Locations'}`
      : t('nav.locations') || 'Locations',
    description: districtData 
      ? `View chess statistics, top players, and clubs in ${districtData.location}, Bangladesh.`
      : 'View district chess statistics and information.',
    keywords: districtData?.location 
      ? `chess ${districtData.location}, ${districtData.location} chess players, chess clubs ${districtData.location}`
      : 'chess locations, district chess',
    url: districtData?.location ? `/locations/${districtData.location.toLowerCase()}` : '/locations',
  })
  
  const isLoading = statsLoading
  
  if (isLoading) {
    return <PageLoader />
  }
  
  if (!normalizedDistrictName) {
    return (
      <Container>
        <div className="district-detail-page">
          <Card className="district-detail-empty-card">
            <div className="district-detail-empty-content">
              <h3 className="district-detail-empty-title">
                {t('locations.districtNotFound') || 'District not found'}
              </h3>
              <p className="district-detail-empty-description">
                {t('locations.districtNotFoundDesc') || 'The district you are looking for does not exist.'}
              </p>
              <Link to="/locations" className="district-detail-back-link">
                <ArrowLeft className="district-detail-back-icon" />
                {t('locations.backToLocations') || 'Back to Locations'}
              </Link>
            </div>
          </Card>
        </div>
      </Container>
    )
  }
  
  return (
    <Container>
      <div className="district-detail-page">
        {/* Back Button */}
        <Link to="/locations" className="district-detail-back-button">
          <ArrowLeft className="district-detail-back-button-icon" />
          <span>{t('locations.backToLocations') || 'Back to Locations'}</span>
        </Link>
        
        {/* Hero Section */}
        <section className="district-detail-hero">
          <div className="district-detail-hero-content">
            <p className="district-detail-hero-label">
              {t('locations.district') || 'District'}
            </p>
            <div className="district-detail-hero-title-row">
              <MapPin className="district-detail-hero-icon" />
              <h1 className="district-detail-hero-title">
                {t(`locations.${districtData?.location || normalizedDistrictName}`) || districtData?.location || normalizedDistrictName}
              </h1>
            </div>
            <p className="district-detail-hero-description">
              {t(`locations.funFact.${districtData?.location || normalizedDistrictName}`) || 
               (districtData?.playerCount > 0 
                 ? `${districtData.playerCount} ${districtData.playerCount === 1 ? t('locations.player') || 'Player' : t('locations.players') || 'Players'}`
                 : t('locations.noDataAvailable') || 'No data available yet')}
            </p>
          </div>
        </section>
        
        {/* District Map */}
        {districtData && (
          <section className="district-detail-map-section">
            <Card className="district-detail-map-card">
              <DistrictMap 
                districtName={districtData.location}
                playerCount={districtData.playerCount}
                averageRating={districtData.averageRating}
              />
            </Card>
          </section>
        )}
        
        {/* Statistics */}
        {districtData ? (
          <div className="district-detail-stats-grid">
            <StatCard
              icon={BarChart3}
              label={t('locations.avgRating') || 'Avg Rating'}
              value={districtData.averageRating > 0 ? Math.round(districtData.averageRating) : '—'}
            />
            <StatCard
              icon={Trophy}
              label={t('locations.totalGames') || 'Total Games'}
              value={districtData.totalGames.toLocaleString()}
            />
            <StatCard
              icon={Users}
              label={t('locations.players') || 'Players'}
              value={districtData.playerCount}
            />
            <StatCard
              icon={ClubIcon}
              label={t('locations.clubs') || 'Clubs'}
              value={districtData.clubCount}
            />
          </div>
        ) : null}
        
        {/* Top Players */}
        {districtData && districtData.topPlayers.length > 0 ? (
          <section className="district-detail-section">
            <div className="district-detail-content-header">
              <Award className="district-detail-content-icon" />
              <p className="district-detail-content-title">{t('locations.topPlayers') || 'Top Players'}</p>
            </div>
            <div className="district-detail-players-grid">
              {districtData.topPlayers.map((player, index) => {
                const rank = index + 1
                const username = player.user.chesscom_username || player.user.lichess_username
                const profileUrl = username ? `/player/${username}` : '#'
                
                // Rank badge styling
                const getRankIcon = () => {
                  if (rank === 1) return <Crown className="district-detail-rank-icon-crown" />
                  if (rank === 2) return <Medal className="district-detail-rank-icon-medal" />
                  if (rank === 3) return <Medal className="district-detail-rank-icon-medal-bronze" />
                  return null
                }
                
                const getRankClass = () => {
                  if (rank === 1) return 'district-detail-player-card-rank-1'
                  if (rank === 2) return 'district-detail-player-card-rank-2'
                  if (rank === 3) return 'district-detail-player-card-rank-3'
                  return ''
                }

                return (
                  <Card key={player.user.id} className={`district-detail-player-card ${getRankClass()}`}>
                    <Link to={profileUrl} className="district-detail-player-link">
                      <div className="district-detail-player-content">
                        {/* Rank Badge */}
                        <div className={`district-detail-rank-badge ${getRankClass()}`}>
                          {getRankIcon() || <span className="district-detail-rank-number">{rank}</span>}
                        </div>

                        {/* Player Info */}
                        <div className="district-detail-player-info">
                          <p className="district-detail-player-name">
                            <PlayerName
                              username={player.user.chesscom_username}
                              name={player.user.name}
                              email={player.user.email}
                              showTitle={true}
                            />
                          </p>
                          {username && (
                            <p className="district-detail-player-username">@{username}</p>
                          )}
                        </div>

                        {/* Rating */}
                        <div className="district-detail-player-rating">
                          <p className="district-detail-player-rating-value">{player.rating}</p>
                          <p className="district-detail-player-rating-label">{t('locations.rating') || 'Rating'}</p>
                        </div>
                      </div>
                    </Link>
                  </Card>
                )
              })}
            </div>
          </section>
        ) : districtData && districtData.playerCount === 0 ? (
          <section className="district-detail-section">
            <Card className="district-detail-empty-card">
              <div className="district-detail-empty-content">
                <Users className="district-detail-empty-icon" />
                <h3 className="district-detail-empty-title">
                  {t('locations.noPlayers') || 'No players yet'}
                </h3>
                <p className="district-detail-empty-description">
                  {t('locations.noPlayersDesc') || 'No players have registered from this district yet.'}
                </p>
              </div>
            </Card>
          </section>
        ) : null}
        
        {/* Clubs */}
        {districtData && districtData.clubs.length > 0 ? (
          <section className="district-detail-section">
            <div className="district-detail-content-header">
              <ClubIcon className="district-detail-content-icon" />
              <p className="district-detail-content-title">{t('locations.clubs') || 'Clubs'}</p>
            </div>
            <div className="district-detail-clubs-list">
              {districtData.clubs.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Container>
  )
}

