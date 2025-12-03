import { useState } from 'react'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { Trophy, Search } from 'lucide-react'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { api } from '../lib/api'
import { useQuery } from '@tanstack/react-query'
import { db } from '../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { LeaderboardCard } from '../components/ui/LeaderboardCard'
import { PageLoader } from '../components/ui/PageLoader'
import './Leaderboard.css'

export function Leaderboard() {
  const { t } = useLanguage()
  const [gameType, setGameType] = useState('rapid')
  const [searchTerm, setSearchTerm] = useState('')

  useSEO({
    title: t('nav.leaderboard') || t('leaderboard.title'),
    description: t('leaderboard.description') || 'View the ChessBD leaderboard with top-rated players. See rankings, ratings, win rates, and statistics for verified chess players in Bangladesh.',
    keywords: 'chess leaderboard, chess rankings, chess ratings, top chess players, player rankings, chess statistics',
    url: '/leaderboard',
  })

  const { data: players, isLoading } = useQuery({
    queryKey: ['ratings', gameType],
    queryFn: async () => {
      if (!db) {
        return []
      }

      // Get all users
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Get verified users with Chess.com usernames only
      const verifiedUsers = allUsers.filter((user) => 
        user.chesscom_username && user.verified_at
      )

      // Fetch Chess.com stats for all users in parallel
      const statsPromises = verifiedUsers.map(async (user) => {
        const chesscomStats = user.chesscom_username 
          ? await api.getChesscomStats(user.chesscom_username).catch(() => null)
          : null
        return { chesscomStats }
      })
      const statsResults = await Promise.all(statsPromises)

      // Calculate ratings for each player
      const playerRatings = verifiedUsers.map((user, index) => {
        const { chesscomStats: chesscomStatsData } = statsResults[index]
        
        let primaryRating = 0
        let totalGames = 0
        let wins = 0
        let draws = 0
        let losses = 0
        
        const chesscomStats = chesscomStatsData
          ? {
              rapid: chesscomStatsData.rapid,
              blitz: chesscomStatsData.blitz,
              bullet: chesscomStatsData.bullet,
              daily: chesscomStatsData.daily,
            }
          : null

        // Get stats for the selected game type
        if (gameType === 'all') {
          // Sum up games and stats from all time controls
          if (chesscomStats) {
            if (chesscomStats.rapid) {
              totalGames += chesscomStats.rapid.games || 0
              wins += chesscomStats.rapid.wins || 0
              losses += chesscomStats.rapid.losses || 0
              draws += chesscomStats.rapid.draws || 0
            }
            if (chesscomStats.blitz) {
              totalGames += chesscomStats.blitz.games || 0
              wins += chesscomStats.blitz.wins || 0
              losses += chesscomStats.blitz.losses || 0
              draws += chesscomStats.blitz.draws || 0
            }
            if (chesscomStats.bullet) {
              totalGames += chesscomStats.bullet.games || 0
              wins += chesscomStats.bullet.wins || 0
              losses += chesscomStats.bullet.losses || 0
              draws += chesscomStats.bullet.draws || 0
            }
            if (chesscomStats.daily) {
              totalGames += chesscomStats.daily.games || 0
              wins += chesscomStats.daily.wins || 0
              losses += chesscomStats.daily.losses || 0
              draws += chesscomStats.daily.draws || 0
            }
          }

          // Get primary rating (prefer rapid > blitz > bullet > daily)
          if (chesscomStats) {
            primaryRating =
              chesscomStats.rapid?.rating ||
              chesscomStats.blitz?.rating ||
              chesscomStats.bullet?.rating ||
              chesscomStats.daily?.rating ||
              0
          }
        } else {
          // Filter by specific game type
          if (chesscomStats && chesscomStats[gameType]) {
            const stats = chesscomStats[gameType]
            totalGames = stats.games || 0
            wins = stats.wins || 0
            losses = stats.losses || 0
            draws = stats.draws || 0
            primaryRating = stats.rating || 0
          }
        }

        if (!primaryRating) {
          primaryRating = 0
        }

        const winRate = totalGames > 0 ? (wins + draws * 0.5) / totalGames : 0

        return {
          user,
          totalGames,
          wins,
          draws,
          losses,
          winRate,
          rating: primaryRating,
          chesscomStats: chesscomStatsData,
        }
      })

      // Filter players by game type
      const filteredByGameType = playerRatings.filter((player) => {
        if (gameType === 'all') return true
        
        if (player.chesscomStats && player.chesscomStats[gameType]) {
          return true
        }
        return false
      })

      // Sort players by rating (highest first)
      filteredByGameType.sort((a, b) => {
        if (a.rating === 0 && b.rating === 0) return 0
        if (a.rating === 0) return 1
        if (b.rating === 0) return -1
        return b.rating - a.rating
      })

      return filteredByGameType
    },
    staleTime: 60000,
  })

  const filteredPlayers = players?.filter(
    (p) =>
      !searchTerm ||
      p.user.chesscom_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.user.email && p.user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.user.name && p.user.name.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || []

  if (isLoading) {
    return <PageLoader />
  }

  return (
    <Container>
      <div className="leaderboard-page">
        {/* Header Section */}
        <div className="leaderboard-header">
          <p className="leaderboard-header-label">
            {t('leaderboard.playerRankings') || 'Player Rankings'}
          </p>
          <h1 className="leaderboard-header-title">
            <Trophy className="leaderboard-header-icon" />
            {t('leaderboard.title') || 'Leaderboard'}
          </h1>
          <p className="leaderboard-header-description">
            {t('leaderboard.descriptionAlt') || t('leaderboard.description')}
          </p>
        </div>

        {/* Search and Filter Section */}
        <Card className="leaderboard-filters-card">
          <div className="leaderboard-filters">
            <div className="leaderboard-search-wrapper">
              <Search className="leaderboard-search-icon" />
              <input
                type="text"
                placeholder={t('leaderboard.searchPlayers') || 'Search players...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="leaderboard-search-input"
              />
            </div>
            <div className="leaderboard-filter-buttons">
              {(['rapid', 'blitz', 'daily', 'all']).map((type) => (
                <button
                  key={type}
                  onClick={() => setGameType(type)}
                  className={`leaderboard-filter-btn ${gameType === type ? 'leaderboard-filter-btn-active' : ''}`}
                >
                  {type === 'rapid' ? t('player.rapid') : 
                   type === 'blitz' ? t('player.blitz') : 
                   type === 'daily' ? t('player.daily') : 
                   (t('leaderboard.all') || 'All')}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Players List */}
        {filteredPlayers.length > 0 ? (
          <div className="leaderboard-list">
            {filteredPlayers.map((player, index) => {
              const rank = index + 1
              return (
                <LeaderboardCard
                  key={player.user.id}
                  player={player}
                  rank={rank}
                  gameType={gameType}
                />
              )
            })}
          </div>
        ) : (
          <Card className="leaderboard-empty-card">
            <div className="leaderboard-empty-content">
              <div className="leaderboard-empty-icon">
                <Trophy className="leaderboard-empty-icon-svg" />
              </div>
              <div>
                <h3 className="leaderboard-empty-title">
                  {t('leaderboard.noPlayers') || 'No players found.'}
                </h3>
                <p className="leaderboard-empty-description">
                  {t('leaderboard.noPlayersDescription') || 'No players found. Verify your account to appear on the leaderboard.'}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Container>
  )
}

