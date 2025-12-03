import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { StatCard } from '../components/ui/StatCard'
import { ClubCard } from '../components/ui/ClubCard'
import { BangladeshMap } from '../components/maps/BangladeshMap'
import { MapPin, Users, Trophy, Award, BarChart3, Crown, Medal, Club as ClubIcon, ArrowRight } from 'lucide-react'
import { useSEO } from '../hooks/use-seo'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth-store'
import { useLanguage } from '../contexts/LanguageContext'
import { db } from '../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { slugify } from '../lib/utils/slug'
import './Locations.css'

// All Bangladesh districts
const ALL_DISTRICTS = [
  "Bagerhat", "Bandarban", "Barguna", "Barisal", "Bhola", "Bogra", "Brahmanbaria",
  "Chandpur", "Chittagong", "Chuadanga", "Comilla", "Cox's Bazar", "Dhaka", "Dinajpur",
  "Faridpur", "Feni", "Gaibandha", "Gazipur", "Gopalganj", "Habiganj", "Jamalpur",
  "Jessore", "Jhalokati", "Jhenaidah", "Joypurhat", "Khagrachari", "Khulna", "Kishoreganj",
  "Kurigram", "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur", "Magura", "Manikganj",
  "Maulvibazar", "Meherpur", "Munshiganj", "Mymensingh", "Narail", "Narayanganj", "Narsingdi",
  "Naogaon", "Natore", "Nawabganj", "Netrokona", "Nilphamari", "Noakhali", "Pabna",
  "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi", "Rangamati", "Rangpur",
  "Satkhira", "Shariatpur", "Sherpur", "Sirajgonj", "Sunamganj", "Sylhet", "Tangail", "Thakurgaon"
]

export function Locations() {
  const { t } = useLanguage()
  const { user } = useAuthStore()

  useSEO({
    title: t('nav.locations') || 'Locations',
    description: 'Explore chess communities across Bangladesh by location. View player statistics, clubs, top players, and achievements for each district.',
    keywords: 'chess locations, Bangladesh districts, chess statistics by location, district chess players, chess clubs by location',
    url: '/locations',
  })

  // Fetch clubs
  const { data: clubs, isLoading: clubsLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => api.getClubs(),
    staleTime: 300000,
  })

  // Fetch users and calculate location stats
  const { data: locationStats, isLoading: statsLoading } = useQuery({
    queryKey: ['location-stats'],
    queryFn: async () => {
      if (!db) return []

      // Get all users
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Get verified users with Chess.com usernames
      const verifiedUsers = users.filter((user) => 
        user.chesscom_username && user.verified_at && user.location
      )

      // Fetch stats for all verified users
      const statsPromises = verifiedUsers.map(async (user) => {
        try {
          const chesscomStats = await api.getChesscomStats(user.chesscom_username || '')
          return { user, chesscomStats }
        } catch {
          return { user, chesscomStats: null }
        }
      })

      const statsResults = await Promise.all(statsPromises)

      // Group by location
      const locationMap = new Map()

      statsResults.forEach(({ user, chesscomStats }) => {
        if (user.location) {
          const location = user.location.trim()
          if (!locationMap.has(location)) {
            locationMap.set(location, [])
          }
          locationMap.get(location).push({ user, chesscomStats })
        }
      })

      // Calculate stats for each location
      const stats = Array.from(locationMap.entries()).map(([location, players]) => {
        // Calculate ratings and stats for each player
        const playerStats = players.map(({ user, chesscomStats }) => {
          let rating = 0
          let totalGames = 0
          let wins = 0
          let draws = 0

          if (chesscomStats) {
            // Use rapid rating as primary, fallback to blitz, then daily
            if (chesscomStats.rapid) {
              rating = chesscomStats.rapid.rating || 0
              totalGames = chesscomStats.rapid.games || 0
              wins = chesscomStats.rapid.wins || 0
              draws = chesscomStats.rapid.draws || 0
            } else if (chesscomStats.blitz) {
              rating = chesscomStats.blitz.rating || 0
              totalGames = chesscomStats.blitz.games || 0
              wins = chesscomStats.blitz.wins || 0
              draws = chesscomStats.blitz.draws || 0
            } else if (chesscomStats.daily) {
              rating = chesscomStats.daily.rating || 0
              totalGames = chesscomStats.daily.games || 0
              wins = chesscomStats.daily.wins || 0
              draws = chesscomStats.daily.draws || 0
            }
          }

          const winRate = totalGames > 0 ? (wins + draws * 0.5) / totalGames : 0

          return {
            user,
            rating,
            totalGames,
            winRate,
          }
        })

        // Sort by rating (highest first)
        playerStats.sort((a, b) => {
          if (a.rating === 0 && b.rating === 0) return 0
          if (a.rating === 0) return 1
          if (b.rating === 0) return -1
          return b.rating - a.rating
        })

        // Get top 5 players
        const topPlayers = playerStats.filter(p => p.rating > 0).slice(0, 5)

        // Calculate averages
        const ratedPlayers = playerStats.filter(p => p.rating > 0)
        const averageRating = ratedPlayers.length > 0
          ? Math.round(ratedPlayers.reduce((sum, p) => sum + p.rating, 0) / ratedPlayers.length)
          : 0

        const totalGames = playerStats.reduce((sum, p) => sum + p.totalGames, 0)

        return {
          location,
          playerCount: players.length,
          clubCount: 0, // Will be calculated separately
          topPlayers,
          averageRating,
          totalGames,
        }
      })

      return stats
    },
    staleTime: 300000,
  })

  // Combine all districts with stats and club counts
  const allLocations = useMemo(() => {
    const statsMap = new Map()
    if (locationStats) {
      locationStats.forEach((stat) => {
        statsMap.set(stat.location, stat)
      })
    }

    const clubsByLocation = new Map()
    if (clubs) {
      clubs.forEach((club) => {
        // Only include approved clubs
        if (club.location && club.location.trim() && club.approved) {
          const location = club.location.trim()
          if (!clubsByLocation.has(location)) {
            clubsByLocation.set(location, [])
          }
          clubsByLocation.get(location).push(club)
        }
      })
    }

    // Create entries only for districts with data
    const locationsWithData = []
    
    ALL_DISTRICTS.forEach((district) => {
      const stats = statsMap.get(district)
      const districtClubs = clubsByLocation.get(district) || []
      
      // Filter to only approved clubs
      const approvedClubs = districtClubs.filter(club => club.approved)
      
      // Only include districts that have players or approved clubs
      if (stats) {
        locationsWithData.push({
          ...stats,
          clubCount: approvedClubs.length,
          clubs: approvedClubs,
        })
      } else if (approvedClubs.length > 0) {
        // District has approved clubs but no players
        locationsWithData.push({
          location: district,
          playerCount: 0,
          clubCount: approvedClubs.length,
          topPlayers: [],
          averageRating: 0,
          totalGames: 0,
          clubs: approvedClubs,
        })
      }
    })

    return locationsWithData.sort((a, b) => {
      // Sort by average rating (highest first), then by location name
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating
      }
      return a.location.localeCompare(b.location)
    })
  }, [locationStats, clubs])

  const isLoading = clubsLoading || statsLoading

  return (
    <Container>
      <div className="locations-page">
        {/* Hero Section */}
        <section className="locations-hero">
          <div className="locations-hero-content">
            <p className="locations-hero-label">{t('locations.subtitle') || 'Explore Chess Communities'}</p>
            <h1 className="locations-hero-title">{t('locations.title') || 'Locations'}</h1>
            <p className="locations-hero-description">
              {t('locations.description') || 'Discover chess communities across Bangladesh organized by district. View player statistics, top players, clubs, and achievements for each location.'}
            </p>
          </div>
        </section>

        {/* Player Heatmap - Bangladesh Map */}
        {!isLoading && locationStats && locationStats.length > 0 && (
          <section className="locations-map-section">
            <div className="locations-map-header">
              <h2 className="locations-map-title">{t('locations.playerHeatmap') || 'Players Across Bangladesh'}</h2>
              <p className="locations-map-description">
                {t('locations.heatmapDescription') || 'Click on districts to see player statistics'}
              </p>
            </div>
            
            <Card className="locations-map-card">
              <BangladeshMap 
                districts={locationStats.map(stat => ({
                  location: stat.location,
                  playerCount: stat.playerCount,
                  averageRating: stat.averageRating,
                }))}
                onDistrictClick={(district) => {
                  // Function to scroll to element
                  const scrollToDistrict = () => {
                    // Try exact match first
                    let element = document.getElementById(`district-${district}`)
                    
                    // If not found, try case-insensitive search
                    if (!element) {
                      const allSections = document.querySelectorAll('section[id^="district-"]')
                      
                      for (const section of allSections) {
                        const sectionId = section.getAttribute('id') || ''
                        const sectionDistrict = sectionId.replace('district-', '')
                        
                        if (sectionDistrict.toLowerCase() === district.toLowerCase()) {
                          element = section
                          break
                        }
                      }
                    }
                    
                    if (element) {
                      // Calculate offset for mobile navbar
                      const isMobile = window.innerWidth < 768
                      const navbarHeight = isMobile ? 56 : 0 // 3.5rem = 56px
                      
                      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
                      const offsetPosition = elementPosition - navbarHeight - 8 // Extra 8px for spacing
                      
                      window.scrollTo({
                        top: Math.max(0, offsetPosition), // Ensure we don't scroll to negative position
                        behavior: 'smooth'
                      })
                    }
                  }
                  
                  // Try immediately first
                  scrollToDistrict()
                  
                  // Also try after a short delay in case DOM isn't ready
                  setTimeout(scrollToDistrict, 200)
                }}
              />
            </Card>
          </section>
        )}

        {/* Locations Sections */}
        {isLoading ? (
          <div className="locations-list">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="locations-section-skeleton">
                <Skeleton className="locations-skeleton-header" />
                <div className="locations-skeleton-content">
                  <Skeleton className="locations-skeleton-stats" />
                  <Skeleton className="locations-skeleton-players" />
                </div>
              </Card>
            ))}
          </div>
        ) : allLocations.length > 0 ? (
          <div className="locations-list">
            {allLocations.map((locationData) => (
              <section key={locationData.location} id={`district-${locationData.location}`} className="locations-section">
                <div className="locations-section-header">
                  <div className="locations-section-header-text">
                    <p className="locations-section-label">{t('locations.district') || 'District'}</p>
                    <div className="locations-section-title-row">
                      <MapPin className="locations-section-title-icon" />
                      <h2 className="locations-section-title">
                        {t(`locations.${locationData.location}`) || locationData.location}
                      </h2>
                    </div>
                    <p className="locations-section-description">
                      {t(`locations.funFact.${locationData.location}`) || 
                       (locationData.playerCount > 0 
                         ? `${locationData.playerCount} ${locationData.playerCount === 1 ? t('locations.player') || 'Player' : t('locations.players') || 'Players'}`
                         : t('locations.noDataAvailable') || 'No data available yet')}
                    </p>
                  </div>
                  <div className="locations-section-actions">
                    <Link
                      to={`/locations/${slugify(locationData.location)}`}
                      className="locations-section-detail-btn"
                      aria-label={`View district details for ${locationData.location}`}
                    >
                      <span>{t('locations.viewDistrict') || 'View district details'}</span>
                      <ArrowRight className="locations-section-detail-icon" />
                    </Link>
                  </div>
                </div>

                {/* Statistics */}
                <div className="locations-stats-grid">
                  <StatCard
                    icon={BarChart3}
                    label={t('locations.avgRating') || 'Avg Rating'}
                    value={locationData.averageRating > 0 ? locationData.averageRating : '—'}
                  />
                  <StatCard
                    icon={Trophy}
                    label={t('locations.totalGames') || 'Total Games'}
                    value={locationData.totalGames.toLocaleString()}
                  />
                  <StatCard
                    icon={Users}
                    label={t('locations.players') || 'Players'}
                    value={locationData.playerCount}
                  />
                  <StatCard
                    icon={ClubIcon}
                    label={t('locations.clubs') || 'Clubs'}
                    value={locationData.clubCount}
                  />
                </div>

                {/* Top Players and Clubs */}
                <div className="locations-content">
                  {/* Top Players */}
                  {locationData.topPlayers.length > 0 && (
                    <div className="locations-top-players">
                      <div className="locations-content-header">
                        <Award className="locations-content-icon" />
                        <p className="locations-content-title">{t('locations.topPlayers') || 'Top Players'}</p>
                      </div>
                      <div className="locations-players-grid">
                        {locationData.topPlayers.map((player, index) => {
                          const rank = index + 1
                          const username = player.user.chesscom_username || player.user.lichess_username
                          const profileUrl = username ? `/player/${username}` : '#'
                          const displayName = player.user.name || username || 'Unknown'
                          
                          // Rank badge styling
                          const getRankIcon = () => {
                            if (rank === 1) return <Crown className="locations-rank-icon-crown" />
                            if (rank === 2) return <Medal className="locations-rank-icon-medal" />
                            if (rank === 3) return <Medal className="locations-rank-icon-medal-bronze" />
                            return null
                          }
                          
                          const getRankClass = () => {
                            if (rank === 1) return 'locations-player-card-rank-1'
                            if (rank === 2) return 'locations-player-card-rank-2'
                            if (rank === 3) return 'locations-player-card-rank-3'
                            return ''
                          }

                          return (
                            <Card key={player.user.id} className={`locations-player-card ${getRankClass()}`}>
                              <Link to={profileUrl} className="locations-player-link">
                                <div className="locations-player-content">
                                  {/* Rank Badge */}
                                  <div className={`locations-rank-badge ${getRankClass()}`}>
                                    {getRankIcon() || <span className="locations-rank-number">{rank}</span>}
                                  </div>

                                  {/* Player Info */}
                                  <div className="locations-player-info">
                                    <p className="locations-player-name">{displayName}</p>
                                    {username && (
                                      <p className="locations-player-username">@{username}</p>
                                    )}
                                  </div>

                                  {/* Rating */}
                                  <div className="locations-player-rating">
                                    <p className="locations-player-rating-value">{player.rating}</p>
                                    <p className="locations-player-rating-label">{t('locations.rating') || 'Rating'}</p>
                                  </div>
                                </div>
                              </Link>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Clubs */}
                  {locationData.clubs.length > 0 && (
                    <div className="locations-clubs">
                      <div className="locations-content-header">
                        <ClubIcon className="locations-content-icon" />
                        <p className="locations-content-title">{t('locations.clubs') || 'Clubs'}</p>
                      </div>
                      <div className="locations-clubs-list">
                        {locationData.clubs.slice(0, 3).map((club) => (
                          <ClubCard 
                            key={club.id} 
                            club={club}
                          />
                        ))}
                        {locationData.clubs.length > 3 && (
                          <Link to="/clubs" className="locations-view-all-clubs">
                            {t('locations.viewAllClubs') || `View all ${locationData.clubs.length} clubs →`}
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <Card className="locations-empty-state">
            <div className="locations-empty-content">
              <div className="locations-empty-icon-wrapper">
                <MapPin className="locations-empty-icon" />
              </div>
              <div>
                <h3 className="locations-empty-title">{t('locations.noLocations') || 'No Locations Available'}</h3>
                <p className="locations-empty-text">
                  {t('locations.noLocationsDescription') || 'Location data will appear here when players have location information.'}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Container>
  )
}

