import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Chess } from 'chess.js'
import { ChessBoard } from '../components/chess/ChessBoard.jsx'
import { useSEO } from '../hooks/use-seo.js'
import { useChessEngine } from '../hooks/useChessEngine.js'
import { getBots } from '../lib/bots/index.js'
import { chooseMoveWithPersonality } from '../lib/bots/botMove.js'
import { Trophy, CheckCircle2, XCircle, Minus, Clock, Play, History, Eye, List, BarChart3, Gamepad2, ArrowLeft, Plus, Brain, Trash2 } from 'lucide-react'
import { PageLoader } from '../components/ui/PageLoader.jsx'
import { MoveHistory } from '../components/chess/MoveHistory.jsx'
import { useAuthStore } from '../store/auth-store.js'
import { rtdb } from '../lib/firebase.js'
import { ref, onValue, set, serverTimestamp, get } from 'firebase/database'
import './BotTournaments.css'

export function BotTournaments() {
  const { user, loading: authLoading } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { engine, isLoading: engineLoading } = useChessEngine()
  const [game, setGame] = useState(new Chess())
  const [moves, setMoves] = useState([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(null)
  const [whiteTime, setWhiteTime] = useState(600)
  const [blackTime, setBlackTime] = useState(600)
  const [isWhiteTurn, setIsWhiteTurn] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameEnded, setGameEnded] = useState(false)
  const sectionRef = useRef(null)
  
  // Tournament state
  const [tournament, setTournament] = useState(null)
  const [allTournaments, setAllTournaments] = useState([])
  const [selectedTournamentId, setSelectedTournamentId] = useState(null)
  const [selectedBots, setSelectedBots] = useState([])
  const [tournamentName, setTournamentName] = useState('')
  const [tournamentMatches, setTournamentMatches] = useState([])
  const [tournamentStandings, setTournamentStandings] = useState([])
  const [currentTournamentMatch, setCurrentTournamentMatch] = useState(null)
  const [isTournamentRunning, setIsTournamentRunning] = useState(false)
  
  // External bots state
  const [externalBots, setExternalBots] = useState([])
  const [showAddExternalBot, setShowAddExternalBot] = useState(false)
  const [externalBotForm, setExternalBotForm] = useState({
    name: '',
    id: '',
    creatorUsername: '',
    apiLink: ''
  })
  
  // Tab state (only for admin)
  const [activeTab, setActiveTab] = useState('create')
  
  // View state for normal users
  const [viewingTournamentDetails, setViewingTournamentDetails] = useState(false)
  
  // Match replay state
  const [replayingMatch, setReplayingMatch] = useState(null)
  const [replayMoves, setReplayMoves] = useState([])
  const [replayGame, setReplayGame] = useState(new Chess())
  
  // Bot players for display
  const [whiteBot, setWhiteBot] = useState(null)
  const [blackBot, setBlackBot] = useState(null)
  
  const availableBots = getBots()
  const isAdmin = user?.is_admin || false

  // Get bot player info
  const getBotPlayer = (bot) => {
    if (bot === 'stockfish') {
      return {
        name: 'Stockfish 17',
        username: 'stockfish17',
        avatar: 'https://stockfishchess.org/images/logo/icon_512x512@2x.webp',
      }
    }
    if (bot && typeof bot === 'object') {
      return {
        name: bot.name,
        username: bot.id,
        avatar: bot.icon,
      }
    }
    return null
  }

  const whitePlayer = getBotPlayer(whiteBot) || { name: 'White Bot', username: 'white', avatar: null }
  const blackPlayer = getBotPlayer(blackBot) || { name: 'Black Bot', username: 'black', avatar: null }

  useSEO({
    title: 'Bot Tournaments',
    description: 'Watch bots compete in tournaments',
    url: '/bot-tournaments',
  })

  // Memoize the position to avoid unnecessary re-renders
  // Use replay game position if in replay mode, otherwise use regular game
  const gamePosition = replayingMatch ? replayGame.fen() : game.fen()
  
  // Get the last move for highlighting
  const lastMove = moves.length > 0 ? {
    from: moves[moves.length - 1].from,
    to: moves[moves.length - 1].to
  } : null

  // Tournament functions
  const handleBotToggle = (bot) => {
    if (tournament && tournament.status === 'running') {
      return // Can't change bots during tournament
    }
    setSelectedBots(prev => {
      const botId = bot === 'stockfish' ? 'stockfish' : (bot.id || bot)
      if (prev.includes(botId)) {
        return prev.filter(id => id !== botId)
      } else {
        return [...prev, botId]
      }
    })
  }

  // External bot handlers
  const handleAddExternalBot = () => {
    if (!externalBotForm.name.trim() || !externalBotForm.id.trim() || !externalBotForm.apiLink.trim()) {
      alert('Please fill in all fields (name, id, and API link are required)')
      return
    }

    // Validate API link is a URL
    try {
      new URL(externalBotForm.apiLink)
    } catch (e) {
      alert('Please enter a valid API URL')
      return
    }

    // Check if ID already exists
    if (externalBots.some(b => b.id === externalBotForm.id.trim()) || 
        availableBots.some(b => b.id === externalBotForm.id.trim()) ||
        externalBotForm.id.trim() === 'stockfish') {
      alert('Bot ID already exists')
      return
    }

    const newExternalBot = {
      id: externalBotForm.id.trim(),
      name: externalBotForm.name.trim(),
      creatorUsername: externalBotForm.creatorUsername.trim() || '',
      apiLink: externalBotForm.apiLink.trim(),
      isExternal: true
    }

    setExternalBots(prev => [...prev, newExternalBot])
    setExternalBotForm({ name: '', id: '', creatorUsername: '', apiLink: '' })
    setShowAddExternalBot(false)
  }

  const handleRemoveExternalBot = (botId) => {
    if (tournament && tournament.status === 'running') {
      return // Can't remove bots during tournament
    }
    setExternalBots(prev => prev.filter(b => b.id !== botId))
    setSelectedBots(prev => prev.filter(id => id !== botId))
  }

  // Generate round-robin pairings (everyone plays everyone, both colors)
  const generateRoundRobinPairings = (botIds) => {
    const pairings = []
    for (let i = 0; i < botIds.length; i++) {
      for (let j = i + 1; j < botIds.length; j++) {
        // Each pair plays twice (once as white, once as black)
        pairings.push({
          whiteBot: botIds[i],
          blackBot: botIds[j],
          matchId: `${botIds[i]}_${botIds[j]}_1`,
          status: 'pending',
          result: null,
        })
        pairings.push({
          whiteBot: botIds[j],
          blackBot: botIds[i],
          matchId: `${botIds[j]}_${botIds[i]}_2`,
          status: 'pending',
          result: null,
        })
      }
    }
    return pairings
  }

  // Helper function to clean data for Firebase (remove undefined values)
  const cleanForFirebase = (obj) => {
    if (obj === null || obj === undefined) {
      return null
    }
    if (Array.isArray(obj)) {
      return obj.map(item => cleanForFirebase(item))
    }
    if (typeof obj === 'object') {
      const cleaned = {}
      for (const key in obj) {
        if (obj[key] !== undefined) {
          cleaned[key] = cleanForFirebase(obj[key])
        }
      }
      return cleaned
    }
    return obj
  }

  const handleStartTournament = async () => {
    if (selectedBots.length < 2) {
      alert('Please select at least 2 bots for the tournament')
      return
    }

    if (!tournamentName.trim()) {
      alert('Please enter a tournament name')
      return
    }

    if (!rtdb) {
      alert('Firebase not configured')
      return
    }

    const tournamentId = `tournament_${Date.now()}`
    const pairings = generateRoundRobinPairings(selectedBots)
    
    // Convert matches array to object for Firebase
    const matchesObj = {}
    pairings.forEach(match => {
      matchesObj[match.matchId] = match
    })

    // Convert standings array to object for Firebase
    const standingsObj = {}
    selectedBots.forEach(botId => {
      standingsObj[botId] = {
        botId,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
      }
    })
    
    const tournamentData = {
      id: tournamentId,
      name: tournamentName.trim(),
      bots: selectedBots,
      externalBots: externalBots.filter(bot => selectedBots.includes(bot.id)),
      matches: matchesObj,
      status: 'running',
      createdAt: serverTimestamp(),
      standings: standingsObj,
    }

    try {
      const tournamentRef = ref(rtdb, `botTournaments/${tournamentId}`)
      await set(tournamentRef, cleanForFirebase(tournamentData))
      
      setTournament(tournamentData)
      setTournamentMatches(pairings)
      setIsTournamentRunning(true)
      setTournamentName('') // Reset name after creating
      setSelectedBots([]) // Reset bot selection
      setActiveTab('standings') // Switch to standings tab
      
      // Don't start matches automatically - user will click to start
    } catch (error) {
      console.error('[BotTournaments] Error starting tournament:', error)
      alert('Failed to start tournament')
    }
  }

  // Play a tournament match
  const playTournamentMatch = async (match, tournamentId) => {
    if (!engine || !engine.getIsReady()) {
      return
    }

    setCurrentTournamentMatch(match)
    
    // Get bot objects (check external bots first, then available bots)
    const whiteBotObj = match.whiteBot === 'stockfish' 
      ? 'stockfish' 
      : (externalBots.find(b => b.id === match.whiteBot) || availableBots.find(b => b.id === match.whiteBot))
    const blackBotObj = match.blackBot === 'stockfish' 
      ? 'stockfish' 
      : (externalBots.find(b => b.id === match.blackBot) || availableBots.find(b => b.id === match.blackBot))

    if (!whiteBotObj || !blackBotObj) {
      console.error('[BotTournaments] Invalid bot configuration for match')
      return
    }

    // Set up board for this match
    const newGame = new Chess()
    setGame(newGame)
    setMoves([])
    setCurrentMoveIndex(null)
    setIsWhiteTurn(true)
    setGameStarted(true)
    setIsRunning(true)
    setGameEnded(false)
    
    // Set bot players for display
    setWhiteBot(whiteBotObj)
    setBlackBot(blackBotObj)

    // Play the game (with board updates, but no Firebase updates during game)
    const gameResult = await playBotGame(whiteBotObj, blackBotObj, engine, true)
    
    // Update Firebase only once after match ends
    const matchRef = ref(rtdb, `botTournaments/${tournamentId}/matches/${match.matchId}`)
    const result = gameResult.result // '1-0', '0-1', or '1/2-1/2'
    await set(matchRef, cleanForFirebase({
      ...match,
      status: 'completed',
      result,
      pgn: gameResult.pgn,
      moves: gameResult.moves,
    }))
    
    // Mark game as ended
    setGameEnded(true)
    setIsRunning(false)

    // Update standings
    await updateTournamentStandings(tournamentId, match.whiteBot, match.blackBot, result)

    // Check if all matches are complete
    const tournamentRef = ref(rtdb, `botTournaments/${tournamentId}`)
    const snapshot = await get(tournamentRef)
    const tournamentData = snapshot.val()
    
    if (tournamentData && tournamentData.matches) {
      const matches = Object.values(tournamentData.matches)
      const allMatchesComplete = matches.every(m => m.status === 'completed')
      
      if (allMatchesComplete) {
        // Tournament complete - update status
        await set(ref(rtdb, `botTournaments/${tournamentId}/status`), 'completed')
        setIsTournamentRunning(false)
        setCurrentTournamentMatch(null)
        setGameStarted(false)
        setIsRunning(false)
      } else {
        // Still have pending matches
        setCurrentTournamentMatch(null)
        setIsRunning(false)
        setGameStarted(false)
      }
    } else {
      setIsTournamentRunning(false)
      setCurrentTournamentMatch(null)
    }
  }

  // Play a game between two bots
  const playBotGame = async (whiteBotObj, blackBotObj, engine, updateBoard = false) => {
    const game = new Chess()
    const moves = []
    let isWhiteTurn = true

    // Initialize board if updating - use a single stable instance
    let boardGame = null
    if (updateBoard) {
      boardGame = new Chess()
      setGame(boardGame)
      setMoves([])
      setCurrentMoveIndex(null)
      setIsWhiteTurn(true)
    }

    while (!game.isGameOver() && !game.isDraw() && !game.isCheckmate() && !game.isStalemate()) {
      const botToMove = isWhiteTurn ? whiteBotObj : blackBotObj
      const botColor = isWhiteTurn ? 'w' : 'b'

      try {
        let moveUci = null

        if (botToMove === 'stockfish') {
          // Use Stockfish engine at full strength
          // Reset engine to maximum strength (in case it was limited by previous bot moves)
          if (engine.setStrength) {
            try {
              await engine.setStrength(false, 0) // Disable Elo limit, use maximum strength
            } catch (e) {
              // If setting strength fails, continue anyway
              console.warn('Failed to reset engine strength:', e)
            }
          }
          
          // Reset multipv to 1 for best move only
          if (engine.setMultiPv) {
            try {
              await engine.setMultiPv(1)
            } catch (e) {
              // If setting multipv fails, continue anyway
            }
          }
          
          // Use higher depth for Stockfish (20 instead of 15 for stronger play)
          const positionEval = await engine.evaluatePosition(game.fen(), 20)
          const bestMoveUci = positionEval.bestMove
          
          if (!bestMoveUci || bestMoveUci === '(none)') {
            throw new Error('No best move returned from engine')
          }
          
          moveUci = bestMoveUci
        } else if (botToMove && typeof botToMove === 'object') {
          // Check if it's an external bot
          if (botToMove.isExternal && botToMove.apiLink) {
            try {
              // Get current FEN position
              const currentFen = game.fen()
              
              // Call external API
              const response = await fetch(botToMove.apiLink, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fen: currentFen }),
                signal: AbortSignal.timeout(30000) // 30 second timeout
              })
              
              if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`)
              }
              
              const data = await response.json()
              
              // Expect response with move in UCI format (e.g., { move: "e2e4" } or { move: "e2e4q" })
              if (data.move && typeof data.move === 'string') {
                moveUci = data.move.toLowerCase()
              } else {
                throw new Error('Invalid API response format: expected { move: "e2e4" }')
              }
            } catch (error) {
              console.error('[BotTournaments] Error calling external bot API:', error)
              
              // Fallback to random move
              const possibleMoves = game.moves({ verbose: true })
              if (possibleMoves.length > 0) {
                const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
                moveUci = randomMove.from + randomMove.to + (randomMove.promotion || '')
              } else {
                throw new Error('No moves available and external API failed')
              }
            }
          } else {
            // Regular bot - use personality-based move selection
            // Ensure engine strength is set correctly for this bot's Elo
            const botElo = botToMove.elo || 2000
            if (engine.setStrength) {
              try {
                // Clamp Elo to Stockfish's supported range (1350-2850)
                const clampedElo = Math.max(1350, Math.min(2850, botElo))
                await engine.setStrength(true, clampedElo)
              } catch (e) {
                // If setting strength fails, continue without limiting
                console.warn('Failed to set engine strength for bot:', e)
              }
            }
            
            // Set multipv for personality-based move selection
            if (engine.setMultiPv) {
              try {
                const multipvCount = botElo < 1800 ? 5 : botElo < 2200 ? 4 : 3
                await engine.setMultiPv(multipvCount)
              } catch (e) {
                // If setting multipv fails, continue with default
              }
            }
            
            const personality = {
              elo: botElo,
              blunder_rate: botToMove.blunder_rate || 0.15,
              depth: botToMove.depth || 0,
              max_ms: botToMove.max_ms || 350,
            }
            moveUci = await chooseMoveWithPersonality(game, personality, engine)
            
            if (!moveUci) {
              throw new Error('No move returned from bot')
            }
          }
        }

        if (moveUci && moveUci !== '(none)') {
          // Add random delay for all bots except external API bots
          // External bots may have their own timing/rate limiting
          if (!botToMove?.isExternal) {
            const minDelay = 500
            const maxDelay = 2000
            const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay
            await new Promise(resolve => setTimeout(resolve, randomDelay))
          }
          
          const from = moveUci.substring(0, 2)
          const to = moveUci.substring(2, 4)
          const promotion = moveUci.length > 4 ? moveUci[4] : undefined

          const move = game.move({
            from,
            to,
            promotion: promotion ? promotion.toLowerCase() : 'q',
          })

          if (move) {
            moves.push(move)
            isWhiteTurn = !isWhiteTurn
            
            // Update board if requested - update incrementally for stability
            if (updateBoard && boardGame) {
              boardGame.move({
                from: move.from,
                to: move.to,
                promotion: move.promotion,
              })
              
              // Update state - batch updates to reduce re-renders
              const newGameInstance = new Chess(boardGame.fen())
              setGame(newGameInstance)
              setMoves([...moves])
              setCurrentMoveIndex(moves.length - 1)
              setIsWhiteTurn(isWhiteTurn)
            }
          } else {
            break
          }
        } else {
          // Fallback to random move
          const possibleMoves = game.moves({ verbose: true })
          if (possibleMoves.length > 0) {
            const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
            const move = game.move(randomMove)
            if (move) {
              moves.push(move)
              isWhiteTurn = !isWhiteTurn
              
              // Update board if requested
              if (updateBoard && boardGame) {
                boardGame.move({
                  from: move.from,
                  to: move.to,
                  promotion: move.promotion,
                })
                
                // Update state - batch updates to reduce re-renders
                const newGameInstance = new Chess(boardGame.fen())
                setGame(newGameInstance)
                setMoves([...moves])
                setCurrentMoveIndex(moves.length - 1)
                setIsWhiteTurn(isWhiteTurn)
                
                // Add delay so users can see the moves
                await new Promise(resolve => setTimeout(resolve, 500))
              }
            } else {
              break
            }
          } else {
            break
          }
        }
      } catch (error) {
        // Fallback to random move
        try {
          const possibleMoves = game.moves({ verbose: true })
          if (possibleMoves.length > 0) {
            const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
            const move = game.move(randomMove)
            if (move) {
              moves.push(move)
              isWhiteTurn = !isWhiteTurn
              
              // Update board if requested
              if (updateBoard && boardGame) {
                boardGame.move({
                  from: move.from,
                  to: move.to,
                  promotion: move.promotion,
                })
                
                // Update state - batch updates to reduce re-renders
                const newGameInstance = new Chess(boardGame.fen())
                setGame(newGameInstance)
                setMoves([...moves])
                setCurrentMoveIndex(moves.length - 1)
                setIsWhiteTurn(isWhiteTurn)
                
                // Add delay so users can see the moves
                await new Promise(resolve => setTimeout(resolve, 500))
              }
            } else {
              break
            }
          } else {
            break
          }
        } catch (fallbackError) {
          break
        }
      }

      // Safety limit
      if (moves.length > 500) {
        break
      }
    }

    // Determine result
    let result = '1/2-1/2'
    if (game.isCheckmate()) {
      result = game.turn() === 'w' ? '0-1' : '1-0'
    } else if (game.isDraw() || game.isStalemate()) {
      result = '1/2-1/2'
    }

    // Generate PGN
    const cleanGame = new Chess()
    for (const move of moves) {
      try {
        if (move.from && move.to) {
          cleanGame.move({ from: move.from, to: move.to, promotion: move.promotion })
        } else if (move.san) {
          cleanGame.move(move.san)
        }
      } catch (e) {
        // Error replaying move
      }
    }

    const whiteName = whiteBotObj === 'stockfish' ? 'Stockfish 17' : whiteBotObj.name
    const blackName = blackBotObj === 'stockfish' ? 'Stockfish 17' : blackBotObj.name

    cleanGame.header('Event', 'Bot Tournament')
    cleanGame.header('White', whiteName)
    cleanGame.header('Black', blackName)
    cleanGame.header('Result', result)

    return {
      result,
      pgn: cleanGame.pgn(),
      moves,
    }
  }

  // Update tournament standings
  const updateTournamentStandings = async (tournamentId, whiteBotId, blackBotId, result) => {
    const standingsRef = ref(rtdb, `botTournaments/${tournamentId}/standings`)
    const snapshot = await get(standingsRef)
    const standings = snapshot.val() || {}

    // Update white bot
    if (standings[whiteBotId]) {
      if (result === '1-0') {
        standings[whiteBotId].wins = (standings[whiteBotId].wins || 0) + 1
        standings[whiteBotId].points = (standings[whiteBotId].points || 0) + 1
      } else if (result === '0-1') {
        standings[whiteBotId].losses = (standings[whiteBotId].losses || 0) + 1
      } else {
        standings[whiteBotId].draws = (standings[whiteBotId].draws || 0) + 1
        standings[whiteBotId].points = (standings[whiteBotId].points || 0) + 0.5
      }
    }

    // Update black bot
    if (standings[blackBotId]) {
      if (result === '0-1') {
        standings[blackBotId].wins = (standings[blackBotId].wins || 0) + 1
        standings[blackBotId].points = (standings[blackBotId].points || 0) + 1
      } else if (result === '1-0') {
        standings[blackBotId].losses = (standings[blackBotId].losses || 0) + 1
      } else {
        standings[blackBotId].draws = (standings[blackBotId].draws || 0) + 1
        standings[blackBotId].points = (standings[blackBotId].points || 0) + 0.5
      }
    }

    await set(standingsRef, standings)
    const standingsArray = Object.values(standings).sort((a, b) => b.points - a.points)
    setTournamentStandings(standingsArray)
  }

  // Load tournament data
  useEffect(() => {
    if (!rtdb) return

    const tournamentsRef = ref(rtdb, 'botTournaments')
    const unsubscribe = onValue(tournamentsRef, (snapshot) => {
      const tournaments = snapshot.val()
      if (tournaments) {
        // Convert tournaments object to array and sort by creation time (newest first)
        const tournamentsArray = Object.entries(tournaments)
          .map(([id, data]) => ({
            id,
            ...data,
            createdAt: data.createdAt || { seconds: 0 }
          }))
          .sort((a, b) => {
            // Sort by tournament ID (which includes timestamp) or createdAt
            const aTime = a.id.includes('_') ? parseInt(a.id.split('_')[1]) : (a.createdAt?.seconds || 0) * 1000
            const bTime = b.id.includes('_') ? parseInt(b.id.split('_')[1]) : (b.createdAt?.seconds || 0) * 1000
            return bTime - aTime
          })
        
        setAllTournaments(tournamentsArray)
        
        // Get the tournament to show (selected or most recent)
        // For non-admin users, only show tournament if explicitly selected
        const tournamentToShow = selectedTournamentId
          ? tournamentsArray.find(t => t.id === selectedTournamentId)
          : (isAdmin ? tournamentsArray[0] : null)
        
        if (tournamentToShow) {
          // Convert matches object to array
          const matches = tournamentToShow.matches 
            ? Object.values(tournamentToShow.matches)
            : []
          
          // Check if all matches are complete (even if status says running)
          const allMatchesComplete = matches.length > 0 && matches.every(m => m.status === 'completed')
          
          // If all matches are complete but status is still running, update it
          if (allMatchesComplete && tournamentToShow.status === 'running' && rtdb) {
            const tournamentRef = ref(rtdb, `botTournaments/${tournamentToShow.id}/status`)
            set(tournamentRef, 'completed').catch(err => {
              console.error('[BotTournaments] Error updating tournament status:', err)
            })
            tournamentToShow.status = 'completed'
          }
          
          setTournament(tournamentToShow)
          setTournamentMatches(matches)
          
          // Load external bots if they exist
          if (tournamentToShow.externalBots) {
            setExternalBots(tournamentToShow.externalBots)
          }
          
          // Convert standings object to array and sort
          const standings = tournamentToShow.standings
            ? Object.values(tournamentToShow.standings).sort((a, b) => b.points - a.points)
            : []
          setTournamentStandings(standings)
          
          setIsTournamentRunning(tournamentToShow.status === 'running')
        } else {
          // No tournament selected - clear tournament state
          // For non-admin users, this means show the list
          // For admin users, this means no tournaments exist
          if (!isAdmin || tournamentsArray.length === 0) {
            setTournament(null)
            setTournamentMatches([])
            setTournamentStandings([])
            setIsTournamentRunning(false)
          }
        }
      } else {
        setAllTournaments([])
        setTournament(null)
        setTournamentMatches([])
        setTournamentStandings([])
        setIsTournamentRunning(false)
      }
    })

    return () => unsubscribe()
  }, [rtdb, selectedTournamentId])

  const handleTimeUpdate = (color, newTime) => {
    if (color === 'white') {
      setWhiteTime(newTime)
    } else {
      setBlackTime(newTime)
    }
  }

  // Handle tournament selection
  const handleTournamentSelect = (tournamentId) => {
    setSelectedTournamentId(tournamentId)
    setReplayingMatch(null)
    setReplayMoves([])
    setReplayGame(new Chess())
    if (isAdmin) {
      // Switch to standings tab to show the selected tournament
      setActiveTab('standings')
    } else {
      setViewingTournamentDetails(true)
    }
  }

  // Handle viewing tournament details (for normal users)
  const handleViewTournamentDetails = (tournamentId) => {
    setSelectedTournamentId(tournamentId)
    setViewingTournamentDetails(true)
  }

  // Handle back to tournament list (for normal users)
  const handleBackToList = () => {
    setViewingTournamentDetails(false)
    setSelectedTournamentId(null)
  }

  // Handle match replay
  const handleReplayMatch = (match) => {
    if (!match.moves || match.moves.length === 0) {
      alert('No moves available for this match')
      return
    }

    setReplayingMatch(match)
    setReplayMoves(match.moves)
    
    // Initialize game from moves
    const newGame = new Chess()
    const moves = []
    for (const moveData of match.moves) {
      try {
        const move = newGame.move({
          from: moveData.from,
          to: moveData.to,
          promotion: moveData.promotion,
        })
        if (move) {
          moves.push(move)
        }
      } catch (e) {
        console.error('Error replaying move:', e)
        break
      }
    }
    
    setReplayGame(newGame)
    setMoves(moves)
    setCurrentMoveIndex(moves.length - 1)
    
    // Set bot players for display
    const whiteBotId = match.whiteBot
    const blackBotId = match.blackBot
    setWhiteBot(whiteBotId === 'stockfish' ? 'stockfish' : availableBots.find(b => b.id === whiteBotId))
    setBlackBot(blackBotId === 'stockfish' ? 'stockfish' : availableBots.find(b => b.id === blackBotId))
  }

  // Handle move navigation during replay
  const handleReplayMoveClick = (moveIndex) => {
    if (!replayingMatch || !replayMoves || replayMoves.length === 0) return
    
    // If moveIndex is -1, go to start position
    if (moveIndex < 0) {
      const newGame = new Chess()
      setReplayGame(newGame)
      setCurrentMoveIndex(null)
      return
    }
    
    const newGame = new Chess()
    
    // Apply moves up to the selected index
    for (let i = 0; i <= moveIndex && i < replayMoves.length; i++) {
      const moveData = replayMoves[i]
      try {
        const move = newGame.move({
          from: moveData.from,
          to: moveData.to,
          promotion: moveData.promotion,
        })
        if (!move) {
          break
        }
      } catch (e) {
        console.error('Error replaying move:', e)
        break
      }
    }
    
    setReplayGame(newGame)
    // Don't update moves - keep the full history to allow going back and forth
    // Only update the currentMoveIndex
    setCurrentMoveIndex(moveIndex)
  }

  // Exit replay mode
  const handleExitReplay = () => {
    setReplayingMatch(null)
    setReplayMoves([])
    setReplayGame(new Chess())
    setMoves([])
    setCurrentMoveIndex(null)
    setWhiteBot(null)
    setBlackBot(null)
  }

  const handleGameReview = () => {
    if (!replayingMatch || !moves || moves.length === 0) return
    
    // Create a fresh game from starting position and replay all moves
    const cleanGame = new Chess()
    for (const move of moves) {
      try {
        if (move.from && move.to) {
          cleanGame.move({ from: move.from, to: move.to, promotion: move.promotion })
        } else if (move.san) {
          cleanGame.move(move.san)
        }
      } catch (e) {
        // Error replaying move
      }
    }
    
    // Determine result
    let result = '*'
    if (cleanGame.isCheckmate()) {
      result = cleanGame.turn() === 'w' ? '0-1' : '1-0'
    } else if (cleanGame.isDraw() || cleanGame.isStalemate()) {
      result = '1/2-1/2'
    }
    
    // Get bot names
    const whiteName = replayingMatch.whiteBot === 'stockfish' 
      ? 'Stockfish 17' 
      : (externalBots.find(b => b.id === replayingMatch.whiteBot)?.name || availableBots.find(b => b.id === replayingMatch.whiteBot)?.name || 'White')
    const blackName = replayingMatch.blackBot === 'stockfish' 
      ? 'Stockfish 17' 
      : (externalBots.find(b => b.id === replayingMatch.blackBot)?.name || availableBots.find(b => b.id === replayingMatch.blackBot)?.name || 'Black')
    
    // Generate PGN with proper headers
    const pgnHeaders = [
      `[Event "Bot Tournament Match"]`,
      `[Site "ChessBD"]`,
      `[Date "${new Date().toISOString().split('T')[0].replace(/-/g, '.')}"]`,
      `[Round "?"]`,
      `[White "${whiteName}"]`,
      `[Black "${blackName}"]`,
      `[Result "${result}"]`
    ]
    
    // Generate move list
    const moveList = []
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i]
      if (move.san) {
        if (i % 2 === 0) {
          moveList.push(`${Math.floor(i / 2) + 1}. ${move.san}`)
        } else {
          moveList[moveList.length - 1] += ` ${move.san}`
        }
      }
    }
    
    const pgn = pgnHeaders.join('\n') + '\n\n' + moveList.join(' ') + ' ' + result
    
    if (!pgn || pgn.trim() === '') return
    
    // Store PGN in sessionStorage BEFORE opening new tab
    sessionStorage.setItem('analysis-pgn', pgn)
    // Open in new tab after setting sessionStorage
    window.open('/analysis', '_blank')
  }

  if (engineLoading || authLoading) {
    return <PageLoader />
  }

  if (!user) {
    return (
      <div className="tournament-page">
        <div className="tournament-container">
          <div className="tournament-board-section" ref={sectionRef}>
            <ChessBoard
              position={gamePosition}
              onMove={() => false}
              flipped={false}
              arePiecesDraggable={false}
              allowFreeMoves={false}
              whitePlayer={whitePlayer}
              blackPlayer={blackPlayer}
              whiteTime={whiteTime}
              blackTime={blackTime}
              isWhiteTurn={isWhiteTurn}
              isRunning={false}
              onTimeUpdate={handleTimeUpdate}
              sectionRef={sectionRef}
              showTimer={false}
              lastMove={lastMove}
            />
          </div>

          <div className="tournament-content-section">
            <div className="tournament-login-prompt">
              <div className="tournament-login-content">
                <h2>Login Required</h2>
                <p>Please log in to view bot tournaments.</p>
                <div className="tournament-login-actions">
                  <button
                    className="tournament-login-btn"
                    onClick={() => {
                      const currentPath = location.pathname + location.search + location.hash
                      navigate('/login', { state: { from: currentPath } })
                    }}
                  >
                    Log In
                  </button>
                  <button
                    className="tournament-signup-btn"
                    onClick={() => {
                      const currentPath = location.pathname + location.search + location.hash
                      navigate('/signup', { state: { from: currentPath } })
                    }}
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tournament-page">
      <div className="tournament-container">
        <div className="tournament-board-section" ref={sectionRef}>
          <ChessBoard
            position={gamePosition}
            onMove={() => false}
            flipped={false}
            arePiecesDraggable={false}
            allowFreeMoves={false}
            whitePlayer={whitePlayer}
            blackPlayer={blackPlayer}
            whiteTime={whiteTime}
            blackTime={blackTime}
            isWhiteTurn={isWhiteTurn}
            isRunning={isRunning}
            onTimeUpdate={handleTimeUpdate}
            sectionRef={sectionRef}
            showTimer={false}
            lastMove={lastMove}
          />
        </div>

        <div className="tournament-content-section">
          {replayingMatch ? (
            <div className="tournament-replay">
              <div className="tournament-replay-header">
                <h3 className="tournament-title">Match Replay</h3>
                <button
                  className="tournament-control-btn"
                  onClick={handleExitReplay}
                >
                  <XCircle size={16} />
                  <span>Exit Replay</span>
                </button>
              </div>
              <div className="tournament-replay-info">
                <p>
                  {replayingMatch.whiteBot === 'stockfish' ? 'Stockfish 17' : (externalBots.find(b => b.id === replayingMatch.whiteBot)?.name || availableBots.find(b => b.id === replayingMatch.whiteBot)?.name || replayingMatch.whiteBot)}
                  {' vs '}
                  {replayingMatch.blackBot === 'stockfish' ? 'Stockfish 17' : (externalBots.find(b => b.id === replayingMatch.blackBot)?.name || availableBots.find(b => b.id === replayingMatch.blackBot)?.name || replayingMatch.blackBot)}
                </p>
                {replayingMatch.result && (
                  <p className="tournament-replay-result">Result: {replayingMatch.result}</p>
                )}
              </div>
              <div className="tournament-replay-actions">
                <button
                  className="tournament-control-btn tournament-control-btn-primary"
                  onClick={handleGameReview}
                >
                  <Brain size={16} />
                  <span>Review</span>
                </button>
              </div>
              <div className="tournament-replay-moves">
                <MoveHistory
                  moves={moves}
                  currentMoveIndex={currentMoveIndex}
                  onMoveClick={handleReplayMoveClick}
                  flipped={false}
                />
              </div>
            </div>
          ) : !tournament || tournament.status === 'pending' ? (
            <>
              {isAdmin ? (
                <>
                  {/* Admin Tabs */}
                  <div className="tournament-tabs">
                    <nav className="tournament-tabs-nav" role="tablist">
                      <button
                        className={`tournament-tab ${activeTab === 'create' ? 'active' : ''}`}
                        onClick={() => setActiveTab('create')}
                        role="tab"
                        aria-selected={activeTab === 'create'}
                      >
                        <Plus size={16} />
                        <span>Create</span>
                      </button>
                      <button
                        className={`tournament-tab ${activeTab === 'tournaments' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tournaments')}
                        role="tab"
                        aria-selected={activeTab === 'tournaments'}
                      >
                        <List size={16} />
                        <span>Tournaments</span>
                      </button>
                    </nav>
                  </div>

                  {/* Tab Content */}
                  <div className="tournament-tab-content">
                    {activeTab === 'create' && (
                      <div className="tournament-tab-panel">
                        <div className="tournament-setup">
                          <h3 className="tournament-title">Create Tournament</h3>
                          <p className="tournament-description">
                            Select bots to participate. Each bot will play every other bot twice (once as white, once as black).
                          </p>
                          
                          <div className="tournament-name-input">
                            <label htmlFor="tournament-name">Tournament Name</label>
                            <input
                              type="text"
                              id="tournament-name"
                              className="tournament-name-field"
                              value={tournamentName}
                              onChange={(e) => setTournamentName(e.target.value)}
                              placeholder="Enter tournament name"
                              disabled={isTournamentRunning}
                            />
                          </div>
                          
                          <div className="tournament-bot-selection">
                            <div className="tournament-bot-item">
                              <input
                                type="checkbox"
                                id="bot-stockfish"
                                checked={selectedBots.includes('stockfish')}
                                onChange={() => handleBotToggle('stockfish')}
                                disabled={isTournamentRunning}
                              />
                              <label htmlFor="bot-stockfish">Stockfish 17</label>
                            </div>
                            {availableBots.map(bot => (
                              <div key={bot.id} className="tournament-bot-item">
                                <input
                                  type="checkbox"
                                  id={`bot-${bot.id}`}
                                  checked={selectedBots.includes(bot.id)}
                                  onChange={() => handleBotToggle(bot)}
                                  disabled={isTournamentRunning}
                                />
                                <label htmlFor={`bot-${bot.id}`}>{bot.name}</label>
                              </div>
                            ))}
                            {externalBots.map(bot => (
                              <div key={bot.id} className="tournament-bot-item">
                                <input
                                  type="checkbox"
                                  id={`bot-${bot.id}`}
                                  checked={selectedBots.includes(bot.id)}
                                  onChange={() => handleBotToggle(bot)}
                                  disabled={isTournamentRunning}
                                />
                                <label htmlFor={`bot-${bot.id}`}>
                                  {bot.name}
                                  {bot.creatorUsername && <span className="tournament-bot-creator"> by {bot.creatorUsername}</span>}
                                </label>
                                {!isTournamentRunning && (
                                  <button
                                    className="tournament-bot-remove"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveExternalBot(bot.id)
                                    }}
                                    title="Remove external bot"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="tournament-external-bot-section">
                            {!showAddExternalBot ? (
                              <button
                                type="button"
                                className="tournament-control-btn"
                                onClick={() => setShowAddExternalBot(true)}
                                disabled={isTournamentRunning}
                              >
                                <Plus size={16} />
                                <span>Add External Bot</span>
                              </button>
                            ) : (
                              <div className="tournament-external-bot-form">
                                <h4 className="tournament-section-title">Add External Bot</h4>
                                <div className="tournament-form-field">
                                  <label htmlFor="external-bot-name">Bot Name *</label>
                                  <input
                                    type="text"
                                    id="external-bot-name"
                                    className="tournament-name-field"
                                    value={externalBotForm.name}
                                    onChange={(e) => setExternalBotForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Enter bot name"
                                    disabled={isTournamentRunning}
                                  />
                                </div>
                                <div className="tournament-form-field">
                                  <label htmlFor="external-bot-id">Bot ID *</label>
                                  <input
                                    type="text"
                                    id="external-bot-id"
                                    className="tournament-name-field"
                                    value={externalBotForm.id}
                                    onChange={(e) => setExternalBotForm(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                                    placeholder="Enter unique bot ID (lowercase, no spaces)"
                                    disabled={isTournamentRunning}
                                  />
                                </div>
                                <div className="tournament-form-field">
                                  <label htmlFor="external-bot-creator">Creator Username</label>
                                  <input
                                    type="text"
                                    id="external-bot-creator"
                                    className="tournament-name-field"
                                    value={externalBotForm.creatorUsername}
                                    onChange={(e) => setExternalBotForm(prev => ({ ...prev, creatorUsername: e.target.value }))}
                                    placeholder="Enter creator username (optional)"
                                    disabled={isTournamentRunning}
                                  />
                                </div>
                                <div className="tournament-form-field">
                                  <label htmlFor="external-bot-api">API Link *</label>
                                  <input
                                    type="url"
                                    id="external-bot-api"
                                    className="tournament-name-field"
                                    value={externalBotForm.apiLink}
                                    onChange={(e) => setExternalBotForm(prev => ({ ...prev, apiLink: e.target.value }))}
                                    placeholder="https://example.com/api/move"
                                    disabled={isTournamentRunning}
                                  />
                                  <small className="tournament-form-hint">
                                    API should accept POST with FEN and return next move in UCI format: {"{ move: \"e2e4\" }"}
                                  </small>
                                </div>
                                <div className="tournament-form-actions">
                                  <button
                                    type="button"
                                    className="tournament-control-btn tournament-control-btn-primary"
                                    onClick={handleAddExternalBot}
                                    disabled={isTournamentRunning}
                                  >
                                    <Plus size={16} />
                                    <span>Add Bot</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="tournament-control-btn"
                                    onClick={() => {
                                      setShowAddExternalBot(false)
                                      setExternalBotForm({ name: '', id: '', creatorUsername: '', apiLink: '' })
                                    }}
                                    disabled={isTournamentRunning}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            className="tournament-control-btn tournament-control-btn-primary"
                            onClick={handleStartTournament}
                            disabled={selectedBots.length < 2 || isTournamentRunning || !tournamentName.trim()}
                          >
                            <Trophy size={16} />
                            <span>Start Tournament</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === 'tournaments' && (
                      <div className="tournament-tab-panel">
                        <div className="tournament-list">
                          {allTournaments.length > 0 ? (
                            <div className="tournament-list-items">
                              {allTournaments.map(t => (
                                <div
                                  key={t.id}
                                  className={`tournament-list-item ${selectedTournamentId === t.id ? 'active' : ''}`}
                                  onClick={() => handleTournamentSelect(t.id)}
                                >
                                  <div className="tournament-list-item-header">
                                    <span className="tournament-list-item-name">
                                      {t.name || `Tournament ${t.id.replace('tournament_', '')}`}
                                    </span>
                                    <span className={`tournament-list-item-status ${t.status === 'running' ? 'status-running' : 'status-completed'}`}>
                                      {t.status === 'running' ? 'Running' : 'Completed'}
                                    </span>
                                  </div>
                                  {t.bots && (
                                    <div className="tournament-list-item-bots">
                                      {t.bots.length} bot{t.bots.length !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="tournament-description">No tournaments yet.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Non-Admin User View - Tournament List */}
                  {viewingTournamentDetails && tournament ? (
                    <div className="tournament-details-view">
                      <button
                        className="tournament-back-btn"
                        onClick={handleBackToList}
                      >
                        <ArrowLeft size={16} />
                        <span>Back to Tournaments</span>
                      </button>
                      <div className="tournament-details-header">
                        <h3 className="tournament-title">
                          {tournament.name || `Tournament ${tournament.id.replace('tournament_', '')}`}
                        </h3>
                        <span className={`tournament-status-badge ${tournament.status === 'running' ? 'status-running' : 'status-completed'}`}>
                          {tournament.status === 'running' ? 'Running' : 'Completed'}
                        </span>
                      </div>
                      
                      <div className="tournament-standings">
                        <div className="tournament-standings-table">
                          <div className="tournament-standings-header">
                            <span>Rank</span>
                            <span>Bot</span>
                            <span>W</span>
                            <span>L</span>
                            <span>D</span>
                            <span>Points</span>
                          </div>
                          {tournamentStandings.map((standing, index) => {
                            const botName = standing.botId === 'stockfish' 
                              ? 'Stockfish 17' 
                              : (externalBots.find(b => b.id === standing.botId)?.name || availableBots.find(b => b.id === standing.botId)?.name || standing.botId)
                            return (
                              <div key={standing.botId} className="tournament-standings-row">
                                <span>{index + 1}</span>
                                <span>{botName}</span>
                                <span>{standing.wins}</span>
                                <span>{standing.losses}</span>
                                <span>{standing.draws}</span>
                                <span>{standing.points}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="tournament-matches">
                        <div className="tournament-matches-list">
                          {tournamentMatches.map((match, index) => {
                            const whiteName = match.whiteBot === 'stockfish' 
                              ? 'Stockfish 17' 
                              : (externalBots.find(b => b.id === match.whiteBot)?.name || availableBots.find(b => b.id === match.whiteBot)?.name || match.whiteBot)
                            const blackName = match.blackBot === 'stockfish' 
                              ? 'Stockfish 17' 
                              : (externalBots.find(b => b.id === match.blackBot)?.name || availableBots.find(b => b.id === match.blackBot)?.name || match.blackBot)
                            return (
                              <div key={match.matchId} className={`tournament-match ${match.status}`}>
                                <span className="tournament-match-number">{index + 1}</span>
                                <span className="tournament-match-players">
                                  {whiteName} vs {blackName}
                                </span>
                                <span className="tournament-match-status">
                                  {match.status === 'pending' && <Clock size={16} />}
                                  {match.status === 'playing' && <Play size={16} />}
                                  {match.status === 'completed' && match.result === '1-0' && <CheckCircle2 size={16} />}
                                  {match.status === 'completed' && match.result === '0-1' && <XCircle size={16} />}
                                  {match.status === 'completed' && match.result === '1/2-1/2' && <Minus size={16} />}
                                </span>
                                {match.result && (
                                  <span className="tournament-match-result">{match.result}</span>
                                )}
                                {match.status === 'completed' && match.moves && match.moves.length > 0 && (
                                  <button
                                    className="tournament-match-replay-btn"
                                    onClick={() => handleReplayMatch(match)}
                                    title="Replay Match"
                                  >
                                    <Eye size={16} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="tournament-list-view">
                      <h3 className="tournament-title">Tournaments</h3>
                      {allTournaments.length > 0 ? (
                        <div className="tournament-list-items">
                          {allTournaments.map(t => (
                            <div
                              key={t.id}
                              className={`tournament-list-item ${selectedTournamentId === t.id ? 'active' : ''}`}
                              onClick={() => handleTournamentSelect(t.id)}
                            >
                              <div className="tournament-list-item-header">
                                <span className="tournament-list-item-name">
                                  {t.name || `Tournament ${t.id.replace('tournament_', '')}`}
                                </span>
                                <span className={`tournament-list-item-status ${t.status === 'running' ? 'status-running' : 'status-completed'}`}>
                                  {t.status === 'running' ? 'Running' : 'Completed'}
                                </span>
                              </div>
                              {t.bots && (
                                <div className="tournament-list-item-bots">
                                  {t.bots.length} bot{t.bots.length !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="tournament-description">No tournaments available.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="tournament-view">
              {/* Top tabs for admins (Create/Tournaments) */}
              {isAdmin && (
                <div className="tournament-tabs">
                  <nav className="tournament-tabs-nav" role="tablist">
                    <button
                      className={`tournament-tab ${activeTab === 'create' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('create')
                        setSelectedTournamentId(null)
                      }}
                      role="tab"
                      aria-selected={activeTab === 'create'}
                    >
                      <Plus size={16} />
                      <span>Create</span>
                    </button>
                    <button
                      className={`tournament-tab ${activeTab === 'tournaments' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('tournaments')
                        // Don't clear selectedTournamentId here - allow viewing tournament details
                      }}
                      role="tab"
                      aria-selected={activeTab === 'tournaments'}
                    >
                      <List size={16} />
                      <span>Tournaments</span>
                    </button>
                  </nav>
                </div>
              )}

              {/* Tab Content for Create/Tournaments (admin only) */}
              {isAdmin && (activeTab === 'create' || activeTab === 'tournaments') ? (
                <div className="tournament-tab-content">
                  {activeTab === 'create' && (
                    <div className="tournament-tab-panel">
                      <div className="tournament-setup">
                        <h3 className="tournament-title">Create Tournament</h3>
                        <p className="tournament-description">
                          Select bots to participate. Each bot will play every other bot twice (once as white, once as black).
                        </p>
                        
                        <div className="tournament-name-input">
                          <label htmlFor="tournament-name">Tournament Name</label>
                          <input
                            type="text"
                            id="tournament-name"
                            className="tournament-name-field"
                            value={tournamentName}
                            onChange={(e) => setTournamentName(e.target.value)}
                            placeholder="Enter tournament name"
                            disabled={isTournamentRunning}
                          />
                        </div>
                        
                        <div className="tournament-bot-selection">
                          <div className="tournament-bot-item">
                            <input
                              type="checkbox"
                              id="bot-stockfish"
                              checked={selectedBots.includes('stockfish')}
                              onChange={() => handleBotToggle('stockfish')}
                              disabled={isTournamentRunning}
                            />
                            <label htmlFor="bot-stockfish">Stockfish 17</label>
                          </div>
                          {availableBots.map(bot => (
                            <div key={bot.id} className="tournament-bot-item">
                              <input
                                type="checkbox"
                                id={`bot-${bot.id}`}
                                checked={selectedBots.includes(bot.id)}
                                onChange={() => handleBotToggle(bot)}
                                disabled={isTournamentRunning}
                              />
                              <label htmlFor={`bot-${bot.id}`}>{bot.name}</label>
                            </div>
                          ))}
                          {externalBots.map(bot => (
                            <div key={bot.id} className="tournament-bot-item">
                              <input
                                type="checkbox"
                                id={`bot-${bot.id}`}
                                checked={selectedBots.includes(bot.id)}
                                onChange={() => handleBotToggle(bot)}
                                disabled={isTournamentRunning}
                              />
                              <label htmlFor={`bot-${bot.id}`}>
                                {bot.name}
                                {bot.creatorUsername && <span className="tournament-bot-creator"> by {bot.creatorUsername}</span>}
                              </label>
                              {!isTournamentRunning && (
                                <button
                                  className="tournament-bot-remove"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveExternalBot(bot.id)
                                  }}
                                  title="Remove external bot"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="tournament-external-bot-section">
                          {!showAddExternalBot ? (
                            <button
                              type="button"
                              className="tournament-control-btn"
                              onClick={() => setShowAddExternalBot(true)}
                              disabled={isTournamentRunning}
                            >
                              <Plus size={16} />
                              <span>Add External Bot</span>
                            </button>
                          ) : (
                            <div className="tournament-external-bot-form">
                              <h4 className="tournament-section-title">Add External Bot</h4>
                              <div className="tournament-form-field">
                                <label htmlFor="external-bot-name-2">Bot Name *</label>
                                <input
                                  type="text"
                                  id="external-bot-name-2"
                                  className="tournament-name-field"
                                  value={externalBotForm.name}
                                  onChange={(e) => setExternalBotForm(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="Enter bot name"
                                  disabled={isTournamentRunning}
                                />
                              </div>
                              <div className="tournament-form-field">
                                <label htmlFor="external-bot-id-2">Bot ID *</label>
                                <input
                                  type="text"
                                  id="external-bot-id-2"
                                  className="tournament-name-field"
                                  value={externalBotForm.id}
                                  onChange={(e) => setExternalBotForm(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                                  placeholder="Enter unique bot ID (lowercase, no spaces)"
                                  disabled={isTournamentRunning}
                                />
                              </div>
                              <div className="tournament-form-field">
                                <label htmlFor="external-bot-creator-2">Creator Username</label>
                                <input
                                  type="text"
                                  id="external-bot-creator-2"
                                  className="tournament-name-field"
                                  value={externalBotForm.creatorUsername}
                                  onChange={(e) => setExternalBotForm(prev => ({ ...prev, creatorUsername: e.target.value }))}
                                  placeholder="Enter creator username (optional)"
                                  disabled={isTournamentRunning}
                                />
                              </div>
                              <div className="tournament-form-field">
                                <label htmlFor="external-bot-api-2">API Link *</label>
                                <input
                                  type="url"
                                  id="external-bot-api-2"
                                  className="tournament-name-field"
                                  value={externalBotForm.apiLink}
                                  onChange={(e) => setExternalBotForm(prev => ({ ...prev, apiLink: e.target.value }))}
                                  placeholder="https://example.com/api/move"
                                  disabled={isTournamentRunning}
                                />
                                <small className="tournament-form-hint">
                                  API should accept POST with PGN and return next move in UCI format
                                </small>
                              </div>
                              <div className="tournament-form-actions">
                                <button
                                  type="button"
                                  className="tournament-control-btn tournament-control-btn-primary"
                                  onClick={handleAddExternalBot}
                                  disabled={isTournamentRunning}
                                >
                                  <Plus size={16} />
                                  <span>Add Bot</span>
                                </button>
                                <button
                                  type="button"
                                  className="tournament-control-btn"
                                  onClick={() => {
                                    setShowAddExternalBot(false)
                                    setExternalBotForm({ name: '', id: '', creatorUsername: '', apiLink: '' })
                                  }}
                                  disabled={isTournamentRunning}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          className="tournament-control-btn tournament-control-btn-primary"
                          onClick={handleStartTournament}
                          disabled={selectedBots.length < 2 || isTournamentRunning || !tournamentName.trim()}
                        >
                          <Trophy size={16} />
                          <span>Start Tournament</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'tournaments' && (
                    <div className="tournament-tab-panel">
                      <div className="tournament-list">
                        {allTournaments.length > 0 ? (
                          <div className="tournament-list-items">
                            {allTournaments.map(t => (
                              <div
                                key={t.id}
                                className={`tournament-list-item ${selectedTournamentId === t.id ? 'active' : ''}`}
                                onClick={() => handleTournamentSelect(t.id)}
                              >
                                <div className="tournament-list-item-header">
                                  <span className="tournament-list-item-name">
                                    {t.name || `Tournament ${t.id.replace('tournament_', '')}`}
                                  </span>
                                  <span className={`tournament-list-item-status ${t.status === 'running' ? 'status-running' : 'status-completed'}`}>
                                    {t.status === 'running' ? 'Running' : 'Completed'}
                                  </span>
                                </div>
                                {t.bots && (
                                  <div className="tournament-list-item-bots">
                                    {t.bots.length} bot{t.bots.length !== 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="tournament-description">No tournaments yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="tournament-header">
                    <h3 className="tournament-title">
                      {tournament.name || (tournament.status === 'running' ? 'Tournament in Progress' : 'Tournament Completed')}
                    </h3>
                    {currentTournamentMatch && (
                      <div className="tournament-current-match">
                        <p>Current Match:</p>
                        <p>
                          {currentTournamentMatch.whiteBot === 'stockfish' ? 'Stockfish 17' : (externalBots.find(b => b.id === currentTournamentMatch.whiteBot)?.name || availableBots.find(b => b.id === currentTournamentMatch.whiteBot)?.name || currentTournamentMatch.whiteBot)}
                          {' vs '}
                          {currentTournamentMatch.blackBot === 'stockfish' ? 'Stockfish 17' : (externalBots.find(b => b.id === currentTournamentMatch.blackBot)?.name || availableBots.find(b => b.id === currentTournamentMatch.blackBot)?.name || currentTournamentMatch.blackBot)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tabs for Standings/Games (specific to this tournament) */}
                  {isAdmin && (
                    <div className="tournament-tabs">
                      <nav className="tournament-tabs-nav" role="tablist">
                        <button
                          className={`tournament-tab ${activeTab === 'standings' ? 'active' : ''}`}
                          onClick={() => setActiveTab('standings')}
                          role="tab"
                          aria-selected={activeTab === 'standings'}
                        >
                          <BarChart3 size={16} />
                          <span>Standings</span>
                        </button>
                        <button
                          className={`tournament-tab ${activeTab === 'games' ? 'active' : ''}`}
                          onClick={() => setActiveTab('games')}
                          role="tab"
                          aria-selected={activeTab === 'games'}
                        >
                          <Gamepad2 size={16} />
                          <span>Games</span>
                        </button>
                      </nav>
                    </div>
                  )}

                  {/* Tab Content for Standings/Games (admin) or direct content (normal user) */}
                  {isAdmin ? (
                <div className="tournament-tab-content">
                  {activeTab === 'standings' && (
                    <div className="tournament-tab-panel">
                      <div className="tournament-standings">
                        <div className="tournament-standings-table">
                          <div className="tournament-standings-header">
                            <span>Rank</span>
                            <span>Bot</span>
                            <span>W</span>
                            <span>L</span>
                            <span>D</span>
                            <span>Points</span>
                          </div>
                          {tournamentStandings.map((standing, index) => {
                            const botName = standing.botId === 'stockfish' 
                              ? 'Stockfish 17' 
                              : (externalBots.find(b => b.id === standing.botId)?.name || availableBots.find(b => b.id === standing.botId)?.name || standing.botId)
                            return (
                              <div key={standing.botId} className="tournament-standings-row">
                                <span>{index + 1}</span>
                                <span>{botName}</span>
                                <span>{standing.wins}</span>
                                <span>{standing.losses}</span>
                                <span>{standing.draws}</span>
                                <span>{standing.points}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'games' && (
                    <div className="tournament-tab-panel">
                      <div className="tournament-matches">
                        <div className="tournament-matches-list">
                          {tournamentMatches.map((match, index) => {
                            const whiteName = match.whiteBot === 'stockfish' 
                              ? 'Stockfish 17' 
                              : (externalBots.find(b => b.id === match.whiteBot)?.name || availableBots.find(b => b.id === match.whiteBot)?.name || match.whiteBot)
                            const blackName = match.blackBot === 'stockfish' 
                              ? 'Stockfish 17' 
                              : (externalBots.find(b => b.id === match.blackBot)?.name || availableBots.find(b => b.id === match.blackBot)?.name || match.blackBot)
                            return (
                              <div key={match.matchId} className={`tournament-match ${match.status}`}>
                                <span className="tournament-match-number">{index + 1}</span>
                                <span className="tournament-match-players">
                                  {whiteName} vs {blackName}
                                </span>
                                <span className="tournament-match-status">
                                  {match.status === 'pending' && <Clock size={16} />}
                                  {match.status === 'playing' && <Play size={16} />}
                                  {match.status === 'completed' && match.result === '1-0' && <CheckCircle2 size={16} />}
                                  {match.status === 'completed' && match.result === '0-1' && <XCircle size={16} />}
                                  {match.status === 'completed' && match.result === '1/2-1/2' && <Minus size={16} />}
                                </span>
                                {match.result && (
                                  <span className="tournament-match-result">{match.result}</span>
                                )}
                                {match.status === 'pending' && tournament.status === 'running' && (
                                  <button
                                    className="tournament-match-start-btn"
                                    onClick={() => playTournamentMatch(match, tournament.id)}
                                    title="Start Match"
                                    disabled={isTournamentRunning && currentTournamentMatch !== null}
                                  >
                                    <Play size={16} />
                                    <span>Start</span>
                                  </button>
                                )}
                                {match.status === 'completed' && match.moves && match.moves.length > 0 && (
                                  <button
                                    className="tournament-match-replay-btn"
                                    onClick={() => handleReplayMatch(match)}
                                    title="Replay Match"
                                  >
                                    <Eye size={16} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="tournament-standings">
                    <h4 className="tournament-section-title">
                      {tournament.status === 'running' ? 'Current Standings' : 'Final Standings'}
                    </h4>
                    <div className="tournament-standings-table">
                      <div className="tournament-standings-header">
                        <span>Rank</span>
                        <span>Bot</span>
                        <span>W</span>
                        <span>L</span>
                        <span>D</span>
                        <span>Points</span>
                      </div>
                      {tournamentStandings.map((standing, index) => {
                        const botName = standing.botId === 'stockfish' 
                          ? 'Stockfish 17' 
                          : availableBots.find(b => b.id === standing.botId)?.name || standing.botId
                        return (
                          <div key={standing.botId} className="tournament-standings-row">
                            <span>{index + 1}</span>
                            <span>{botName}</span>
                            <span>{standing.wins}</span>
                            <span>{standing.losses}</span>
                            <span>{standing.draws}</span>
                            <span>{standing.points}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="tournament-matches">
                    <div className="tournament-matches-list">
                      {tournamentMatches.map((match, index) => {
                        const whiteName = match.whiteBot === 'stockfish' 
                          ? 'Stockfish 17' 
                          : availableBots.find(b => b.id === match.whiteBot)?.name || match.whiteBot
                        const blackName = match.blackBot === 'stockfish' 
                          ? 'Stockfish 17' 
                          : availableBots.find(b => b.id === match.blackBot)?.name || match.blackBot
                        return (
                          <div key={match.matchId} className={`tournament-match ${match.status}`}>
                            <span className="tournament-match-number">{index + 1}</span>
                            <span className="tournament-match-players">
                              {whiteName} vs {blackName}
                            </span>
                            <span className="tournament-match-status">
                              {match.status === 'pending' && <Clock size={16} />}
                              {match.status === 'playing' && <Play size={16} />}
                              {match.status === 'completed' && match.result === '1-0' && <CheckCircle2 size={16} />}
                              {match.status === 'completed' && match.result === '0-1' && <XCircle size={16} />}
                              {match.status === 'completed' && match.result === '1/2-1/2' && <Minus size={16} />}
                            </span>
                            {match.result && (
                              <span className="tournament-match-result">{match.result}</span>
                            )}
                            {match.status === 'completed' && match.moves && match.moves.length > 0 && (
                              <button
                                className="tournament-match-replay-btn"
                                onClick={() => handleReplayMatch(match)}
                                title="Replay Match"
                              >
                                <Eye size={16} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

