import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useSEO } from '../hooks/use-seo'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { useAuthStore } from '../store/auth-store'
import { Swords, Lock, X, Users, ChevronLeft, ChevronRight, SkipBack, SkipForward, Crown, Circle, XCircle, Trophy, Target, User as UserIcon, CheckCircle, XCircle as XCircleIcon, Clock, TrendingUp, HatGlasses, Bot } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { rtdb, auth } from '../lib/firebase'
import { ref, onValue, set, onDisconnect, serverTimestamp, get } from 'firebase/database'
import { api } from '../lib/api'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import botsData from "../lib/bots/bots.json"

const MAX_ARENA_PLAYERS = 50

export function Arena() {
  const { t } = useLanguage()
  const { user, loading: authLoading } = useAuthStore()
  const location = useLocation()
  const [arenaPlayersCount, setArenaPlayersCount] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Game state for multiplayer
  const [game, setGame] = useState(null)
  const [moveHistory, setMoveHistory] = useState([])
  const [moveHistoryUci, setMoveHistoryUci] = useState([])
  const [gameStarted, setGameStarted] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [draggedSquare, setDraggedSquare] = useState(null)
  const [boardOrientation, setBoardOrientation] = useState('white')
  const [lastMove, setLastMove] = useState(null)
  const [viewingMoveIndex, setViewingMoveIndex] = useState(null)
  const [fullscreenBoardWidth, setFullscreenBoardWidth] = useState(600)
  const fullscreenBoardRef = useRef(null)
  const fullscreenBoardContainerRef = useRef(null)
  const promotionSourceSquareRef = useRef(null)
  const promotionTargetSquareRef = useRef(null)
  const [showPromotionDialog, setShowPromotionDialog] = useState(false)
  const [promotionToSquare, setPromotionToSquare] = useState(null)
  const presenceSetRef = useRef(false)
  const abortTimeoutRef = useRef(null)
  const showAvailablePlayersTimeoutRef = useRef(null)
  const firstMoveTimeoutRef = useRef(null)
  const userCurrentGameRef = useRef(null) // Ref to track current game ID for timeout callbacks
  
  // Timer state
  const [whiteTime, setWhiteTime] = useState(600000) // 10 minutes in milliseconds
  const [blackTime, setBlackTime] = useState(600000) // 10 minutes in milliseconds
  const [gameStatus, setGameStatus] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const timerIntervalRef = useRef(null)
  const lastMoveTimestampRef = useRef(null) // Server timestamp of last move
  const dbTimeOffsetRef = useRef(0) // Offset between local time and server time
  const previousTabRef = useRef('challenge')
  const currentTurnRef = useRef('white') // Current turn from database
  
  // Draw offer state
  const [drawOffer, setDrawOffer] = useState(null)
  
  // Arena challenge and ranking state
  const [activeTab, setActiveTab] = useState('challenge')
  const [currentOpponent, setCurrentOpponent] = useState(null)
  const [challengeStatus, setChallengeStatus] = useState('idle')
  const [userArenaStats, setUserArenaStats] = useState(null)
  const [arenaRankings, setArenaRankings] = useState([])
  const [availablePlayers, setAvailablePlayers] = useState([])
  const [botsInGames, setBotsInGames] = useState(new Set()) // Track which bots are currently in games
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [currentBotId, setCurrentBotId] = useState(null) // Track which bot we're playing against
  const botMoveScheduledRef = useRef(false) // Track if a bot move is already scheduled
  const gameEndingRef = useRef(false) // Track if handleGameEnd is currently being called
  const [pendingChallenge, setPendingChallenge] = useState(null)
  const [playersInMatches, setPlayersInMatches] = useState(new Set())
  const [userCurrentGame, setUserCurrentGame] = useState(null)
  const [userColor, setUserColor] = useState(null)
  const [opponentColor, setOpponentColor] = useState(null)
  const [_playerMatchInfo, setPlayerMatchInfo] = useState(new Map())
  const [showFirstMoveWarning, setShowFirstMoveWarning] = useState(false)
  const [firstMoveCountdown, setFirstMoveCountdown] = useState(20)
  const firstMoveCountdownIntervalRef = useRef(null)
  
  // Keep ref in sync with state for timeout callbacks
  useEffect(() => {
    userCurrentGameRef.current = userCurrentGame
  }, [userCurrentGame])
  
  // Update currentOpponent to include avatar_url when available
  useEffect(() => {
    if (currentOpponent && availablePlayers.length > 0) {
      const player = availablePlayers.find(p => p.id === currentOpponent.id)
      if (player && player.avatar_url !== currentOpponent?.avatar_url) {
        setCurrentOpponent({
          ...currentOpponent,
          avatar_url: player.avatar_url || null,
        })
      }
    }
  }, [availablePlayers, currentOpponent])

  useSEO({
    title: t('arena.title'),
    description: t('arena.description'),
    url: '/arena',
    keywords: 'chess arena, arena tournaments, competitive chess, chess matches, chess competitions',
  })

  // Subscribe to arena players count from Realtime Database
  useEffect(() => {
    if (!rtdb) return

    const arenaPresenceRef = ref(rtdb, 'arena/presence')
    
    const unsubscribe = onValue(arenaPresenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const count = typeof data === 'object' ? Object.keys(data).length : 0
        setArenaPlayersCount(count)
      } else {
        setArenaPlayersCount(0)
      }
    }, (error) => {
      console.error('[Arena] Error subscribing to arena players:', error)
      setArenaPlayersCount(0)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Initialize game
  useEffect(() => {
    if (!game) {
      const newGame = new Chess()
      setGame(newGame)
    }
  }, [game])

  // Track presence in arena when fullscreen
  useEffect(() => {
    if (!rtdb || !auth || !user || !isFullscreen) {
      // Clean up presence when not in fullscreen
      if (rtdb && user && presenceSetRef.current) {
        const userId = user.id
        const arenaPresenceRef = ref(rtdb, `arena/presence/${userId}`)
        set(arenaPresenceRef, null).catch(() => {
          // Ignore errors during cleanup
        })
        presenceSetRef.current = false
      }
      return
    }

    // Check if arena is full before setting presence
    if (arenaPlayersCount >= MAX_ARENA_PLAYERS) {
      setIsFullscreen(false)
      return
    }

    // Only set presence once to avoid continuous updates
    if (presenceSetRef.current) {
      return
    }

    const userId = user.id
    const arenaPresenceRef = ref(rtdb, `arena/presence/${userId}`)

    // Set presence when entering arena (only once, no timestamp to avoid continuous updates)
    set(arenaPresenceRef, {
      online: true,
    }).then(() => {
      presenceSetRef.current = true
    }).catch((error) => {
      console.error('[Arena] Error setting presence:', error)
      setIsFullscreen(false)
    })

    // Set up automatic cleanup on disconnect
    const disconnectRef = onDisconnect(arenaPresenceRef)
    disconnectRef.remove().catch((error) => {
      console.error('[Arena] Error setting up onDisconnect:', error)
    })

    // Cleanup function - remove presence when component unmounts or fullscreen exits
    return () => {
      if (presenceSetRef.current) {
        set(arenaPresenceRef, null).catch(() => {
          // Ignore errors during cleanup
        })
        presenceSetRef.current = false
      }
    }
  }, [isFullscreen, user, rtdb, auth]) // Removed arenaPlayersCount to prevent update loop

  // Subscribe to available players in arena using onValue to track actual additions/removals
  useEffect(() => {
    if (!rtdb || !user || !isFullscreen) {
      setAvailablePlayers([])
      return
    }

    const arenaPresenceRef = ref(rtdb, 'arena/presence')
    
    let isMounted = true
    const playerCache = new Map()
    const pendingFetches = new Set()
    const removeTimeouts = new Map()
    let previousUserIds = new Set()
    
    // Fetch player data and add to list
    const fetchAndAddPlayer = async (uid) => {
      if (uid === user.id) return // Skip self
      if (playerCache.has(uid)) {
        return // Already cached
      }
      if (pendingFetches.has(uid)) {
        return // Already fetching
      }
      
      // Cancel any pending removal
      const removeTimeout = removeTimeouts.get(uid)
      if (removeTimeout) {
        clearTimeout(removeTimeout)
        removeTimeouts.delete(uid)
      }
      
      pendingFetches.add(uid)
      
      try {
        const userData = await api.getUser(uid)
        
        // Get rating from Chess.com stats (default to 0 if not available)
        let rating = 0
        let name = 'Player'
        let avatar_url = null
        
        if (userData) {
          name = userData.chesscom_username || userData.name || userData.email?.split('@')[0] || 'Player'
          avatar_url = userData.avatar_url
          
          // Fetch Chess.com rating
          if (userData.chesscom_username) {
            try {
              const stats = await api.getChesscomStats(userData.chesscom_username)
              if (stats?.rapid) {
                rating = stats.rapid.rating || 0
              } else if (stats?.blitz) {
                rating = stats.blitz.rating || 0
              }
            } catch (e) {
              // Use default rating (0)
            }
          }
        }
        
        const player = {
          id: uid,
          name,
          rating,
          avatar_url: null,
        }
        
        // Double-check cache before adding (might have been removed during fetch)
        if (!playerCache.has(uid) && isMounted) {
          playerCache.set(uid, player)
          // Preserve bots when updating players
          setAvailablePlayers(prev => {
            const bots = prev.filter(p => p.isBot)
            return [...Array.from(playerCache.values()), ...bots]
          })
        }
        
        pendingFetches.delete(uid)
      } catch (error) {
        console.error(`[Arena] Error fetching user ${uid}:`, error)
        // Even if fetch fails, add player with default data so they appear in the list
        const player = {
          id: uid,
          name: 'Player',
          rating: 0,
          avatar_url: null,
        }
        
        if (!playerCache.has(uid) && isMounted) {
          playerCache.set(uid, player)
          // Preserve bots when updating players
          setAvailablePlayers(prev => {
            const bots = prev.filter(p => p.isBot)
            return [...Array.from(playerCache.values()), ...bots]
          })
        }
        
        pendingFetches.delete(uid)
      }
    }
    
    // Remove player from list with debounce
    const removePlayer = (uid) => {
      if (uid === user.id) return // Skip self
      
      // Cancel any pending removal
      const existingTimeout = removeTimeouts.get(uid)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }
      
      // Debounce removal - wait 2 seconds before actually removing
      // This prevents flickering if the player quickly reconnects
      const timeout = setTimeout(() => {
        if (playerCache.has(uid)) {
          playerCache.delete(uid)
          removeTimeouts.delete(uid)
          
          if (isMounted) {
            // Preserve bots when updating players
            setAvailablePlayers(prev => {
              const bots = prev.filter(p => p.isBot)
              return [...Array.from(playerCache.values()), ...bots]
            })
          }
        }
      }, 2000)
      
      removeTimeouts.set(uid, timeout)
    }
    
    // Use onValue to track actual additions/removals by comparing state
    const unsubscribe = onValue(arenaPresenceRef, (snapshot) => {
      if (!isMounted) return
      
      const currentUserIds = new Set()
      
      if (snapshot.exists()) {
        const presenceData = snapshot.val()
        // Ensure presenceData is an object
        if (presenceData && typeof presenceData === 'object') {
          const userIds = Object.keys(presenceData).filter(uid => {
            // Filter out self and ensure it's a valid string
            if (uid === user.id || !uid || typeof uid !== 'string') {
              return false
            }
            // Check if the value is an object (presence data) or just truthy
            const presenceValue = presenceData[uid]
            // Accept if it's an object with online: true, or just truthy (for backwards compatibility)
            return presenceValue && (presenceValue.online === true || presenceValue === true || typeof presenceValue === 'object')
          })
          userIds.forEach(uid => currentUserIds.add(uid))
        }
      }
      
      // On first load (previousUserIds is empty), add all existing players
      const isInitialLoad = previousUserIds.size === 0
      
      if (isInitialLoad) {
        // Add all players that are currently in presence
        console.log('[Arena] Initial load - found players in presence:', Array.from(currentUserIds))
        currentUserIds.forEach(uid => {
          fetchAndAddPlayer(uid)
        })
      } else {
        // Find newly added players
        currentUserIds.forEach(uid => {
          if (!previousUserIds.has(uid)) {
            fetchAndAddPlayer(uid)
          }
        })
        
        // Find removed players
        previousUserIds.forEach(uid => {
          if (!currentUserIds.has(uid)) {
            removePlayer(uid)
          }
        })
      }
      
      previousUserIds = currentUserIds
    }, (error) => {
      console.error('[Arena] Error subscribing to arena presence:', error)
      setAvailablePlayers([])
    })

    return () => {
      isMounted = false
      
      // Clear all timeouts
      removeTimeouts.forEach(timeout => clearTimeout(timeout))
      removeTimeouts.clear()
      
      playerCache.clear()
      pendingFetches.clear()
      unsubscribe()
    }
  }, [isFullscreen, user, rtdb])

  // Add bots to available players list
  useEffect(() => {
    if (!isFullscreen) {
      // Clear bots when exiting arena
      setAvailablePlayers(prev => prev.filter(p => !p.isBot))
      return
    }

    // Add active bots to the list
    const activeBots = botsData.filter(bot => bot.active !== false)
    const botPlayers = activeBots.map(bot => ({
      id: `bot_${bot.id}`,
      name: t(`bots.${bot.id}.name`) || bot.name,
      rating: 0, // Default rating for bots
      avatar_url: bot.icon,
      isBot: true,
      botId: bot.id,
    }))

    setAvailablePlayers(prev => {
      // Remove existing bots first
      const withoutBots = prev.filter(p => !p.isBot)
      // Add current bots
      return [...withoutBots, ...botPlayers]
    })
  }, [isFullscreen, t])

  // Track which bots are in games
  useEffect(() => {
    if (!rtdb || !isFullscreen) {
      setBotsInGames(new Set())
      return
    }

    const botsInGamesSet = new Set()
    const unsubscribeFunctions = []

    // Track each bot's game status
    botsData.filter(bot => bot.active !== false).forEach(bot => {
      if (!rtdb) return
      const botId = `bot_${bot.id}`
      const botGameRef = ref(rtdb, `arena/bots/${bot.id}/currentGame`)
      
      const unsubscribe = onValue(botGameRef, (snapshot) => {
        if (snapshot.exists()) {
          botsInGamesSet.add(botId)
        } else {
          botsInGamesSet.delete(botId)
        }
        setBotsInGames(new Set(botsInGamesSet))
      }, (error) => {
        console.error(`[Arena] Error tracking bot ${bot.id} game:`, error)
      })

      unsubscribeFunctions.push(unsubscribe)
    })

    return () => {
      unsubscribeFunctions.forEach(unsub => unsub())
    }
  }, [rtdb, isFullscreen])

  // Check for existing game on mount and when entering arena
  useEffect(() => {
    if (!rtdb || !user) return

    const userId = user.id
    const userCurrentGameRef = ref(rtdb, `arena/users/${userId}/currentGame`)
    
    // Check if user has an active game
    get(userCurrentGameRef).then((snapshot) => {
      if (snapshot.exists() && rtdb) {
        const gameId = snapshot.val()
        
        // Check if game is still active
        const gameRef = ref(rtdb, `arena/games/${gameId}`)
        get(gameRef).then((gameSnapshot) => {
          if (gameSnapshot.exists()) {
            const gameData = gameSnapshot.val()
            // Only auto-enter if game is still active
            if (gameData.status === 'active') {
              setUserCurrentGame(gameId)
              setIsFullscreen(true)
            } else {
              // Game ended, clear the reference
              set(userCurrentGameRef, null).catch(() => {})
            }
          }
        }).catch(() => {})
      }
    }).catch(() => {})

    // Also listen for changes
    const unsubscribe = onValue(userCurrentGameRef, (snapshot) => {
      if (snapshot.exists() && rtdb) {
        const gameId = snapshot.val()
        setUserCurrentGame(gameId)
        
        // If user has an active game and not in fullscreen, automatically enter fullscreen
        if (!isFullscreen) {
          setIsFullscreen(true)
        }
      } else {
        setUserCurrentGame(null)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [rtdb, user, isFullscreen])

  // Track which players are in matches and their opponents
  useEffect(() => {
    if (!rtdb || !user) {
      setPlayersInMatches(new Set())
      setPlayerMatchInfo(new Map())
      return
    }

    const userId = user.id
    const playersInMatchesSet = new Set()
    const matchInfoMap = new Map()
    
    // Track current user's game for opponent info
    if (userCurrentGame && rtdb) {
      const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
      get(gameRef).then((gameSnapshot) => {
        if (gameSnapshot.exists()) {
          const gameData = gameSnapshot.val()
          const opponentId = gameData.whitePlayer === userId ? gameData.blackPlayer : gameData.whitePlayer
          if (opponentId) {
            // Fetch opponent name
            api.getUser(opponentId).then((opponentUser) => {
              if (opponentUser) {
                const opponentName = opponentUser.chesscom_username || opponentUser.name || opponentUser.email?.split('@')[0] || 'Player'
                matchInfoMap.set(userId, { opponentId, opponentName })
                setPlayerMatchInfo(new Map(matchInfoMap))
              }
            }).catch(() => {
              // If opponent fetch fails, try to get from availablePlayers
              const opponent = availablePlayers.find(p => p.id === opponentId)
              if (opponent) {
                matchInfoMap.set(userId, { opponentId, opponentName: opponent.name })
                setPlayerMatchInfo(new Map(matchInfoMap))
              }
            })
          }
        }
      }).catch(() => {})
    }

    // Track all available players' games
    const unsubscribePlayers = []
    
    availablePlayers.forEach((player) => {
      if (!rtdb) return
      const playerGameRef = ref(rtdb, `arena/users/${player.id}/currentGame`)
      const unsubscribe = onValue(playerGameRef, (snapshot) => {
        if (snapshot.exists() && rtdb) {
          const gameId = snapshot.val()
          playersInMatchesSet.add(player.id)
          
          // Fetch game data to get opponent
          const gameRef = ref(rtdb, `arena/games/${gameId}`)
          get(gameRef).then((gameSnapshot) => {
            if (gameSnapshot.exists()) {
              const gameData = gameSnapshot.val()
              const opponentId = gameData.whitePlayer === player.id ? gameData.blackPlayer : gameData.whitePlayer
              if (opponentId) {
                // Fetch opponent name
                api.getUser(opponentId).then((opponentUser) => {
                  if (opponentUser) {
                    const opponentName = opponentUser.chesscom_username || opponentUser.name || opponentUser.email?.split('@')[0] || 'Player'
                    matchInfoMap.set(player.id, { opponentId, opponentName })
                    setPlayerMatchInfo(new Map(matchInfoMap))
                  }
                }).catch(() => {
                  // If opponent fetch fails, try to get from availablePlayers
                  const opponent = availablePlayers.find(p => p.id === opponentId)
                  if (opponent) {
                    matchInfoMap.set(player.id, { opponentId, opponentName: opponent.name })
                    setPlayerMatchInfo(new Map(matchInfoMap))
                  } else {
                    // Fallback: use opponentId as name
                    matchInfoMap.set(player.id, { opponentId, opponentName: 'Player' })
                    setPlayerMatchInfo(new Map(matchInfoMap))
                  }
                })
              }
            }
          }).catch(() => {})
        } else {
          playersInMatchesSet.delete(player.id)
          matchInfoMap.delete(player.id)
          setPlayerMatchInfo(new Map(matchInfoMap))
        }
        setPlayersInMatches(new Set(playersInMatchesSet))
      })
      unsubscribePlayers.push(unsubscribe)
    })

    return () => {
      unsubscribePlayers.forEach(unsub => unsub())
    }
  }, [user, availablePlayers, rtdb, userCurrentGame])

  // Subscribe to incoming challenges (challenges sent TO this user)
  useEffect(() => {
    if (!rtdb || !user || !isFullscreen) return

    const userId = user.id
    const challengesRef = ref(rtdb, `arena/challenges/${userId}`)
    
    const unsubscribe = onValue(challengesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPendingChallenge(null)
        if (challengeStatus === 'challenged_by') {
          setChallengeStatus('idle')
          setCurrentOpponent(null)
          setActiveTab('challenge')
        }
        return
      }

      const challengeData = snapshot.val()
      
      // Check if there's a challenge to this user
      if (challengeData.from && challengeData.from !== userId) {
        setPendingChallenge({
          from: challengeData.from,
          to: userId,
        })
        setChallengeStatus('challenged_by')
        setActiveTab('game')
        
        // Fetch opponent info
        api.getUser(challengeData.from).then(async (opponentUser) => {
          if (opponentUser) {
            let rating = 0
            
            // Calculate points from arena games
            if (rtdb) {
              try {
                const gamesRef = ref(rtdb, 'arena/games')
                const gamesSnapshot = await get(gamesRef)
                if (gamesSnapshot.exists()) {
                  const gamesData = gamesSnapshot.val()
                  const games = Object.values(gamesData)
                  const statsMap = calculateStatsFromGames(games)
                  const playerStats = statsMap.get(challengeData.from)
                  if (playerStats) {
                    rating = playerStats.points
                  }
                }
              } catch (e) {
                // Use default rating (0)
              }
            }
            
            setCurrentOpponent({
              id: challengeData.from,
              name: opponentUser.chesscom_username || opponentUser.name || opponentUser.email?.split('@')[0] || 'Player',
              rating,
              avatar_url: opponentUser.avatar_url || null,
            })
          }
        }).catch((error) => {
          console.error('[Arena] Error fetching opponent:', error)
        })
      } else {
        setPendingChallenge(null)
        if (challengeStatus === 'challenged_by') {
          setChallengeStatus('idle')
          setCurrentOpponent(null)
          setActiveTab('challenge')
        }
      }
    }, (error) => {
      console.error('[Arena] Error subscribing to challenges:', error)
    })

    return () => {
      unsubscribe()
    }
  }, [isFullscreen, user, challengeStatus])

  // Subscribe to outgoing challenges (challenges sent BY this user) - track when opponent accepts/declines
  useEffect(() => {
    if (!rtdb || !user || !isFullscreen || challengeStatus !== 'challenged' || !currentOpponent) return

    const opponentId = currentOpponent.id
    const outgoingChallengeRef = ref(rtdb, `arena/challenges/${opponentId}`)
    
    const unsubscribe = onValue(outgoingChallengeRef, (snapshot) => {
      // If challenge no longer exists, it was either accepted (game created) or declined
      if (!snapshot.exists()) {
        // Check if a game was created (if so, game listener will handle it)
        // If no game, challenge was declined
        if (!userCurrentGame) {
          setChallengeStatus('idle')
          setCurrentOpponent(null)
          setActiveTab('challenge')
        }
      }
    }, (error) => {
      console.error('[Arena] Error subscribing to outgoing challenge:', error)
    })

    return () => {
      unsubscribe()
    }
  }, [isFullscreen, user, challengeStatus, currentOpponent, userCurrentGame, rtdb])

  // Function to calculate stats from games
  const calculateStatsFromGames = (games) => {
    const statsMap = new Map()
    
    // Points system
    const POINTS_WIN = 10
    const POINTS_LOSS = -5
    const POINTS_DRAW = 3
    
    games.forEach((game) => {
      // Skip aborted games
      if (game.status === 'aborted') return
      
      const whitePlayerId = game.whitePlayer
      const blackPlayerId = game.blackPlayer
      const winner = game.winner
      
      if (!whitePlayerId || !blackPlayerId) return
      
      // Initialize stats for players if not exists
      if (!statsMap.has(whitePlayerId)) {
        statsMap.set(whitePlayerId, { wins: 0, losses: 0, draws: 0, points: 0, winRate: 0 })
      }
      if (!statsMap.has(blackPlayerId)) {
        statsMap.set(blackPlayerId, { wins: 0, losses: 0, draws: 0, points: 0, winRate: 0 })
      }
      
      const whiteStats = statsMap.get(whitePlayerId)
      const blackStats = statsMap.get(blackPlayerId)
      
      // Determine result
      if (!winner) {
        // Draw
        whiteStats.draws++
        blackStats.draws++
        whiteStats.points += POINTS_DRAW
        blackStats.points += POINTS_DRAW
      } else if (winner === 'white') {
        whiteStats.wins++
        blackStats.losses++
        whiteStats.points += POINTS_WIN
        blackStats.points += POINTS_LOSS
      } else if (winner === 'black') {
        blackStats.wins++
        whiteStats.losses++
        blackStats.points += POINTS_WIN
        whiteStats.points += POINTS_LOSS
      }
      
      // Ensure points don't go below 0
      whiteStats.points = Math.max(0, whiteStats.points)
      blackStats.points = Math.max(0, blackStats.points)
      
      // Calculate win rate
      const whiteTotalGames = whiteStats.wins + whiteStats.losses + whiteStats.draws
      const blackTotalGames = blackStats.wins + blackStats.losses + blackStats.draws
      whiteStats.winRate = whiteTotalGames > 0 ? whiteStats.wins / whiteTotalGames : 0
      blackStats.winRate = blackTotalGames > 0 ? blackStats.wins / blackTotalGames : 0
    })
    
    return statsMap
  }

  // Real-time listener for game state updates when in a match
  useEffect(() => {
    if (!rtdb || !user || !userCurrentGame || !isFullscreen) {
      return
    }

    const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
    
    const unsubscribe = onValue(gameRef, (snapshot) => {
      if (!snapshot.exists()) return
      
      const gameData = snapshot.val()
      const userId = user.id
      
      // Check if this is a bot game
      if (gameData.botId && !currentBotId) {
        setCurrentBotId(gameData.botId)
      }
      
      // Determine user's color
      const isUserWhite = gameData.whitePlayer === userId
      const userColorValue = isUserWhite ? 'white' : 'black'
      const opponentColorValue = isUserWhite ? 'black' : 'white'
      
      // Set colors if not already set
      if (!userColor || !opponentColor) {
        setUserColor(userColorValue)
        setOpponentColor(opponentColorValue)
        // Set board orientation based on user color (black = flipped)
        setBoardOrientation(userColorValue)
      }
      
      // If opponent is a bot, set currentOpponent from availablePlayers
      const opponentId = isUserWhite ? gameData.blackPlayer : gameData.whitePlayer
      if (opponentId && opponentId.startsWith('bot_') && (!currentOpponent || currentOpponent.id !== opponentId)) {
        const botPlayer = availablePlayers.find(p => p.id === opponentId)
        if (botPlayer) {
          setCurrentOpponent(botPlayer)
        }
      }
      
      // Update challenge status to 'in_game' when game is detected
      if (challengeStatus !== 'in_game') {
        setChallengeStatus('in_game')
        setPendingChallenge(null)
        // Switch to game tab when game is detected
        setActiveTab('game')
      }
      
      // Set timeout for first move if no moves have been made yet (20 seconds)
      // This applies to both human and bot games
      if (gameData.status === 'active' && (!gameData.moveHistory || gameData.moveHistory.length === 0)) {
        if (!firstMoveTimeoutRef.current) {
          // Capture gameId at the time timeout is set
          const gameId = userCurrentGameRef.current
          // Set timeout from now (20 seconds)
          firstMoveTimeoutRef.current = setTimeout(() => {
            // Check again if first move has been made
            const currentGameId = userCurrentGameRef.current || gameId
            if (rtdb && currentGameId) {
              const gameRef = ref(rtdb, `arena/games/${currentGameId}`)
              get(gameRef).then((snapshot) => {
                if (snapshot.exists()) {
                  const currentGameData = snapshot.val()
                  // If still no moves and game is still active, abort the game
                  if (currentGameData.status === 'active' && (!currentGameData.moveHistory || currentGameData.moveHistory.length === 0)) {
                    handleGameEnd('abort')
                  }
                }
                firstMoveTimeoutRef.current = null
              }).catch(() => {
                firstMoveTimeoutRef.current = null
              })
            } else {
              firstMoveTimeoutRef.current = null
            }
          }, 20000) // 20 seconds
        }
      } else if (gameData.moveHistory && gameData.moveHistory.length > 0) {
        // Clear timeout if moves have been made
        if (firstMoveTimeoutRef.current) {
          clearTimeout(firstMoveTimeoutRef.current)
          firstMoveTimeoutRef.current = null
        }
      }
      
            // Update game status
            if (gameData.status && gameData.status !== 'active') {
              const previousStatus = gameStatus
              setGameStatus(gameData.status)
              if (gameData.winner !== undefined || gameData.status === 'draw' || gameData.status === 'stalemate' || gameData.status === 'aborted') {
                setGameResult({ 
                  winner: gameData.winner || null, 
                  reason: gameData.resultReason || gameData.status 
                })
              }
              // If game ended, stop timer and bot move effect
              if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current)
                timerIntervalRef.current = null
              }
              // Immediately stop bot move effect when game ends
              botMoveScheduledRef.current = false
              setIsBotThinking(false)
              
              // If game just ended (was active, now not active), trigger the 10-second delay
              if (previousStatus === 'active' && gameData.status !== 'active') {
                // Clear any existing timeout
                if (showAvailablePlayersTimeoutRef.current) {
                  clearTimeout(showAvailablePlayersTimeoutRef.current)
                }
                
                // Set challenge status to 'idle' after 10 seconds to show available players
                showAvailablePlayersTimeoutRef.current = setTimeout(() => {
                  setChallengeStatus('idle') // Make user available for challenges after delay
                  showAvailablePlayersTimeoutRef.current = null
                }, 10000) // 10 seconds delay
              }
            } else if (!gameStatus || gameStatus !== 'active') {
              setGameStatus('active')
              setGameResult(null)
            }
      
      // Check if opponent disconnected (abort game after 20 seconds) - only for human players
      if (gameData.status === 'active' && gameData.whitePlayer && gameData.blackPlayer && rtdb && !gameData.botId) {
        // Check if opponent is still in presence
        const humanOpponentId = isUserWhite ? gameData.blackPlayer : gameData.whitePlayer
        const opponentPresenceRef = ref(rtdb, `arena/presence/${humanOpponentId}`)
        get(opponentPresenceRef).then((presenceSnapshot) => {
          if (!presenceSnapshot.exists()) {
            // Opponent disconnected - start 20 second countdown
            if (!abortTimeoutRef.current) {
              abortTimeoutRef.current = setTimeout(() => {
                // Double-check opponent is still not present before aborting
                get(opponentPresenceRef).then((recheckSnapshot) => {
                  if (!recheckSnapshot.exists()) {
                    handleGameEnd('abort')
                  }
                  abortTimeoutRef.current = null
                }).catch(() => {
                  handleGameEnd('abort')
                  abortTimeoutRef.current = null
                })
              }, 20000) // 20 seconds
            }
          } else {
            // Opponent is back - clear abort timeout if it exists
            if (abortTimeoutRef.current) {
              clearTimeout(abortTimeoutRef.current)
              abortTimeoutRef.current = null
            }
          }
        }).catch(() => {
          // Ignore errors
        })
      }
      
      // Update draw offer
      if (gameData.drawOffer) {
        setDrawOffer(gameData.drawOffer)
      } else {
        setDrawOffer(null)
      }
      
      // Update timer from database - account for elapsed time since last move
      // Only update timers if at least one move has been made
      const hasMoves = gameData.moveHistory && Array.isArray(gameData.moveHistory) && gameData.moveHistory.length > 0
      
      if (gameData.whiteTime !== undefined && gameData.blackTime !== undefined) {
        if (hasMoves && gameData.updatedAt && typeof gameData.updatedAt === 'number') {
          // Only update if this is a newer timestamp than what we've seen (to avoid overwriting bot moves)
          if (!lastMoveTimestampRef.current || gameData.updatedAt > lastMoveTimestampRef.current) {
            const currentLocalTime = Date.now()
            
            // Update server time offset - always recalculate to account for drift
            dbTimeOffsetRef.current = gameData.updatedAt - currentLocalTime
            
            // Calculate elapsed time since the server timestamp
            // If server time is ahead of local time (positive offset), elapsed time is negative, so use 0
            // If server time is behind local time (negative offset), elapsed time is positive
            const elapsedTime = Math.max(0, currentLocalTime - gameData.updatedAt)
            
            // Get current turn to determine which timer is running
            const currentTurn = gameData.currentTurn || 'white'
            currentTurnRef.current = currentTurn // Update ref for timer interval
            
            // Update timers based on database values minus elapsed time
            let updatedWhiteTime = gameData.whiteTime
            let updatedBlackTime = gameData.blackTime
            
            if (gameData.status === 'active') {
              // Only decrement the timer for the player whose turn it is
              if (currentTurn === 'white') {
                updatedWhiteTime = Math.max(0, gameData.whiteTime - elapsedTime)
              } else {
                updatedBlackTime = Math.max(0, gameData.blackTime - elapsedTime)
              }
            }
            
            setWhiteTime(updatedWhiteTime)
            setBlackTime(updatedBlackTime)
            lastMoveTimestampRef.current = gameData.updatedAt
          }
        } else if (!hasMoves) {
          // Before first move, just set the initial timer values without decrementing
          setWhiteTime(gameData.whiteTime)
          setBlackTime(gameData.blackTime)
        }
      }
      
      // Update game state from Firebase
      if (gameData.fen) {
        const newGame = new Chess(gameData.fen)
        setGame(newGame)
        setGameStarted(true)
        
        // Check for game end conditions
        if (newGame.isCheckmate()) {
          // Immediately stop bot move effect
          botMoveScheduledRef.current = false
          setIsBotThinking(false)
          const winner = newGame.turn() === 'w' ? 'black' : 'white'
          handleGameEnd('checkmate', winner)
        } else if (newGame.isStalemate()) {
          // Immediately stop bot move effect
          botMoveScheduledRef.current = false
          setIsBotThinking(false)
          handleGameEnd('stalemate')
        } else if (newGame.isDraw()) {
          // Immediately stop bot move effect
          botMoveScheduledRef.current = false
          setIsBotThinking(false)
          handleGameEnd('draw')
        }
      }
      
      // Update move history
      if (gameData.moveHistory && Array.isArray(gameData.moveHistory)) {
        setMoveHistory(gameData.moveHistory)
        
        // Clear first move timeout and warning if first move has been made
        if (gameData.moveHistory.length > 0) {
          if (firstMoveTimeoutRef.current) {
            clearTimeout(firstMoveTimeoutRef.current)
            firstMoveTimeoutRef.current = null
          }
          setShowFirstMoveWarning(false)
          setFirstMoveCountdown(20)
          if (firstMoveCountdownIntervalRef.current) {
            clearInterval(firstMoveCountdownIntervalRef.current)
            firstMoveCountdownIntervalRef.current = null
          }
        } else {
          // No moves yet - show warning if user is white
          if (isUserWhite && gameData.status === 'active') {
            setShowFirstMoveWarning(true)
          }
        }
      } else {
        // No move history yet - show warning if user is white
        if (isUserWhite && gameData.status === 'active') {
          setShowFirstMoveWarning(true)
        }
      }
      
      // Update move history UCI if available
      if (gameData.moveHistoryUci && Array.isArray(gameData.moveHistoryUci)) {
        setMoveHistoryUci(gameData.moveHistoryUci)
      } else if (gameData.moveHistory && Array.isArray(gameData.moveHistory)) {
        // Reconstruct UCI moves from SAN if UCI not available
        const tempGame = new Chess()
        const uciMoves = []
        for (const sanMove of gameData.moveHistory) {
          try {
            const move = tempGame.move(sanMove)
            if (move) {
              const promotion = move.promotion ? move.promotion.toLowerCase() : ''
              uciMoves.push(move.from + move.to + promotion)
            }
          } catch (e) {
            break
          }
        }
        setMoveHistoryUci(uciMoves)
      }
      
      // Update last move if available
      if (gameData.lastMove) {
        setLastMove(gameData.lastMove)
      }
      
      // Fetch opponent info (update even if already set, in case it changed) - only for human players
      const humanOpponentId = isUserWhite ? gameData.blackPlayer : gameData.whitePlayer
      if (humanOpponentId && !humanOpponentId.startsWith('bot_')) {
        // Only fetch if opponent is different or not set
        if (!currentOpponent || currentOpponent.id !== humanOpponentId) {
          api.getUser(humanOpponentId).then((opponentUser) => {
            if (opponentUser) {
              let rating = 0
              if (opponentUser.chesscom_username) {
                api.getChesscomStats(opponentUser.chesscom_username).then((stats) => {
                  if (stats?.rapid) {
                    rating = stats.rapid.rating || 0
                  } else if (stats?.blitz) {
                    rating = stats.blitz.rating || 0
                  }
                  setCurrentOpponent({
                    id: humanOpponentId,
                    name: opponentUser.chesscom_username || opponentUser.name || opponentUser.email?.split('@')[0] || 'Player',
                    rating,
                    avatar_url: opponentUser.avatar_url || null,
                  })
                }).catch(() => {
                  setCurrentOpponent({
                    id: humanOpponentId,
                    name: opponentUser.chesscom_username || opponentUser.name || opponentUser.email?.split('@')[0] || 'Player',
                    rating: 0,
                    avatar_url: opponentUser.avatar_url || null,
                  })
                })
              } else {
                setCurrentOpponent({
                  id: humanOpponentId,
                  name: opponentUser.chesscom_username || opponentUser.name || opponentUser.email?.split('@')[0] || 'Player',
                  rating: 0,
                  avatar_url: opponentUser.avatar_url || null,
                })
              }
            }
          }).catch(() => {
            // Try to get from availablePlayers
            const opponent = availablePlayers.find(p => p.id === humanOpponentId)
            if (opponent) {
              setCurrentOpponent(opponent)
            }
          })
        }
      }
    }, (error) => {
      console.error('[Arena] Error subscribing to game state:', error)
    })

    return () => {
      unsubscribe()
      // Clear abort timeout on cleanup
      if (abortTimeoutRef.current) {
        clearTimeout(abortTimeoutRef.current)
        abortTimeoutRef.current = null
      }
      // Clear show available players timeout on cleanup
      if (showAvailablePlayersTimeoutRef.current) {
        clearTimeout(showAvailablePlayersTimeoutRef.current)
        showAvailablePlayersTimeoutRef.current = null
      }
      // Clear first move timeout on cleanup
      if (firstMoveTimeoutRef.current) {
        clearTimeout(firstMoveTimeoutRef.current)
        firstMoveTimeoutRef.current = null
      }
    }
  }, [isFullscreen, user, userCurrentGame, rtdb, currentOpponent, availablePlayers, userColor, opponentColor, challengeStatus])

  // Make bot move
  const makeBotMove = async () => {
    if (!game || !rtdb || !userCurrentGame || !currentBotId || isBotThinking || !user) {
      botMoveScheduledRef.current = false
      return
    }
    
    // Check local gameStatus first - if game has ended, don't proceed
    if (gameStatus && gameStatus !== 'active') {
      botMoveScheduledRef.current = false
      setIsBotThinking(false)
      return
    }
    
    const currentGame = new Chess(game.fen())
    if (currentGame.isGameOver()) {
      botMoveScheduledRef.current = false
      setIsBotThinking(false)
      return
    }
    
    // Check if it's the bot's turn
    const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
    const gameSnapshot = await get(gameRef)
    if (!gameSnapshot.exists()) {
      botMoveScheduledRef.current = false
      setIsBotThinking(false)
      return
    }
    
    const gameData = gameSnapshot.val()
    
    // Check if game is still active before making a move
    if (gameData.status && gameData.status !== 'active') {
      botMoveScheduledRef.current = false
      setIsBotThinking(false)
      return
    }
    
    // Double-check game is not over from FEN
    const dbGame = new Chess(gameData.fen || game.fen())
    if (dbGame.isGameOver()) {
      botMoveScheduledRef.current = false
      setIsBotThinking(false)
      return
    }
    
    const userId = user.id
    const isUserWhite = gameData.whitePlayer === userId
    const botColor = isUserWhite ? 'black' : 'white'
    const botColorChar = botColor === 'white' ? 'w' : 'b'
    
    // Check if it's bot's turn
    if (currentGame.turn() !== botColorChar) {
      botMoveScheduledRef.current = false
      return
    }
    
    setIsBotThinking(true)
    botMoveScheduledRef.current = false
    
    // Store the timestamp when we start the bot move (before API call)
    const moveStartTime = Date.now()
    
    try {
      // Call bot API
      const response = await fetch("https://chessbd.pythonanywhere.com/bot/move", {
        method: "POST",
        headers,
        body: JSON.stringify({
          bot_id: currentBotId,
          fen: currentGame.fen(),
        }),
      })
      
      if (!response.ok) {
        throw new Error('Bot API error')
      }
      
      const data = await response.json()
      
      if (data.ok && data.move) {
        const from = data.move.substring(0, 2)
        const to = data.move.substring(2, 4)
        const promotion = data.move.length > 4 ? data.move[4].toLowerCase() : undefined 
        
        const gameCopy = new Chess(currentGame.fen())
        const move = gameCopy.move({
          from,
          to,
          promotion: promotion || 'q',
        })
        
        if (move) {
          
          // Update local state
          setLastMove({ from, to })
          setGame(gameCopy)
          const newMoveHistory = [...moveHistory, move.san]
          const newMoveHistoryUci = [...moveHistoryUci, data.move]
          setMoveHistory(newMoveHistory)
          setMoveHistoryUci(newMoveHistoryUci)
          
          // Sync to Firebase
          const nextTurn = gameCopy.turn() === 'w' ? 'white' : 'black'
          const timeIncrement = 2000
          
          // Calculate elapsed time since the bot's turn started (when we read gameData)
          // Use the database timestamp as the source of truth
          const currentLocalTime = Date.now()
          let elapsedTime = 0
          
          if (gameData.updatedAt && typeof gameData.updatedAt === 'number') {
            // Calculate elapsed time from when the bot's turn started
            // gameData.updatedAt is server time when the previous move was made (bot's turn started)
            // We need to account for server time offset
            const serverTimeAtTurnStart = gameData.updatedAt
            // Convert current local time to estimated server time
            // dbTimeOffsetRef = serverTime - localTime (from a previous measurement)
            // So estimatedServerTime = localTime + dbTimeOffsetRef
            const estimatedServerTimeNow = currentLocalTime + dbTimeOffsetRef.current
            elapsedTime = Math.max(0, estimatedServerTimeNow - serverTimeAtTurnStart)
          } else {
            // Fallback: use the time since we started the move
            elapsedTime = Math.max(0, currentLocalTime - moveStartTime)
          }
          
          // Get timer values from the original gameData (when bot's turn started)
          // These are the baseline values before any time elapsed
          let currentWhiteTime = gameData.whiteTime !== undefined ? gameData.whiteTime : whiteTime
          let currentBlackTime = gameData.blackTime !== undefined ? gameData.blackTime : blackTime
          
          // Determine which timer was running (the bot's timer, since bot just moved)
          const currentTurnBeforeMove = gameData.currentTurn || 'white'
          
          // Subtract elapsed time from the timer that was running
          if (currentTurnBeforeMove === 'white') {
            currentWhiteTime = Math.max(0, currentWhiteTime - elapsedTime)
          } else {
            currentBlackTime = Math.max(0, currentBlackTime - elapsedTime)
          }
          
          // Now add time increment to the bot (who just moved)
          // Determine who just moved: if nextTurn is white, black just moved; if nextTurn is black, white just moved
          const updatedWhiteTime = nextTurn === 'black' ? currentWhiteTime + timeIncrement : currentWhiteTime
          const updatedBlackTime = nextTurn === 'white' ? currentBlackTime + timeIncrement : currentBlackTime
          
          // Check for game end conditions
          let updatedStatus = gameData.status || 'active'
          let updatedWinner = null
          let updatedResultReason = null
          
          if (gameCopy.isCheckmate()) {
            updatedStatus = 'checkmate'
            updatedWinner = gameCopy.turn() === 'w' ? 'black' : 'white'
            updatedResultReason = 'checkmate'
          } else if (gameCopy.isStalemate()) {
            updatedStatus = 'stalemate'
            updatedResultReason = 'stalemate'
          } else if (gameCopy.isDraw()) {
            updatedStatus = 'draw'
            updatedResultReason = 'draw'
          }
          
          await set(gameRef, {
            ...gameData,
            fen: gameCopy.fen(),
            moveHistory: newMoveHistory,
            moveHistoryUci: newMoveHistoryUci,
            currentTurn: nextTurn,
            lastMove,
            whiteTime: updatedWhiteTime,
            blackTime: updatedBlackTime,
            status: updatedStatus,
            winner: updatedWinner,
            resultReason: updatedResultReason,
            updatedAt: serverTimestamp(),
          })
          
          // Re-fetch to get the actual server timestamp and update offset
          try {
            const updatedSnapshot = await get(gameRef)
            if (updatedSnapshot.exists()) {
              const updatedData = updatedSnapshot.val()
              if (updatedData.updatedAt && typeof updatedData.updatedAt === 'number') {
                const serverTime = updatedData.updatedAt
                const localTime = Date.now()
                dbTimeOffsetRef.current = serverTime - localTime
                lastMoveTimestampRef.current = serverTime
              }
            }
          } catch (error) {
            // If re-fetch fails, estimate based on current time
            const estimatedServerTime = Date.now()
            dbTimeOffsetRef.current = 0 // Assume no offset if we can't determine
            lastMoveTimestampRef.current = estimatedServerTime
          }
          
          setWhiteTime(updatedWhiteTime)
          setBlackTime(updatedBlackTime)
          
          // If game ended, trigger handleGameEnd
          if (updatedStatus !== 'active') {
            if (updatedStatus === 'checkmate') {
              handleGameEnd('checkmate', updatedWinner || undefined)
            } else if (updatedStatus === 'stalemate') {
              handleGameEnd('stalemate')
            } else if (updatedStatus === 'draw') {
              handleGameEnd('draw')
            }
          }
        }
      }
    } catch (error) {
      console.error('[Arena] Error making bot move:', error)
    } finally {
      setIsBotThinking(false)
    }
  }

  // Bot move effect - trigger bot move when it's bot's turn
  useEffect(() => {
    if (!game || !rtdb || !userCurrentGame || !currentBotId || isBotThinking || !gameStarted || !user) {
      botMoveScheduledRef.current = false
      return
    }
    if (gameStatus !== 'active') {
      botMoveScheduledRef.current = false
      return
    }
    
    const currentGame = new Chess(game.fen())
    if (currentGame.isGameOver()) {
      botMoveScheduledRef.current = false
      return
    }
    
    // Prevent multiple bot moves from being scheduled
    if (botMoveScheduledRef.current) return
    
    // Check if it's bot's turn
    get(ref(rtdb, `arena/games/${userCurrentGame}`)).then((snapshot) => {
      if (!snapshot.exists()) {
        botMoveScheduledRef.current = false
        return
      }
      
      const gameData = snapshot.val()
      
      // Check if game is still active
      if (gameData.status && gameData.status !== 'active') {
        botMoveScheduledRef.current = false
        return
      }
      
      const userId = user.id
      const isUserWhite = gameData.whitePlayer === userId
      const botColor = isUserWhite ? 'black' : 'white'
      const botColorChar = botColor === 'white' ? 'w' : 'b'
      
      // Check if it's bot's turn based on database currentTurn
      const currentTurn = gameData.currentTurn || 'white'
      const isBotTurn = (botColor === 'white' && currentTurn === 'white') || (botColor === 'black' && currentTurn === 'black')
      
      if (isBotTurn && currentGame.turn() === botColorChar) {
        // Double-check game status before scheduling
        if (gameData.status && gameData.status !== 'active') {
          botMoveScheduledRef.current = false
          return
        }
        
        // Double-check game is not over
        if (currentGame.isGameOver()) {
          botMoveScheduledRef.current = false
          return
        }
        
        botMoveScheduledRef.current = true
        // Small delay before bot moves
        setTimeout(() => {
          // Check again before making move (status might have changed)
          if (gameStatus && gameStatus !== 'active') {
            botMoveScheduledRef.current = false
            return
          }
          makeBotMove()
        }, 300)
      } else {
        botMoveScheduledRef.current = false
      }
    }).catch(() => {
      botMoveScheduledRef.current = false
    })
    
    // Cleanup function for useEffect
    return () => {
      botMoveScheduledRef.current = false
    }
  }, [game, gameStarted, userCurrentGame, currentBotId, isBotThinking, gameStatus, rtdb, user, moveHistory.length])

  // Handle modal-open class to hide scrollbar when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`)
      document.body.classList.add('modal-open')
      document.documentElement.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
      document.documentElement.classList.remove('modal-open')
    }

    return () => {
      document.body.classList.remove('modal-open')
      document.documentElement.classList.remove('modal-open')
    }
  }, [isFullscreen])

  // Update fullscreen board width
  useLayoutEffect(() => {
    const updateFullscreenBoardWidth = () => {
      if (fullscreenBoardRef.current && isFullscreen) {
        const windowWidth = window.innerWidth
        const windowHeight = window.innerHeight
        const isMobile = windowWidth < 1024

        if (isMobile) {
          const padding = 32
          const availableWidth = windowWidth - padding
          setFullscreenBoardWidth(availableWidth)
        } else {
          const headerHeight = 65
          const verticalPadding = 64
          const horizontalPadding = 64
          const playerInfoHeight = 60
          const availableHeight = windowHeight - headerHeight - verticalPadding - playerInfoHeight
          const rightPanelMinWidth = 250
          const gap = 24
          const sidebarWidth = 224
          const availableWidth = windowWidth - sidebarWidth - rightPanelMinWidth - gap - horizontalPadding
          const boardSize = Math.min(availableWidth, availableHeight)
          setFullscreenBoardWidth(boardSize)
        }
      }
    }

    updateFullscreenBoardWidth()
    window.addEventListener('resize', updateFullscreenBoardWidth)
    return () => {
      window.removeEventListener('resize', updateFullscreenBoardWidth)
    }
  }, [isFullscreen])

  const handleEnterArena = async () => {
    if (arenaPlayersCount >= MAX_ARENA_PLAYERS) {
      // Arena is full, show message or prevent entry
      return
    }
    
    setIsFullscreen(true)
    setChallengeStatus('idle')
    
    // Check if user has an active game when entering arena
    if (rtdb && user) {
      const userId = user.id
      const userCurrentGameRef = ref(rtdb, `arena/users/${userId}/currentGame`)
      try {
        const snapshot = await get(userCurrentGameRef)
        if (snapshot.exists()) {
          const gameId = snapshot.val()
          // Verify game is still active
          const gameRef = ref(rtdb, `arena/games/${gameId}`)
          const gameSnapshot = await get(gameRef)
          if (gameSnapshot.exists()) {
            const gameData = gameSnapshot.val()
            if (gameData.status === 'active') {
              setUserCurrentGame(gameId)
            } else {
              // Game ended, clear the reference
              await set(userCurrentGameRef, null)
            }
          }
        }
      } catch (error) {
        console.error('[Arena] Error checking for existing game:', error)
      }
    }
  }

  const isArenaFull = arenaPlayersCount >= MAX_ARENA_PLAYERS

  const handleExitArena = () => {
    // Clean up challenges
    if (rtdb && user) {
      const userId = user.id
      // Remove any outgoing challenges
      const outgoingChallengeRef = ref(rtdb, `arena/challenges/${userId}`)
      set(outgoingChallengeRef, null).catch(() => {})
      
      // Remove any incoming challenges
      if (availablePlayers.length > 0 && rtdb) {
        const rtdbInstance = rtdb
        availablePlayers.forEach((player) => {
          const incomingChallengeRef = ref(rtdbInstance, `arena/challenges/${player.id}`)
          get(incomingChallengeRef).then((snapshot) => {
            if (snapshot.exists() && snapshot.val().from === userId) {
              set(incomingChallengeRef, null).catch(() => {})
            }
          }).catch(() => {})
        })
      }
    }
    
    setIsFullscreen(false)
    setChallengeStatus('idle')
    setCurrentOpponent(null)
    setPendingChallenge(null)
  }

  const handleChallengePlayer = async (opponentId) => {
    if (!rtdb || !user) return
    
    // Prevent challenging if user is in a match
    if (userCurrentGame) {
      console.warn('[Arena] Cannot challenge while in a match')
      return
    }

    const opponent = availablePlayers.find(p => p.id === opponentId)
    if (!opponent) return

    const userId = user.id
    
    // Check if opponent is a bot
    if (opponent.isBot && opponent.botId) {
      // Check if bot is already in a game
      if (botsInGames.has(opponentId)) {
        console.warn('[Arena] Bot is already in a game')
        return
      }

      // Immediately create game with bot (no challenge needed)
      try {
        const botId = opponent.botId
        
        // Randomly assign white/black colors
        const userIsWhite = Math.random() < 0.5
        const whitePlayer = userIsWhite ? userId : `bot_${botId}`
        const blackPlayer = userIsWhite ? `bot_${botId}` : userId
        
        // Create game
        const gameId = `${userId}_bot_${botId}_${Date.now()}`
        const gameRef = ref(rtdb, `arena/games/${gameId}`)
        
        // Create game with assigned colors
        const initialTime = 600000 // 10 minutes in milliseconds
        await set(gameRef, {
          player1: whitePlayer,
          player2: blackPlayer,
          whitePlayer,
          blackPlayer,
          botId, // Store bot ID for reference
          status: 'active',
          currentTurn: 'white',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moveHistory: [],
          moveHistoryUci: [],
          whiteTime: initialTime,
          blackTime: initialTime,
          drawOffer: null,
          createdAt: serverTimestamp(),
        })
        
        // Mark bot as in game
        await set(ref(rtdb, `arena/bots/${botId}/currentGame`), gameId)
        
        // Initialize timer and game status
        setWhiteTime(initialTime)
        setBlackTime(initialTime)
        setGameStatus('active')
        setGameResult(null)
        setDrawOffer(null)
        
        // Set game reference for current user
        await set(ref(rtdb, `arena/users/${userId}/currentGame`), gameId)
        
        // Set colors and board orientation
        const userColorValue = userIsWhite ? 'white' : 'black'
        const opponentColorValue = userIsWhite ? 'black' : 'white'
        setUserColor(userColorValue)
        setOpponentColor(opponentColorValue)
        setBoardOrientation(userColorValue)
        
        // Set current bot ID
        setCurrentBotId(botId)
        
        // Initialize current turn ref
        currentTurnRef.current = 'white'
        
        // Initialize game
        const newGame = new Chess()
        setGame(newGame)
        setMoveHistory([])
        setMoveHistoryUci([])
        setGameStarted(true)
        setSelectedSquare(null)
        setLastMove(null)
        setViewingMoveIndex(null)
        setShowPromotionDialog(false)
        setPromotionToSquare(null)
        promotionSourceSquareRef.current = null
        promotionTargetSquareRef.current = null
        
        setCurrentOpponent(opponent)
        setUserCurrentGame(gameId)
        setChallengeStatus('in_game')
        setActiveTab('game')
        
        // Set timeout for first move (20 seconds) - always set for bot games
        // If user is white, they need to make the first move
        // If user is black, bot needs to make the first move
        if (firstMoveTimeoutRef.current) {
          clearTimeout(firstMoveTimeoutRef.current)
        }
        // Capture gameId at the time timeout is set
        const capturedGameId = gameId
        firstMoveTimeoutRef.current = setTimeout(() => {
          const currentGameId = userCurrentGameRef.current || capturedGameId
          if (rtdb && currentGameId) {
            const gameRef = ref(rtdb, `arena/games/${currentGameId}`)
            get(gameRef).then((snapshot) => {
              if (snapshot.exists()) {
                const gameData = snapshot.val()
                // If still no moves and game is still active, abort the game
                if (gameData.status === 'active' && (!gameData.moveHistory || gameData.moveHistory.length === 0)) {
                  handleGameEnd('abort')
                }
              }
              firstMoveTimeoutRef.current = null
            }).catch(() => {
              firstMoveTimeoutRef.current = null
            })
          } else {
            firstMoveTimeoutRef.current = null
          }
        }, 20000)
      } catch (error) {
        console.error('[Arena] Error creating game with bot:', error)
      }
    } else {
      // Regular player challenge
      const challengeRef = ref(rtdb, `arena/challenges/${opponentId}`)
      
      try {
        await set(challengeRef, {
          from: userId,
          to: opponentId,
          timestamp: serverTimestamp(),
        })
        
        setCurrentOpponent(opponent)
        setChallengeStatus('challenged')
        setActiveTab('game')
      } catch (error) {
        console.error('[Arena] Error sending challenge:', error)
      }
    }
  }

  const handleAcceptChallenge = async () => {
    if (!rtdb || !user || !pendingChallenge) return

    const userId = user.id
    const opponentId = pendingChallenge.from
    
    try {
      // Remove challenge
      const challengeRef = ref(rtdb, `arena/challenges/${userId}`)
      await set(challengeRef, null)
      
      // Randomly assign white/black colors
      const userIsWhite = Math.random() < 0.5
      const whitePlayer = userIsWhite ? userId : opponentId
      const blackPlayer = userIsWhite ? opponentId : userId
      
      // Create game
      const gameId = `${userId}_${opponentId}_${Date.now()}`
      const gameRef = ref(rtdb, `arena/games/${gameId}`)
      
      // Create game with assigned colors
      const initialTime = 600000 // 10 minutes in milliseconds
      await set(gameRef, {
        player1: whitePlayer,
        player2: blackPlayer,
        whitePlayer,
        blackPlayer,
        status: 'active',
        currentTurn: 'white',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moveHistory: [],
        moveHistoryUci: [],
        whiteTime: initialTime,
        blackTime: initialTime,
        drawOffer: null,
        createdAt: serverTimestamp(),
      })
      
      // Initialize timer and game status
      setWhiteTime(initialTime)
      setBlackTime(initialTime)
      setGameStatus('active')
      setGameResult(null)
      setDrawOffer(null)
      
      // Set game reference for current user
      await set(ref(rtdb, `arena/users/${userId}/currentGame`), gameId)
      
      // Try to set game reference for opponent
      try {
        await set(ref(rtdb, `arena/users/${opponentId}/currentGame`), gameId)
      } catch (opponentError) {
        console.warn('[Arena] Could not set currentGame for opponent (this is expected):', opponentError)
      }
      
      // Set colors and board orientation (board orientation = user color, so black players see board flipped)
      const userColorValue = userIsWhite ? 'white' : 'black'
      const opponentColorValue = userIsWhite ? 'black' : 'white'
      setUserColor(userColorValue)
      setOpponentColor(opponentColorValue)
      setBoardOrientation(userColorValue) // Board orientation matches user color
      
      // Initialize current turn ref
      currentTurnRef.current = 'white'
      
      // Initialize game
      const newGame = new Chess()
      setGame(newGame)
      setMoveHistory([])
      setMoveHistoryUci([])
      setGameStarted(true) // Start game immediately
      setSelectedSquare(null)
      setLastMove(null)
      setViewingMoveIndex(null)
      setShowPromotionDialog(false)
      setPromotionToSquare(null)
      promotionSourceSquareRef.current = null
      promotionTargetSquareRef.current = null
      
      setChallengeStatus('in_game')
      setPendingChallenge(null)
      // Switch to game tab when game starts
      setActiveTab('game')
      
      // Set timeout for first move (20 seconds)
      if (firstMoveTimeoutRef.current) {
        clearTimeout(firstMoveTimeoutRef.current)
      }
      // Capture gameId at the time timeout is set
      const capturedGameId = gameId
      firstMoveTimeoutRef.current = setTimeout(() => {
        // Check if first move has been made
        const currentGameId = userCurrentGameRef.current || capturedGameId
        if (rtdb && currentGameId) {
          const gameRef = ref(rtdb, `arena/games/${currentGameId}`)
          get(gameRef).then((snapshot) => {
            if (snapshot.exists()) {
              const gameData = snapshot.val()
              // If no moves have been made, abort the game
              if (!gameData.moveHistory || gameData.moveHistory.length === 0) {
                handleGameEnd('abort')
              }
            }
            firstMoveTimeoutRef.current = null
          }).catch(() => {
            firstMoveTimeoutRef.current = null
          })
        } else {
          firstMoveTimeoutRef.current = null
        }
      }, 20000) // 20 seconds
    } catch (error) {
      console.error('[Arena] Error accepting challenge:', error)
    }
  }

  const handleDeclineChallenge = async () => {
    if (!rtdb || !user || !pendingChallenge) return

    const userId = user.id
    const challengeRef = ref(rtdb, `arena/challenges/${userId}`)
    
    try {
      await set(challengeRef, null)
      setPendingChallenge(null)
      setChallengeStatus('idle')
      setCurrentOpponent(null)
      setActiveTab('challenge')
    } catch (error) {
      console.error('[Arena] Error declining challenge:', error)
    }
  }

  const handleCancelChallenge = async () => {
    if (!rtdb || !user || !currentOpponent) return

    const opponentId = currentOpponent.id
    const challengeRef = ref(rtdb, `arena/challenges/${opponentId}`)
    
    try {
      await set(challengeRef, null)
      setCurrentOpponent(null)
      setChallengeStatus('idle')
      setActiveTab('challenge')
    } catch (error) {
      console.error('[Arena] Error canceling challenge:', error)
    }
  }

  // Handle move for multiplayer (both players are human)
  const handleMove = (sourceSquare, targetSquare, promotion) => {
    if (!game || !rtdb || !user || !userCurrentGame) return false
    
    const currentGame = new Chess(game.fen())
    if (currentGame.isGameOver()) return false

    // Check if it's the user's turn based on local game state
    // We'll verify with Firebase, but check locally first
    // This is a basic check - the real-time listener will handle turn validation
    
    // Check if move is valid
    const moves = currentGame.moves({ square: sourceSquare, verbose: true })
    const isValidSquare = moves.some((m) => m.to === targetSquare)
    
    if (!isValidSquare) {
      return false
    }

    // Check if this is a pawn promotion move
    const piece = currentGame.get(sourceSquare)
    const isPawn = piece?.type === 'p'
    const rank = parseInt(targetSquare[1])
    const isPromotionMove = isPawn && (
      (currentGame.turn() === 'w' && rank === 8) || 
      (currentGame.turn() === 'b' && rank === 1)
    )

    if (isPromotionMove && !promotion) {
      if (!promotionSourceSquareRef.current || !promotionTargetSquareRef.current) {
        promotionSourceSquareRef.current = sourceSquare
        promotionTargetSquareRef.current = targetSquare
      }
      return false
    }

    let move
    try {
      if (isPromotionMove && promotion) {
        move = currentGame.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: promotion,
        })
      } else {
        move = currentGame.move({
          from: sourceSquare,
          to: targetSquare,
        })
      }
    } catch (e) {
      return false
    }

    if (!move) {
      return false
    }


    // Start game on first move
    if (!gameStarted) {
      setGameStarted(true)
    }

    // Clear first move timeout and warning if this is the first move
    if (moveHistory.length === 0) {
      if (firstMoveTimeoutRef.current) {
        clearTimeout(firstMoveTimeoutRef.current)
        firstMoveTimeoutRef.current = null
      }
      setShowFirstMoveWarning(false)
      setFirstMoveCountdown(20)
      if (firstMoveCountdownIntervalRef.current) {
        clearInterval(firstMoveCountdownIntervalRef.current)
        firstMoveCountdownIntervalRef.current = null
      }
    }

    const promotionChar = move.promotion ? move.promotion.toLowerCase() : ''
    const uciMove = sourceSquare + targetSquare + promotionChar
    
    // Update local state
    setLastMove({ from: sourceSquare, to: targetSquare })
    setGame(currentGame)
    const newMoveHistory = [...moveHistory, move.san]
    const newMoveHistoryUci = [...moveHistoryUci, uciMove]
    setMoveHistory(newMoveHistory)
    setMoveHistoryUci(newMoveHistoryUci)
    setSelectedSquare(null)
    promotionSourceSquareRef.current = null
    promotionTargetSquareRef.current = null
    
    // Sync to Firebase RTDB asynchronously
    const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
    get(gameRef).then((gameSnapshot) => {
      if (!gameSnapshot.exists()) return
      
      const gameData = gameSnapshot.val()
      const userId = user.id
      const isUserWhite = gameData.whitePlayer === userId
      const currentTurn = gameData.currentTurn || 'white'
      const isUserTurn = (isUserWhite && currentTurn === 'white') || (!isUserWhite && currentTurn === 'black')
      
      if (!isUserTurn) {
        // Not user's turn, revert local state
        const revertedGame = new Chess(game.fen())
        setGame(revertedGame)
        setMoveHistory(moveHistory)
        setMoveHistoryUci(moveHistoryUci)
        setLastMove(lastMove)
        return
      }
      
      // Sync move to Firebase
      const nextTurn = currentGame.turn() === 'w' ? 'white' : 'black'
      
      // Update timer - add time increment (e.g., 2 seconds per move) when move is made
      const timeIncrement = 2000 // 2 seconds per move
      const updatedWhiteTime = currentGame.turn() === 'b' ? whiteTime + timeIncrement : whiteTime
      const updatedBlackTime = currentGame.turn() === 'w' ? blackTime + timeIncrement : blackTime
      
      // Check for game end conditions
      let updatedStatus = gameData.status || 'active'
      let updatedWinner = null
      let updatedResultReason = null
      
      if (currentGame.isCheckmate()) {
        updatedStatus = 'checkmate'
        updatedWinner = currentGame.turn() === 'w' ? 'black' : 'white'
        updatedResultReason = 'checkmate'
        // Immediately update gameStatus and stop bot move effect if this is a bot game
        setGameStatus('checkmate')
        setGameResult({ winner: updatedWinner, reason: updatedResultReason })
        if (currentBotId) {
          botMoveScheduledRef.current = false
          setIsBotThinking(false)
          // Stop timer immediately
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current)
            timerIntervalRef.current = null
          }
        }
      } else if (currentGame.isStalemate()) {
        updatedStatus = 'stalemate'
        updatedResultReason = 'stalemate'
        // Immediately update gameStatus and stop bot move effect if this is a bot game
        setGameStatus('stalemate')
        setGameResult({ winner: null, reason: updatedResultReason })
        if (currentBotId) {
          botMoveScheduledRef.current = false
          setIsBotThinking(false)
          // Stop timer immediately
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current)
            timerIntervalRef.current = null
          }
        }
      } else if (currentGame.isDraw()) {
        updatedStatus = 'draw'
        updatedResultReason = 'draw'
        // Immediately update gameStatus and stop bot move effect if this is a bot game
        setGameStatus('draw')
        setGameResult({ winner: null, reason: updatedResultReason })
        if (currentBotId) {
          botMoveScheduledRef.current = false
          setIsBotThinking(false)
          // Stop timer immediately
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current)
            timerIntervalRef.current = null
          }
        }
      }
      
      set(gameRef, {
        ...gameData,
        fen: currentGame.fen(),
        moveHistory: newMoveHistory,
        moveHistoryUci: newMoveHistoryUci,
        currentTurn: nextTurn,
        lastMove,
        whiteTime: updatedWhiteTime,
        blackTime: updatedBlackTime,
        status: updatedStatus,
        winner: updatedWinner,
        resultReason: updatedResultReason,
        updatedAt: serverTimestamp(),
      }).then(async () => {
        // Re-fetch to get the actual server timestamp
        try {
          const updatedSnapshot = await get(gameRef)
          if (updatedSnapshot.exists()) {
            const updatedData = updatedSnapshot.val()
            if (updatedData.updatedAt && typeof updatedData.updatedAt === 'number') {
              const serverTime = updatedData.updatedAt
              const localTime = Date.now()
              dbTimeOffsetRef.current = serverTime - localTime
              lastMoveTimestampRef.current = serverTime
            }
          }
        } catch (error) {
          // If re-fetch fails, estimate based on current time
          const estimatedServerTime = Date.now()
          dbTimeOffsetRef.current = 0 // Assume no offset if we can't determine
          lastMoveTimestampRef.current = estimatedServerTime
        }
        // Update local timer state
        setWhiteTime(updatedWhiteTime)
        setBlackTime(updatedBlackTime)
        
        // If game ended, trigger handleGameEnd (game state listener will also detect it, but this ensures it's called)
        if (updatedStatus !== 'active') {
          if (updatedStatus === 'checkmate') {
            handleGameEnd('checkmate', updatedWinner || undefined)
          } else if (updatedStatus === 'stalemate') {
            handleGameEnd('stalemate')
          } else if (updatedStatus === 'draw') {
            handleGameEnd('draw')
          }
        }
      }).catch((error) => {
        console.error('[Arena] Error syncing move to Firebase:', error)
      })
    }).catch((error) => {
      console.error('[Arena] Error checking game state:', error)
    })
    
    return true
  }

  const handleSquareClick = (square) => {
    if (!game) return
    if (viewingMoveIndex !== null) return

    const currentGame = new Chess(displayedPosition || game.fen())
    if (currentGame.isGameOver()) return
    
    // Check if it's the user's turn
    if (!user || !userCurrentGame || !rtdb) return
    
    // Verify it's the user's turn (basic check - will be validated in handleMove)
    const currentTurn = currentGame.turn()
    // We'll do a quick check - if the piece color doesn't match current turn, don't proceed
    const piece = currentGame.get(square)
    if (selectedSquare === null && piece && piece.color !== currentTurn) {
      return // Can't select opponent's piece
    }

    if (selectedSquare === square) {
      setSelectedSquare(null)
    } else if (selectedSquare) {
      // Check if this is a promotion move
      const selectedPiece = currentGame.get(selectedSquare)
      const isPawn = selectedPiece?.type === 'p'
      const rank = parseInt(square[1])
      const isPromotionMove = isPawn && (
        (currentGame.turn() === 'w' && rank === 8) || 
        (currentGame.turn() === 'b' && rank === 1)
      )
      
      // For promotion moves, trigger the dialog manually (only if it's user's turn)
      if (isPromotionMove && selectedPiece?.color === currentTurn) {
        promotionSourceSquareRef.current = selectedSquare
        promotionTargetSquareRef.current = square
        setPromotionToSquare(square)
        setShowPromotionDialog(true)
        setSelectedSquare(null)
      } else {
        // Try to make a move using handleMove (which safely returns false if invalid)
        const success = handleMove(selectedSquare, square)
        if (!success) {
          // If move failed, check if clicked square has a piece of current turn and select it
          const piece = currentGame.get(square)
          const currentTurn = currentGame.turn()
          if (piece && piece.color === currentTurn) {
            setSelectedSquare(square)
          } else {
            setSelectedSquare(null)
          }
        }
      }
    } else {
      const piece = currentGame.get(square)
      const currentTurn = currentGame.turn()
      if (piece && piece.color === currentTurn) {
        setSelectedSquare(square)
      }
    }
  }

  const handlePromotionCheck = (sourceSquare, targetSquare, piece) => {
    // Don't trigger promotion if viewing move history
    if (viewingMoveIndex !== null) {
      return false
    }
    
    // Don't trigger promotion if game hasn't started or no moves have been made
    if (!gameStarted || moveHistory.length === 0) {
      return false
    }
    
    // Don't trigger promotion if it's not the user's turn
    if (!game || !user || !userCurrentGame || !rtdb) {
      return false
    }
    
    const currentGame = new Chess(game.fen())
    const currentTurn = currentGame.turn()
    const pieceColor = piece[0] === 'w' ? 'w' : 'b'
    
    // Only trigger if it's the user's turn and the piece matches the current turn
    if (pieceColor !== currentTurn) {
      return false
    }
    
    const rank = parseInt(targetSquare[1])
    const isPromotion = (piece === 'wP' && rank === 8) || (piece === 'bP' && rank === 1)
    
    if (isPromotion) {
      promotionSourceSquareRef.current = sourceSquare
      promotionTargetSquareRef.current = targetSquare
      setShowPromotionDialog(true)
      setPromotionToSquare(targetSquare)
    }
    
    return isPromotion
  }

  const handlePromotionPieceSelect = (piece) => {
    if (!piece) {
      setShowPromotionDialog(false)
      setPromotionToSquare(null)
      return false
    }
    if (promotionSourceSquareRef.current && promotionTargetSquareRef.current) {
      const pieceType = piece.length > 1 ? piece[1].toLowerCase() : piece.toLowerCase()
      const validPromotion = ['q', 'r', 'b', 'n'].includes(pieceType) ? pieceType : 'q'
      
      const sourceSquare = promotionSourceSquareRef.current
      const targetSquare = promotionTargetSquareRef.current
      
      promotionSourceSquareRef.current = null
      promotionTargetSquareRef.current = null
      
      setShowPromotionDialog(false)
      setPromotionToSquare(null)
      
      handleMove(sourceSquare, targetSquare, validPromotion)
      return true
    }
    setShowPromotionDialog(false)
    setPromotionToSquare(null)
    return false
  }


  // Format time in MM:SS format
  const formatTime = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Handle game end (win, lose, draw, resign, timeout, abort)
  const handleGameEnd = async (reason, winner) => {
    if (!rtdb || !user || !userCurrentGame || !game) return
    
    // Prevent duplicate calls
    if (gameEndingRef.current) return
    gameEndingRef.current = true

    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    // Clear abort timeout if game is ending
    if (abortTimeoutRef.current) {
      clearTimeout(abortTimeoutRef.current)
      abortTimeoutRef.current = null
    }
    
    // Clear first move timeout and warning if game is ending
    if (firstMoveTimeoutRef.current) {
      clearTimeout(firstMoveTimeoutRef.current)
      firstMoveTimeoutRef.current = null
    }
    setShowFirstMoveWarning(false)
    setFirstMoveCountdown(20)
    if (firstMoveCountdownIntervalRef.current) {
      clearInterval(firstMoveCountdownIntervalRef.current)
      firstMoveCountdownIntervalRef.current = null
    }

    const userId = user.id
    const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
    
    try {
      const gameSnapshot = await get(gameRef)
      if (!gameSnapshot.exists()) return

      const gameData = gameSnapshot.val()
      const isUserWhite = gameData.whitePlayer === userId
      
      let finalStatus = 'draw'
      let finalWinner = null
      let resultReason = reason

      if (reason === 'checkmate') {
        finalStatus = 'checkmate'
        finalWinner = winner || (isUserWhite ? 'black' : 'white')
      } else if (reason === 'stalemate') {
        finalStatus = 'stalemate'
        finalWinner = null
      } else if (reason === 'draw') {
        finalStatus = 'draw'
        finalWinner = null
      } else if (reason === 'resign') {
        finalStatus = 'resigned'
        finalWinner = isUserWhite ? 'black' : 'white'
      } else if (reason === 'timeout') {
        finalStatus = 'timeout'
        finalWinner = winner || (isUserWhite ? 'black' : 'white')
      } else if (reason === 'abort') {
        finalStatus = 'aborted'
        finalWinner = null
      }

      // Update game status in Firebase
      await set(gameRef, {
        ...gameData,
        status: finalStatus,
        winner: finalWinner,
        resultReason,
        endedAt: serverTimestamp(),
      })

      // Clear current game references
      await set(ref(rtdb, `arena/users/${userId}/currentGame`), null)
      
      // Clear bot game reference if this was a bot game
      if (gameData.botId) {
        try {
          await set(ref(rtdb, `arena/bots/${gameData.botId}/currentGame`), null)
        } catch (e) {
          // Ignore errors
        }
        setCurrentBotId(null)
      } else {
        // Try to clear opponent's game reference (for human players)
        const opponentId = isUserWhite ? gameData.blackPlayer : gameData.whitePlayer
        if (opponentId) {
          try {
            await set(ref(rtdb, `arena/users/${opponentId}/currentGame`), null)
          } catch (e) {
            // Ignore errors
          }
        }
      }

      // Update local state - keep board visible, only update challenge status after 10 seconds
      setGameStatus(finalStatus)
      setGameResult({ winner: finalWinner, reason: resultReason })
      setDrawOffer(null)
      // Keep currentOpponent for display purposes
      // Don't clear game state - keep board visible
      
      // Clear any existing timeout
      if (showAvailablePlayersTimeoutRef.current) {
        clearTimeout(showAvailablePlayersTimeoutRef.current)
      }
      
      // Set challenge status to 'idle' after 10 seconds to show available players
      showAvailablePlayersTimeoutRef.current = setTimeout(() => {
        setChallengeStatus('idle') // Make user available for challenges after delay
        showAvailablePlayersTimeoutRef.current = null
      }, 10000) // 10 seconds delay
    } catch (error) {
      console.error('[Arena] Error ending game:', error)
    } finally {
      // Reset the flag after a short delay to allow for cleanup
      setTimeout(() => {
        gameEndingRef.current = false
      }, 1000)
    }
  }

  // Handle resign
  const handleResign = async () => {
    if (!rtdb || !user || !userCurrentGame || !game) return
    if (gameStatus !== 'active') return

    await handleGameEnd('resign')
  }

  // Handle draw offer
  const handleOfferDraw = async () => {
    if (!rtdb || !user || !userCurrentGame || !currentOpponent) return
    if (gameStatus !== 'active') return

    const userId = user.id
    const opponentId = currentOpponent.id
    
    try {
      const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
      const gameData = (await get(gameRef)).val()
      await set(gameRef, {
        ...gameData,
        drawOffer: null,
      })
      setDrawOffer({ from: userId, to: opponentId })
    } catch (error) {
      console.error('[Arena] Error offering draw:', error)
    }
  }

  // Handle accept draw
  const handleAcceptDraw = async () => {
    if (!rtdb || !user || !userCurrentGame || !drawOffer) return

    await handleGameEnd('draw')
  }

  // Handle decline draw
  const handleDeclineDraw = async () => {
    if (!rtdb || !user || !userCurrentGame) return

    try {
      const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
      const gameData = (await get(gameRef)).val()
      await set(gameRef, {
        ...gameData,
        drawOffer: null,
      })
      setDrawOffer(null)
    } catch (error) {
      console.error('[Arena] Error declining draw:', error)
    }
  }

  // Timer effect - decrement time for current player (synchronized with database)
  useEffect(() => {
    // Don't start timer until first move has been made
    if (!gameStarted || !game || !userCurrentGame || gameStatus !== 'active' || moveHistory.length === 0) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      return
    }

    const currentGame = new Chess(game.fen())
    if (currentGame.isGameOver()) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      return
    }
    
    // Sync timer with database periodically (every 5 seconds) - only after first move
    const syncTimer = setInterval(async () => {
      if (!rtdb || !userCurrentGame || moveHistory.length === 0) return
      
      try {
        const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
        const gameSnapshot = await get(gameRef)
        if (!gameSnapshot.exists()) return
        
        const gameData = gameSnapshot.val()
        if (gameData.whiteTime !== undefined && gameData.blackTime !== undefined && gameData.updatedAt && typeof gameData.updatedAt === 'number') {
          // Calculate elapsed time since last move
          // Simply calculate elapsed time as local time minus server time
          const currentLocalTime = Date.now()
          const elapsedTime = Math.max(0, currentLocalTime - gameData.updatedAt)
          
          // Update offset for future calculations
          dbTimeOffsetRef.current = gameData.updatedAt - currentLocalTime
          
          const currentTurn = gameData.currentTurn || 'white'
          let updatedWhiteTime = gameData.whiteTime
          let updatedBlackTime = gameData.blackTime
          
          if (currentTurn === 'white') {
            updatedWhiteTime = Math.max(0, gameData.whiteTime - elapsedTime)
          } else {
            updatedBlackTime = Math.max(0, gameData.blackTime - elapsedTime)
          }
          
          setWhiteTime(updatedWhiteTime)
          setBlackTime(updatedBlackTime)
        }
      } catch (error) {
        console.error('[Arena] Error syncing timer:', error)
      }
    }, 5000) // Sync every 5 seconds
    
    // Local countdown timer (updates every second)
    // Use currentTurnRef which is updated by the game state listener
    timerIntervalRef.current = setInterval(() => {
      const currentTurn = currentTurnRef.current
      
      if (currentTurn === 'white') {
        setWhiteTime(prev => {
          const newTime = prev - 1000
          if (newTime <= 0) {
            // Timeout - end game
            handleGameEnd('timeout', 'black')
            return 0
          }
          return newTime
        })
      } else {
        setBlackTime(prev => {
          const newTime = prev - 1000
          if (newTime <= 0) {
            // Timeout - end game
            handleGameEnd('timeout', 'white')
            return 0
          }
          return newTime
        })
      }
    }, 1000)

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      clearInterval(syncTimer)
    }
  }, [game, gameStarted, userCurrentGame, gameStatus, rtdb, moveHistory])

  // First move countdown timer
  useEffect(() => {
    if (showFirstMoveWarning && userColor === 'white' && gameStatus === 'active' && moveHistory.length === 0) {
      // Reset countdown to 20 seconds when warning appears
      setFirstMoveCountdown(20)
      
      // Start countdown interval
      firstMoveCountdownIntervalRef.current = setInterval(() => {
        setFirstMoveCountdown((prev) => {
          if (prev <= 1) {
            // Countdown reached 0, clear interval
            if (firstMoveCountdownIntervalRef.current) {
              clearInterval(firstMoveCountdownIntervalRef.current)
              firstMoveCountdownIntervalRef.current = null
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      // Clear interval when warning is hidden
      if (firstMoveCountdownIntervalRef.current) {
        clearInterval(firstMoveCountdownIntervalRef.current)
        firstMoveCountdownIntervalRef.current = null
      }
    }

    return () => {
      if (firstMoveCountdownIntervalRef.current) {
        clearInterval(firstMoveCountdownIntervalRef.current)
        firstMoveCountdownIntervalRef.current = null
      }
    }
  }, [showFirstMoveWarning, userColor, gameStatus, moveHistory])

  // Clear game state when user switches away from game tab after game ended
  useEffect(() => {
    // If user switches FROM 'game' tab TO another tab and game has ended, clear game state
    if (previousTabRef.current === 'game' && activeTab !== 'game' && gameResult && userCurrentGame) {
      // Clear game state
      if (rtdb && user) {
        const userId = user.id
        // Clear currentGame reference in Firebase
        set(ref(rtdb, `arena/users/${userId}/currentGame`), null).catch((error) => {
          console.error('[Arena] Error clearing currentGame:', error)
        })
      }
      
      // Clear local state
      setUserCurrentGame(null)
      setGameResult(null)
      setCurrentOpponent(null)
      setChallengeStatus('idle')
      setGameStatus(null)
      setGame(null)
      setGameStarted(false)
      setMoveHistory([])
      setMoveHistoryUci([])
      setLastMove(null)
      setViewingMoveIndex(null)
      setDrawOffer(null)
      setUserColor(null)
      setOpponentColor(null)
      setWhiteTime(600000)
      setBlackTime(600000)
      setCurrentBotId(null)
      setIsBotThinking(false)
      
      // Clear any pending timeouts
      if (showAvailablePlayersTimeoutRef.current) {
        clearTimeout(showAvailablePlayersTimeoutRef.current)
        showAvailablePlayersTimeoutRef.current = null
      }
    }
    
    // Update previous tab ref
    previousTabRef.current = activeTab
  }, [activeTab, gameResult, userCurrentGame, rtdb, user])

  // Fetch and update arena rankings in real-time (calculated from games)
  useEffect(() => {
    if (!rtdb || !isFullscreen) return

    const gamesRef = ref(rtdb, 'arena/games')
    
    const unsubscribe = onValue(gamesRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setArenaRankings([])
        return
      }

      const gamesData = snapshot.val()
      const games = Object.values(gamesData)
      
      // Calculate stats from games
      const statsMap = calculateStatsFromGames(games)
      
      if (statsMap.size === 0) {
        setArenaRankings([])
        return
      }

      // Fetch user info for each player with stats (including bots)
      const userIds = Array.from(statsMap.keys())
      const playerPromises = userIds.map(async (userId) => {
        const stats = statsMap.get(userId)
        
        // Check if this is a bot
        if (userId.startsWith('bot_')) {
          const botId = userId.replace('bot_', '')
          const bot = botsData.find(b => b.id === botId)
          
          if (bot) {
            return {
              id: userId,
              name: t(`bots.${bot.id}.name`) || bot.name,
              rating: stats.points,
              wins: stats.wins,
              losses: stats.losses,
              draws: stats.draws,
              winRate: stats.winRate,
              isBot: true,
              botId: bot.id,
              avatar_url: bot.icon,
            }
          } else {
            // Bot not found, still include with basic info
            return {
              id: userId,
              name: 'Bot',
              rating: stats.points,
              wins: stats.wins,
              losses: stats.losses,
              draws: stats.draws,
              winRate: stats.winRate,
              isBot: true,
            }
          }
        }
        
        // Regular user - fetch user data
        try {
          const userData = await api.getUser(userId)
          if (!userData) return null

          const name = userData.chesscom_username || userData.name || userData.email?.split('@')[0] || 'Player'
          
          return {
            id: userId,
            name,
            rating: stats.points,
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws,
            winRate: stats.winRate,
            isBot: false,
          }
        } catch (error) {
          // If user fetch fails, still include with basic info
          return {
            id: userId,
            name: 'Player',
            rating: stats.points,
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws,
            winRate: stats.winRate,
            isBot: false,
          }
        }
      })

      const players = await Promise.all(playerPromises)
      const validPlayers = players.filter(p => p !== null)

      // Sort by points (descending), then by wins, then by winRate
      validPlayers.sort((a, b) => {
        if (b.rating !== a.rating) {
          return b.rating - a.rating
        }
        if (b.wins !== a.wins) {
          return b.wins - a.wins
        }
        return b.winRate - a.winRate
      })

      // Assign ranks - players with same points get same rank
      const rankedPlayers = validPlayers.map((player, index) => {
        let rank = index + 1
        
        // If this player has the same points as the previous player, they share the same rank
        if (index > 0 && validPlayers[index - 1].rating === player.rating) {
          // Find the first player in the sequence with the same points
          for (let i = index - 1; i >= 0; i--) {
            if (validPlayers[i].rating === player.rating) {
              rank = i + 1 // Use the rank of the first player with same points
            } else {
              break
            }
          }
        }
        
        return {
          ...player,
          rank,
        }
      })

      setArenaRankings(rankedPlayers)
    }, (error) => {
      console.error('[Arena] Error fetching rankings:', error)
      setArenaRankings([])
    })

    return () => {
      unsubscribe()
    }
  }, [rtdb, isFullscreen])

  // Fetch and update user's arena stats in real-time (calculated from games)
  useEffect(() => {
    if (!rtdb || !user || !isFullscreen) {
      setUserArenaStats(null)
      return
    }

    const userId = user.id
    const gamesRef = ref(rtdb, 'arena/games')
    
    const unsubscribe = onValue(gamesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setUserArenaStats(null)
        return
      }

      const gamesData = snapshot.val()
      const games = Object.values(gamesData)
      
      // Calculate stats from games
      const statsMap = calculateStatsFromGames(games)
      const userStats = statsMap.get(userId)
      
      if (!userStats) {
        setUserArenaStats(null)
        return
      }

      setUserArenaStats(() => {
        // Get user's rank from current arenaRankings state (uses rank property which handles ties)
        const userRanking = arenaRankings.find(p => p.id === userId)
        const userRank = userRanking?.rank || (arenaRankings.length > 0 ? arenaRankings.length + 1 : 1)
        
        return {
          wins: userStats.wins,
          losses: userStats.losses,
          draws: userStats.draws,
          winRate: userStats.winRate,
          rating: userStats.points,
          rank: userRank,
        }
      })
    }, (error) => {
      console.error('[Arena] Error fetching user stats:', error)
      setUserArenaStats(null)
    })

    return () => {
      unsubscribe()
    }
  }, [rtdb, user, isFullscreen, arenaRankings])

  // Update user's rank when rankings change
  useEffect(() => {
    if (!user || !userArenaStats) return

    const userId = user.id
    const userRanking = arenaRankings.find(p => p.id === userId)
    const userRank = userRanking?.rank || (arenaRankings.length > 0 ? arenaRankings.length + 1 : 1)
    
    if (userRanking && userArenaStats.rank !== userRank) {
      setUserArenaStats((prevStats) => {
        if (!prevStats) return null
        return {
          ...prevStats,
          rank: userRank,
        }
      })
    }
  }, [arenaRankings, user, userArenaStats])

  // Get king square for checkmate/stalemate indicator
  const getKingSquare = (game, color) => {
    const board = game.board()
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file]
        if (piece && piece.type === 'k' && piece.color === color) {
          const fileChar = String.fromCharCode(97 + file)
          const rankNum = 8 - rank
          return `${fileChar}${rankNum}`
        }
      }
    }
    return null
  }

  // Calculate displayed position based on viewingMoveIndex
  const displayedPosition = useMemo(() => {
    if (!game) return null
    if (viewingMoveIndex === null) return game.fen()
    
    const tempGame = new Chess()
    for (let i = 0; i <= viewingMoveIndex && i < moveHistoryUci.length; i++) {
      const uciMove = moveHistoryUci[i]
      if (uciMove) {
        const from = uciMove.substring(0, 2)
        const to = uciMove.substring(2, 4)
        const promotion = uciMove.length > 4 ? uciMove[4].toLowerCase() : undefined
        try {
          tempGame.move({
            from,
            to,
            promotion: promotion || undefined,
          })
        } catch (e) {
          // Ignore errors
        }
      }
    }
    return tempGame.fen()
  }, [game, viewingMoveIndex, moveHistoryUci])

  const displayedLastMove = useMemo(() => {
    if (viewingMoveIndex === null && lastMove) {
      return lastMove
    }
    if (viewingMoveIndex !== null && viewingMoveIndex >= 0 && moveHistoryUci[viewingMoveIndex]) {
      const uciMove = moveHistoryUci[viewingMoveIndex]
      return {
        from: uciMove.substring(0, 2),
        to: uciMove.substring(2, 4)
      }
    }
    return null
  }, [lastMove, viewingMoveIndex, moveHistoryUci])

  // Returns pieces with color info], black: [{piece: 'p', color: 'white'}] }
  const capturedPieces = useMemo(() => {
    if (!game) return { white: [], black: [] }
    
    const captured = { white: [], black: [] }
    
    // Build a game from the start and replay moves up to the displayed position
    const tempGame = new Chess()
    const movesToReplay = viewingMoveIndex !== null 
      ? moveHistoryUci.slice(0, viewingMoveIndex + 1)
      : moveHistoryUci
    
    // Replay moves to get accurate capture information
    for (const uciMove of movesToReplay) {
      if (uciMove) {
        const from = uciMove.substring(0, 2)
        const to = uciMove.substring(2, 4)
        const promotion = uciMove.length > 4 ? uciMove[4].toLowerCase() : undefined
        let move
        try {
          move = tempGame.move({ 
            from: from, 
            to: to, 
            promotion: promotion 
          })
          if (!move) {
            break
          }
        } catch (e) {
          break
        }
        
        if (move && move.captured) {
          // The color that made the move captured the piece
          const capturingColor = move.color === 'w' ? 'white' : 'black'
          // The captured piece is the opposite color of the capturing player
          const capturedPieceColor = move.color === 'w' ? 'black' : 'white'
          captured[capturingColor].push({ piece: move.captured, color: capturedPieceColor })
        }
      }
    }
    
    // Group pieces by type and color, then sort
    const pieceOrder = { q: 0, r: 1, b: 2, n: 3, p: 4 }
    
    // Group white's captured pieces
    const whiteGrouped = []
    const whiteCounts = {}
    captured.white.forEach(p => {
      const key = `${p.piece}-${p.color}`
      whiteCounts[key] = (whiteCounts[key] || 0) + 1
    })
    Object.entries(whiteCounts).forEach(([key, count]) => {
      const [piece, color] = key.split('-')
      whiteGrouped.push({ piece, color: color, count })
    })
    whiteGrouped.sort((a, b) => (pieceOrder[a.piece] || 5) - (pieceOrder[b.piece] || 5))
    
    // Group black's captured pieces
    const blackGrouped = []
    const blackCounts = {}
    captured.black.forEach(p => {
      const key = `${p.piece}-${p.color}`
      blackCounts[key] = (blackCounts[key] || 0) + 1
    })
    Object.entries(blackCounts).forEach(([key, count]) => {
      const [piece, color] = key.split('-')
      blackGrouped.push({ piece, color: color, count })
    })
    blackGrouped.sort((a, b) => (pieceOrder[a.piece] || 5) - (pieceOrder[b.piece] || 5))
    
    return { white: whiteGrouped, black: blackGrouped }
  }, [game, moveHistoryUci, viewingMoveIndex])

  // Calculate material advantage
  const materialAdvantage = useMemo(() => {
    if (!capturedPieces) return 0
    
    const pieceValues = { q: 9, r: 5, b: 3, n: 3, p: 1 }
    
    let whiteValue = 0
    let blackValue = 0
    
    capturedPieces.white.forEach(p => {
      whiteValue += pieceValues[p.piece] * p.count
    })
    
    capturedPieces.black.forEach(p => {
      blackValue += pieceValues[p.piece] * p.count
    })
    
    // Positive = white advantage, Negative = black advantage
    return whiteValue - blackValue
  }, [capturedPieces])

  // Get square styles for highlighting
  const getSquareStyles = () => {
    const styles = {}
    
    if (!displayedPosition) return styles
    
    const currentGame = new Chess(displayedPosition)
    const isInCheck = currentGame.inCheck()
    const isCheckmate = currentGame.isCheckmate()
    const isStalemate = currentGame.isStalemate()
    
    if (isInCheck && !isCheckmate) {
      const turn = currentGame.turn()
      for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
          const square = String.fromCharCode(97 + file) + (8 - rank)
          const piece = currentGame.get(square)
          if (piece && piece.type === 'k' && piece.color === turn) {
            styles[square] = {
              background: 'rgba(239, 68, 68, 0.6)',
              boxShadow: 'inset 0 0 0 2px rgba(239, 68, 68, 0.8)'
            }
            break
          }
        }
      }
    }
    
    if (isCheckmate || isStalemate) {
      const turn = currentGame.turn()
      const kingSquare = getKingSquare(currentGame, turn)
      if (kingSquare) {
        styles[kingSquare] = {
          ...styles[kingSquare],
          background: isCheckmate ? 'rgba(239, 68, 68, 0.6)' : 'rgba(156, 163, 175, 0.6)',
          boxShadow: isCheckmate 
            ? 'inset 0 0 0 2px rgba(239, 68, 68, 0.8)' 
            : 'inset 0 0 0 2px rgba(156, 163, 175, 0.8)'
        }
      }
    }
    
    if (displayedLastMove && !isInCheck) {
      styles[displayedLastMove.from] = {
        background: 'rgba(255, 238, 88, 0.35)'
      }
      styles[displayedLastMove.to] = {
        background: 'rgba(255, 238, 88, 0.35)'
      }
    }
    
    // Show available moves for selected square (click) or dragged square (drag)
    const activeSquare = draggedSquare || selectedSquare
    if (activeSquare) {
      styles[activeSquare] = {
        background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.3) 40%, transparent 40%)',
        boxShadow: 'inset 0 0 0 2px rgba(186, 186, 186, 0.8)'
      }
      
      const validMoves = currentGame.moves({ square: activeSquare, verbose: true }) || []
      validMoves.forEach((move) => {
        const targetSquare = move.to
        const pieceOnTarget = currentGame.get(targetSquare)
        
        if (pieceOnTarget) {
          styles[targetSquare] = {
            boxShadow: 'inset 0 0 0 4px rgba(255, 255, 255, 0.6)',
            borderRadius: '50%'
          }
        } else {
          styles[targetSquare] = {
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.5) 30%, transparent 18%)',
            borderRadius: '50%'
          }
        }
      })
    }
    
    return styles
  }

  const goToFirstMove = () => {
    if (!game || moveHistory.length === 0) return
    setViewingMoveIndex(0)
  }

  const goToPreviousMove = () => {
    if (viewingMoveIndex === null || viewingMoveIndex === 0) return
    setViewingMoveIndex(prev => prev !== null ? prev - 1 : null)
  }

  const goToNextMove = () => {
    if (viewingMoveIndex === null || viewingMoveIndex === moveHistory.length - 1) return
    setViewingMoveIndex(prev => prev !== null ? prev + 1 : null)
  }

  const goToLastMove = () => {
    setViewingMoveIndex(null)
  }

  // Get user's display name (prioritize chesscom_username)
  const chesscomUsername = (user)?.chesscom_username
  const displayUsername = chesscomUsername || user?.name || user?.email?.split('@')[0] || 'Guest'
  
  // Get opponent's display name (prioritize chesscom_username)
  const opponentDisplayName = currentOpponent?.name || t('arena.opponent') || 'Opponent'

  if (authLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-[var(--color-bg-active)]/30 border-t-[var(--color-bg-active)] rounded-full animate-spin"></div>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <Container>
      <div className="py-8 sm:py-12 md:py-16">
        {/* Hero Section */}
        <section className="mb-8 sm:mb-10 md:mb-12 text-center">
          <div className="mb-6 sm:mb-8 flex justify-center">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-[var(--color-bg-active)]/20 border border-[var(--color-icon-border)]">
              <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--color-bg-active)]" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[var(--color-text-primary)] mb-4 sm:mb-6">
            {t('arena.title')}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-[var(--color-text-primary)]/80 leading-relaxed px-4 max-w-3xl mx-auto">
            {t('arena.description')}
          </p>
        </section>

        {!user ? (
          <Card className="hover-lift relative overflow-hidden group text-center">
            <div className="absolute right-0 top-0 h-20 w-20 translate-x-10 -translate-y-10 rounded-full bg-[var(--color-bg-active)]/15 blur-2xl"></div>
            <div className="relative px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6 pt-4 sm:pt-5 md:pt-6">
              <div className="flex flex-col items-center gap-4 sm:gap-5 max-w-md mx-auto relative z-10">
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-[var(--color-bg-active)]/20 border border-[var(--color-icon-border)] group-hover:border-[var(--color-bg-active)]/50 transition-colors">
                  <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--color-bg-active)]" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-3 sm:mb-4">
                    {t('arena.signInRequired')}
                  </h2>
                  <p className="text-[var(--color-text-primary)]/70 text-sm sm:text-base md:text-lg leading-relaxed mb-6 sm:mb-8">
                    {t('arena.signInMessage')}
                  </p>
                  <Link to="/login" state={{ from: location.pathname }}>
                    <button className="px-6 py-3 rounded-lg bg-[var(--color-bg-secondary)] backdrop-blur-xl border border-[var(--color-icon-border)] shadow-lg shadow-[var(--color-bg-active)]/20 text-[var(--color-text-primary)] font-semibold transition-all duration-300 hover:border-[var(--color-bg-active)]/50 hover:shadow-[var(--color-bg-active)]/30 hover:bg-[var(--color-bg-active)]/10 w-full sm:w-auto">
                      {t('auth.signIn')}
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <section>
            {/* Arena Status Card - Only show when not in fullscreen */}
            {!isFullscreen && (
              <div className="mb-6 sm:mb-8">
                <div className="relative group">
                  <div className="absolute inset-0 bg-[var(--color-bg-active)]/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                  
                  <Card className="hover-lift relative overflow-hidden border border-[var(--color-border)]">
                    <div className="absolute right-0 top-0 h-20 w-20 translate-x-10 -translate-y-10 rounded-full bg-[var(--color-bg-active)]/15 blur-2xl"></div>
                    
                    <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-0">
                      {/* Left side - Stats */}
                      <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-[var(--color-border)]/50 bg-[var(--color-bg-primary)]">
                        <div className="flex items-start gap-4 mb-6">
                          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-[var(--color-bg-active)] border border-[var(--color-icon-border)] flex-shrink-0 group-hover:border-[var(--color-bg-active)]/50 transition-colors">
                            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-[var(--color-text-light)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs uppercase tracking-wider text-[var(--color-text-primary)]/60 mb-2 font-semibold">
                              {t('arena.playersInArena') || 'Players in Arena'}
                            </p>
                            <div className="flex items-baseline gap-3 flex-wrap">
                              <div className="flex items-baseline gap-2">
                                <p className="text-3xl sm:text-4xl md:text-5xl font-black text-[var(--color-text-primary)] leading-none">
                                  {arenaPlayersCount}
                                </p>
                                <span className="text-xs sm:text-sm md:text-base font-medium text-[var(--color-text-primary)]/50">
                                  / {MAX_ARENA_PLAYERS}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg-active)]/20 border border-[var(--color-bg-active)]">
                                <div className="w-2 h-2 rounded-full bg-[var(--color-bg-active)] animate-pulse"></div>
                                <span className="text-xs font-semibold text-[var(--color-bg-active)]">
                                  {t('arena.activeNow') || 'Active'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)]/60 leading-relaxed">
                          {t('arena.joinDescription') || 'Join competitive matches and test your skills against players and bots from across Bangladesh.'}
                        </p>
                      </div>
                      
                      {/* Right side - Action */}
                      <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center items-center lg:items-start bg-[var(--color-bg-secondary)]">
                        <div className="w-full max-w-xs">
                          <h3 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-3 text-center lg:text-left">
                            {t('arena.readyToBattle') || 'Ready to Battle?'}
                          </h3>
                          <p className="text-sm text-[var(--color-text-primary)]/70 mb-6 text-center lg:text-left">
                            {isArenaFull 
                              ? (t('arena.arenaFullDescription') || 'The arena has reached its maximum capacity. Please try again later.')
                              : (t('arena.enterDescription') || 'Enter the arena and find your next opponent.')
                            }
                          </p>
                          <button
                            onClick={handleEnterArena}
                            disabled={isArenaFull}
                            className={`group relative w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-base shadow-lg transition-all duration-300 ${
                              isArenaFull
                                ? 'bg-[var(--color-text-primary)]/20 text-[var(--color-text-primary)]/50 cursor-not-allowed'
                                : 'bg-[var(--color-bg-active)] text-[var(--color-text-light)] hover:opacity-90 hover:scale-105 hover:shadow-[var(--color-bg-active)]/30 active:scale-95'
                            }`}
                          >
                            {!isArenaFull && (
                              <div className="absolute inset-0 bg-[var(--color-bg-active)]/20 rounded-xl blur-lg group-hover:blur-xl transition-all"></div>
                            )}
                            <Swords className={`w-5 h-5 relative z-10 ${isArenaFull ? 'opacity-50' : ''}`} />
                            <span className="relative z-10">
                              {isArenaFull 
                                ? (t('arena.arenaFull') || 'Arena Full')
                                : (t('arena.enterArena') || 'Enter Arena')
                              }
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </section>
        )}

      {/* Fullscreen Arena Overlay */}
      {isFullscreen && (game || gameResult) && (
        <div
          className="fixed inset-0 bg-[var(--color-bg-primary)] z-40 flex items-center justify-center overflow-y-auto pt-14 sm:pt-16 md:pt-0 md:pl-56"
        >
          <div
            className="bg-[var(--color-bg-primary)] w-full h-full flex flex-col border-t border-[var(--color-border)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative z-10 px-3 sm:px-4 border-b border-[var(--color-border)] flex items-center justify-between flex-shrink-0" style={{ height: '65px' }}>
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-[var(--color-text-primary)] pr-2 truncate">
                {t('arena.title')}
              </h3>
              <button
                onClick={handleExitArena}
                className="text-[var(--color-text-primary)]/70 hover:text-[var(--color-text-primary)] transition-all p-2 -mr-2 rounded-lg hover:bg-[var(--color-bg-active)]/10 hover:scale-110 active:scale-95 flex-shrink-0"
                aria-label="Exit fullscreen"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 scrollbar-hide" ref={fullscreenBoardRef}>
              <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 max-w-7xl mx-auto lg:h-full">
                {/* Board */}
                <div ref={fullscreenBoardContainerRef} className="flex-shrink-0 lg:flex-1 flex flex-col items-center lg:items-start justify-center w-full lg:w-auto lg:h-full">
                  <div className="flex flex-col items-center lg:items-start" style={{ width: `${fullscreenBoardWidth}px`, maxWidth: '100%' }}>
                    {/* Top player info - Always opponent */}
                    <div className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-t-lg flex-shrink-0">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-semibold text-[var(--color-text-primary)]">
                          {opponentDisplayName}
                        </span>
                        {gameStarted && game && userColor && opponentColor && (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                            (opponentColor === 'white' && game.turn() === 'w') || (opponentColor === 'black' && game.turn() === 'b')
                              ? 'bg-[var(--color-bg-active)]/20' 
                              : ''
                          }`}>
                            <Clock className="w-4 h-4 text-[var(--color-text-primary)]/60" />
                            <span className={`text-sm font-mono font-semibold ${
                              (opponentColor === 'white' ? whiteTime : blackTime) < 60000 
                                ? 'text-red-500' 
                                : 'text-[var(--color-text-primary)]'
                            }`}>
                              {formatTime(opponentColor === 'white' ? whiteTime : blackTime)}
                            </span>
                          </div>
                        )}
                      </div>
                      {(() => {
                        const opponentColor = boardOrientation === 'white' ? 'black' : 'white'
                        const pieces = capturedPieces[opponentColor]
                        const opponentAdvantage = opponentColor === 'white' ? materialAdvantage : -materialAdvantage
                        return (
                          <div className="flex items-center ml-auto">
                            {pieces.length > 0 ? (
                              pieces.map((capturedPiece, idx) => {
                                const isWhite = capturedPiece.color === 'white'
                                const fillColor = isWhite ? 'white' : 'black'
                                const strokeColor = 'black'
                                const pieceMap = {
                                  q: (
                                    
                                      {Array.from({ length: capturedPiece.count }).map((_, i) => (
                                         0 ? '-8px' : '0' }}>
                                          
                                            
                                            
                                            
                                            
                                            
                                            
                                            
                                            
                                            
                                            
                                          
                                        
                                      ))}
                                    
                                  ),
                                  r: (
                                    
                                      {Array.from({ length: capturedPiece.count }).map((_, i) => (
                                         0 ? '-8px' : '0' }}>
                                          
                                            
                                            
                                            
                                            
                                            
                                            
                                          
                                        
                                      ))}
                                    
                                  ),
                                  b: (
                                    
                                      {Array.from({ length: capturedPiece.count }).map((_, i) => (
                                         0 ? '-8px' : '0' }}>
                                          
                                            
                                            
                                            
                                            
                                          
                                        
                                      ))}
                                    
                                  ),
                                  n: (
                                    
                                      {Array.from({ length: capturedPiece.count }).map((_, i) => (
                                         0 ? '-8px' : '0' }}>
                                          
                                            
                                            
                                            
                                            
                                          
                                        
                                      ))}
                                    
                                  ),
                                  p: (
                                    
                                      {Array.from({ length: capturedPiece.count }).map((_, i) => (
                                         0 ? '-8px' : '0' }}>
                                          
                                            
                                          
                                        
                                      ))}
                                    
                                  )
                                }
                                return pieceMap[capturedPiece.piece] || null
                              })
                            ) : null}
                            {opponentAdvantage > 0 && (
                              
                                +{opponentAdvantage}
                              
                            )}
                          
                        )
                      })()}
                    
                    
                    
                      <div
                        style={{
                          width: `${fullscreenBoardWidth}px`,
                          height: `${fullscreenBoardWidth}px`,
                          position: 'relative',
                          display: 'inline-block',
                          zIndex: 9999,
                        }}
                        onMouseDown={(e) => {
                          if (viewingMoveIndex === null) {
                            const target = e.target
                            const square = target.closest('[data-square]')?.getAttribute('data-square')
                            if (square && game) {
                              const currentGame = new Chess(displayedPosition || game.fen())
                              const piece = currentGame.get(square)
                              if (piece && currentGame.turn() === piece.color) {
                                setDraggedSquare(square)
                              }
                            }
                          }
                        }}
                        onMouseUp={() => setDraggedSquare(null)}
                        onMouseLeave={() => setDraggedSquare(null)}
                      >
                        <Chessboard
                          key={`arena-board-${fullscreenBoardWidth}`}
                          position={displayedPosition || undefined}
                          onPieceDrop={(sourceSquare, targetSquare) => {
                            setDraggedSquare(null)
                            
                            // Don't allow moves when viewing history
                            if (viewingMoveIndex !== null) {
                              return false
                            }
                            
                            if (game) {
                              const currentGame = new Chess(game.fen())
                              const piece = currentGame.get(sourceSquare)
                              
                              // Check if it's the user's turn
                              const currentTurn = currentGame.turn()
                              if (piece?.color !== currentTurn) {
                                return false // Not user's turn
                              }
                              
                              const isPawn = piece?.type === 'p'
                              const rank = parseInt(targetSquare[1])
                              const isPromotionMove = isPawn && (
                                (currentGame.turn() === 'w' && rank === 8) || 
                                (currentGame.turn() === 'b' && rank === 1)
                              )
                              
                              if (isPromotionMove && !promotionSourceSquareRef.current && !promotionTargetSquareRef.current) {
                                return true
                              }
                              
                              if (isPromotionMove && promotionSourceSquareRef.current !== sourceSquare) {
                                promotionSourceSquareRef.current = sourceSquare
                                promotionTargetSquareRef.current = targetSquare
                              }
                            }
                            
                            return handleMove(sourceSquare, targetSquare)
                          }}
                          onPromotionCheck={handlePromotionCheck}
                          onPromotionPieceSelect={handlePromotionPieceSelect}
                          showPromotionDialog={showPromotionDialog}
                          promotionToSquare={promotionToSquare}
                          promotionDialogVariant="modal"
                          onSquareClick={viewingMoveIndex !== null ? undefined : handleSquareClick}
                          arePiecesDraggable={true}
                          boardOrientation={boardOrientation}
                          boardWidth={fullscreenBoardWidth}
                          customSquareStyles={getSquareStyles()}
                          customLightSquareStyle={{ fill: '#e6e1e1', backgroundColor: '#e6e1e1' }}
                          customDarkSquareStyle={{ fill: '#858282', backgroundColor: '#858282' }}
                          customBoardStyle={{
                            borderRadius: '0',
                            boxShadow: 'none',
                            width: `${fullscreenBoardWidth}px`,
                            height: `${fullscreenBoardWidth}px`,
                            maxWidth: '100%',
                            maxHeight: '100%',
                            margin: 0,
                            display: 'block',
                            borderLeft: '1px solid var(--color-border)',
                            borderRight: '1px solid var(--color-border)',
                          }}
                        />
                        {isFullscreen && (() => {
                          if (!displayedPosition) return null
                          const currentDisplayedGame = new Chess(displayedPosition)
                          const isCheckmate = currentDisplayedGame.isCheckmate()
                          const isStalemate = currentDisplayedGame.isStalemate()
                          
                          if (!isCheckmate && !isStalemate) return null
                          
                          const losingColor = currentDisplayedGame.turn()
                          const winningColor = losingColor === 'w' ? 'b' : 'w'
                          
                          const losingKingSquare = getKingSquare(currentDisplayedGame, losingColor)
                          const winningKingSquare = getKingSquare(currentDisplayedGame, winningColor)
                          
                          if (!losingKingSquare || !winningKingSquare) return null
                          
                          const squareSize = fullscreenBoardWidth / 8
                          
                          const getIconPosition = (square) => {
                            const file = square.charCodeAt(0) - 97
                            const rank = 8 - parseInt(square[1])
                            const x = boardOrientation === 'white' ? file * squareSize : (7 - file) * squareSize
                            const y = boardOrientation === 'white' ? rank * squareSize : (7 - rank) * squareSize
                            return { x, y, iconLeft: x + squareSize - 20, iconTop: y + 4 }
                          }
                          
                          const losingPos = getIconPosition(losingKingSquare)
                          const winningPos = getIconPosition(winningKingSquare)
                          
                          return (
                            
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${losingPos.iconLeft}px`,
                                  top: `${losingPos.iconTop}px`,
                                  pointerEvents: 'none',
                                  zIndex: 100,
                                }}
                                className={`rounded-full p-1.5 ${isCheckmate ? 'bg-red-500' : 'bg-gray-500'}`}
                              >
                                {isCheckmate ? (
                                  
                                ) : (
                                  
                                )}
                              
                              
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${winningPos.iconLeft}px`,
                                  top: `${winningPos.iconTop}px`,
                                  pointerEvents: 'none',
                                  zIndex: 100,
                                }}
                                className="rounded-full p-1.5 bg-green-500"
                              >
                                
                              
                            
                          )
                        })()}
                      
                    
                    
                    {/* Bottom player info - Always user */}
                    
                      
                        
                          {displayUsername}
                        
                        {gameStarted && game && userColor && (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                            (userColor === 'white' && game.turn() === 'w') || (userColor === 'black' && game.turn() === 'b')
                              ? 'bg-[var(--color-bg-active)]/20' 
                              : ''
                          }`}>
                            
                            <span className={`text-sm font-mono font-semibold ${
                              (userColor === 'white' ? whiteTime : blackTime) < 60000 
                                ? 'text-red-500' 
                                : 'text-[var(--color-text-primary)]'
                            }`}>
                              {formatTime(userColor === 'white' ? whiteTime : blackTime)}
                            
                          
                        )}
                      
                      {(() => {
                        const userColor = boardOrientation === 'white' ? 'white' : 'black'
                        const pieces = capturedPieces[userColor]
                        const userAdvantage = userColor === 'white' ? materialAdvantage : -materialAdvantage
                        return (
                          
                            {pieces.length > 0 ? (
                              pieces.map((capturedPiece, idx) => {
                                const isWhite = capturedPiece.color === 'white'
                                const fillColor = isWhite ? 'white' : 'black'
                                const strokeColor = 'black'
                                const pieceMap = {
                                  q: (
                                    
                                      {Array.from({ length: capturedPiece.count }).map((_, i) => (
                                         0 ? '-8px' : '0' }}>
                                          
                                            
                                            
                                            
                                            
                                            
                                            
                                            
                                            
                                            
                                            
                                          
                                        
                                      ))}
                                    
                                  ),
                                  r: (
                                    
                                      {Array.from({ length: capturedPiece.count }).map((_, i) => (
                                         0 ? '-8px' : '0' }}>
                                          
                                            
                                            
                                            
                                            
                                            
                                            
                                          
                                        
                                      ))}
                                    
                                  ),
                                  b: (
                                    
                                      {Array.from({ length: capturedPiece.count }).map((_, i) => (
                                         0 ? '-8px' : '0' }}>
                                          
                                            
                                            
                                            
                                            
                                          
                                        
                                      ))}
                                    
                                  ),
                                  n: (
                                    
                                      {Array.from({ length: capturedPiece.count }).map((_, i) => (
                                         0 ? '-8px' : '0' }}>
                                          
                                            
                                            
                                            
                                            
                                          
                                        
                                      ))}
                                    
                                  ),
                                  p: (
                                    
                                      {Array.from({ length: capturedPiece.count }).map((_, i) => (
                                         0 ? '-8px' : '0' }}>
                                          
                                            
                                          
                                        
                                      ))}
                                    
                                  )
                                }
                                return pieceMap[capturedPiece.piece] || null
                              })
                            ) : null}
                            {userAdvantage > 0 && (
                              
                                +{userAdvantage}
                              
                            )}
                          
                        )
                      })()}
                    
                  
                

                {/* Right Panel - Challenge, Rankings, Stats */}
                
                  
                    {/* Tabs */}
                    
                      <button
                        onClick={() => setActiveTab('challenge')}
                        className={`px-3 py-2 text-sm font-semibold transition-colors border-b-2 ${
                          activeTab === 'challenge'
                            ? 'border-[var(--color-bg-active)] text-[var(--color-bg-active)]'
                            : 'border-transparent text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        
                        {t('arena.challenge') || 'Challenge'}
                      
                      {(challengeStatus === 'in_game' || challengeStatus === 'challenged' || challengeStatus === 'challenged_by' || (gameResult && currentOpponent)) && (
                        <button
                          onClick={() => setActiveTab('game')}
                          className={`px-3 py-2 text-sm font-semibold transition-colors border-b-2 ${
                            activeTab === 'game'
                              ? 'border-[var(--color-bg-active)] text-[var(--color-bg-active)]'
                              : 'border-transparent text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)]'
                          }`}
                        >
                          
                          {t('arena.game') || 'Game'}
                        
                      )}
                      <button
                        onClick={() => setActiveTab('rankings')}
                        className={`px-3 py-2 text-sm font-semibold transition-colors border-b-2 ${
                          activeTab === 'rankings'
                            ? 'border-[var(--color-bg-active)] text-[var(--color-bg-active)]'
                            : 'border-transparent text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        
                        {t('arena.rankings') || 'Rankings'}
                      
                      <button
                        onClick={() => setActiveTab('stats')}
                        className={`px-3 py-2 text-sm font-semibold transition-colors border-b-2 ${
                          activeTab === 'stats'
                            ? 'border-[var(--color-bg-active)] text-[var(--color-bg-active)]'
                            : 'border-transparent text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        
                        {t('arena.stats') || 'Stats'}
                      
                    

                    {/* Tab Content */}
                    
                      {/* Challenge Tab */}
                      {activeTab === 'challenge' && (
                        
                          {/* Combined list of all active players */}
                          
                            {availablePlayers.length === 0 ? (
                              
                                
                                
                                  {t('arena.noPlayersAvailable') || 'No other players in arena. Waiting for opponents...'}
                                
                              
                            ) : (
                              
                                {availablePlayers.map((player) => {
                                  const isInMatch = playersInMatches.has(player.id) || (player.isBot && botsInGames.has(player.id))
                                  
                                  return (
                                    <div
                                      key={player.id}
                                      className={`p-3 rounded-lg border transition-colors ${
                                        isInMatch
                                          ? 'bg-[var(--color-bg-secondary)]/50 border-[var(--color-border)]/50 opacity-60'
                                          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] hover:border-[var(--color-bg-active)]/50'
                                      }`}
                                    >
                                      
                                        
                                          {player.avatar_url ? (
                                            <img
                                              src={player.avatar_url}
                                              alt={player.name}
                                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                            />
                                          ) : (
                                            
                                              {player.isBot ? (
                                                
                                              ) : (
                                                
                                              )}
                                            
                                          )}
                                          
                                            {player.name}
                                            {isInMatch ? (
                                              
                                                {t('arena.playing') || 'Playing'}
                                              
                                            ) : (
                                              
                                                {player.isBot ? 'Bot' : `Rating: ${player.rating}`}
                                              
                                            )}
                                          
                                        
                                        {isInMatch ? (
                                          
                                            
                                              {t('arena.playing') || 'Playing'}
                                            
                                          
                                        ) : (
                                          <button
                                            onClick={() => handleChallengePlayer(player.id)}
                                            disabled={!!userCurrentGame && gameStatus === 'active'}
                                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex-shrink-0 ${
                                              userCurrentGame && gameStatus === 'active'
                                                ? 'bg-[var(--color-text-primary)]/20 text-[var(--color-text-primary)]/50 cursor-not-allowed'
                                                : 'bg-[var(--color-bg-active)] text-[var(--color-text-light)] hover:opacity-90 hover:scale-105 active:scale-95'
                                            }`}
                                          >
                                            {t('arena.challenge') || 'Challenge'}
                                          
                                        )}
                                      
                                    
                                  )
                                })}
                              
                            )}
                          
                        
                      )}

                      {/* Game Tab */}
                      {activeTab === 'game' && (
                        
                          {/* Challenge status messages */}
                          {challengeStatus === 'challenged' && currentOpponent && !userCurrentGame && (
                            
                              
                                
                                  {t('arena.challenged') || 'You challenged'}
                                
                                
                                  
                                    {currentOpponent.avatar_url ? (
                                      <img
                                        src={currentOpponent.avatar_url}
                                        alt={currentOpponent.name}
                                        className="w-10 h-10 rounded-full object-cover"
                                      />
                                    ) : (
                                      
                                        
                                      
                                    )}
                                    
                                      {currentOpponent.name}
                                      Rating<button
                                onClick={handleCancelChallenge}
                                className="w-full px-4 py-2 rounded-lg border border-[var(--color-icon-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-bg-active)]/50 hover:bg-[var(--color-bg-active)]/10 text-[var(--color-text-primary)] text-sm transition-colors"
                              >
                                {t('arena.cancelChallenge') || 'Cancel Challenge'}
                              
                            
                          )}

                          {challengeStatus === 'challenged_by' && currentOpponent && !userCurrentGame && (
                            
                              
                                
                                  {t('arena.challengeReceived') || 'Challenge Received!'}
                                
                                
                                  {currentOpponent.avatar_url ? (
                                    <img
                                      src={currentOpponent.avatar_url}
                                      alt={currentOpponent.name}
                                      className="w-10 h-10 rounded-full object-cover"
                                    />
                                  ) : (
                                    
                                      
                                    
                                  )}
                                  
                                    {currentOpponent.name}
                                    Rating<button
                                    onClick={handleAcceptChallenge}
                                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-bg-active)] text-[var(--color-text-light)] font-semibold transition-all duration-300 hover:opacity-90 flex items-center justify-center gap-2"
                                  >
                                    
                                    {t('arena.accept') || 'Accept'}
                                  
                                  <button
                                    onClick={handleDeclineChallenge}
                                    className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-icon-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-bg-active)]/50 hover:bg-[var(--color-bg-active)]/10 text-[var(--color-text-primary)] font-semibold transition-colors flex items-center justify-center gap-2"
                                  >
                                    
                                    {t('arena.decline') || 'Decline'}
                                  
                                
                              
                            
                          )}

                          {/* Game content - only show when in game or game ended */}
                          {(challengeStatus === 'in_game' || (gameResult && currentOpponent)) && currentOpponent && (
                            
                          {gameResult ? (
                            
                              
                                {t('arena.gameOver') || 'Game Over'}
                              
                              
                                {currentOpponent.avatar_url ? (
                                  <img
                                    src={currentOpponent.avatar_url}
                                    alt={currentOpponent.name}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  
                                    
                                  
                                )}
                                
                                  {currentOpponent.name}
                                  Rating{gameResult && (
                                
                                  
                                    {gameResult.winner 
                                      ? (gameResult.winner === (userColor === 'white' ? 'white' : 'black')
                                          ? (t('arena.youWon') || 'You Won!')
                                          : (t('arena.youLost') || 'You Lost'))
                                      : (t('arena.gameDrawn') || 'Game Drawn')
                                    }
                                  
                                  
                                    {gameResult.reason === 'checkmate' && (t('arena.byCheckmate') || 'By checkmate')}
                                    {gameResult.reason === 'stalemate' && (t('arena.byStalemate') || 'By stalemate')}
                                    {gameResult.reason === 'draw' && (t('arena.byDraw') || 'By draw')}
                                    {gameResult.reason === 'resign' && (t('arena.byResignation') || 'By resignation')}
                                    {gameResult.reason === 'timeout' && (t('arena.byTimeout') || 'By timeout')}
                                    {gameResult.reason === 'abort' && (t('arena.byAbort') || 'Game aborted')}
                                  
                                
                              )}
                            
                          ) : (
                            
                              
                                
                                  {t('arena.playingAgainst') || 'Playing against'}
                                
                                
                                  {currentOpponent.avatar_url ? (
                                    <img
                                      src={currentOpponent.avatar_url}
                                      alt={currentOpponent.name}
                                      className="w-10 h-10 rounded-full object-cover"
                                    />
                                  ) : (
                                    
                                      
                                    
                                  )}
                                  
                                    {currentOpponent.name}
                                    Rating{/* First move warning for white player */}
                              {showFirstMoveWarning && userColor === 'white' && gameStatus === 'active' && moveHistory.length === 0 && (
                                
                                  
                                    
                                    
                                      {t('arena.playFirstMoveIn20Seconds') || 'Please play your first move within'} {firstMoveCountdown}s {t('arena.orGameWillBeAborted') || 'or the game will be aborted.'}
                                    
                                  
                                
                              )}
                              {gameStarted && gameStatus === 'active' && (
                                
                                  {drawOffer && drawOffer.from === currentOpponent && currentOpponent.id && (
                                    
                                      
                                        {t('arena.drawOfferReceived') || 'Draw offer received'}
                                      
                                      
                                        <button
                                          onClick={handleAcceptDraw}
                                          className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-active)] text-[var(--color-text-light)] font-semibold text-sm transition-colors hover:opacity-90"
                                        >
                                          {t('arena.accept') || 'Accept'}
                                        
                                        <button
                                          onClick={handleDeclineDraw}
                                          className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-icon-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-bg-active)]/50 hover:bg-[var(--color-bg-active)]/10 text-[var(--color-text-primary)] font-semibold text-sm transition-colors"
                                        >
                                          {t('arena.decline') || 'Decline'}
                                        
                                      
                                    
                                  )}
                                  
                                    <button
                                      onClick={handleOfferDraw}
                                      disabled={!!drawOffer}
                                      className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-icon-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-bg-active)]/50 hover:bg-[var(--color-bg-active)]/10 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text-primary)] text-sm transition-colors"
                                    >
                                      {drawOffer && drawOffer.from === user?.id 
                                        ? (t('arena.drawOffered') || 'Draw Offered')
                                        : (t('arena.offerDraw') || 'Offer Draw')
                                      }
                                    
                                    <button
                                      onClick={handleResign}
                                      className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-icon-border)] bg-[var(--color-bg-secondary)] hover:border-red-500/50 hover:bg-red-500/10 text-[var(--color-text-primary)] text-sm transition-colors"
                                    >
                                      {t('arena.resign') || 'Resign'}
                                    
                                  
                                
                              )}
                            
                          )}

                          {/* Move History - Show in Game tab */}
                          {gameStarted && moveHistory.length > 0 && (
                            
                              
                                
                                  {t('arena.moveHistory') || 'Move History'}
                                
                                {moveHistory.length > 0 && (
                                  
                                    <button
                                      onClick={goToFirstMove}
                                      disabled={viewingMoveIndex === 0}
                                      className="p-1 rounded border border-[var(--color-icon-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-bg-active)]/50 hover:bg-[var(--color-bg-active)]/10 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text-primary)] transition-colors"
                                      title={t('arena.firstMove') || 'First Move'}
                                    >
                                      
                                    
                                    <button
                                      onClick={goToPreviousMove}
                                      disabled={viewingMoveIndex === 0}
                                      className="p-1 rounded border border-[var(--color-icon-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-bg-active)]/50 hover:bg-[var(--color-bg-active)]/10 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text-primary)] transition-colors"
                                      title={t('arena.previousMove') || 'Previous Move'}
                                    >
                                      
                                    
                                    <button
                                      onClick={goToNextMove}
                                      disabled={viewingMoveIndex === null || viewingMoveIndex === moveHistory.length - 1}
                                      className="p-1 rounded border border-[var(--color-icon-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-bg-active)]/50 hover:bg-[var(--color-bg-active)]/10 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text-primary)] transition-colors"
                                      title={t('arena.nextMove') || 'Next Move'}
                                    >
                                      
                                    
                                    <button
                                      onClick={goToLastMove}
                                      disabled={viewingMoveIndex === null}
                                      className="p-1 rounded border border-[var(--color-icon-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-bg-active)]/50 hover:bg-[var(--color-bg-active)]/10 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text-primary)] transition-colors"
                                      title={t('arena.currentPosition') || 'Current Position'}
                                    >
                                      
                                    
                                  
                                )}
                              
                              
                                {moveHistory.map((move, index) => {
                                  const moveNumber = Math.floor(index / 2) + 1
                                  const isWhiteMove = index % 2 === 0
                                  const isActive = viewingMoveIndex === index
                                  
                                  if (isWhiteMove) {
                                    return (
                                      
                                        {moveNumber}.
                                        <span
                                          className={`flex-1 px-2 py-1 rounded ${
                                            isActive ? 'bg-[var(--color-bg-active)]/30 text-[var(--color-bg-active)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]/80 hover:bg-[var(--color-bg-active)]/10'
                                          } cursor-pointer transition-colors`}
                                          onClick={() => {
                                            if (index === moveHistory.length - 1) {
                                              setViewingMoveIndex(null)
                                            } else {
                                              setViewingMoveIndex(index)
                                            }
                                          }}
                                        >
                                          {move}
                                        
                                        {moveHistory[index + 1] && (
                                          <span
                                            className={`flex-1 px-2 py-1 rounded ${
                                              viewingMoveIndex === index + 1 ? 'bg-[var(--color-bg-active)]/30 text-[var(--color-bg-active)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]/80 hover:bg-[var(--color-bg-active)]/10'
                                            } cursor-pointer transition-colors`}
                                            onClick={() => {
                                              if (index + 1 === moveHistory.length - 1) {
                                                setViewingMoveIndex(null)
                                              } else {
                                                setViewingMoveIndex(index + 1)
                                              }
                                            }}
                                          >
                                            {moveHistory[index + 1]}
                                          
                                        )}
                                      
                                    )
                                  }
                                  return null
                                })}
                              
                            
                          )}
                            
                          )}
                        
                      )}

                      {/* Rankings Tab */}
                      {activeTab === 'rankings' && (
                        
                          {arenaRankings.length === 0 ? (
                            
                              
                              
                                {t('arena.noRankingsYet') || 'No rankings yet. Play games to appear on the leaderboard!'}
                              
                            
                          ) : (
                            
                              {arenaRankings.map((player, index) => {
                                const isBot = (player).isBot || false
                                const avatarUrl = (player).avatar_url
                                
                                return (
                                  <div
                                    key={player.id}
                                    className={`p-3 rounded-lg border ${
                                      player.id === user?.id
                                        ? 'bg-[var(--color-bg-active)]/20 border-[var(--color-bg-active)]/50'
                                        : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
                                    }`}
                                  >
                                    
                                      
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                        index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                        index === 1 ? 'bg-gray-400/20 text-gray-400' :
                                        index === 2 ? 'bg-orange-600/20 text-orange-600' :
                                        'bg-[var(--color-bg-active)]/20 text-[var(--color-text-primary)]/60'
                                      }`}>
                                        {player.rank.toString().padStart(2, '0')}
                                      
                                        {avatarUrl ? (
                                          <img
                                            src={avatarUrl}
                                            alt={player.name}
                                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                          />
                                        ) : (
                                          
                                            {isBot ? (
                                              
                                            ) : (
                                              
                                            )}
                                          
                                        )}
                                        
                                          
                                            {player.name}
                                            {isBot && (
                                              
                                                Bot
                                              
                                            )}
                                          
                                          
                                            {player.wins}W / {player.losses}L / {player.draws}D • {Math.round(player.winRate * 100)}%
                                          
                                        
                                      
                                      
                                        Points
                                        {player.rating}
                                      
                                    
                                  
                                )
                              })}
                            
                          )}
                        
                      )}

                      {/* Stats Tab */}
                      {activeTab === 'stats' && (
                        
                          {userArenaStats ? (
                            
                              
                                
                                  {t('arena.points') || 'Points'}
                                  {userArenaStats.rating}
                                
                                
                                  
                                  
                                    {t('arena.rank') || 'Rank'}: #{userArenaStats.rank.toString().padStart(2, '0')}
                                  
                                
                              
                              
                                
                                  {userArenaStats.wins}
                                  {t('arena.wins') || 'Wins'}
                                
                                
                                  {userArenaStats.losses}
                                  {t('arena.losses') || 'Losses'}
                                
                                
                                  {userArenaStats.draws}
                                  {t('arena.draws') || 'Draws'}
                                
                              
                              
                                
                                  {t('arena.winRate') || 'Win Rate'}
                                  {Math.round(userArenaStats.winRate * 100)}%
                                
                                
                                  <div
                                    className="bg-[var(--color-bg-active)] h-2 rounded-full transition-all"
                                    style={{ width: `${userArenaStats.winRate * 100}%` }}
                                  >
                                
                              
                            
                          ) : (
                            
                              
                              
                                {t('arena.noStatsYet') || 'No stats yet. Play games to see your statistics!'}
                              
                            
                          )}
                        
                      )}

                    
                  
                
              
            
          
        
      )}
      
    
  )
}

