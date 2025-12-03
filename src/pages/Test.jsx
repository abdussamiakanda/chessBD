import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import { ChessBoard } from '../components/chess/ChessBoard'
import { MoveHistory } from '../components/chess/MoveHistory'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuthStore } from '../store/auth-store'
import { useChessEngine } from '../hooks/useChessEngine'
import { PawnIcon } from '../components/ui/ChessPieceIcons'
import { Play, RefreshCw, Check } from 'lucide-react'
import { PageLoader } from '../components/ui/PageLoader'
import { loadCustomPieces, createCustomPieces } from '../lib/chess/loadPieces.jsx'
import './Test.css'

export function Test() {
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuthStore()
  const { engine, isLoading: engineLoading, error: engineError } = useChessEngine()
  const [game, setGame] = useState(new Chess())
  const [moves, setMoves] = useState([]) // Full move history - never truncated
  const [moveHistoryUci, setMoveHistoryUci] = useState([]) // Track UCI moves for API
  const [currentMoveIndex, setCurrentMoveIndex] = useState(null)
  const [whiteTime, setWhiteTime] = useState(600)
  const [blackTime, setBlackTime] = useState(600)
  const [isWhiteTurn, setIsWhiteTurn] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [playAsBlack, setPlayAsBlack] = useState(false)
  const [isEngineThinking, setIsEngineThinking] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [customPieces, setCustomPieces] = useState(null)
  const sectionRef = useRef(null)
  
  const pgn = location.state?.pgn

  // Load custom pieces on mount
  useEffect(() => {
    try {
      // Change 'default' to your theme name
      const themeName = 'default'
      const pieceUrls = loadCustomPieces(themeName)
      console.log('Loaded piece URLs:', Object.keys(pieceUrls))
      if (Object.keys(pieceUrls).length > 0) {
        const pieces = createCustomPieces(pieceUrls)
        console.log('Created custom pieces:', Object.keys(pieces))
        setCustomPieces(pieces)
      } else {
        console.warn('No piece URLs loaded')
      }
    } catch (error) {
      console.error('Failed to load custom pieces:', error)
    }
  }, [])

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

  const enginePlayer = {
    name: 'Stockfish 17',
    username: 'stockfish17',
    avatar: 'https://stockfishchess.org/images/logo/icon_512x512@2x.webp',
  }

  // Assign players to colors based on playAsBlack setting
  // If playAsBlack = false: user is white, engine is black
  // If playAsBlack = true: user is black, engine is white
  const whitePlayer = playAsBlack ? enginePlayer : userPlayer
  const blackPlayer = playAsBlack ? userPlayer : enginePlayer

  useSEO({
    title: 'Chess Test',
    description: 'Test your chess skills',
    url: '/test',
  })

  const handleMove = (sourceSquare, targetSquare, promotion = 'q') => {
    // Don't allow moves if user is not logged in
    if (!user) {
      return false
    }

    // Don't allow moves when replaying/navigating through move history
    // Only allow moves when at the latest position (currentMoveIndex === moves.length - 1 or null)
    if (currentMoveIndex !== null && currentMoveIndex < moves.length - 1) {
      return false
    }

    // Don't allow moves if game hasn't started (for black, game starts with Start Game button)
    // Exception: if user is white and game hasn't started, allow the first move to start the game
    if (!gameStarted && playAsBlack) {
      return false
    }

    // Determine which color the user is playing
    const userColor = playAsBlack ? 'b' : 'w'
    const isUserTurn = playAsBlack ? !isWhiteTurn : isWhiteTurn
    
    // Only allow moves when it's the user's turn
    if (!isUserTurn) {
      return false
    }

    const gameCopy = new Chess(game.fen())
    
    // Check if the piece being moved matches the user's color
    const piece = gameCopy.get(sourceSquare)
    if (!piece || piece.color !== userColor) {
      return false
    }
    
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotion || 'q',
      })
      
      if (move) {
        // If game hasn't started and user is white, start the game after successful move
        if (!gameStarted && !playAsBlack) {
          setGameStarted(true)
          setIsRunning(true)
        }
        
        setGame(gameCopy)
        // Add the new move to the moves array instead of replacing it
        setMoves(prev => {
          const newMoves = [...prev, move]
          setCurrentMoveIndex(newMoves.length - 1)
          return newMoves
        })
        setIsWhiteTurn(gameCopy.turn() === 'w')
        
        // Update UCI move history for API
        const uciMove = sourceSquare + targetSquare + (move.promotion || '')
        setMoveHistoryUci(prev => [...prev, uciMove])
        
        return true
      }
    } catch (e) {
      // Invalid move
    }
    return false
  }

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

  // Engine move handler
  useEffect(() => {
    // Don't work if user is not logged in
    if (!user) {
      return
    }
    
    // Only work if game has started
    if (!gameStarted) {
      return
    }
    
    // Determine which color the engine is playing
    const engineColor = playAsBlack ? 'w' : 'b'
    const isEngineTurn = playAsBlack ? isWhiteTurn : !isWhiteTurn
    
    // Only trigger when it's the engine's turn and game is not over
    // Don't trigger if we're navigating through move history (currentMoveIndex !== moves.length - 1)
    if (!isEngineTurn || isEngineThinking || (currentMoveIndex !== null && currentMoveIndex < moves.length - 1)) {
      return
    }

    const makeEngineMove = async () => {
      // Don't proceed if engine is not ready
      if (!engine || !engine.getIsReady()) {
        setIsEngineThinking(false)
        return
      }

      setIsEngineThinking(true)
      
      // Add random delay to make engine moves feel more natural (500ms to 2000ms)
      const minDelay = 500
      const maxDelay = 2000
      const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay
      
      // Wait for the delay before making the move
      await new Promise(resolve => setTimeout(resolve, randomDelay))
      
      try {
        // Create game instance from current position
        const currentGame = new Chess(game.fen())
        
        // Check if game is over
        if (currentGame.isGameOver() || currentGame.isDraw()) {
          setIsEngineThinking(false)
          return
        }
        
        const currentFen = currentGame.fen()
        
        // Use Stockfish engine to evaluate position and get best move
        // Using depth 15 for good balance between speed and strength
        const positionEval = await engine.evaluatePosition(currentFen, 15)
        
        // Get the best move from the evaluation
        const bestMoveUci = positionEval.bestMove
        if (!bestMoveUci || bestMoveUci === '(none)') {
          throw new Error('No best move returned from engine')
        }
        
        // Parse UCI move (format: e2e4 or e7e8q for promotion)
        const from = bestMoveUci.substring(0, 2)
        const to = bestMoveUci.substring(2, 4)
        const promotion = bestMoveUci.length > 4 ? bestMoveUci[4] : undefined
        
        // Validate and make the move
        const pieceOnFrom = currentGame.get(from)
        if (!pieceOnFrom) {
          throw new Error(`No piece on source square: ${from}`)
        }
        
        // Determine which color the engine is playing
        const engineColor = playAsBlack ? 'w' : 'b'
        if (currentGame.turn() !== engineColor) {
          throw new Error(`Wrong turn - expected ${engineColor}, got: ${currentGame.turn()}`)
        }
        
        if (pieceOnFrom.color !== engineColor) {
          throw new Error(`Wrong piece color - expected ${engineColor}, got: ${pieceOnFrom.color}`)
        }
        
        const engineMove = currentGame.move({
          from,
          to,
          promotion: promotion ? promotion.toLowerCase() : 'q',
        })
        
        if (!engineMove) {
          throw new Error('Failed to make move')
        }

        // Update game state
        setGame(currentGame)
        setMoves(prev => {
          const newMoves = [...prev, engineMove]
          setCurrentMoveIndex(newMoves.length - 1)
          return newMoves
        })
        setIsWhiteTurn(currentGame.turn() === 'w')
        
        // Update UCI move history
        const uciMove = engineMove.from + engineMove.to + (engineMove.promotion || '')
        setMoveHistoryUci(prev => [...prev, uciMove])
      } catch (error) {
        // Fallback: if engine fails, use a random valid move
        try {
          const fallbackGame = new Chess(game.fen())
          const possibleMoves = fallbackGame.moves({ verbose: true })
          if (possibleMoves.length > 0) {
            const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
            const engineMove = fallbackGame.move(randomMove)
            if (engineMove) {
              setGame(fallbackGame)
              setMoves(prev => {
                const newMoves = [...prev, engineMove]
                setCurrentMoveIndex(newMoves.length - 1)
                return newMoves
              })
              setIsWhiteTurn(fallbackGame.turn() === 'w')
              
              const uciMove = engineMove.from + engineMove.to + (engineMove.promotion || '')
              setMoveHistoryUci(prev => [...prev, uciMove])
            }
          } else {
            setIsWhiteTurn(true)
          }
        } catch (fallbackError) {
          setIsWhiteTurn(true)
        }
      } finally {
        setIsEngineThinking(false)
      }
    }

    makeEngineMove()
  }, [isWhiteTurn, game, isEngineThinking, playAsBlack, gameStarted, currentMoveIndex, moves.length, user, engine])

  const handleMoveClick = (moveIndex) => {
    // If moveIndex is -1, go to start position
    if (moveIndex < 0) {
      const newGame = new Chess()
      setGame(newGame)
      setCurrentMoveIndex(null)
      setIsWhiteTurn(true)
      // Reset UCI history to empty
      setMoveHistoryUci([])
      return
    }
    
    // Rebuild game state up to the clicked move using the full moves array
    // Don't truncate moves - always show full history
    const newGame = new Chess()
    const newUciHistory = []
    
    for (let i = 0; i <= moveIndex && i < moves.length; i++) {
      const moveObj = moves[i]
      
      // Try different methods to replay the move
      let move = null
      
      // Method 1: Try using the move object directly (if it's a Move object from chess.js)
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
      
      // Method 2: Try using SAN notation
      if (!move && moveObj && moveObj.san) {
        try {
          move = newGame.move(moveObj.san)
        } catch (e) {
          // Continue to next method
        }
      }
      
      // Method 3: Try using the move object itself (if it's already a Move object)
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
        // If we can't replay a move, we can't continue
        break
      }
    }
    
    setGame(newGame)
    setCurrentMoveIndex(moveIndex)
    setIsWhiteTurn(newGame.turn() === 'w')
    setMoveHistoryUci(newUciHistory)
    // Don't update moves - keep the full history
  }

  const handleTimeUpdate = (color, newTime) => {
    if (color === 'white') {
      setWhiteTime(newTime)
    } else {
      setBlackTime(newTime)
    }
  }

  const handleStartGame = () => {
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
    
    // If user is black, engine makes first move
    // This will be handled by the engine useEffect
  }

  const handleNewGame = () => {
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
  }

  const handlePlayAsBlack = () => {
    // Only allow toggling if game hasn't started
    if (gameStarted) {
      return
    }
    
    const newPlayAsBlack = !playAsBlack
    setPlayAsBlack(newPlayAsBlack)
    setFlipped(newPlayAsBlack)
    
    // Reset game state but don't start the game
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
  }

  if (authLoading) {
    return <PageLoader />
  }

  if (engineLoading) {
    return <PageLoader />
  }

  return (
    <div className="test-page">
      <div className="test-container">
        <div className="test-board-section" ref={sectionRef}>
          <ChessBoard
            position={gamePosition}
            onMove={handleMove}
            flipped={flipped}
            arePiecesDraggable={user && (currentMoveIndex === null || currentMoveIndex === moves.length - 1)}
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
            customPieces={customPieces}
          />
        </div>

        <div className="test-content-section">
          {!user ? (
            <div className="test-login-prompt">
              <div className="test-login-content">
                <h2>Login Required</h2>
                <p>Please log in to play against the chess engine.</p>
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
          ) : (
            <>
              <div className="test-controls">
                <button
                  className="test-control-btn test-control-btn-primary"
                  onClick={handleStartGame}
                  disabled={gameStarted}
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
                <div className="pawn-toggle-group">
                  <button
                    className={`test-control-btn test-control-btn-toggle ${!playAsBlack ? 'active' : ''}`}
                    onClick={() => {
                      if (playAsBlack) {
                        handlePlayAsBlack()
                      }
                    }}
                    title="Play as White"
                    disabled={gameStarted}
                  >
                    <div className="pawn-icon pawn-white">
                      <PawnIcon className="pawn-svg" />
                    </div>
                    {!playAsBlack && (
                      <Check className="pawn-toggle-check" size={12} />
                    )}
                  </button>
                  <button
                    className={`test-control-btn test-control-btn-toggle ${playAsBlack ? 'active' : ''}`}
                    onClick={() => {
                      if (!playAsBlack) {
                        handlePlayAsBlack()
                      }
                    }}
                    title="Play as Black"
                    disabled={gameStarted}
                  >
                    <div className="pawn-icon pawn-black">
                      <PawnIcon className="pawn-svg" />
                    </div>
                    {playAsBlack && (
                      <Check className="pawn-toggle-check" size={12} />
                    )}
                  </button>
                </div>
              </div>
              <MoveHistory
                moves={moves}
                currentMoveIndex={currentMoveIndex}
                onMoveClick={handleMoveClick}
                flipped={flipped}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

