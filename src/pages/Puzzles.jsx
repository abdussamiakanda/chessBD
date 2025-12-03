import { useState, useEffect, useRef, useMemo } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useSEO } from '../hooks/use-seo'
import { useAuthStore } from '../store/auth-store'
import { api } from '../lib/api'
import { Chess } from 'chess.js'
import { ChessBoard } from '../components/chess/ChessBoard'
import { MoveHistory } from '../components/chess/MoveHistory'
import { RefreshCw, CheckCircle, Info, ExternalLink, Puzzle } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageLoader } from '../components/ui/PageLoader'
import './Puzzles.css'

export function Puzzles() {
  const { t } = useLanguage()
  const { user, loading: authLoading } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [puzzle, setPuzzle] = useState(null)
  const [game, setGame] = useState(null)
  const [initialGame, setInitialGame] = useState(null) // Store initial puzzle state
  const [moves, setMoves] = useState([]) // Full move history
  const [currentMoveIndex, setCurrentMoveIndex] = useState(null)
  const [solutionIndex, setSolutionIndex] = useState(0)
  const [isCorrect, setIsCorrect] = useState(null)
  const [showSolution, setShowSolution] = useState(false)
  const [loading, setLoading] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [isWhiteTurn, setIsWhiteTurn] = useState(true)
  const [isPlayingOpponentMove, setIsPlayingOpponentMove] = useState(false)
  const [userIsWhite, setUserIsWhite] = useState(true) // Track which color the user is playing
  const sectionRef = useRef(null)
  
  useSEO({
    title: t('learn.categories.tactics.title'),
    description: t('learn.categories.tactics.description'),
    url: '/puzzles',
  })

  // Initialize game state if not set (so board always shows)
  useEffect(() => {
    if (!game) {
      const defaultGame = new Chess()
      setGame(defaultGame)
      setIsWhiteTurn(true)
      setUserIsWhite(true) // Default: user is white
      setFlipped(false) // User is white, so no flip needed
    }
  }, [game])

  const resetPuzzle = () => {
    if (!initialGame || !puzzle) return
    
    // Reset to initial state
    const resetGame = new Chess()
    resetGame.load(initialGame.fen())
    setGame(resetGame)
    setMoves([])
    setCurrentMoveIndex(null)
    setSolutionIndex(0)
    setIsCorrect(null)
    setShowSolution(false)
    setIsWhiteTurn(resetGame.turn() === 'w')
    // Determine user color from initial position: if it's white's turn, user is white; if black's turn, user is black
    const userIsWhiteColor = resetGame.turn() === 'w'
    setUserIsWhite(userIsWhiteColor)
    setFlipped(!userIsWhiteColor) // Flip board if user is black, so user is always at bottom
  }

  const loadPuzzle = async (resetState = true) => {
    setLoading(true)
    
    setIsCorrect(null)
    setShowSolution(false)
    setSolutionIndex(0)
    setIsPlayingOpponentMove(false)
    
    if (resetState) {
      setMoves([])
      setCurrentMoveIndex(null)
    }

    try {
      const currentPuzzleId = puzzle?.puzzle?.id
      let puzzleData = null
      let attempts = 0
      const maxAttempts = 15
      const retryDelay = 800
      
      while (attempts < maxAttempts) {
        attempts++
        
        const fetchedPuzzle = await api.getPuzzle()
        
        if (!fetchedPuzzle) {
          if (attempts >= maxAttempts) {
            setLoading(false)
            return
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        
        if (!currentPuzzleId || fetchedPuzzle.puzzle.id !== currentPuzzleId) {
          puzzleData = fetchedPuzzle
          break
        } else {
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
        }
      }
      
      if (!puzzleData) {
        setLoading(false)
        return
      }

      if (!puzzleData.puzzle || !puzzleData.puzzle.solution || puzzleData.puzzle.solution.length === 0) {
        setLoading(false)
        return
      }

      const puzzleGame = new Chess()
      const hasFen = puzzleData.game.fen
      let gameLoaded = false
      
      if (hasFen) {
        try {
          puzzleGame.load(hasFen)
          gameLoaded = true
          setGame(puzzleGame)
          setMoves([])
          setCurrentMoveIndex(null)
          setIsWhiteTurn(puzzleGame.turn() === 'w')
          // Determine user color: if it's white's turn, user is white; if black's turn, user is black
          const userIsWhiteColor = puzzleGame.turn() === 'w'
          setUserIsWhite(userIsWhiteColor)
          setFlipped(!userIsWhiteColor) // Flip board if user is black, so user is always at bottom
          
          const initialGameCopy = new Chess()
          initialGameCopy.load(hasFen)
          setInitialGame(initialGameCopy)
        } catch (e) {
          try {
            puzzleGame.loadPgn(puzzleData.game.pgn)
            gameLoaded = true
            setGame(puzzleGame)
            setMoves([])
            setCurrentMoveIndex(null)
            setIsWhiteTurn(puzzleGame.turn() === 'w')
            // Determine user color: if it's white's turn, user is white; if black's turn, user is black
            const userIsWhiteColor = puzzleGame.turn() === 'w'
            setUserIsWhite(userIsWhiteColor)
            setFlipped(!userIsWhiteColor) // Flip board if user is black, so user is always at bottom
            
            const initialGameCopy = new Chess()
            initialGameCopy.load(puzzleGame.fen())
            setInitialGame(initialGameCopy)
          } catch (e2) {
            // Fallback failed
          }
        }
      } else {
        try {
          puzzleGame.loadPgn(puzzleData.game.pgn)
          gameLoaded = true
        } catch (e) {
          const pgn = puzzleData.game.pgn
          const moveMatches = pgn.match(/\d+\.\s*([^\s]+)\s+([^\s]+)/g) || []
          
          for (const match of moveMatches) {
            const parts = match.match(/\d+\.\s*([^\s]+)\s+([^\s]+)/)
            if (parts) {
              try {
                puzzleGame.move(parts[1])
                puzzleGame.move(parts[2])
                gameLoaded = true
              } catch (e) {
                // Skip invalid moves
              }
            }
          }
        }

        const initialPly = puzzleData.puzzle.initialPly
        const history = puzzleGame.history({ verbose: true })
        
        const tempGame = new Chess()
        for (let i = 0; i < initialPly && i < history.length; i++) {
          try {
            tempGame.move(history[i])
          } catch (e) {
            // Skip invalid moves
          }
        }

        gameLoaded = true
        setGame(tempGame)
        setMoves([])
        setCurrentMoveIndex(null)
        setIsWhiteTurn(tempGame.turn() === 'w')
        // Determine user color: if it's white's turn, user is white; if black's turn, user is black
        const userIsWhiteColor = tempGame.turn() === 'w'
        setUserIsWhite(userIsWhiteColor)
        setFlipped(!userIsWhiteColor) // Flip board if user is black, so user is always at bottom
        
        const initialGameCopy = new Chess()
        initialGameCopy.load(tempGame.fen())
        setInitialGame(initialGameCopy)
      }
      
      if (!gameLoaded) {
        setLoading(false)
        return
      }
      
      setPuzzle(puzzleData)
      setShowSolution(false)
      setSolutionIndex(0)
      
      if (game && !initialGame) {
        const initialGameCopy = new Chess()
        initialGameCopy.load(game.fen())
        setInitialGame(initialGameCopy)
      }
    } catch (error) {
      // Error handling without toast
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && !puzzle) {
      loadPuzzle(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Calculate last move for highlighting
  const lastMove = useMemo(() => {
    if (moves.length === 0) return null
    const lastMoveObj = moves[moves.length - 1]
    return lastMoveObj ? { from: lastMoveObj.from, to: lastMoveObj.to } : null
  }, [moves])

  // Get player info
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

  const puzzlePlayer = {
    name: puzzle?.game?.perf?.name || 'Puzzle',
    username: 'puzzle',
    avatar: null,
    icon: Puzzle,
  }

  // Determine which color the user is playing based on puzzle starting position
  // If user is white: userPlayer is white, puzzlePlayer is black
  // If user is black: userPlayer is black, puzzlePlayer is white (and board is flipped)
  const whitePlayer = userIsWhite ? userPlayer : puzzlePlayer
  const blackPlayer = userIsWhite ? puzzlePlayer : userPlayer

  const handleMove = (sourceSquare, targetSquare, promotion) => {
    if (!game || !puzzle) return false
    if (isPlayingOpponentMove) return false
    if (isCorrect === true && !showSolution) return false
    if (isCorrect === false && !showSolution) return false

    const moves = game.moves({ square: sourceSquare, verbose: true })
    const isValidSquare = moves.some((m) => m.to === targetSquare)
    
    if (!isValidSquare) {
      return false
    }

    const piece = game.get(sourceSquare)
    const isPawn = piece?.type === 'p'
    const rank = parseInt(targetSquare[1])
    const isPromotionMove = isPawn && (
      (game.turn() === 'w' && rank === 8) || 
      (game.turn() === 'b' && rank === 1)
    )

    if (isPromotionMove && !promotion) {
      // ChessBoard will handle promotion dialog automatically
      return false
    }

    if (showSolution) {
      let move
      try {
        if (isPromotionMove && promotion) {
          move = game.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: promotion,
          })
        } else {
          move = game.move({
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

      // Add move to moves array
      setMoves(prev => {
        const newMoves = [...prev, move]
        setCurrentMoveIndex(newMoves.length - 1)
        return newMoves
      })
      setIsWhiteTurn(game.turn() === 'w')
      
      const opponentMoveIndex = solutionIndex + 1
      
      if (opponentMoveIndex < puzzle.puzzle.solution.length) {
        setIsPlayingOpponentMove(true)
        
        setTimeout(() => {
          let opponentMoveStr = puzzle.puzzle.solution[opponentMoveIndex]
          if (opponentMoveStr) {
            opponentMoveStr = opponentMoveStr
              .replace(/^\d+\.\.\.\s*/, '')
              .replace(/^\d+\.\s*/, '')
              .trim()
          }
          
          try {
            let opponentMove = game.move(opponentMoveStr)
            
            if (!opponentMove && opponentMoveStr.length >= 4) {
              const from = opponentMoveStr.substring(0, 2)
              const to = opponentMoveStr.substring(2, 4)
              const promotion = opponentMoveStr.length > 4 ? opponentMoveStr[4] : undefined
              
              opponentMove = game.move({
                from,
                to,
                promotion: promotion ? promotion.toLowerCase() : undefined
              })
            }
            
            if (opponentMove) {
              // Add opponent move to moves array
              setMoves(prev => {
                const newMoves = [...prev, opponentMove]
                setCurrentMoveIndex(newMoves.length - 1)
                return newMoves
              })
              setIsWhiteTurn(game.turn() === 'w')
              setSolutionIndex(opponentMoveIndex + 1)
            } else {
              setSolutionIndex(opponentMoveIndex)
            }
            setIsPlayingOpponentMove(false)
          } catch (e) {
            setSolutionIndex(opponentMoveIndex)
            setIsPlayingOpponentMove(false)
          }
        }, 800)
      }
      
      return true
    }

    let expectedMove = puzzle.puzzle.solution[solutionIndex]
    if (expectedMove) {
      expectedMove = expectedMove
        .replace(/^\d+\.\.\.\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .trim()
    }
    
    if (!expectedMove) {
      return false
    }
    
    const tempGame = new Chess(game.fen())
    
    let move
    if (isPromotionMove && promotion) {
      move = tempGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotion,
      })
    } else {
      move = tempGame.move({
        from: sourceSquare,
        to: targetSquare,
      })
    }

    if (!move) {
      return false
    }
    
    const moveSan = move.san.replace(/[+#=]/, '').trim()
    const moveUci = (move.from + move.to + (move.promotion || '')).toLowerCase()
    const expectedMoveClean = expectedMove.replace(/[+#=]/, '').trim()
    const expectedMoveLower = expectedMoveClean.toLowerCase()
    const expectedMoveUpper = expectedMoveClean.toUpperCase()
    
    let isExpectedMove = 
      moveSan === expectedMoveClean || 
      moveSan === expectedMoveUpper ||
      moveSan.toLowerCase() === expectedMoveLower ||
      moveUci === expectedMoveLower ||
      moveUci === expectedMoveClean.toLowerCase()
    
    if (!isExpectedMove) {
      try {
        const testGame = new Chess(game.fen())
        let testMove = null
        
        try {
          testMove = testGame.move(expectedMoveClean)
        } catch (e) {
          if (expectedMoveClean.length >= 4) {
            const uciPattern = /^[a-h][1-8][a-h][1-8][qrnb]?$/i
            if (uciPattern.test(expectedMoveClean)) {
              const from = expectedMoveClean.substring(0, 2).toLowerCase()
              const to = expectedMoveClean.substring(2, 4).toLowerCase()
              const promotion = expectedMoveClean.length > 4 ? expectedMoveClean[4].toLowerCase() : undefined
              
              try {
                testMove = testGame.move({
                  from,
                  to,
                  promotion: promotion || undefined
                })
              } catch (e2) {
                // UCI move failed
              }
            }
          }
        }
        
        if (testMove) {
          const userMoveFen = tempGame.fen().split(' ').slice(0, 4).join(' ')
          const expectedMoveFen = testGame.fen().split(' ').slice(0, 4).join(' ')
          isExpectedMove = userMoveFen === expectedMoveFen
        }
      } catch (e) {
        // If parsing fails, continue with original match result
      }
    }

    if (isExpectedMove) {
      let appliedMove
      try {
        if (isPromotionMove && promotion) {
          appliedMove = game.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: promotion,
          })
        } else {
          appliedMove = game.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: move.promotion || undefined
          })
        }
        
        if (!appliedMove) {
          return false
        }
        
        // Add move to moves array
        setMoves(prev => {
          const newMoves = [...prev, appliedMove]
          setCurrentMoveIndex(newMoves.length - 1)
          return newMoves
        })
        setIsWhiteTurn(game.turn() === 'w')
      } catch (e) {
        return false
      }
      
      const nextSolutionIndex = solutionIndex + 1
      if (nextSolutionIndex < puzzle.puzzle.solution.length) {
        setIsPlayingOpponentMove(true)
        
        setTimeout(() => {
          let opponentMoveStr = puzzle.puzzle.solution[nextSolutionIndex]
          if (opponentMoveStr) {
            opponentMoveStr = opponentMoveStr
              .replace(/^\d+\.\.\.\s*/, '')
              .replace(/^\d+\.\s*/, '')
              .trim()
          }
          
          try {
            let opponentMove = game.move(opponentMoveStr)
            
            if (!opponentMove && opponentMoveStr.length >= 4) {
              const from = opponentMoveStr.substring(0, 2)
              const to = opponentMoveStr.substring(2, 4)
              const promotion = opponentMoveStr.length > 4 ? opponentMoveStr[4] : undefined
              
              opponentMove = game.move({
                from,
                to,
                promotion: promotion ? promotion.toLowerCase() : undefined
              })
            }
            
            if (opponentMove) {
              // Add opponent move to moves array
              setMoves(prev => {
                const newMoves = [...prev, opponentMove]
                setCurrentMoveIndex(newMoves.length - 1)
                return newMoves
              })
              setIsWhiteTurn(game.turn() === 'w')
              
              const nextUserMoveIndex = nextSolutionIndex + 1
              if (nextUserMoveIndex < puzzle.puzzle.solution.length) {
                setSolutionIndex(nextUserMoveIndex)
              } else {
                setIsCorrect(true)
              }
            } else {
              setSolutionIndex(nextSolutionIndex)
            }
            setIsPlayingOpponentMove(false)
          } catch (e) {
            setSolutionIndex(nextSolutionIndex)
            setIsPlayingOpponentMove(false)
          }
        }, 1500)
      } else {
        setIsCorrect(true)
      }
    } else {
      const wrongMove = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: move.promotion || undefined
      })
      
      if (wrongMove) {
        // Add wrong move to moves array so it's visible
        setMoves(prev => {
          const newMoves = [...prev, wrongMove]
          setCurrentMoveIndex(newMoves.length - 1)
          return newMoves
        })
        setIsWhiteTurn(game.turn() === 'w')
        setIsCorrect(false)
        return true
      }
      
      return false
    }

    return true
  }

  const handleMoveClick = (moveIndex) => {
    // Don't allow navigation when solving puzzle (only allow when showing solution)
    if (!showSolution) {
      return
    }
    
    // If moveIndex is -1, go to start position
    if (moveIndex < 0) {
      if (initialGame) {
        const newGame = new Chess()
        newGame.load(initialGame.fen())
        setGame(newGame)
        setCurrentMoveIndex(null)
        setIsWhiteTurn(newGame.turn() === 'w')
        // Restore user color and board orientation from initial position
        const userIsWhiteColor = newGame.turn() === 'w'
        setUserIsWhite(userIsWhiteColor)
        setFlipped(!userIsWhiteColor) // Flip board if user is black, so user is always at bottom
      }
      return
    }
    
    // Rebuild game state up to the clicked move
    const newGame = new Chess()
    if (initialGame) {
      newGame.load(initialGame.fen())
    }
    
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
          // Continue
        }
      }
      
      if (!move && moveObj) {
        try {
          move = newGame.move(moveObj)
        } catch (e) {
          // All methods failed
        }
      }
    }
    
    setGame(newGame)
    setCurrentMoveIndex(moveIndex)
    setIsWhiteTurn(newGame.turn() === 'w')
    // Keep user color and board orientation consistent (user always at bottom)
    setFlipped(!userIsWhite) // Flip board if user is black, so user is always at bottom
  }

  const handleShowSolution = () => {
    if (!game || !puzzle || !initialGame) return
    
    // Reset to initial position
    const resetGame = new Chess()
    resetGame.load(initialGame.fen())
    
    // Build solution moves by playing through the solution
    const solutionMoves = []
    const tempGame = new Chess()
    tempGame.load(initialGame.fen())
    
    // Play through all solution moves
    for (let i = 0; i < puzzle.puzzle.solution.length; i++) {
      let moveStr = puzzle.puzzle.solution[i]
      if (!moveStr) continue
      
      // Clean move: remove move numbers and ellipsis
      moveStr = moveStr
        .replace(/^\d+\.\.\.\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .trim()
      
      try {
        // Try as SAN first
        let move = tempGame.move(moveStr)
        
        // If that fails, try parsing as UCI (e.g., "e2e4")
        if (!move && moveStr.length >= 4) {
          const from = moveStr.substring(0, 2).toLowerCase()
          const to = moveStr.substring(2, 4).toLowerCase()
          const promotion = moveStr.length > 4 ? moveStr[4].toLowerCase() : undefined
          
          move = tempGame.move({
            from,
            to,
            promotion: promotion || undefined
          })
        }
        
        if (move) {
          solutionMoves.push(move)
        }
      } catch (e) {
        // Skip invalid moves
      }
    }
    
    // Update game state with all solution moves played
    setGame(tempGame)
    setMoves(solutionMoves)
    setCurrentMoveIndex(solutionMoves.length - 1) // Show last move
    setSolutionIndex(puzzle.puzzle.solution.length)
    setIsWhiteTurn(tempGame.turn() === 'w')
    // Keep user color and board orientation consistent (user always at bottom)
    setFlipped(!userIsWhite) // Flip board if user is black, so user is always at bottom
    
    setShowSolution(true)
    setIsCorrect(false)
    setIsPlayingOpponentMove(false)
  }

  const handleNextPuzzle = async () => {
    setLoading(true)
    
    try {
      await loadPuzzle(false)
    } catch (error) {
      setLoading(false)
    }
  }

  const gamePosition = game ? game.fen() : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  if (authLoading) {
    return <PageLoader />
  }

  if (loading && !game) {
    return <PageLoader />
  }

  return (
    <div className="engine-page">
      <div className="engine-container">
        <div className="engine-board-section" ref={sectionRef}>
          <ChessBoard
            position={gamePosition}
            onMove={handleMove}
            flipped={flipped}
            arePiecesDraggable={user && !isPlayingOpponentMove && (currentMoveIndex === null || currentMoveIndex === moves.length - 1) && (isCorrect === null || showSolution)}
            allowFreeMoves={false}
            whitePlayer={whitePlayer}
            blackPlayer={blackPlayer}
            whiteTime={600}
            blackTime={600}
            isWhiteTurn={isWhiteTurn}
            isRunning={true}
            onTimeUpdate={() => {}}
            sectionRef={sectionRef}
            showTimer={false}
            lastMove={lastMove}
          />
        </div>

        <div className="engine-content-section">
          {!user ? (
            <div className="engine-login-prompt">
              <div className="engine-login-content">
                <h2>{t('puzzles.signInRequired')}</h2>
                <p>{t('puzzles.signInMessage')}</p>
                <button
                  className="engine-login-btn"
                  onClick={() => {
                    const currentPath = location.pathname + location.search + location.hash
                    navigate('/login', { state: { from: currentPath } })
                  }}
                >
                  {t('auth.signIn')}
                </button>
                <button
                  className="engine-signup-btn"
                  onClick={() => {
                    const currentPath = location.pathname + location.search + location.hash
                    navigate('/signup', { state: { from: currentPath } })
                  }}
                >
                  {t('auth.signUp')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="engine-controls">
                <button
                  className="engine-control-btn engine-control-btn-primary"
                  onClick={handleNextPuzzle}
                  disabled={loading}
                >
                  <RefreshCw size={16} />
                  <span>{loading ? t('puzzles.loading') : t('puzzles.next')}</span>
                </button>
                {isCorrect === false && !showSolution && (
                  <button
                    className="engine-control-btn"
                    onClick={resetPuzzle}
                  >
                    <RefreshCw size={16} />
                    <span>{t('puzzles.retry')}</span>
                  </button>
                )}
                {!showSolution && isCorrect !== false && puzzle && (
                  <button
                    className="engine-control-btn"
                    onClick={handleShowSolution}
                  >
                    <Info size={16} />
                    <span>{t('puzzles.showSolution')}</span>
                  </button>
                )}
                {puzzle?.game?.url && (
                  <a
                    href={puzzle.game.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="engine-control-btn"
                    title="View on Chess.com"
                  >
                    <ExternalLink size={16} />
                    <span>Chess.com</span>
                  </a>
                )}
              </div>
              
              {isCorrect === true && (
                <div className="puzzle-feedback">
                  <CheckCircle className="w-5 h-5" />
                  <span className="puzzle-feedback-success">{t('puzzles.solved')}</span>
                </div>
              )}

              {isCorrect === false && !showSolution && (
                <div className="puzzle-feedback">
                  <span className="puzzle-feedback-error">{t('puzzles.incorrect')}</span>
                </div>
              )}

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
