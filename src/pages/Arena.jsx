import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import { ChessBoard } from '../components/chess/ChessBoard'
import { MoveHistory } from '../components/chess/MoveHistory'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuthStore } from '../store/auth-store'
import { rtdb, auth } from '../lib/firebase'
import { ref, onValue, set, update, onDisconnect, serverTimestamp, get } from 'firebase/database'
import { api } from '../lib/api'
import { Swords, Users, Trophy, User as UserIcon, Bot, Play, RefreshCw, Check, X, Clock, Flag, Handshake } from 'lucide-react'
import { PageLoader } from '../components/ui/PageLoader'
import botsData from '../lib/bots/bots.json'
import './Arena.css'

const MAX_ARENA_PLAYERS = 50

export function Arena() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuthStore()
  const sectionRef = useRef(null)

  // Game state
  const [game, setGame] = useState(new Chess())
  const [moves, setMoves] = useState([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(null)
  const [whiteTime, setWhiteTime] = useState(600)
  const [blackTime, setBlackTime] = useState(600)
  const [isWhiteTurn, setIsWhiteTurn] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)

  // Arena state
  const [isInArena, setIsInArena] = useState(false)
  const [arenaPlayersCount, setArenaPlayersCount] = useState(0)
  const [availablePlayers, setAvailablePlayers] = useState([])
  const [activeTab, setActiveTab] = useState('challenge')
  const [currentOpponent, setCurrentOpponent] = useState(null)
  const [userCurrentGame, setUserCurrentGame] = useState(null)
  const [userColor, setUserColor] = useState(null)
  const [opponentColor, setOpponentColor] = useState(null)
  const [botsInGames, setBotsInGames] = useState(new Set())
  const [playersInMatches, setPlayersInMatches] = useState(new Set())
  const [pendingChallenge, setPendingChallenge] = useState(null) // Challenge received from another player
  const [outgoingChallenge, setOutgoingChallenge] = useState(null) // Challenge sent by current user
  const [challengeOpponent, setChallengeOpponent] = useState(null) // Opponent info for challenge UI only (not for board)
  const presenceRefRef = useRef(null)
  const onDisconnectRef = useRef(null)
  const playersCacheRef = useRef(new Map()) // Cache user data to avoid repeated API calls
  const lastOnlineUsersRef = useRef(new Set()) // Track last online users to prevent flickering
  const switchedToGameTabRef = useRef(null) // Track which game we've already switched to game tab for
  const lastTimerSyncRef = useRef(null) // Track last time we synced timer from Firebase

  useSEO({
    title: 'Arena',
    description: 'Play chess against other players in the arena',
    url: '/arena',
  })

  // Listen to arena player count (always, even when not in arena) - REALTIME
  useEffect(() => {
    if (!rtdb) return

    const allPresenceRef = ref(rtdb, 'arena/presence')
    const unsubscribe = onValue(allPresenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const presenceData = snapshot.val()
        // Filter out null/undefined entries and only count users with online: true
        const onlineUsers = Object.keys(presenceData).filter(
          (uid) => {
            const userPresence = presenceData[uid]
            // Check if presence exists and is online (not null, not false)
            return userPresence !== null && 
                   userPresence !== undefined && 
                   userPresence.online === true
          }
        )
        setArenaPlayersCount(onlineUsers.length)
      } else {
        setArenaPlayersCount(0)
      }
    }, (error) => {
      console.error('[Arena] Error listening to presence:', error)
      setArenaPlayersCount(0)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Subscribe to arena presence (only when in arena)
  useEffect(() => {
    if (!rtdb || !user) return

        const userId = user.id

    if (!isInArena) {
      // Clean up presence if not in arena
      const presenceRef = ref(rtdb, `arena/presence/${userId}`)
      set(presenceRef, null).catch(() => {})
      
      if (onDisconnectRef.current) {
        onDisconnectRef.current.cancel()
        onDisconnectRef.current = null
      }
      presenceRefRef.current = null
      return
    }

    const presenceRef = ref(rtdb, `arena/presence/${userId}`)
    presenceRefRef.current = presenceRef

    // Set presence
    set(presenceRef, {
      online: true,
      lastSeen: serverTimestamp(),
    }).catch((error) => {
      // Only log non-permission errors - permission errors are expected if rules don't allow
      if (error?.code !== 'PERMISSION_DENIED' && !error?.message?.includes('permission')) {
      console.error('[Arena] Error setting presence:', error)
      }
    })

    // Set up disconnect handler - removes presence when user leaves page/closes tab
    const disconnectHandler = onDisconnect(presenceRef)
    onDisconnectRef.current = disconnectHandler
    disconnectHandler.set(null).catch((error) => {
      // Only log non-permission errors - permission errors are expected if rules don't allow
      if (error?.code !== 'PERMISSION_DENIED' && !error?.message?.includes('permission')) {
        console.error('[Arena] Error setting up disconnect handler:', error)
      }
    })

    // Listen to all presence - REALTIME LISTENER
    const allPresenceRef = ref(rtdb, 'arena/presence')
    const unsubscribePresence = onValue(allPresenceRef, async (snapshot) => {
      if (snapshot.exists()) {
        const presenceData = snapshot.val()
        const onlineUsers = Object.keys(presenceData).filter(
          (uid) => presenceData[uid] && presenceData[uid].online && uid !== userId
        )
        
        // Check if online users actually changed
        const currentOnlineUsersSet = new Set(onlineUsers)
        const lastOnlineUsersSet = lastOnlineUsersRef.current
        const onlineUsersChanged = 
          lastOnlineUsersSet.size !== currentOnlineUsersSet.size ||
          [...lastOnlineUsersSet].some(id => !currentOnlineUsersSet.has(id)) ||
          [...currentOnlineUsersSet].some(id => !lastOnlineUsersSet.has(id))
        
        if (!onlineUsersChanged) {
          return // Skip if no change to prevent flickering
        }
        
        lastOnlineUsersRef.current = currentOnlineUsersSet
        setArenaPlayersCount(onlineUsers.length + 1) // +1 for current user

        // Fetch available players (use cache to avoid repeated API calls)
        const playersPromises = onlineUsers.map(async (uid) => {
          // Check cache first
          if (playersCacheRef.current.has(uid)) {
            return playersCacheRef.current.get(uid)
          }
      
      try {
        const userData = await api.getUser(uid)
        if (userData) {
        const player = {
          id: uid,
                name: userData.chesscom_username || userData.name || userData.email?.split('@')[0] || 'Player',
                avatar_url: userData.avatar_url || null,
                rating: 0, // TODO: Calculate from arena games
                isBot: false,
              }
              // Cache the player data
              playersCacheRef.current.set(uid, player)
              return player
            }
      } catch (error) {
            console.error('[Arena] Error fetching user:', error)
          }
          return null
        })

        const players = await Promise.all(playersPromises)
        const filteredPlayers = players.filter((p) => p !== null)
        
        // Only update if players actually changed to prevent flickering
        setAvailablePlayers((prev) => {
          if (prev.length !== filteredPlayers.length) {
            return filteredPlayers
          }
          // Check if any player IDs changed
          const prevIds = [...prev.map(p => p.id)].sort()
          const newIds = [...filteredPlayers.map(p => p.id)].sort()
          if (prevIds.length !== newIds.length) {
            return filteredPlayers
          }
          const hasChanged = prevIds.some((id, i) => id !== newIds[i])
          return hasChanged ? filteredPlayers : prev
        })
      } else {
        if (lastOnlineUsersRef.current.size > 0) {
          lastOnlineUsersRef.current = new Set()
          setArenaPlayersCount(1)
          setAvailablePlayers([])
        }
      }
    })

    // Listen to active games directly - more efficient than checking each user
    const gamesRef = ref(rtdb, 'arena/games')
    const unsubscribeGames = onValue(gamesRef, (snapshot) => {
      const inMatches = new Set()
      
      if (snapshot.exists()) {
        const gamesData = snapshot.val()
        
        // Find all players in active games
        Object.keys(gamesData).forEach((gameId) => {
          const gameData = gamesData[gameId]
          if (gameData && gameData.status === 'active') {
            // Add both players to the in-matches set
            if (gameData.whitePlayer && !gameData.whitePlayer.startsWith('bot_')) {
              inMatches.add(gameData.whitePlayer)
            }
            if (gameData.blackPlayer && !gameData.blackPlayer.startsWith('bot_')) {
              inMatches.add(gameData.blackPlayer)
            }
          }
        })
      }
      
      // Only update if the set contents actually changed
      setPlayersInMatches((prev) => {
        if (prev.size !== inMatches.size) {
          return inMatches
        }
        // Check if any IDs are different
        const prevArray = [...prev].sort()
        const newArray = [...inMatches].sort()
        if (prevArray.length !== newArray.length) {
          return inMatches
        }
        const hasChanged = prevArray.some((id, i) => id !== newArray[i])
        return hasChanged ? inMatches : prev
      })
    })

    // Listen to active games for bots - use same games listener
    const gamesRefForBots = ref(rtdb, 'arena/games')
    const unsubscribeBots = onValue(gamesRefForBots, (snapshot) => {
      const activeBots = new Set()
      
      if (snapshot.exists()) {
        const gamesData = snapshot.val()
        
        if (gamesData) {
          Object.keys(gamesData).forEach((gameId) => {
            const gameData = gamesData[gameId]
            if (gameData && gameData.status === 'active') {
              // Add bots to the in-games set
              if (gameData.whitePlayer && gameData.whitePlayer.startsWith('bot_')) {
                activeBots.add(gameData.whitePlayer)
              }
              if (gameData.blackPlayer && gameData.blackPlayer.startsWith('bot_')) {
                activeBots.add(gameData.blackPlayer)
              }
            }
          })
        }
      }
      
      setBotsInGames(activeBots)
    })

    return () => {
      unsubscribePresence()
      unsubscribeGames()
      unsubscribeBots()
      if (onDisconnectRef.current) {
        onDisconnectRef.current.cancel()
        onDisconnectRef.current = null
      }
      presenceRefRef.current = null
    }
  }, [user, isInArena])

  // Clean up presence when component unmounts or user leaves page
  useEffect(() => {
    if (!rtdb || !user) return

    const userId = user.id

    // Cleanup function - removes presence when component unmounts
    return () => {
      if (isInArena) {
        const presenceRef = ref(rtdb, `arena/presence/${userId}`)
        set(presenceRef, null).catch(() => {
          // Ignore errors during cleanup
        })
      }
      if (onDisconnectRef.current) {
        onDisconnectRef.current.cancel()
        onDisconnectRef.current = null
      }
      presenceRefRef.current = null
    }
  }, [user, isInArena, rtdb])

  // Subscribe to incoming challenges (challenges TO this user)
  useEffect(() => {
    if (!rtdb || !user || !isInArena) return

    const userId = user.id
    const challengeRef = ref(rtdb, `arena/challenges/${userId}`)
    
    const unsubscribe = onValue(challengeRef, (snapshot) => {
      if (snapshot.exists()) {
      const challengeData = snapshot.val()
        if (challengeData && challengeData.from && challengeData.from !== userId) {
        setPendingChallenge({
          from: challengeData.from,
          to: userId,
        })
        
          // Don't update currentOpponent here - only update when game starts
          // Fetch opponent info for display in challenge UI only
          api.getUser(challengeData.from).then((opponentData) => {
            if (opponentData) {
              // Store opponent info temporarily for challenge UI, but don't set currentOpponent
              // currentOpponent will be set when game actually starts
          }
        }).catch((error) => {
          console.error('[Arena] Error fetching opponent:', error)
        })
      } else {
        setPendingChallenge(null)
        setChallengeOpponent(null)
        if (!userCurrentGame) {
          setCurrentOpponent(null)
        }
      }
    } else {
      setPendingChallenge(null)
      setChallengeOpponent(null)
        if (!userCurrentGame) {
          setCurrentOpponent(null)
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [user, isInArena, userCurrentGame])

  // Subscribe to outgoing challenges (challenges sent BY this user)
  useEffect(() => {
    if (!rtdb || !user || !isInArena) return

    const userId = user.id
    
    // Check all challenges to see if we sent any
    const allChallengesRef = ref(rtdb, 'arena/challenges')
    const unsubscribe = onValue(allChallengesRef, (snapshot) => {
      if (snapshot.exists()) {
        const challengesData = snapshot.val()
        let foundOutgoing = null
        
        // Find challenge sent by current user
        Object.keys(challengesData).forEach((opponentId) => {
          const challenge = challengesData[opponentId]
          if (challenge && challenge.from === userId) {
            foundOutgoing = {
              from: userId,
              to: opponentId,
            }
          }
        })
        
        setOutgoingChallenge(foundOutgoing)
        if (foundOutgoing) {
          // Switch to game tab when we sent a challenge
          setActiveTab('game')
        }
      } else {
        setOutgoingChallenge(null)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [user, isInArena])

  // Switch to game tab when receiving or sending a challenge
  useEffect(() => {
    if (!isInArena) return
    
    // Switch to game tab when there's a pending challenge or outgoing challenge
    if (pendingChallenge || outgoingChallenge) {
      if (activeTab !== 'game') {
        setActiveTab('game')
      }
    }
  }, [pendingChallenge, outgoingChallenge, activeTab, isInArena])

  // Switch to challenge tab when game tab conditions are no longer met
  useEffect(() => {
    if (!isInArena) return

    // If there's no game, no pending challenge, and no outgoing challenge, switch to challenge tab
    if (!userCurrentGame && !pendingChallenge && !outgoingChallenge) {
      if (activeTab === 'game') {
        setActiveTab('challenge')
      }
    }
  }, [userCurrentGame, pendingChallenge, outgoingChallenge, activeTab, isInArena])

  // Subscribe to current game
  useEffect(() => {
    if (!rtdb || !user) return

      const userId = user.id
    const userGameRef = ref(rtdb, `arena/users/${userId}/currentGame`)
    let gameUnsubscribe = null
    
    const unsubscribe = onValue(userGameRef, (snapshot) => {
      // Clean up previous game subscription
      if (gameUnsubscribe) {
        gameUnsubscribe()
        gameUnsubscribe = null
      }

      if (snapshot.exists()) {
          const gameId = snapshot.val()
        const previousGameId = userCurrentGame
        setUserCurrentGame(gameId)
        
        // Don't switch to game tab here - only switch when challenge is accepted
        // The game will be detected by the game data listener below
          
        // Subscribe to game data
          const gameRef = ref(rtdb, `arena/games/${gameId}`)
        gameUnsubscribe = onValue(gameRef, (gameSnapshot) => {
            if (gameSnapshot.exists()) {
              const gameData = gameSnapshot.val()
            if (gameData.status === 'active') {
              // Verify this is still the user's current game
              // (check happens via the outer listener which will unsubscribe if gameId changes)
              // Load game state from FEN (this is the source of truth)
              const gameInstance = new Chess(gameData.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
              
              // Check if game ended (shouldn't happen if status is active, but check anyway)
              if (gameInstance.isGameOver() || gameInstance.isDraw()) {
                // Game ended - update status
                if (rtdb && userCurrentGame) {
                  const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
                  let winner = null
                  if (gameInstance.isCheckmate()) {
                    winner = gameInstance.turn() === 'w' ? 'black' : 'white'
                  } else if (gameInstance.isStalemate() || gameInstance.isDraw()) {
                    winner = 'draw'
                  }
                  set(gameRef, {
                    status: 'finished',
                    winner: winner,
                    finishedAt: serverTimestamp(),
                  }).catch((error) => {
                    console.error('[Arena] Error updating game end status:', error)
                  })
                }
                setIsRunning(false)
                return
              }
              
              // Only update if the FEN has actually changed (prevents unnecessary updates)
              setGame((prevGame) => {
                if (prevGame.fen() === gameInstance.fen()) {
                  return prevGame // Don't update if FEN hasn't changed
                }
                return gameInstance
              })
              
              // Reconstruct moves from FEN if moveHistory is available
              if (gameData.moveHistory && Array.isArray(gameData.moveHistory) && gameData.moveHistory.length > 0) {
                const reconstructedGame = new Chess()
                const reconstructedMoves = []
                try {
                  // Try to replay moves from moveHistory
                  for (const moveStr of gameData.moveHistory) {
                    if (typeof moveStr === 'string') {
                      const move = reconstructedGame.move(moveStr)
                      if (move) {
                        reconstructedMoves.push(move)
                      }
                    }
                  }
                  // Only update moves if they're different
                  setMoves((prevMoves) => {
                    if (prevMoves.length === reconstructedMoves.length) {
                      // Check if moves are the same
                      const same = prevMoves.every((m, i) => {
                        const pm = reconstructedMoves[i]
                        return m && pm && m.from === pm.from && m.to === pm.to
                      })
                      if (same) return prevMoves
                    }
                    return reconstructedMoves
                  })
                  setCurrentMoveIndex(reconstructedMoves.length - 1)
                } catch (e) {
                  // If move reconstruction fails, just use the FEN
                  console.error('[Arena] Error reconstructing moves:', e)
                  setMoves([])
                  setCurrentMoveIndex(null)
                }
      } else {
                setMoves([])
                setCurrentMoveIndex(null)
              }
              
              setIsWhiteTurn(gameData.currentTurn === 'white')
              
              // Check if game was already started before updating state
              const wasGameStarted = gameStarted
              setGameStarted(true)
              setIsRunning(true)
              
              // Only sync timer from Firebase on initial load or periodically (not on every update)
              // This prevents the timer from being reset while the ChessBoard is counting down
              const now = Date.now()
              const shouldSyncTimer = 
                !lastTimerSyncRef.current || // First time loading the game
                !wasGameStarted || // Game just started
                (now - (lastTimerSyncRef.current || 0) > 10000) // Sync every 10 seconds to catch up if needed
              
              if (shouldSyncTimer) {
                // Convert from milliseconds to seconds for display
                setWhiteTime(Math.floor((gameData.whiteTime || 600000) / 1000))
                setBlackTime(Math.floor((gameData.blackTime || 600000) / 1000))
                lastTimerSyncRef.current = now
              }
              
              // Switch to game tab only when game first starts (for the other user when challenge is accepted)
              // The handleAcceptChallenge function will switch the tab for the accepting user
              
              // Only switch tab if game wasn't already started AND we haven't switched for this game yet
              // This ensures both users switch to game tab when a challenge is accepted, but not on page reload
              if (!wasGameStarted && switchedToGameTabRef.current !== gameId) {
                setActiveTab('game')
                switchedToGameTabRef.current = gameId
              }

              // Set colors (only if not already set to avoid overwriting)
              if (!userColor) {
                if (gameData.whitePlayer === userId) {
                  setUserColor('white')
                  setOpponentColor('black')
                  setFlipped(false)
        } else {
                  setUserColor('black')
                  setOpponentColor('white')
                  setFlipped(true)
                }
              }

              // Get opponent info
          const opponentId = gameData.whitePlayer === userId ? gameData.blackPlayer : gameData.whitePlayer
          if (opponentId) {
                api.getUser(opponentId.replace('bot_', '')).then((opponentData) => {
                  if (opponentData) {
                  setCurrentOpponent({
                      id: opponentId,
                      name: opponentData.chesscom_username || opponentData.name || 'Opponent',
                      avatar_url: opponentData.avatar_url || null,
            })
          }
        }).catch((error) => {
          console.error('[Arena] Error fetching opponent:', error)
        })
              }
            }
          }
              })
      } else {
        // No game - reset everything
        setUserCurrentGame(null)
        setGameStarted(false)
        setIsRunning(false)
        setCurrentOpponent(null)
        setUserColor(null)
        setOpponentColor(null)
        switchedToGameTabRef.current = null // Reset the switch tracking
        lastTimerSyncRef.current = null // Reset timer sync tracking
        // Reset game to starting position
        const newGame = new Chess()
        setGame(newGame)
        setMoves([])
        setCurrentMoveIndex(null)
        setIsWhiteTurn(true)
        setWhiteTime(600)
        setBlackTime(600)
        setFlipped(false)
      }
    })

    return () => {
      unsubscribe()
      if (gameUnsubscribe) {
        gameUnsubscribe()
      }
    }
  }, [user])

  const getUserName = () => {
    if (user?.username) return user.username
    if (user?.chesscom_username) return user.chesscom_username
    if (user?.email) return user.email.split('@')[0]
    return 'player'
  }

  const userPlayer = {
    name: user?.name || 'You',
    username: getUserName(),
    avatar: user?.avatar_url || user?.avatar || user?.photoURL || null,
  }

  // Only show opponent info if game has started (userColor is set)
  const opponentPlayer = userColor && currentOpponent
    ? {
        name: currentOpponent.name,
        username: currentOpponent.name,
        avatar: currentOpponent.avatar_url || null,
      }
    : {
        name: 'Opponent',
        username: 'opponent',
        avatar: null,
      }

  // When not in game, show user as white at bottom
  const whitePlayer = userColor ? (userColor === 'white' ? userPlayer : opponentPlayer) : userPlayer
  const blackPlayer = userColor ? (userColor === 'black' ? userPlayer : opponentPlayer) : opponentPlayer

  const handleMove = (sourceSquare, targetSquare, promotion = 'q') => {
    if (!user || !userCurrentGame || !gameStarted) {
      console.log('[Arena] Move blocked: missing user, game, or not started', { user: !!user, userCurrentGame, gameStarted })
      return false
    }

    // Don't allow moves when replaying/navigating through move history
    if (currentMoveIndex !== null && currentMoveIndex < moves.length - 1) {
      console.log('[Arena] Move blocked: navigating move history', { currentMoveIndex, movesLength: moves.length })
      return false
    }

    // Check if userColor is set
    if (!userColor) {
      console.log('[Arena] Move blocked: userColor not set', { userColor })
      return false
    }

    const gameCopy = new Chess(game.fen())
    const piece = gameCopy.get(sourceSquare)
    const userColorChar = userColor === 'white' ? 'w' : 'b'

    // Validate piece belongs to user
    if (!piece || piece.color !== userColorChar) {
      console.log('[Arena] Move blocked: invalid piece', { piece: !!piece, pieceColor: piece?.color, userColorChar, userColor })
      return false
    }

    // Validate it's the user's turn
    const isUserTurn = (userColor === 'white' && isWhiteTurn) || (userColor === 'black' && !isWhiteTurn)
    if (!isUserTurn) {
      console.log('[Arena] Move blocked: not user turn', { userColor, isWhiteTurn })
      return false
    }

    // Validate it's actually the correct turn in the game
    if (gameCopy.turn() !== userColorChar) {
      console.log('[Arena] Move blocked: wrong turn in game', { gameTurn: gameCopy.turn(), userColorChar })
      return false
    }

    try {
        const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
          promotion: promotion || 'q',
        })
        
        if (move) {
        // Check for game end conditions
        const isGameOver = gameCopy.isGameOver()
        const isDraw = gameCopy.isDraw()
        const isCheckmate = gameCopy.isCheckmate()
        const isStalemate = gameCopy.isStalemate()
        
        let gameStatus = 'active'
        let winner = null
        
        if (isCheckmate) {
          gameStatus = 'finished'
          winner = gameCopy.turn() === 'w' ? 'black' : 'white' // Winner is the player who just moved
        } else if (isStalemate || isDraw) {
          gameStatus = 'finished'
          winner = 'draw'
        }

        setGame(gameCopy)
        const newMoves = [...moves, move]
        setMoves(newMoves)
        setCurrentMoveIndex(newMoves.length - 1)
        setIsWhiteTurn(gameCopy.turn() === 'w')

        // Update Firebase
        if (rtdb && userCurrentGame) {
          const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
          const uciMove = sourceSquare + targetSquare + (move.promotion || '')
          const currentMoves = moves.map((m) => m.san || m)
          const currentUciMoves = moves.map((m) => m.from + m.to + (m.promotion || ''))

          const updateData = {
            fen: gameCopy.fen(),
            moveHistory: [...currentMoves, move.san],
            moveHistoryUci: [...currentUciMoves, uciMove],
            currentTurn: gameCopy.turn() === 'w' ? 'white' : 'black',
            lastMoveTimestamp: serverTimestamp(),
            status: gameStatus,
          }

          if (winner) {
            updateData.winner = winner
          }

          if (gameStatus === 'finished') {
            updateData.finishedAt = serverTimestamp()
            setIsRunning(false)
          }

          set(gameRef, updateData)
        }

        return true
      }
    } catch (e) {
      // Invalid move
      console.error('[Arena] Invalid move:', e)
    }
    return false
  }

  const handleMoveClick = (moveIndex) => {
    if (moveIndex < 0) {
      const newGame = new Chess()
      setGame(newGame)
      setCurrentMoveIndex(null)
      setIsWhiteTurn(true)
      return
    }
    
    const newGame = new Chess()
    for (let i = 0; i <= moveIndex && i < moves.length; i++) {
      const moveObj = moves[i]
      try {
        if (moveObj && typeof moveObj === 'object' && 'from' in moveObj && 'to' in moveObj) {
          newGame.move({
            from: moveObj.from,
            to: moveObj.to,
            promotion: moveObj.promotion || undefined,
          })
        } else if (moveObj && moveObj.san) {
          newGame.move(moveObj.san)
        }
      } catch (e) {
        break
      }
    }

    setGame(newGame)
    setCurrentMoveIndex(moveIndex)
    setIsWhiteTurn(newGame.turn() === 'w')
  }

  const handleTimeUpdate = (color, newTime) => {
    if (color === 'white') {
      setWhiteTime(newTime)
    } else {
      setBlackTime(newTime)
    }

    // Update timer in Firebase periodically (every 5 seconds to avoid too many writes)
    if (rtdb && userCurrentGame && gameStarted) {
      // Use a debounce mechanism - only update if it's been a while since last update
      const now = Date.now()
      if (!handleTimeUpdate.lastUpdate || now - handleTimeUpdate.lastUpdate > 5000) {
        handleTimeUpdate.lastUpdate = now
        const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
        // Convert seconds to milliseconds for Firebase
        // Use update() instead of set() to only update timer fields without overwriting the entire game
        const updateData = {
          whiteTime: color === 'white' ? newTime * 1000 : whiteTime * 1000,
          blackTime: color === 'black' ? newTime * 1000 : blackTime * 1000,
        }
        update(gameRef, updateData).catch((error) => {
          // Only log permission errors in development, they're expected if rules don't allow updates
          if (error?.code !== 'PERMISSION_DENIED' && !error?.message?.includes('permission')) {
            console.error('[Arena] Error updating timer:', error)
          }
        })
      }
    }

    // Check for time out
    if (newTime <= 0) {
      if (rtdb && userCurrentGame) {
        const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
        const winner = color === 'white' ? 'black' : 'white'
        set(gameRef, {
          status: 'finished',
          winner: winner,
          finishedAt: serverTimestamp(),
          timeout: true,
        }).catch((error) => {
          console.error('[Arena] Error updating timeout:', error)
        })
        setIsRunning(false)
      }
    }
  }

  const handleEnterArena = async () => {
    if (!rtdb || !user) return
    
    if (arenaPlayersCount >= MAX_ARENA_PLAYERS) {
      alert('Arena is full. Please try again later.')
      return
    }
    
    setIsInArena(true)
    
    // Check if user has an active game
      const userId = user.id
      const userCurrentGameRef = ref(rtdb, `arena/users/${userId}/currentGame`)
      try {
        const snapshot = await get(userCurrentGameRef)
        if (snapshot.exists()) {
          const gameId = snapshot.val()
          const gameRef = ref(rtdb, `arena/games/${gameId}`)
          const gameSnapshot = await get(gameRef)
          if (gameSnapshot.exists()) {
            const gameData = gameSnapshot.val()
            if (gameData.status === 'active') {
              setUserCurrentGame(gameId)
            } else {
              await set(userCurrentGameRef, null)
            }
          }
        }
      } catch (error) {
        console.error('[Arena] Error checking for existing game:', error)
    }
  }

  const handleExitArena = async () => {
    if (!rtdb || !user) return

      const userId = user.id
    
    // Remove presence immediately - use remove() to ensure it's deleted
    const presenceRef = ref(rtdb, `arena/presence/${userId}`)
    try {
      // Use remove() instead of set(null) for better realtime updates
      await set(presenceRef, null)
      // Force a small delay to ensure Firebase processes the removal
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      // Only log non-permission errors - permission errors are expected if rules don't allow
      if (error?.code !== 'PERMISSION_DENIED' && !error?.message?.includes('permission')) {
        console.error('[Arena] Error removing presence:', error)
      }
    }
    
    if (onDisconnectRef.current) {
      onDisconnectRef.current.cancel()
      onDisconnectRef.current = null
    }
    presenceRefRef.current = null

    // Clean up challenges
    const challengeRef = ref(rtdb, `arena/challenges/${userId}`)
    try {
      await set(challengeRef, null)
    } catch (error) {
      console.error('[Arena] Error removing challenge:', error)
    }

    setIsInArena(false)
    setAvailablePlayers([])
    // The realtime listener will update arenaPlayersCount automatically
    setCurrentOpponent(null)
    
    // Reset game state when exiting arena (if not in a game)
    if (!userCurrentGame) {
      const newGame = new Chess()
      setGame(newGame)
      setMoves([])
      setCurrentMoveIndex(null)
      setGameStarted(false)
      setIsRunning(false)
      setIsWhiteTurn(true)
      setWhiteTime(600)
      setBlackTime(600)
      setUserColor(null)
      setOpponentColor(null)
      setFlipped(false)
    }
  }

  const handleChallengePlayer = async (opponentId) => {
    if (!rtdb || !user || userCurrentGame) return

    const userId = user.id
    const opponent = availablePlayers.find((p) => p.id === opponentId)
    if (!opponent) return

    // Skip bots - no bot challenges
    if (opponent.isBot) {
        return
      }

    // Send challenge to player
      const challengeRef = ref(rtdb, `arena/challenges/${opponentId}`)
        await set(challengeRef, {
          from: userId,
          to: opponentId,
          timestamp: serverTimestamp(),
        })
        
        setCurrentOpponent(opponent)
    setActiveTab('game') // Switch to game tab when challenging someone
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
      
      const initialTime = 600000 // 10 minutes in milliseconds
      const initialTimeSeconds = 600 // 10 minutes in seconds
      
      // Set local state immediately
      setWhiteTime(initialTimeSeconds)
      setBlackTime(initialTimeSeconds)
      
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
      
      // Set game reference for both players
      await set(ref(rtdb, `arena/users/${userId}/currentGame`), gameId)
        await set(ref(rtdb, `arena/users/${opponentId}/currentGame`), gameId)
      
      // Initialize game state immediately (don't wait for listener)
      const initialGame = new Chess()
      setGame(initialGame)
      setMoves([])
      setCurrentMoveIndex(null)
      setIsWhiteTurn(true)
      setUserCurrentGame(gameId)
      setGameStarted(true)
      setIsRunning(true)
      
      // Set colors
      if (userIsWhite) {
        setUserColor('white')
        setOpponentColor('black')
        setFlipped(false)
      } else {
        setUserColor('black')
        setOpponentColor('white')
        setFlipped(true)
      }
      
      // Get opponent info
      api.getUser(opponentId).then((opponentData) => {
        if (opponentData) {
          setCurrentOpponent({
            id: opponentId,
            name: opponentData.chesscom_username || opponentData.name || 'Opponent',
            avatar_url: opponentData.avatar_url || null,
          })
        }
      }).catch((error) => {
        console.error('[Arena] Error fetching opponent:', error)
      })
      
      // Clear challenge state
      setPendingChallenge(null)
      setOutgoingChallenge(null)
      setChallengeOpponent(null)
      
      // Switch to game tab and mark that we've switched for this game
      setActiveTab('game')
      switchedToGameTabRef.current = gameId
    } catch (error) {
      console.error('[Arena] Error accepting challenge:', error)
    }
  }

  const handleDeclineChallenge = async () => {
    if (!rtdb || !user || !pendingChallenge) return

    const userId = user.id
    
    try {
      // Remove challenge
      const challengeRef = ref(rtdb, `arena/challenges/${userId}`)
      await set(challengeRef, null)
      
      // Clear challenge state
      setPendingChallenge(null)
      setChallengeOpponent(null)
      setCurrentOpponent(null)
      setActiveTab('challenge') // Switch back to challenge tab
    } catch (error) {
      console.error('[Arena] Error declining challenge:', error)
    }
  }

  const handleCancelChallenge = async () => {
    if (!rtdb || !user || !outgoingChallenge) return

    const opponentId = outgoingChallenge.to
    
    try {
      // Remove challenge
      const challengeRef = ref(rtdb, `arena/challenges/${opponentId}`)
      await set(challengeRef, null)
      
      // Clear challenge state
      setOutgoingChallenge(null)
      setChallengeOpponent(null)
      setCurrentOpponent(null)
      setActiveTab('challenge') // Switch back to challenge tab
    } catch (error) {
      console.error('[Arena] Error canceling challenge:', error)
    }
  }

  const handleResign = async () => {
    if (!rtdb || !user || !userCurrentGame || !gameStarted) return

      const userId = user.id
    const winner = userColor === 'white' ? 'black' : 'white'
    
    try {
    const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
      await set(gameRef, {
        status: 'finished',
        winner: winner,
        resigned: true,
        resignedBy: userId,
        finishedAt: serverTimestamp(),
      })
      
      setIsRunning(false)
      setGameStarted(false)
    } catch (error) {
      console.error('[Arena] Error resigning:', error)
    }
  }

  const handleOfferDraw = async () => {
    if (!rtdb || !user || !userCurrentGame || !gameStarted) return

    const userId = user.id
    
    try {
      const gameRef = ref(rtdb, `arena/games/${userCurrentGame}`)
      const gameSnapshot = await get(gameRef)
      if (gameSnapshot.exists()) {
        const gameData = gameSnapshot.val()
        const currentDrawOffer = gameData.drawOffer
        
        // If opponent already offered draw, accept it
        if (currentDrawOffer && currentDrawOffer !== userId) {
      await set(gameRef, {
            status: 'finished',
            winner: 'draw',
        drawOffer: null,
            finishedAt: serverTimestamp(),
          })
          setIsRunning(false)
          setGameStarted(false)
          } else {
          // Offer draw
          await update(gameRef, {
            drawOffer: userId,
          })
        }
          }
        } catch (error) {
      console.error('[Arena] Error offering draw:', error)
    }
  }

  const gamePosition = useMemo(() => game.fen(), [game])

  const lastMove = useMemo(() => {
    if (moves.length > 0) {
      const lastMoveObj = moves[moves.length - 1]
        return {
        from: lastMoveObj.from,
        to: lastMoveObj.to,
      }
    }
    return null
  }, [moves])

  if (authLoading) {
    return <PageLoader />
  }

  return (
    <div className="arena-page">
      <div className="arena-container">
        <div className="arena-board-section" ref={sectionRef}>
          <ChessBoard
            position={gamePosition}
            onMove={handleMove}
            flipped={flipped}
            arePiecesDraggable={user && gameStarted && (currentMoveIndex === null || currentMoveIndex === moves.length - 1)}
            allowFreeMoves={false}
            whitePlayer={whitePlayer}
            blackPlayer={blackPlayer}
            whiteTime={whiteTime > 10000 ? Math.floor(whiteTime / 1000) : whiteTime}
            blackTime={blackTime > 10000 ? Math.floor(blackTime / 1000) : blackTime}
            isWhiteTurn={isWhiteTurn}
            isRunning={isRunning}
            onTimeUpdate={handleTimeUpdate}
            sectionRef={sectionRef}
            showTimer={true}
            lastMove={lastMove}
          />
            </div>

        <div className="arena-content-section">
        {!user ? (
            <div className="arena-login-prompt">
              <div className="arena-login-content">
                <h2>Login Required</h2>
                <p>Please log in to play in the arena.</p>
                <button
                  className="arena-login-btn"
                  onClick={() => navigate('/login', { state: { from: '/arena' } })}
                >
                  Log In
                    </button>
                <button
                  className="arena-signup-btn"
                  onClick={() => navigate('/signup', { state: { from: '/arena' } })}
                >
                  Sign Up
                </button>
                </div>
              </div>
          ) : !isInArena ? (
            <div className="arena-enter-section">
              <div className="arena-enter-content">
                <div className="arena-enter-icon-wrapper">
                  <Swords className="arena-enter-icon" />
            </div>
                <h2 className="arena-enter-title">Enter Arena</h2>
                <p className="arena-enter-description">
                  Join the arena to challenge other players and test your skills.
                </p>
                <div className="arena-enter-players-count">
                  <Users size={18} />
                  <span>
                    {arenaPlayersCount === 0 
                      ? 'No players in arena' 
                      : `${arenaPlayersCount} player${arenaPlayersCount !== 1 ? 's' : ''} in arena`
                    }
                                </span>
                              </div>
                          <button
                  className="arena-enter-btn"
                            onClick={handleEnterArena}
                  disabled={arenaPlayersCount >= MAX_ARENA_PLAYERS}
                >
                  <Swords size={20} />
                  <span>Enter Arena</span>
                          </button>
                {arenaPlayersCount >= MAX_ARENA_PLAYERS && (
                  <p className="arena-enter-full">Arena is full. Please try again later.</p>
                )}
                        </div>
                      </div>
          ) : (
            <>
              <div className="arena-controls">
                <div className="arena-controls-top">
                  <div className="arena-players-count-header">
                    <Users size={18} />
                    <span>{arenaPlayersCount} / {MAX_ARENA_PLAYERS} players</span>
                    </div>
              <button
                    className="arena-exit-btn"
                onClick={handleExitArena}
                    title="Exit Arena"
              >
                    Exit
              </button>
            </div>
                <div className="arena-tabs">
                  {(pendingChallenge || outgoingChallenge || userCurrentGame) && (
                    <button
                      className={`arena-tab ${activeTab === 'game' ? 'active' : ''}`}
                      onClick={() => setActiveTab('game')}
                    >
                      <Swords size={16} />
                      <span>Game</span>
                    </button>
                  )}
                      <button
                    className={`arena-tab ${activeTab === 'challenge' ? 'active' : ''}`}
                        onClick={() => setActiveTab('challenge')}
                  >
                    <Users size={16} />
                    <span>Challenge</span>
                  </button>
                        <button
                    className={`arena-tab ${activeTab === 'rankings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rankings')}
                  >
                    <Trophy size={16} />
                    <span>Rankings</span>
                  </button>
                </div>
              </div>

              <div className="arena-tab-content">
                      {activeTab === 'challenge' && (
                  <div className="arena-challenge-content">
                            {availablePlayers.length === 0 ? (
                      <div className="arena-empty">
                        <Users size={48} />
                        <p>No other players in arena. Waiting for opponents...</p>
                      </div>
                    ) : (
                      <div className="arena-players-list">
                                {availablePlayers
                                  .filter((player) => !player.isBot) // Filter out bots
                                  .map((player) => {
                                    const isInMatch = playersInMatches.has(player.id)
                                  return (
                                    <div
                                      key={player.id}
                                        className={`arena-player-card ${isInMatch ? 'in-match' : ''}`}
                                      >
                                        <div className="arena-player-info">
                                          {player.avatar_url ? (
                                            <img
                                              src={player.avatar_url}
                                              alt={player.name}
                                              className="arena-player-avatar"
                                            />
                                          ) : (
                                            <div className="arena-player-avatar-placeholder">
                                              <UserIcon size={20} />
                                            </div>
                                          )}
                                          <div className="arena-player-details">
                                            <div className="arena-player-name">{player.name}</div>
                                            <div className="arena-player-status">Rating: {player.rating}</div>
                                          </div>
                                        </div>
                                            {isInMatch ? (
                                          <div className="arena-player-status-badge">Playing</div>
                                        ) : (
                                          <button
                                            className="arena-challenge-btn"
                                            onClick={() => handleChallengePlayer(player.id)}
                                            disabled={!!userCurrentGame}
                                          >
                                            <Swords size={16} />
                                            <span>Challenge</span>
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })}
                      </div>
                    )}
                  </div>
                )}

                      {activeTab === 'game' && (
                  <div className="arena-game-content">
                    {userCurrentGame ? (
                      <div className="arena-game-active">
                        <div className="arena-game-status">
                          <Swords size={24} />
                          <h3>Game in Progress</h3>
                          <p>Playing against {currentOpponent?.name || 'Opponent'}</p>
                        </div>
                        {gameStarted && (
                          <>
                            <div className="arena-game-actions">
                              <button
                                className="arena-resign-btn"
                                onClick={handleResign}
                                disabled={!isRunning}
                              >
                                <Flag size={16} />
                                <span>Resign</span>
                              </button>
                              <button
                                className="arena-draw-btn"
                                onClick={handleOfferDraw}
                                disabled={!isRunning}
                              >
                                <Handshake size={16} />
                                <span>Offer Draw</span>
                              </button>
                            </div>
                            <div className="arena-game-move-history">
                              <MoveHistory
                                moves={moves}
                                currentMoveIndex={currentMoveIndex}
                                onMoveClick={handleMoveClick}
                                flipped={flipped}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ) : pendingChallenge ? (
                      <div className="arena-challenge-received">
                        <div className="arena-challenge-header">
                          <div className="arena-challenge-icon-wrapper">
                            <Swords className="arena-challenge-icon" />
                          </div>
                          <h3>Challenge Received</h3>
                        </div>
                        {challengeOpponent && (
                          <div className="arena-challenge-opponent">
                            <div className="arena-challenge-opponent-info">
                              {challengeOpponent.avatar_url ? (
                                <img
                                  src={challengeOpponent.avatar_url}
                                  alt={challengeOpponent.name}
                                  className="arena-challenge-opponent-avatar"
                                    />
                                  ) : (
                                <div className="arena-challenge-opponent-avatar-placeholder">
                                  <UserIcon size={24} />
                                </div>
                              )}
                              <div className="arena-challenge-opponent-details">
                                <div className="arena-challenge-opponent-name">{challengeOpponent.name}</div>
                                <div className="arena-challenge-opponent-status">challenged you</div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="arena-challenge-actions">
                          <button
                            className="arena-challenge-accept-btn"
                                    onClick={handleAcceptChallenge}
                          >
                            <Check size={18} />
                            <span>Accept</span>
                          </button>
                                  <button
                            className="arena-challenge-decline-btn"
                                    onClick={handleDeclineChallenge}
                          >
                            <X size={18} />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>
                    ) : outgoingChallenge ? (
                      <div className="arena-challenge-sent">
                        <div className="arena-challenge-header">
                          <div className="arena-challenge-icon-wrapper">
                            <Clock className="arena-challenge-icon" />
                          </div>
                          <h3>Challenge Sent</h3>
                        </div>
                        {currentOpponent && (
                          <div className="arena-challenge-opponent">
                            <div className="arena-challenge-opponent-info">
                                {currentOpponent.avatar_url ? (
                                  <img
                                    src={currentOpponent.avatar_url}
                                    alt={currentOpponent.name}
                                  className="arena-challenge-opponent-avatar"
                                  />
                                ) : (
                                <div className="arena-challenge-opponent-avatar-placeholder">
                                  <UserIcon size={24} />
                                </div>
                              )}
                              <div className="arena-challenge-opponent-details">
                                <div className="arena-challenge-opponent-name">{currentOpponent.name}</div>
                                <div className="arena-challenge-opponent-status">waiting for response...</div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="arena-challenge-actions">
                                        <button
                            className="arena-challenge-cancel-btn"
                            onClick={handleCancelChallenge}
                          >
                            <X size={18} />
                            <span>Cancel Challenge</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="arena-empty">
                        <Swords size={48} />
                        <p>No active challenge or game</p>
                      </div>
                    )}
                  </div>
                )}

                      {activeTab === 'rankings' && (
                  <div className="arena-rankings-content">
                    <div className="arena-empty">
                      <Trophy size={48} />
                      <p>Rankings coming soon</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
