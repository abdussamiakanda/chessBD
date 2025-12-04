import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import { ChessBoard } from '../components/chess/ChessBoard'
import { MoveHistory } from '../components/chess/MoveHistory'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuthStore } from '../store/auth-store'
import { getBotById } from '../lib/bots'
import { useChessEngine } from '../hooks/useChessEngine'
import { chooseMoveWithPersonality, pickMessage } from '../lib/bots/botMove'
import { PawnIcon } from '../components/ui/ChessPieceIcons'
import { Play, RefreshCw, Check } from 'lucide-react'
import { PageLoader } from '../components/ui/PageLoader'
import './Engine.css'

export function BotGame() {
  const { t } = useLanguage()
  const { botId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuthStore()
  const { engine, isLoading: engineLoading } = useChessEngine()
  const [bot, setBot] = useState(null)
  const [game, setGame] = useState(new Chess())
  const [moves, setMoves] = useState([])
  const [moveHistoryUci, setMoveHistoryUci] = useState([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(null)
  const [whiteTime, setWhiteTime] = useState(600)
  const [blackTime, setBlackTime] = useState(600)
  const [isWhiteTurn, setIsWhiteTurn] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [playAsBlack, setPlayAsBlack] = useState(false)
  const flipped = playAsBlack
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [botMessage, setBotMessage] = useState('')
  const [gameStarted, setGameStarted] = useState(false)
  const sectionRef = useRef(null)
  
  const pgn = location.state?.pgn

  // Load bot data
  useEffect(() => {
    if (botId) {
      const botData = getBotById(botId)
      if (botData) {
        setBot(botData)
      } else {
        // Bot not found, redirect to bots page
        navigate('/bots', { replace: true })
      }
    }
  }, [botId, navigate])

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

  const botPlayer = bot ? {
    name: bot.name,
    username: bot.id,
    avatar: bot.icon,
  } : null

  // Assign players to colors based on playAsBlack setting
  const whitePlayer = playAsBlack ? botPlayer : userPlayer
  const blackPlayer = playAsBlack ? userPlayer : botPlayer

  useSEO({
    title: bot ? `${bot.name} - Chess Bot` : 'Chess Bot',
    description: bot ? bot.description : 'Play against a chess bot',
    url: bot ? `/bots/${bot.id}` : '/bots',
  })

  const handleMove = async (sourceSquare, targetSquare, promotion = 'q') => {
    if (!user) {
      return false
    }

    if (currentMoveIndex !== null && currentMoveIndex < moves.length - 1) {
      return false
    }

    if (!gameStarted && playAsBlack) {
      return false
    }

    const userColor = playAsBlack ? 'b' : 'w'
    if (game.turn() !== userColor) {
      return false
    }

    const gameCopy = new Chess(game.fen())

    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotion || 'q',
      })

      if (!move) {
        return false
      }

      setGame(gameCopy)
      const newMoves = [...moves, move]
      setMoves(newMoves)
      setCurrentMoveIndex(newMoves.length - 1)

      const uciMove = `${sourceSquare}${targetSquare}${move.promotion || ''}`
      const newUciHistory = [...moveHistoryUci, uciMove]
      setMoveHistoryUci(newUciHistory)

      setIsWhiteTurn(gameCopy.turn() === 'w')

      if (!gameStarted) {
        setGameStarted(true)
        setIsRunning(true)
      }

      // Get bot message reacting to user's move
      const botColor = playAsBlack ? 'w' : 'b'
      const personality = {
        elo: bot?.elo || 2000,
        blunder_rate: bot?.blunder_rate || 0.15,
        depth: bot?.depth || 0,
        max_ms: bot?.max_ms || 350,
        welcome: [],
        midgame: ["Your move!", "Let's see what you got!", "Interesting..."],
        game_over_win: ["GG! Well played!", "Good game!", "Thanks for playing!"],
        game_over_loss: ["Nice game!", "Well played!", "Good fight!"],
        game_over_draw: ["Draw! Good game!", "Stalemate!", "Interesting game!"],
        game_over: ["Game over!", "Thanks for playing!", "GG!"],
      }
      const message = await pickMessage(gameCopy, personality, botColor, bot?.description || null)
      if (message) {
        setBotMessage(message)
      }

      return true
    } catch (e) {
      return false
    }
  }

  const makeBotMove = async () => {
    if (!game || !bot || isBotThinking || game.isGameOver()) {
      return
    }

    const botColor = playAsBlack ? 'w' : 'b'
    if (game.turn() !== botColor) {
      return
    }

    setIsBotThinking(true)

    // Add random delay to make bot moves feel more natural (500ms to 2000ms)
    const minDelay = 500
    const maxDelay = 2000
    const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay
    await new Promise(resolve => setTimeout(resolve, randomDelay))

    try {
      const currentFen = game.fen()
      const gameCopy = new Chess(currentFen)

      // Get personality settings from bot
      const personality = {
        elo: bot.elo || 2000,
        blunder_rate: bot.blunder_rate || 0.15,
        depth: bot.depth || 0,
        max_ms: bot.max_ms || 350,
        // Placeholder messages for now
        welcome: [],
        midgame: ["Your move!", "Let's see what you got!", "Interesting..."],
        game_over_win: ["GG! Well played!", "Good game!", "Thanks for playing!"],
        game_over_loss: ["Nice game!", "Well played!", "Good fight!"],
        game_over_draw: ["Draw! Good game!", "Stalemate!", "Interesting game!"],
        game_over: ["Game over!", "Thanks for playing!", "GG!"],
      }

      // Choose move with personality
      const moveUci = await chooseMoveWithPersonality(gameCopy, personality, engine)
      
      if (!moveUci) {
        throw new Error('No move returned from bot')
      }

      // Parse UCI move
      const from = moveUci.substring(0, 2)
      const to = moveUci.substring(2, 4)
      const promotion = moveUci.length > 4 ? moveUci[4].toLowerCase() : undefined

      // Make the move
      const move = gameCopy.move({
        from,
        to,
        promotion: promotion || undefined,
      })

      if (!move) {
        throw new Error('Failed to make move')
      }

      // Update bot message (check game state after move)
      const botColorChar = botColor
      const message = await pickMessage(gameCopy, personality, botColorChar, bot?.description || null)
      setBotMessage(message)

      // Update game state
      const newMoves = [...moves, move]
      setMoves(newMoves)
      setCurrentMoveIndex(newMoves.length - 1)
      setMoveHistoryUci([...moveHistoryUci, moveUci])
      setIsWhiteTurn(gameCopy.turn() === 'w')
      setGame(gameCopy)
    } catch (error) {
      // Fallback: make a random move
      const gameCopy = new Chess(game.fen())
      const legalMoves = gameCopy.moves({ verbose: true })
      if (legalMoves.length > 0) {
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)]
        const move = gameCopy.move(randomMove)
        if (move) {
          const newMoves = [...moves, move]
          setMoves(newMoves)
          setCurrentMoveIndex(newMoves.length - 1)
          setIsWhiteTurn(gameCopy.turn() === 'w')
          setGame(gameCopy)
          
          const moveUci = `${move.from}${move.to}${move.promotion || ''}`
          setMoveHistoryUci([...moveHistoryUci, moveUci])
        }
      }
    } finally {
      setIsBotThinking(false)
    }
  }

  // Bot move effect with delay
  useEffect(() => {
    if (!gameStarted || !game || !bot || isBotThinking || !user) {
      return
    }

    if (game.isGameOver()) {
      setIsRunning(false)
      return
    }

    const botColor = playAsBlack ? 'w' : 'b'
    const isAtLatestPosition = currentMoveIndex === null || currentMoveIndex === moves.length - 1
    if (game.turn() === botColor && isAtLatestPosition) {
      const delay = Math.random() * 1500 + 500
      const timeoutId = setTimeout(() => {
        makeBotMove()
      }, delay)

      return () => clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, gameStarted, bot, isBotThinking, playAsBlack, currentMoveIndex, moves.length, user])

  const handleTimeUpdate = (color, newTime) => {
    setTimeout(() => {
      if (color === 'white') {
        setWhiteTime(newTime)
      } else {
        setBlackTime(newTime)
      }
    }, 0)
  }

  const handleMoveClick = (moveIndex) => {
    if (moveIndex === null) {
      const newGame = new Chess()
      setGame(newGame)
      setMoves([])
      setCurrentMoveIndex(null)
      setMoveHistoryUci([])
      setIsWhiteTurn(true)
      return
    }

    const newGame = new Chess()
    const newUciHistory = []

    for (let i = 0; i <= moveIndex; i++) {
      const move = moves[i]
      if (move) {
        try {
          let appliedMove = null
          if (move.from && move.to) {
            appliedMove = newGame.move({ from: move.from, to: move.to, promotion: move.promotion })
          } else if (move.san) {
            appliedMove = newGame.move(move.san)
          } else {
            appliedMove = newGame.move(move)
          }

          if (appliedMove) {
            newUciHistory.push(`${appliedMove.from}${appliedMove.to}`)
          }
        } catch (e) {
          // Failed to replay move
        }
      }
    }

    setGame(newGame)
    setCurrentMoveIndex(moveIndex)
    setMoveHistoryUci(newUciHistory)
    setIsWhiteTurn(newGame.turn() === 'w')
  }

  const handleStartGame = () => {
    const newGame = new Chess()
    setGame(newGame)
    setMoves([])
    setCurrentMoveIndex(null)
    setMoveHistoryUci([])
    setWhiteTime(600)
    setBlackTime(600)
    setIsWhiteTurn(true)
    setGameStarted(true)
    setIsRunning(true)
  }

  const handleNewGame = () => {
    const newGame = new Chess()
    setGame(newGame)
    setMoves([])
    setCurrentMoveIndex(null)
    setMoveHistoryUci([])
    setWhiteTime(600)
    setBlackTime(600)
    setIsWhiteTurn(true)
    setGameStarted(false)
    setIsRunning(false)
  }

  const handlePlayAsBlack = () => {
    if (gameStarted) {
      return
    }
    
    setPlayAsBlack(!playAsBlack)
    const newGame = new Chess()
    setGame(newGame)
    setMoves([])
    setCurrentMoveIndex(null)
    setMoveHistoryUci([])
    setWhiteTime(600)
    setBlackTime(600)
    setIsWhiteTurn(true)
    setGameStarted(false)
    setIsRunning(false)
  }

  const gamePosition = useMemo(() => {
    return game.fen()
  }, [game])

  const lastMove = useMemo(() => {
    if (moves.length === 0) return null
    const lastMoveObj = moves[moves.length - 1]
    if (lastMoveObj && lastMoveObj.from && lastMoveObj.to) {
      return {
        from: lastMoveObj.from,
        to: lastMoveObj.to,
      }
    }
    return null
  }, [moves])

  if (authLoading || engineLoading) {
    return <PageLoader />
  }

  if (!bot) {
    return <PageLoader />
  }

  if (!user) {
    return (
      <div className="engine-page">
        <div className="engine-container">
          <div className="engine-board-section" ref={sectionRef}>
            <ChessBoard
              position={gamePosition}
              onMove={() => false}
              flipped={flipped}
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

          <div className="engine-content-section">
            <div className="engine-login-prompt">
              <div className="engine-login-content">
                <h2>{t('bots.signInRequired') || t('auth.signInRequired') || 'Sign In Required'}</h2>
                <p>{t('bots.signInMessage') || t('auth.signInMessage') || 'Please sign in to play against bots.'}</p>
                <div className="engine-login-actions">
                  <button
                    className="engine-login-btn"
                    onClick={() => navigate('/login', { state: { from: location.pathname } })}
                  >
                    {t('auth.signIn') || 'Sign In'}
                  </button>
                  <button
                    className="engine-signup-btn"
                    onClick={() => navigate('/signup', { state: { from: location.pathname } })}
                  >
                    {t('auth.signUp') || 'Sign Up'}
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
    <div className="engine-page">
      <div className="engine-container">
        <div className="engine-board-section" ref={sectionRef}>
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
          />
        </div>

        <div className="engine-content-section">
          <div className="engine-controls">
            <button
              className="engine-control-btn engine-control-btn-primary"
              onClick={handleStartGame}
              disabled={gameStarted}
            >
              <Play size={16} />
              <span>{t('engine.startGame') || 'Start Game'}</span>
            </button>
            <button
              className="engine-control-btn engine-control-btn-primary"
              onClick={handleNewGame}
              disabled={!gameStarted}
            >
              <RefreshCw size={16} />
              <span>{t('engine.newGame') || 'New Game'}</span>
            </button>
            <div className="pawn-toggle-group">
              <button
                className={`engine-control-btn engine-control-btn-toggle ${!playAsBlack ? 'active' : ''}`}
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
                className={`engine-control-btn engine-control-btn-toggle ${playAsBlack ? 'active' : ''}`}
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

            {botMessage && (
              <div className="puzzle-feedback">
                <span className="puzzle-feedback-success">{botMessage}</span>
              </div>
            )}
          </div>

          <MoveHistory
            moves={moves}
            currentMoveIndex={currentMoveIndex}
            onMoveClick={handleMoveClick}
          />
        </div>
      </div>
    </div>
  )
}

