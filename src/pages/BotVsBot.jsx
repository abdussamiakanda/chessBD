import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import { ChessBoard } from '../components/chess/ChessBoard.jsx'
import { MoveHistory } from '../components/chess/MoveHistory.jsx'
import { useSEO } from '../hooks/use-seo.js'
import { useChessEngine } from '../hooks/useChessEngine.js'
import { getBots } from '../lib/bots/index.js'
import { chooseMoveWithPersonality } from '../lib/bots/botMove.js'
import { Play, RefreshCw, Brain } from 'lucide-react'
import { PageLoader } from '../components/ui/PageLoader.jsx'
import { useAuthStore } from '../store/auth-store.js'
import './BotVsBot.css'

export function BotVsBot() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuthStore()
  const { engine, isLoading: engineLoading } = useChessEngine()
  const [game, setGame] = useState(new Chess())
  const [moves, setMoves] = useState([])
  const [moveHistoryUci, setMoveHistoryUci] = useState([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(null)
  const [whiteTime, setWhiteTime] = useState(600)
  const [blackTime, setBlackTime] = useState(600)
  const [isWhiteTurn, setIsWhiteTurn] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [isEngineThinking, setIsEngineThinking] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameEnded, setGameEnded] = useState(false)
  const sectionRef = useRef(null)
  
  // Bot vs Bot mode
  const [whiteBot, setWhiteBot] = useState(null)
  const [blackBot, setBlackBot] = useState(null)
  const [isWhiteBotThinking, setIsWhiteBotThinking] = useState(false)
  const [isBlackBotThinking, setIsBlackBotThinking] = useState(false)
  
  const pgn = location.state?.pgn
  const availableBots = getBots()

  useEffect(() => {
    if (pgn) {
      try {
        const newGame = new Chess()
        newGame.loadPgn(pgn)
        setGame(newGame)
        setMoves(newGame.history({ verbose: true }))
        setCurrentMoveIndex(newGame.history().length - 1)
        setIsWhiteTurn(newGame.turn() === 'w')
      } catch (e) {
        // Failed to load PGN
      }
    }
  }, [pgn])

  const enginePlayer = {
    name: 'Stockfish 17',
    username: 'stockfish17',
    avatar: 'https://stockfishchess.org/images/logo/icon_512x512@2x.webp',
  }

  // Get bot player info
  const getBotPlayer = (bot) => {
    if (bot === 'stockfish') {
      return enginePlayer
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

  // Assign players
  const whitePlayer = getBotPlayer(whiteBot) || { name: 'White Bot', username: 'white', avatar: null }
  const blackPlayer = getBotPlayer(blackBot) || { name: 'Black Bot', username: 'black', avatar: null }

  useSEO({
    title: 'Bot vs Bot',
    description: 'Watch bots play chess against each other',
    url: '/bot-vs-bot',
  })

  // Memoize the position to avoid unnecessary re-renders
  const gamePosition = useMemo(() => game.fen(), [game])
  
  // Get the last move for highlighting
  const lastMove = useMemo(() => {
    if (moves.length > 0) {
      const lastMoveObj = moves[moves.length - 1]
      return {
        from: lastMoveObj.from,
        to: lastMoveObj.to
      }
    }
    return null
  }, [moves])

  // Bot move handler
  useEffect(() => {
    if (!gameStarted) {
      return
    }
    
    // Check if game is over
    const currentGame = new Chess(game.fen())
    if (currentGame.isGameOver() || currentGame.isDraw() || currentGame.isCheckmate() || currentGame.isStalemate()) {
      setIsRunning(false)
      setGameEnded(true)
      return
    }

    // Determine which bot should move
    let shouldMove = false
    let botToMove = null
    let botColor = null

    if (isWhiteTurn && whiteBot && !isWhiteBotThinking) {
      shouldMove = true
      botToMove = whiteBot
      botColor = 'w'
    } else if (!isWhiteTurn && blackBot && !isBlackBotThinking) {
      shouldMove = true
      botToMove = blackBot
      botColor = 'b'
    }

    // Don't trigger if we're navigating through move history
    if (currentMoveIndex !== null && currentMoveIndex < moves.length - 1) {
      return
    }

    if (!shouldMove) {
      return
    }

    const makeBotMove = async () => {
      if (!engine || !engine.getIsReady()) {
        return
      }

      // Set thinking state
      if (botColor === 'w') {
        setIsWhiteBotThinking(true)
      } else {
        setIsBlackBotThinking(true)
      }
      if (botToMove === 'stockfish') {
        setIsEngineThinking(true)
      }
      
      // Add random delay to make moves feel more natural (500ms to 2000ms)
      const minDelay = 500
      const maxDelay = 2000
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay
      
      await new Promise(resolve => setTimeout(resolve, randomDelay))
      
      try {
        const currentGame = new Chess(game.fen())
        
        // Check if game is over
        if (currentGame.isGameOver() || currentGame.isDraw() || currentGame.isCheckmate() || currentGame.isStalemate()) {
          setIsRunning(false)
          setGameEnded(true)
          return
        }
        
        if (currentGame.turn() !== botColor) {
          throw new Error(`Wrong turn - expected ${botColor}, got: ${currentGame.turn()}`)
        }

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
          
          const currentFen = currentGame.fen()
          // Use higher depth for Stockfish (20 instead of 15 for stronger play)
          const positionEval = await engine.evaluatePosition(currentFen, 20)
          const bestMoveUci = positionEval.bestMove
          
          if (!bestMoveUci || bestMoveUci === '(none)') {
            throw new Error('No best move returned from engine')
          }
          
          moveUci = bestMoveUci
        } else if (botToMove && typeof botToMove === 'object') {
          // Use bot with personality
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
          
          moveUci = await chooseMoveWithPersonality(currentGame, personality, engine)
          
          if (!moveUci) {
            throw new Error('No move returned from bot')
          }
        } else {
          throw new Error('Invalid bot configuration')
        }
        
        // Parse UCI move
        const from = moveUci.substring(0, 2)
        const to = moveUci.substring(2, 4)
        const promotion = moveUci.length > 4 ? moveUci[4] : undefined
        
        // Validate and make the move
        const pieceOnFrom = currentGame.get(from)
        if (!pieceOnFrom) {
          throw new Error(`No piece on source square: ${from}`)
        }
        
        if (pieceOnFrom.color !== botColor) {
          throw new Error(`Wrong piece color - expected ${botColor}, got: ${pieceOnFrom.color}`)
        }
        
        const move = currentGame.move({
          from,
          to,
          promotion: promotion ? promotion.toLowerCase() : 'q',
        })
        
        if (!move) {
          throw new Error('Failed to make move')
        }

        // Update game state
        setGame(currentGame)
        setMoves(prev => {
          const newMoves = [...prev, move]
          setCurrentMoveIndex(newMoves.length - 1)
          return newMoves
        })
        setIsWhiteTurn(currentGame.turn() === 'w')
        
        // Update UCI move history
        const uciMove = move.from + move.to + (move.promotion || '')
        setMoveHistoryUci(prev => [...prev, uciMove])

        // Check if game ended
        if (currentGame.isGameOver() || currentGame.isDraw() || currentGame.isCheckmate() || currentGame.isStalemate()) {
          setIsRunning(false)
          setGameEnded(true)
        }
      } catch (error) {
        // Fallback: if engine/bot fails, use a random valid move
        try {
          const fallbackGame = new Chess(game.fen())
          const possibleMoves = fallbackGame.moves({ verbose: true })
          if (possibleMoves.length > 0) {
            const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
            const botMove = fallbackGame.move(randomMove)
            if (botMove) {
              setGame(fallbackGame)
              setMoves(prev => {
                const newMoves = [...prev, botMove]
                setCurrentMoveIndex(newMoves.length - 1)
                return newMoves
              })
              setIsWhiteTurn(fallbackGame.turn() === 'w')
              
              const uciMove = botMove.from + botMove.to + (botMove.promotion || '')
              setMoveHistoryUci(prev => [...prev, uciMove])
            }
          } else {
            setIsWhiteTurn(true)
            setIsRunning(false)
            setGameEnded(true)
          }
        } catch (fallbackError) {
          setIsWhiteTurn(true)
          setIsRunning(false)
          setGameEnded(true)
        }
      } finally {
        // Reset thinking states
        if (botColor === 'w') {
          setIsWhiteBotThinking(false)
        } else {
          setIsBlackBotThinking(false)
        }
        if (botToMove === 'stockfish') {
          setIsEngineThinking(false)
        }
      }
    }

    makeBotMove()
  }, [isWhiteTurn, game, isEngineThinking, isWhiteBotThinking, isBlackBotThinking, gameStarted, currentMoveIndex, moves.length, whiteBot, blackBot, engine])

  const handleMoveClick = (moveIndex) => {
    if (moveIndex < 0) {
      const newGame = new Chess()
      setGame(newGame)
      setCurrentMoveIndex(null)
      setIsWhiteTurn(true)
      setMoveHistoryUci([])
      return
    }
    
    const newGame = new Chess()
    const newUciHistory = []
    
    for (let i = 0; i <= moveIndex && i < moves.length; i++) {
      const moveObj = moves[i]
      let move = null
      
      if (moveObj && typeof moveObj === 'object' && 'from' in moveObj && 'to' in moveObj) {
        try {
          move = newGame.move({
            from: moveObj.from,
            to: moveObj.to,
            promotion: moveObj.promotion || undefined,
          })
        } catch (e) {
          // Continue to next method
        }
      }
      
      if (!move && moveObj && moveObj.san) {
        try {
          move = newGame.move(moveObj.san)
        } catch (e) {
          // Continue to next method
        }
      }
      
      if (!move && moveObj) {
        try {
          move = newGame.move(moveObj)
        } catch (e) {
          // All methods failed
        }
      }
      
      if (move) {
        const uciMove = move.from + move.to + (move.promotion || '')
        newUciHistory.push(uciMove)
      } else {
        break
      }
    }
    
    setGame(newGame)
    setCurrentMoveIndex(moveIndex)
    setIsWhiteTurn(newGame.turn() === 'w')
    setMoveHistoryUci(newUciHistory)
  }

  const handleTimeUpdate = (color, newTime) => {
    if (color === 'white') {
      setWhiteTime(newTime)
    } else {
      setBlackTime(newTime)
    }
  }

  const handleStartGame = () => {
    if (!whiteBot || !blackBot) {
      return
    }
    
    const newGame = new Chess()
    setGame(newGame)
    setMoves([])
    setCurrentMoveIndex(null)
    setIsWhiteTurn(true)
    setMoveHistoryUci([])
    setWhiteTime(600)
    setBlackTime(600)
    setGameStarted(true)
    setIsRunning(true)
    setGameEnded(false)
  }

  const handleNewGame = () => {
    // Reset all game state and clear board
    const newGame = new Chess()
    setGame(newGame)
    setMoves([])
    setCurrentMoveIndex(null)
    setIsWhiteTurn(true)
    setMoveHistoryUci([])
    setWhiteTime(600)
    setBlackTime(600)
    setGameStarted(false)
    setIsRunning(false)
    setGameEnded(false)
    setIsWhiteBotThinking(false)
    setIsBlackBotThinking(false)
    setIsEngineThinking(false)
  }

  const handleGameReview = () => {
    if (moves.length === 0) return
    
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
    
    let result = '*'
    if (cleanGame.isCheckmate()) {
      result = cleanGame.turn() === 'w' ? '0-1' : '1-0'
    } else if (cleanGame.isDraw() || cleanGame.isStalemate()) {
      result = '1/2-1/2'
    }
    
    const whiteName = whitePlayer.username || whitePlayer.name || 'White'
    const blackName = blackPlayer.username || blackPlayer.name || 'Black'
    
    const today = new Date()
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
    
    cleanGame.header('Event', "Let's Play!")
    cleanGame.header('Site', 'Chess.com')
    cleanGame.header('Date', dateStr)
    cleanGame.header('Round', '?')
    cleanGame.header('White', whiteName)
    cleanGame.header('Black', blackName)
    cleanGame.header('Result', result)
    
    const pgn = cleanGame.pgn()
    
    if (!pgn || pgn.trim() === '') return
    
    sessionStorage.setItem('analysis-pgn', pgn)
    window.open('/analysis', '_blank')
  }

  const handleBotSelect = (color, bot) => {
    if (gameStarted) {
      return
    }
    if (color === 'white') {
      setWhiteBot(bot)
    } else {
      setBlackBot(bot)
    }
  }

  if (engineLoading || authLoading) {
    return <PageLoader />
  }

  if (!user) {
    return (
      <div className="test-page">
        <div className="test-container">
          <div className="test-board-section" ref={sectionRef}>
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

          <div className="test-content-section">
            <div className="test-login-prompt">
              <div className="test-login-content">
                <h2>Login Required</h2>
                <p>Please log in to play bot vs bot games.</p>
                <div className="test-login-actions">
                  <button
                    className="test-login-btn"
                    onClick={() => {
                      const currentPath = location.pathname + location.search + location.hash
                      navigate('/login', { state: { from: currentPath } })
                    }}
                  >
                    Log In
                  </button>
                  <button
                    className="test-signup-btn"
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
    <div className="test-page">
      <div className="test-container">
        <div className="test-board-section" ref={sectionRef}>
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

        <div className="test-content-section">
          <div className="test-controls">
            {/* Bot Selection */}
            <div className="test-bot-selector">
              <div className="test-bot-select-group">
                <label className="test-bot-label">White:</label>
                <select
                  className="test-bot-select"
                  value={whiteBot === 'stockfish' ? 'stockfish' : whiteBot?.id || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === 'stockfish') {
                      handleBotSelect('white', 'stockfish')
                    } else if (value) {
                      const bot = availableBots.find(b => b.id === value)
                      if (bot) handleBotSelect('white', bot)
                    } else {
                      handleBotSelect('white', null)
                    }
                  }}
                  disabled={gameStarted}
                >
                  <option value="">Select Bot</option>
                  <option value="stockfish">Stockfish 17</option>
                  {availableBots.map(bot => (
                    <option key={bot.id} value={bot.id}>{bot.name}</option>
                  ))}
                </select>
              </div>
              <div className="test-bot-select-group">
                <label className="test-bot-label">Black:</label>
                <select
                  className="test-bot-select"
                  value={blackBot === 'stockfish' ? 'stockfish' : blackBot?.id || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === 'stockfish') {
                      handleBotSelect('black', 'stockfish')
                    } else if (value) {
                      const bot = availableBots.find(b => b.id === value)
                      if (bot) handleBotSelect('black', bot)
                    } else {
                      handleBotSelect('black', null)
                    }
                  }}
                  disabled={gameStarted}
                >
                  <option value="">Select Bot</option>
                  <option value="stockfish">Stockfish 17</option>
                  {availableBots.map(bot => (
                    <option key={bot.id} value={bot.id}>{bot.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Game Controls */}
            <div className="test-game-controls">
              <button
                className="test-control-btn test-control-btn-primary"
                onClick={handleStartGame}
                disabled={gameStarted || !whiteBot || !blackBot}
              >
                <Play size={16} />
                <span>Start Game</span>
              </button>
              <button
                className="test-control-btn test-control-btn-primary"
                onClick={handleNewGame}
                disabled={!gameStarted}
              >
                <RefreshCw size={16} />
                <span>New Game</span>
              </button>
            </div>

            {/* Game Review Button */}
            {gameEnded && moves.length > 0 && (
              <div className="test-review-btn-wrapper">
                <button
                  className="test-control-btn game-card-action-btn-primary"
                  onClick={handleGameReview}
                >
                  <Brain size={16} />
                  <span>Game Review</span>
                </button>
              </div>
            )}
          </div>
          <MoveHistory
            moves={moves}
            currentMoveIndex={currentMoveIndex}
            onMoveClick={handleMoveClick}
            flipped={false}
          />
        </div>
      </div>
    </div>
  )
}
