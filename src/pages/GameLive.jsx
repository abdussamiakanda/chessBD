// this page is used to fetch the game PGN from Chess.com and navigate to the analysis page
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useSEO } from '../hooks/use-seo'
import { useAuthStore } from '../store/auth-store'
import { Card } from '../components/ui/Card'
import { Container } from '../components/ui/Container'
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import './GameLive.css'

export function GameLive() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Get username from query params or use current user's chess.com username
  const username = searchParams.get('username') || user?.chesscom_username || null

  useSEO({
    title: `Game ${id} - ChessBD`,
    description: 'Analyzing chess game from Chess.com',
    url: `/game/live/${id}`,
  })

  useEffect(() => {
    const fetchGame = async () => {
      if (!id) {
        setError('Invalid game ID')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const CHESSCOM_API_BASE = 'https://api.chess.com/pub'
        
        // Step 1: Extract player names from the game page HTML (like chessiro.com does)
        // Chessiro's approach: Fetch HTML -> Extract players -> Search archives
        const CORS_PROXIES = [
          { name: 'AllOrigins', url: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}` },
          { name: 'CorsProxy.io', url: (target) => `https://corsproxy.io/?${encodeURIComponent(target)}` },
          { name: 'ProxyCORS', url: (target) => `https://proxy.cors.sh/${target}` },
        ]

        const gamePageUrl = `https://www.chess.com/game/live/${id}`
        let playersToSearch = []

        // Fetch HTML via CORS proxy to extract player names
        for (const proxy of CORS_PROXIES) {
          try {
            const proxyUrl = proxy.url(gamePageUrl)
            const response = await fetch(proxyUrl, {
              headers: { 'Accept': 'text/html' },
              signal: AbortSignal.timeout(10000),
            })

            if (response.ok) {
              const html = await response.text()
              
              if (html && html.includes('<html') && html.length > 1000) {
                // Extract player names from meta description: "player1 (rating) vs player2 (rating)"
                const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
                if (metaDescMatch) {
                  const description = metaDescMatch[1]
                  const playersMatch = description.match(/(\w+)\s+\([^)]+\)\s+vs\s+(\w+)\s+\([^)]+\)/i)
                  if (playersMatch) {
                    playersToSearch = [playersMatch[1].toLowerCase(), playersMatch[2].toLowerCase()]
                    break
                  }
                }

                // Fallback: Try og:title
                if (playersToSearch.length === 0) {
                  const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
                  if (ogTitleMatch) {
                    const title = ogTitleMatch[1]
                    const titlePlayersMatch = title.match(/(\w+)\s+vs\s+(\w+)/i)
                    if (titlePlayersMatch) {
                      playersToSearch = [titlePlayersMatch[1].toLowerCase(), titlePlayersMatch[2].toLowerCase()]
                      break
                    }
                  }
                }

                if (playersToSearch.length > 0) break
              }
            }
          } catch (error) {
            continue // Try next proxy
          }
        }

        // Step 2: Fallback to username parameter if HTML extraction failed
        if (playersToSearch.length === 0) {
          if (username) {
            playersToSearch = [username.toLowerCase()]
          } else {
            setError('Could not determine players. Please provide a username in the URL (?username=...) or ensure you are logged in with a verified Chess.com username.')
            setLoading(false)
            return
          }
        }

        // Step 3: Search through each player's archives to find the game (chessiro's approach)
        // Chessiro: Access game archives -> Iterate through archives -> Retrieve specific game
        // Game ID appears in [Link "..."] tag (sometimes also in [Site "..."] tag)
        const linkPattern = new RegExp(`\\[Link\\s+"[^"]*game/(?:live|daily)/${id}[^"]*"\\]`, 'i')
        const sitePattern = new RegExp(`\\[Site\\s+"[^"]*game/(?:live|daily)/${id}[^"]*"\\]`, 'i')
        const hasGameId = (text) => linkPattern.test(text) || sitePattern.test(text)
        
        for (const playerUsername of playersToSearch) {
          try {
            // Get available archives for this player
            const archivesUrl = `${CHESSCOM_API_BASE}/player/${playerUsername}/games/archives`
            const archivesResponse = await fetch(archivesUrl, {
              headers: { 'Accept': 'application/json', 'User-Agent': 'ChessBD/1.0' },
              signal: AbortSignal.timeout(10000),
            })

            if (!archivesResponse.ok) continue

            const { archives = [] } = await archivesResponse.json()
            if (archives.length === 0) continue

            // Search from most recent archives first (chessiro optimizes by starting with recent)
            const reversedArchives = [...archives].reverse()
            
            for (const archiveUrl of reversedArchives) {
              try {
                const pgnUrl = archiveUrl.endsWith('/') ? `${archiveUrl}pgn` : `${archiveUrl}/pgn`
                const pgnResponse = await fetch(pgnUrl, {
                  headers: { 'Accept': 'text/plain', 'User-Agent': 'ChessBD/1.0' },
                  signal: AbortSignal.timeout(15000),
                })

                if (pgnResponse.ok) {
                  const pgnText = await pgnResponse.text()
                  
                  if (hasGameId(pgnText)) {
                    // Extract the specific game from multi-game PGN
                    const games = pgnText.split(/\n\n(?=\[Event)/)
                    const targetGame = games.find(game => hasGameId(game))
                    
                    if (targetGame) {
                      navigate('/analysis', { state: { pgn: targetGame.trim() }, replace: true })
                      return
                    }
                  }
                }
              } catch {
                continue // Try next archive
              }
            }
          } catch {
            continue // Try next player
          }
        }

        // If we've searched all players' archives and didn't find the game
        setError(`Game with ID ${id} not found in game archives. The game might not be publicly available or the players' archives might not be accessible.`)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching game:', err)
        setError('Failed to fetch game. Please check the game ID and try again.')
        setLoading(false)
      }
    }

    fetchGame()
  }, [id, username, navigate])

  if (loading) {
    return (
      <Container>
        <div className="game-live-container">
          <Card className="game-live-loading-card">
            <div className="game-live-loading-glow"></div>
            <div className="game-live-loading">
              <div className="game-live-loading-spinner-wrapper">
                <div className="game-live-loading-spinner-glow"></div>
                <Loader2 className="game-live-loading-icon" />
              </div>
              <div className="game-live-loading-text">
                <h2 className="game-live-loading-title">Fetching Game</h2>
                <p className="game-live-loading-description">Retrieving game data from Chess.com</p>
              </div>
              <div className="game-live-loading-dots">
                <div className="game-live-loading-dot game-live-loading-dot-1"></div>
                <div className="game-live-loading-dot game-live-loading-dot-2"></div>
                <div className="game-live-loading-dot game-live-loading-dot-3"></div>
              </div>
            </div>
          </Card>
        </div>
      </Container>
    )
  }

  if (error) {
    return (
      <Container>
        <div className="game-live-container">
          <Card className="game-live-error-card">
            <div className="game-live-error">
              <div className="game-live-error-icon-wrapper">
                <AlertCircle className="game-live-error-icon" />
              </div>
              <div className="game-live-error-text">
                <h2 className="game-live-error-title">Error</h2>
                <p className="game-live-error-description">{error}</p>
              </div>
              <button onClick={() => navigate('/analysis')} className="game-live-error-button">
                <span>Go to Analysis Page</span>
                <ArrowRight className="game-live-error-button-icon" />
              </button>
            </div>
          </Card>
        </div>
      </Container>
    )
  }

  return null
}

