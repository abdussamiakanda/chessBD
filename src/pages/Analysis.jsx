import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import { ChessBoard } from '../components/chess/ChessBoard'
import { MoveHistory } from '../components/chess/MoveHistory'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuthStore } from '../store/auth-store'
import { usePlayerGames } from '../hooks/use-player'
import { useChessEngine } from '../hooks/useChessEngine'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { openings } from '../lib/engine/openings'
import { Upload, FileText, Loader2, X, TrendingUp, Star, ThumbsUp, CheckCircle, BookOpen, HelpCircle, AlertCircle, Users, Calendar, Sparkles, XCircle, Zap, AlertTriangle } from 'lucide-react'
import { ChesscomIcon } from '../components/ui/ChesscomIcon'
import { PageLoader } from '../components/ui/PageLoader'
import './Analysis.css'

export function Analysis() {
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuthStore()
  const { engine, isLoading: engineLoading, error: engineError } = useChessEngine()
  const [game, setGame] = useState(new Chess())
  const [originalGame, setOriginalGame] = useState(null) // Store original game with headers
  const [pgnText, setPgnText] = useState('')
  const [selectedGame, setSelectedGame] = useState(null)
  const [activeTab, setActiveTab] = useState('upload')
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState(null)
  const [evaluation, setEvaluation] = useState(null)
  const [currentFen, setCurrentFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const [moves, setMoves] = useState([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(null)
  const [hasGame, setHasGame] = useState(false)
  const [pgnAnalysis, setPgnAnalysis] = useState(null)
  const [isAnalyzingReview, setIsAnalyzingReview] = useState(false)
  const [reviewProgress, setReviewProgress] = useState({ current: 0, total: 0, percentage: 0 })
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [whiteTime, setWhiteTime] = useState(null)
  const [blackTime, setBlackTime] = useState(null)
  const [moveTimes, setMoveTimes] = useState([]) // Array of { whiteTime, blackTime } for each move
  const graphContainerRef = useRef(null)
  const [markerAspectRatio, setMarkerAspectRatio] = useState(1)
  const fileInputRef = useRef(null)
  const sectionRef = useRef(null)
  const lastAnalyzedFen = useRef(null)
  const pasteTimeoutRef = useRef(null)
  const [boardOrientation, setBoardOrientation] = useState('white')
  
  const [initialPgn, setInitialPgn] = useState(location.state?.pgn || null)
  const username = user?.username || user?.chesscom_username || ''
  const { data: chesscomGames, isLoading: gamesLoading } = usePlayerGames(username)
  
  // Fetch all chessbd users to check if players are registered users
  const { data: allUsers } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => api.getUsers(),
    staleTime: 300000, // 5 minutes
  })

  // Check sessionStorage on mount (for new tabs opened from GameCard)
  useEffect(() => {
    if (!initialPgn && typeof window !== 'undefined') {
      const pgnFromStorage = sessionStorage.getItem('analysis-pgn')
      if (pgnFromStorage) {
        setInitialPgn(pgnFromStorage)
        // Clear sessionStorage after reading
        sessionStorage.removeItem('analysis-pgn')
      }
    }
  }, []) // Only run on mount

  // Also check location.state changes
  useEffect(() => {
    if (location.state?.pgn && location.state.pgn !== initialPgn) {
      setInitialPgn(location.state.pgn)
    }
  }, [location.state?.pgn])

  useEffect(() => {
    if (initialPgn && !hasGame && initialPgn.trim() !== '') {
      // Set pgnText so it shows in the paste tab
      setPgnText(initialPgn)
      // Load the PGN if user is logged in and we don't already have a game loaded
      if (user && !loading && !isAnalyzingReview) {
        loadPgn(initialPgn)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPgn, user, hasGame, loading, isAnalyzingReview])

  // Update FEN when game changes
  useEffect(() => {
    if (game) {
      setCurrentFen(game.fen())
    }
  }, [game])

  // Update times when navigating through moves
  useEffect(() => {
    if (moveTimes.length > 0 && currentMoveIndex !== null && currentMoveIndex >= 0) {
      if (currentMoveIndex < moveTimes.length) {
        const timeAtMove = moveTimes[currentMoveIndex]
        if (timeAtMove !== null) {
          // Determine which player's time this is based on move number
          // Even moves (0, 2, 4...) are white, odd moves (1, 3, 5...) are black
          if (currentMoveIndex % 2 === 0) {
            // White's time after this move
            setWhiteTime(timeAtMove)
            // Black's time is from previous move or initial
            if (currentMoveIndex > 0 && moveTimes[currentMoveIndex - 1] !== null) {
              setBlackTime(moveTimes[currentMoveIndex - 1])
            } else if (moveTimes[0] !== null) {
              setBlackTime(moveTimes[0])
            }
          } else {
            // Black's time after this move
            setBlackTime(timeAtMove)
            // White's time is from previous move
            if (currentMoveIndex > 0 && moveTimes[currentMoveIndex - 1] !== null) {
              setWhiteTime(moveTimes[currentMoveIndex - 1])
            } else if (moveTimes[0] !== null) {
              setWhiteTime(moveTimes[0])
            }
          }
        }
      }
    } else if (currentMoveIndex === null || currentMoveIndex < 0) {
      // At start position, show initial times
      if (moveTimes.length > 0 && moveTimes[0] !== null) {
        setWhiteTime(moveTimes[0])
        setBlackTime(moveTimes[0])
      }
    }
  }, [currentMoveIndex, moveTimes])

  // Auto-analyze when engine becomes ready and we have a non-initial position
  useEffect(() => {
    if (engine && engine.getIsReady && engine.getIsReady() && currentFen && game) {
      const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      if (currentFen !== initialFen && currentFen !== lastAnalyzedFen.current && !analyzing && !loading) {
        lastAnalyzedFen.current = currentFen
        // Use a small delay to avoid race conditions
        const timeoutId = setTimeout(() => {
          analyzePosition()
        }, 200)
        return () => clearTimeout(timeoutId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, currentFen, game])

  useSEO({
    title: t('learn.categories.analysis.title'),
    description: t('learn.categories.analysis.description'),
    url: '/analysis',
  })

  // Piece values for material calculation
  const PIECE_VALUES = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
  }

  // Clamp number between min and max
  const ceilsNumber = (number, min, max) => {
    if (number > max) return max
    if (number < min) return min
    return number
  }

  // Convert centipawns to win percentage (from Lichess, via Chesskit)
  const getWinPercentageFromCp = (cp) => {
    const cpCeiled = ceilsNumber(cp, -1000, 1000)
    const MULTIPLIER = -0.00368208
    const winChances = 2 / (1 + Math.exp(MULTIPLIER * cpCeiled)) - 1
    return 50 + 50 * winChances
  }

  // Convert mate to win percentage
  const getWinPercentageFromMate = (mate) => {
    return mate > 0 ? 100 : 0
  }

  // Get win percentage from CP or mate
  const getWinPercentage = (cp, mate) => {
    if (mate !== null && mate !== undefined) {
      return getWinPercentageFromMate(mate)
    }
    if (cp !== null && cp !== undefined) {
      return getWinPercentageFromCp(cp)
    }
    return 50 // Default to equal position
  }

  // Calculate material difference (white - black) from FEN
  const getMaterialDifference = (fen) => {
    const g = new Chess(fen)
    const board = g.board().flat()
    return board.reduce((acc, square) => {
      if (!square) return acc
      const piece = square.type
      if (square.color === 'w') {
        return acc + (PIECE_VALUES[piece] || 0)
      }
      return acc - (PIECE_VALUES[piece] || 0)
    }, 0)
  }

  // Convert UCI move string to move parameters
  const uciMoveParams = (uciMove) => ({
    from: uciMove.slice(0, 2),
    to: uciMove.slice(2, 4),
    promotion: uciMove.slice(4, 5) || undefined,
  })

  // Check if move is a simple piece recapture
  const isSimplePieceRecapture = (fen, uciMoves) => {
    const game = new Chess(fen)
    const moves = uciMoves.map((uciMove) => uciMoveParams(uciMove))

    if (moves[0].to !== moves[1].to) return false

    const piece = game.get(moves[0].to)
    if (piece) return true

    return false
  }

  // Check if move is a piece sacrifice
  const getIsPieceSacrifice = (fen, playedMove, bestLinePvToPlay) => {
    if (!bestLinePvToPlay || bestLinePvToPlay.length === 0) return false

    const game = new Chess(fen)
    const whiteToPlay = game.turn() === 'w'
    const startingMaterialDifference = getMaterialDifference(fen)

    let moves = [playedMove, ...bestLinePvToPlay]
    if (moves.length % 2 === 1) {
      moves = moves.slice(0, -1)
    }
    let nonCapturingMovesTemp = 1

    const capturedPieces = {
      w: [],
      b: [],
    }
    
    for (const move of moves) {
      try {
        const fullMove = game.move(uciMoveParams(move))
        if (fullMove.captured) {
          capturedPieces[fullMove.color].push(fullMove.captured)
          nonCapturingMovesTemp = 1
        } else {
          nonCapturingMovesTemp--
          if (nonCapturingMovesTemp < 0) break
        }
      } catch (e) {
        console.error('Error in getIsPieceSacrifice:', e)
        return false
      }
    }

    // Remove matching captures (exchanges)
    for (const p of capturedPieces['w'].slice(0)) {
      if (capturedPieces['b'].includes(p)) {
        capturedPieces['b'].splice(capturedPieces['b'].indexOf(p), 1)
        capturedPieces['w'].splice(capturedPieces['w'].indexOf(p), 1)
      }
    }

    // If only pawns captured and roughly equal, not a sacrifice
    if (
      Math.abs(capturedPieces['w'].length - capturedPieces['b'].length) <= 1 &&
      capturedPieces['w'].concat(capturedPieces['b']).every((p) => p === 'p')
    ) {
      return false
    }

    const endingMaterialDifference = getMaterialDifference(game.fen())
    const materialDiff = endingMaterialDifference - startingMaterialDifference
    const materialDiffPlayerRelative = whiteToPlay ? materialDiff : -materialDiff

    return materialDiffPlayerRelative < 0
  }

  // Advanced move categorization using win percentages (like Chesskit/Chess.com)
  const categorizeMove = ({
    cpl,
    cpBeforeWhite,
    cpAfterWhite,
    mateBefore,
    mateAfter,
    isWhiteMove,
    missedMate,
    alternativeLineWinPercentage,
    winPercentageDiff,
    fenBefore,
    moveUci,
    bestLinePv,
    fenTwoMovesAgo,
    uciMovesTwoAgo,
    isBestMove,
  }) => {
    // Check for missed mate first
    if (missedMate) {
      return { category: 'miss', miss: true }
    }

    // Calculate win percentages from white's perspective
    const lastPositionWinPercentage = getWinPercentage(cpBeforeWhite, mateBefore)
    const positionWinPercentage = getWinPercentage(cpAfterWhite, mateAfter)

    // Use win percentage-based classification
    let baseCategory = 'good'
    if (lastPositionWinPercentage !== null && positionWinPercentage !== null) {
      const winDiff = winPercentageDiff !== undefined 
        ? winPercentageDiff 
        : (positionWinPercentage - lastPositionWinPercentage) * (isWhiteMove ? 1 : -1)

      if (winDiff < -20) {
        baseCategory = 'blunder'
      } else if (winDiff < -10) {
        baseCategory = 'mistake'
      } else if (winDiff < -5) {
        baseCategory = 'inaccuracy'
      } else if (winDiff < -2) {
        baseCategory = 'good'
      } else {
        baseCategory = 'excellent'
      }
    } else {
      // Fallback to CPL-based classification
      if (cpl === null || cpl === undefined) {
        baseCategory = 'good'
      } else if (cpl === 0) {
        baseCategory = 'best'
      } else if (cpl <= 20) {
        baseCategory = 'excellent'
      } else if (cpl <= 60) {
        baseCategory = 'good'
      } else if (cpl <= 120) {
        baseCategory = 'inaccuracy'
      } else if (cpl <= 300) {
        baseCategory = 'mistake'
      } else {
        baseCategory = 'blunder'
      }
    }

    let category = baseCategory

    // Check for brilliant/great moves (skip for misses and blunders)
    if (!missedMate && baseCategory !== 'blunder' && baseCategory !== 'miss') {
      // Check for Brilliant move - piece sacrifice that's good
      if (alternativeLineWinPercentage !== null && winPercentageDiff !== undefined && winPercentageDiff >= -2) {
        const isPieceSacrifice = getIsPieceSacrifice(fenBefore, moveUci, bestLinePv)
        const isLosing = isWhiteMove
          ? positionWinPercentage < 50
          : positionWinPercentage > 50
        const isAlternateCompletelyWinning = isWhiteMove
          ? alternativeLineWinPercentage > 97
          : alternativeLineWinPercentage < 3

        if (isPieceSacrifice && !isLosing && !isAlternateCompletelyWinning) {
          category = 'brilliant'
        }
      }

      // Check for Great move - changes game outcome or only good move
      if (category === baseCategory && alternativeLineWinPercentage !== null && winPercentageDiff !== undefined && winPercentageDiff >= -2) {
        // Exclude simple recaptures
        if (!(fenTwoMovesAgo && uciMovesTwoAgo && isSimplePieceRecapture(fenTwoMovesAgo, uciMovesTwoAgo))) {
          const isLosing = isWhiteMove
            ? positionWinPercentage < 50
            : positionWinPercentage > 50
          const isAlternateCompletelyWinning = isWhiteMove
            ? alternativeLineWinPercentage > 97
            : alternativeLineWinPercentage < 3

          if (!isLosing && !isAlternateCompletelyWinning) {
            const hasChangedGameOutcome =
              winPercentageDiff > 10 &&
              ((lastPositionWinPercentage < 50 && positionWinPercentage > 50) ||
                (lastPositionWinPercentage > 50 && positionWinPercentage < 50))

            const alternativeWinPercentageDiff =
              (positionWinPercentage - alternativeLineWinPercentage) * (isWhiteMove ? 1 : -1)
            const isTheOnlyGoodMove = alternativeWinPercentageDiff > 10

            if (hasChangedGameOutcome || isTheOnlyGoodMove) {
              category = 'great'
            }
          }
        }
      }
    }

    // Check if best move (after brilliant/great checks)
    if (category === baseCategory && isBestMove && cpl !== null && cpl === 0) {
      category = 'best'
    }

    return { category, miss: false }
  }

  // Check if move is a book move
  const isBookMove = (fen) => {
    const boardFen = fen ? fen.split(' ')[0] : null
    return boardFen ? openings.some(opening => opening.fen === boardFen) : false
  }

  // Analyze entire game
  const analyzeGame = async (pgnOverride = null) => {
    if (!engine || !engine.getIsReady || !engine.getIsReady()) {
      return
    }

    // Stop any previous analysis jobs
    if (engine.stopAllCurrentJobs) {
      await engine.stopAllCurrentJobs()
    }

    let pgnToAnalyze = pgnOverride || pgnText
    if (!pgnToAnalyze || !pgnToAnalyze.trim()) {
      // Try to get PGN from game
      if (game) {
        try {
          pgnToAnalyze = game.pgn()
        } catch (e) {
          return
        }
      }
    }

    if (!pgnToAnalyze || !pgnToAnalyze.trim()) {
      return
    }

    setIsAnalyzingReview(true)
    setPgnAnalysis(null)
    
    try {
      const analysisGame = new Chess()
      analysisGame.loadPgn(pgnToAnalyze)
      const history = analysisGame.history({ verbose: true })
      const totalMoves = history.length
      setReviewProgress({ current: 0, total: totalMoves, percentage: 0 })

      // Collect FENs for analysis
      const fens = []
      analysisGame.reset()
      for (let i = 0; i < history.length; i++) {
        fens.push(analysisGame.fen())
        analysisGame.move(history[i])
      }
      fens.push(analysisGame.fen()) // Final position

      // Analyze all positions concurrently (like chessbd)
      const gameEval = await engine.evaluateGame({
        fens,
        uciMoves: history.map(m => m.from + m.to + (m.promotion || '')),
        depth: 15,
        multiPv: 3,
        setEvaluationProgress: (progress) => {
          const percentage = Math.round(progress)
          const movesAnalyzed = Math.floor((progress / 99) * totalMoves)
          setReviewProgress({
            current: movesAnalyzed,
            total: totalMoves,
            percentage
          })
        },
        workersNb: 2,
      })

      // Validate we have positions
      if (!gameEval.positions || gameEval.positions.length === 0) {
        setError('Analysis returned no positions')
        setIsAnalyzingReview(false)
        return
      }

      if (gameEval.positions.length < history.length + 1) {
        // Expected more positions than received
      }

      // Process results
      const analyzedMoves = []
      const whiteCpls = []
      const blackCpls = []

      for (let i = 0; i < history.length; i++) {
        // Safety check
        if (!gameEval.positions[i] || !gameEval.positions[i + 1]) {
          continue
        }

        const move = history[i]
        const analysisBefore = gameEval.positions[i]
        const analysisAfter = gameEval.positions[i + 1]
        const side = i % 2 === 0 ? 'white' : 'black'

        const bestLine = analysisBefore.lines?.[0]
        const bestMoveUci = bestLine?.pv?.[0] || ''
        const moveUci = move.from + move.to + (move.promotion || '')
        const isBestMove = bestMoveUci.toLowerCase() === moveUci.toLowerCase()

        // Get evaluations from white's perspective (Stockfish gives from white's perspective)
        const bestLineCp = bestLine?.cp
        const bestLineMate = bestLine?.mate
        const afterCp = analysisAfter.lines?.[0]?.cp
        const afterMate = analysisAfter.lines?.[0]?.mate

        // Calculate CPL
        let cpl = null
        if (bestLine) {
          const beforeCp = bestLineCp !== null && bestLineCp !== undefined ? bestLineCp : (bestLineMate ? (bestLineMate > 0 ? 1000 : -1000) : 0)
          const afterCpValue = afterCp !== null && afterCp !== undefined ? afterCp : (afterMate ? (afterMate > 0 ? 1000 : -1000) : 0)
          
          if (isBestMove) {
            cpl = 0
          } else if (beforeCp !== null && afterCpValue !== null) {
            // Adjust for side (CP is from white's perspective)
            const beforeCpAdjusted = side === 'white' ? beforeCp : -beforeCp
            const afterCpAdjusted = side === 'white' ? afterCpValue : -afterCpValue
            cpl = Math.max(0, Math.round(beforeCpAdjusted - afterCpAdjusted))
          }
        }

        if (cpl !== null) {
          if (side === 'white') whiteCpls.push(cpl)
          else blackCpls.push(cpl)
        }

        // Check for missed mate
        const missedMate = bestLineMate !== null && bestLineMate !== undefined && bestLineMate !== 0 && !isBestMove

        // Calculate win percentages
        const cpBeforeWhite = bestLineCp
        const cpAfterWhite = afterCp
        const mateBefore = bestLineMate
        const mateAfter = afterMate
        const isWhiteMove = side === 'white'
        
        const lastPositionWinPercentage = getWinPercentage(cpBeforeWhite, mateBefore)
        const positionWinPercentage = getWinPercentage(cpAfterWhite, mateAfter)
        const winPercentageDiff = (positionWinPercentage - lastPositionWinPercentage) * (isWhiteMove ? 1 : -1)

        // Get alternative line for brilliant/great detection
        const alternativeLine = analysisBefore.lines?.find((line) => 
          line.pv && line.pv[0] && line.pv[0].toLowerCase() !== moveUci.toLowerCase()
        )
        let alternativeLineWinPercentage = null
        if (alternativeLine) {
          const altCp = alternativeLine.cp
          const altMate = alternativeLine.mate
          alternativeLineWinPercentage = getWinPercentage(altCp, altMate)
        }

        // Get FEN and moves from two moves ago (for simple recapture check)
        const fenTwoMovesAgo = i > 1 ? fens[i - 2] : null
        const uciMovesTwoAgo = i > 1 ? [history[i - 2].from + history[i - 2].to + (history[i - 2].promotion || ''), moveUci] : null

        // Get best line PV for piece sacrifice detection
        const bestLinePv = analysisAfter.lines?.[0]?.pv || []

        // Check if book move
        const fenAfter = fens[i + 1]
        const book = isBookMove(fenAfter)

        // Categorize move using advanced logic
        const categorization = categorizeMove({
          cpl,
          cpBeforeWhite,
          cpAfterWhite,
          mateBefore,
          mateAfter,
          isWhiteMove,
          missedMate,
          alternativeLineWinPercentage,
          winPercentageDiff,
          fenBefore: fens[i],
          moveUci,
          bestLinePv,
          fenTwoMovesAgo,
          uciMovesTwoAgo,
          isBestMove,
        })
        
        let category = categorization.category
        const miss = categorization.miss
        
        // Book moves override category
        if (book) category = 'book'

        // Get alternative lines (other MultiPV lines)
        const altLines = analysisBefore.lines?.slice(1, 4).map((line, idx) => ({
          rank: idx + 2,
          uci: line.pv?.[0] || '',
          score: {
            type: line.mate ? 'mate' : 'cp',
            value: line.mate || (line.cp || 0)
          },
          pv_san: line.pv?.slice(0, 5) || []
        })).filter(line => line.uci) || []

        analyzedMoves.push({
          ply: i + 1,
          side,
          fen_before: fens[i],
          uci: moveUci,
          san: move.san,
          best: {
            rank: 1,
            uci: bestMoveUci,
            score: {
              type: bestLine?.mate ? 'mate' : 'cp',
              value: bestLine?.mate || (bestLine?.cp || 0)
            },
            pv_san: bestLine?.pv?.slice(0, 5) || []
          },
          alt_lines: altLines.length > 0 ? altLines : undefined,
          score_after: (() => {
            // Score after move from white's perspective (for graph display)
            const afterMate = analysisAfter.lines?.[0]?.mate
            const afterCp = analysisAfter.lines?.[0]?.cp || 0
            
            if (afterMate) {
              // Mate score from white's perspective (Stockfish gives from white's perspective)
              return { type: 'mate', value: afterMate }
            } else {
              // CP score from white's perspective (Stockfish gives from white's perspective)
              return { type: 'cp', value: afterCp }
            }
          })(),
          cpl,
          category,
          miss,
          book
        })
      }

      // Calculate summary
      const whiteAcpl = whiteCpls.length > 0 ? whiteCpls.reduce((a, b) => a + b, 0) / whiteCpls.length : 0
      const blackAcpl = blackCpls.length > 0 ? blackCpls.reduce((a, b) => a + b, 0) / blackCpls.length : 0
      const calculateAccuracy = (acpl) => Math.max(0, Math.min(100, 100 / (1 + acpl / 50)))

      const countMoves = (side) => {
        const sideMoves = analyzedMoves.filter(m => m.side === side)
        return {
          brilliant: sideMoves.filter(m => m.category === 'brilliant').length,
          great: sideMoves.filter(m => m.category === 'great').length,
          best: sideMoves.filter(m => m.category === 'best').length,
          excellent: sideMoves.filter(m => m.category === 'excellent').length,
          good: sideMoves.filter(m => m.category === 'good').length,
          book: sideMoves.filter(m => m.book).length,
          inaccuracy: sideMoves.filter(m => m.category === 'inaccuracy').length,
          mistake: sideMoves.filter(m => m.category === 'mistake').length,
          miss: sideMoves.filter(m => m.miss).length,
          blunder: sideMoves.filter(m => m.category === 'blunder').length,
        }
      }

      const result = {
        game: {
          headers: {},
          result: game.header('Result') || '*'
        },
        summary: {
          white: {
            acpl: whiteAcpl,
            accuracy: calculateAccuracy(whiteAcpl),
            counts: countMoves('white')
          },
          black: {
            acpl: blackAcpl,
            accuracy: calculateAccuracy(blackAcpl),
            counts: countMoves('black')
          }
        },
        moves: analyzedMoves
      }
      
      setPgnAnalysis(result)
    } catch (err) {
      setError('Failed to analyze game')
    } finally {
      setIsAnalyzingReview(false)
    }
  }

  // Auto-analyze game when it loads
  useEffect(() => {
    if (hasGame && game && engine && engine.getIsReady && engine.getIsReady() && !pgnAnalysis && !isAnalyzingReview && pgnText.trim()) {
      // Small delay to ensure state is updated
      const timeoutId = setTimeout(() => {
        analyzeGame()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGame, game, engine, pgnText])

  // Calculate marker aspect ratio for graph
  useEffect(() => {
    const updateAspectRatio = () => {
      if (graphContainerRef.current) {
        const containerWidth = graphContainerRef.current.offsetWidth
        const containerHeight = graphContainerRef.current.offsetHeight
        const viewBoxWidth = 800
        const viewBoxHeight = 200
        
        const scaleX = containerWidth / viewBoxWidth
        const scaleY = containerHeight / viewBoxHeight
        const aspectRatio = scaleY / scaleX
        setMarkerAspectRatio(aspectRatio)
      }
    }

    updateAspectRatio()
    window.addEventListener('resize', updateAspectRatio)
    return () => window.removeEventListener('resize', updateAspectRatio)
  }, [pgnAnalysis])

  // Parse time string to seconds (handles formats like "5:00", "300", "1:23:45")
  const parseTimeToSeconds = (timeStr) => {
    if (!timeStr) return null
    // Remove quotes if present
    timeStr = timeStr.replace(/"/g, '').trim()
    
    // If it's just a number, assume seconds
    if (/^\d+$/.test(timeStr)) {
      return parseInt(timeStr, 10)
    }
    
    // Parse MM:SS or HH:MM:SS format
    const parts = timeStr.split(':').map(p => parseInt(p, 10))
    if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    
    return null
  }

  // Extract time information from PGN
  const extractTimeInfo = (pgn) => {
    const timeInfo = {
      initialWhiteTime: null,
      initialBlackTime: null,
      moveTimes: []
    }
    
    // Extract TimeControl to get initial time
    const timeControlMatch = pgn.match(/\[TimeControl\s+"([^"]+)"\]/i)
    if (timeControlMatch) {
      const timeControl = timeControlMatch[1]
      // Format is usually "600+0" (initial time + increment) or "600" (just initial time)
      const timeControlParts = timeControl.split('+')
      const initialTime = parseInt(timeControlParts[0], 10)
      if (!isNaN(initialTime)) {
        timeInfo.initialWhiteTime = initialTime
        timeInfo.initialBlackTime = initialTime
      }
    }
    
    // Extract WhiteClock and BlackClock from headers (final times)
    const whiteClockMatch = pgn.match(/\[WhiteClock\s+"([^"]+)"\]/i)
    const blackClockMatch = pgn.match(/\[BlackClock\s+"([^"]+)"\]/i)
    
    // Extract clock times from move comments (Chess.com format: {[%clk 5:00]})
    const clockMatches = pgn.matchAll(/\{\[%clk\s+([^\]]+)\]\}/g)
    const clockTimes = Array.from(clockMatches).map(m => m[1].trim())
    
    // If we have clock times in comments, use those
    if (clockTimes.length > 0) {
      timeInfo.moveTimes = clockTimes.map(timeStr => {
        const seconds = parseTimeToSeconds(timeStr)
        return seconds !== null ? seconds : null
      })
      
      // Set initial times from first clock time if available
      if (timeInfo.moveTimes[0] !== null && timeInfo.initialWhiteTime === null) {
        timeInfo.initialWhiteTime = timeInfo.moveTimes[0]
        timeInfo.initialBlackTime = timeInfo.moveTimes[0]
      }
    } else if (whiteClockMatch || blackClockMatch) {
      // Use header clock times as final times
      const whiteFinal = whiteClockMatch ? parseTimeToSeconds(whiteClockMatch[1]) : null
      const blackFinal = blackClockMatch ? parseTimeToSeconds(blackClockMatch[1]) : null
      
      // We can't reconstruct move-by-move times from just final times
      // But we can show the final times
      if (whiteFinal !== null) timeInfo.initialWhiteTime = whiteFinal
      if (blackFinal !== null) timeInfo.initialBlackTime = blackFinal
    }
    
    return timeInfo
  }

  const loadPgn = async (pgn) => {
    try {
      setError(null)
      setLoading(true)
      setEvaluation(null)
      // Clear previous analysis when loading new game
      setPgnAnalysis(null)
      setIsReviewMode(false)
      setIsAnalyzingReview(false)
      setReviewProgress({ current: 0, total: 0, percentage: 0 })
      
      const newGame = new Chess()
      newGame.loadPgn(pgn)
      
      // Extract player names from PGN headers FIRST to determine orientation
      const whiteMatch = pgn.match(/\[White\s+"([^"]+)"\]/i)
      const blackMatch = pgn.match(/\[Black\s+"([^"]+)"\]/i)
      const whiteName = whiteMatch ? whiteMatch[1] : 'White Player'
      const blackName = blackMatch ? blackMatch[1] : 'Black Player'
      
      // Get current user's chesscom username for comparison
      const currentChesscomUsername = user?.chesscom_username?.toLowerCase().trim() || ''
      
      // Normalize PGN player names for comparison (lowercase, trim)
      const whiteNameNormalized = whiteName.toLowerCase().trim()
      const blackNameNormalized = blackName.toLowerCase().trim()
      
      // Check if current user's chesscom username matches either player
      // Use exact match or check if names contain each other
      const isUserWhite = currentChesscomUsername && (
        whiteNameNormalized === currentChesscomUsername ||
        whiteNameNormalized.replace(/\s+/g, '') === currentChesscomUsername.replace(/\s+/g, '') ||
        whiteNameNormalized.includes(currentChesscomUsername) ||
        currentChesscomUsername.includes(whiteNameNormalized)
      )
      const isUserBlack = currentChesscomUsername && (
        blackNameNormalized === currentChesscomUsername ||
        blackNameNormalized.replace(/\s+/g, '') === currentChesscomUsername.replace(/\s+/g, '') ||
        blackNameNormalized.includes(currentChesscomUsername) ||
        currentChesscomUsername.includes(blackNameNormalized)
      )
      
      // Set board orientation: if user is black, flip board so user is at bottom
      if (isUserBlack) {
        setBoardOrientation('black')
      } else {
        setBoardOrientation('white')
      }
      
      // Now set game state
      setGame(newGame)
      setOriginalGame(newGame) // Store original game with headers
      const gameMoves = newGame.history({ verbose: true })
      setMoves(gameMoves)
      setCurrentMoveIndex(gameMoves.length - 1)
      setHasGame(true)
      
      // Set player names (avatars will be updated by useEffect when allUsers loads)
      setWhitePlayer({ 
        name: whiteName, 
        username: whiteName.toLowerCase().replace(/\s+/g, ''), 
        avatar: null 
      })
      
      setBlackPlayer({ 
        name: blackName, 
        username: blackName.toLowerCase().replace(/\s+/g, ''), 
        avatar: null 
      })
      
      // Extract time information
      const timeInfo = extractTimeInfo(pgn)
      setMoveTimes(timeInfo.moveTimes)
      
      // Set initial times
      if (timeInfo.initialWhiteTime !== null) {
        setWhiteTime(timeInfo.initialWhiteTime)
      } else {
        setWhiteTime(null)
      }
      if (timeInfo.initialBlackTime !== null) {
        setBlackTime(timeInfo.initialBlackTime)
      } else {
        setBlackTime(null)
      }
      
      // Reset last analyzed FEN so new position gets analyzed
      lastAnalyzedFen.current = null
      
      // Wait for engine to be ready, then analyze
      if (engine && engine.getIsReady && engine.getIsReady()) {
        // Small delay to ensure game state is updated
        setTimeout(async () => {
          await analyzeGame(pgn)
        }, 100)
      }
    } catch (err) {
      setError(t('analysis.invalidPgn') || 'Invalid PGN format')
      setHasGame(false)
      setPgnAnalysis(null)
      setIsReviewMode(false)
    } finally {
      setLoading(false)
    }
  }

  const analyzePosition = async (gameInstance = null) => {
    const gameToAnalyze = gameInstance || game
    if (!engine || !engine.getIsReady || !engine.getIsReady()) {
      setError(t('analysis.engineNotReady') || 'Engine not ready')
      return
    }

    if (!gameToAnalyze) {
      return
    }

    try {
      setAnalyzing(true)
      setError(null)
      const fen = gameToAnalyze.fen()
      
      // Analyze with depth 16 for good analysis
      const evalResult = await engine.evaluatePosition(fen, 16)
      setEvaluation(evalResult)
    } catch (err) {
      setError(t('analysis.analysisError') || 'Error analyzing position')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result
      if (content) {
        loadPgn(content)
        setActiveTab('paste')
        setPgnText(content)
      }
    }
    reader.readAsText(file)
  }

  const handlePastePgnChange = (value) => {
    setPgnText(value)
    // Clear previous timeout
    if (pasteTimeoutRef.current) {
      clearTimeout(pasteTimeoutRef.current)
    }
    // Auto-load PGN after user stops typing (1 second delay)
    if (value.trim()) {
      pasteTimeoutRef.current = setTimeout(async () => {
        try {
          const testGame = new Chess()
          testGame.loadPgn(value.trim())
          // If PGN is valid, load it
          await loadPgn(value.trim())
        } catch (err) {
          // Invalid PGN, don't load yet
        }
      }, 1000)
    }
  }

  const handleClearGame = () => {
    setGame(new Chess())
    setOriginalGame(null)
    setPgnText('')
    setMoves([])
    setCurrentMoveIndex(null)
    setHasGame(false)
    setEvaluation(null)
    setError(null)
    setPgnAnalysis(null)
    setIsReviewMode(false)
    setIsAnalyzingReview(false)
    setAnalyzing(false) // Also clear analyzing state
    setLoading(false) // Also clear loading state
    setReviewProgress({ current: 0, total: 0, percentage: 0 })
    setWhiteTime(null)
    setBlackTime(null)
    setMoveTimes([])
    lastAnalyzedFen.current = null
    setBoardOrientation('white') // Reset to default orientation
    setCurrentFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') // Reset to starting position
    setSelectedGame(null) // Clear selected game
    
    // Reset player states to initial values
    setWhitePlayer({
      name: 'White Player',
      username: 'whiteplayer',
      avatar: null,
    })
    setBlackPlayer({
      name: 'Black Player',
      username: 'blackplayer',
      avatar: null,
    })
    
    // Clear initialPgn to prevent reload
    setInitialPgn(null)
    
    // Clear sessionStorage if it exists (for new tabs)
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('analysis-pgn')
    }
    
    // Clear location state to prevent reload from initialPgn
    navigate(location.pathname, { replace: true, state: {} })
  }

  const handleSelectGame = async (game) => {
    if (game.pgn) {
      setSelectedGame(game)
      await loadPgn(game.pgn)
      setPgnText(game.pgn)
    }
  }

  const [whitePlayer, setWhitePlayer] = useState({
    name: 'White Player',
    username: 'whiteplayer',
    avatar: null,
  })

  const [blackPlayer, setBlackPlayer] = useState({
    name: 'Black Player',
    username: 'blackplayer',
    avatar: null,
  })

  // Update player avatars when allUsers loads and we have a game
  useEffect(() => {
    if (!allUsers || !hasGame || !whitePlayer.name || !blackPlayer.name) {
      console.log('Avatar update skipped:', { 
        allUsers: !!allUsers, 
        hasGame, 
        whiteName: whitePlayer.name, 
        blackName: blackPlayer.name 
      })
      return
    }
    
    // Convert allUsers object to array (api.getUsers returns an object with user IDs as keys)
    const usersArray = Array.isArray(allUsers) ? allUsers : Object.values(allUsers || {})
    
    if (usersArray.length === 0) {
      console.log('No users found in allUsers')
      return
    }
    
    const whiteNameNormalized = whitePlayer.name.toLowerCase().trim()
    const blackNameNormalized = blackPlayer.name.toLowerCase().trim()
    
    console.log('Checking for chessbd users:', { whiteNameNormalized, blackNameNormalized, allUsersCount: usersArray.length })
    
    // Find chessbd user for white player
    const whiteChessbdUser = usersArray.find(u => {
      const userChesscom = u.chesscom_username?.toLowerCase().trim() || ''
      const userLichess = u.lichess_username?.toLowerCase().trim() || ''
      return userChesscom === whiteNameNormalized || 
             userLichess === whiteNameNormalized ||
             userChesscom.replace(/\s+/g, '') === whiteNameNormalized.replace(/\s+/g, '') ||
             userLichess.replace(/\s+/g, '') === whiteNameNormalized.replace(/\s+/g, '')
    })
    
    // Find chessbd user for black player
    const blackChessbdUser = usersArray.find(u => {
      const userChesscom = u.chesscom_username?.toLowerCase().trim() || ''
      const userLichess = u.lichess_username?.toLowerCase().trim() || ''
      return userChesscom === blackNameNormalized || 
             userLichess === blackNameNormalized ||
             userChesscom.replace(/\s+/g, '') === blackNameNormalized.replace(/\s+/g, '') ||
             userLichess.replace(/\s+/g, '') === blackNameNormalized.replace(/\s+/g, '')
    })
    
    console.log('Found chessbd users:', { 
      whiteChessbdUser: whiteChessbdUser ? { name: whiteChessbdUser.name, avatar: whiteChessbdUser.avatar_url } : null,
      blackChessbdUser: blackChessbdUser ? { name: blackChessbdUser.name, avatar: blackChessbdUser.avatar_url } : null
    })
    
    // Update player info if chessbd users found (use chessbd user's name and avatar)
    if (whiteChessbdUser || blackChessbdUser) {
      setWhitePlayer(prev => ({
        ...prev,
        name: whiteChessbdUser?.name || prev.name,
        avatar: whiteChessbdUser?.avatar_url || prev.avatar
      }))
      setBlackPlayer(prev => ({
        ...prev,
        name: blackChessbdUser?.name || prev.name,
        avatar: blackChessbdUser?.avatar_url || prev.avatar
      }))
      console.log('Updated player avatars and names')
    }
  }, [allUsers, hasGame, whitePlayer.name, blackPlayer.name])

  const handleMove = async (sourceSquare, targetSquare) => {
    // Don't allow moves in analysis mode
    return false
  }

  const handleMoveClick = (index) => {
    if (!game || !moves || moves.length === 0) return
    const tempGame = new Chess()
    try {
      if (index >= 0 && index < moves.length) {
        // Go to specific move - replay moves up to that point
        tempGame.reset()
        for (let i = 0; i <= index; i++) {
          if (moves[i]) {
            tempGame.move(moves[i])
          }
        }
      } else {
        // Go to start position (index is -1 or null)
        tempGame.reset()
      }
      setGame(tempGame)
      setCurrentMoveIndex(index)
      setEvaluation(null)
      lastAnalyzedFen.current = null
      
      // Update times based on move index
      if (moveTimes.length > 0 && index >= 0) {
        // Find the time for this move index
        // Move times are stored per move, so index corresponds to moveTimes[index]
        if (index < moveTimes.length) {
          const timeAtMove = moveTimes[index]
          if (timeAtMove !== null) {
            // Determine which player's time this is based on move number
            // Even moves (0, 2, 4...) are white, odd moves (1, 3, 5...) are black
            if (index % 2 === 0) {
              // White's time after this move
              setWhiteTime(timeAtMove)
              // Black's time is from previous move or initial
              if (index > 0 && moveTimes[index - 1] !== null) {
                setBlackTime(moveTimes[index - 1])
              }
            } else {
              // Black's time after this move
              setBlackTime(timeAtMove)
              // White's time is from previous move
              if (index > 0 && moveTimes[index - 1] !== null) {
                setWhiteTime(moveTimes[index - 1])
              }
            }
          }
        }
      } else if (index < 0) {
        // At start position, show initial times
        if (moveTimes.length > 0 && moveTimes[0] !== null) {
          setWhiteTime(moveTimes[0])
          setBlackTime(moveTimes[0])
        }
      }
      
      // Don't analyze position in review mode - we already have analysis data
      if (!isReviewMode && engine && engine.getIsReady && engine.getIsReady()) {
        analyzePosition(tempGame)
      }
    } catch (err) {
      // Error navigating to move
    }
  }

  const handleTimeUpdate = (color, newTime) => {
    // Not used in analysis mode
  }

  // Create move quality map: square -> quality (only for the current move)
  const moveQualityMap = useMemo(() => {
    if (!pgnAnalysis || !pgnAnalysis.moves || !moves || moves.length === 0) {
      return null
    }
    
    // Only show quality for the current move being viewed
    if (currentMoveIndex === null || currentMoveIndex < 0) {
      return null // At start position, no move to show
    }
    
    const moveData = pgnAnalysis.moves[currentMoveIndex]
    if (!moveData || !moveData.uci) {
      return null
    }
    
    // Extract destination square from UCI (last 2 characters, or last 2 before promotion)
    const uci = moveData.uci
    if (uci.length < 4) {
      return null
    }
    
    const toSquare = uci.substring(2, 4)
    return { [toSquare]: moveData.category }
  }, [pgnAnalysis, currentMoveIndex, moves])

  // Create best move arrow (only if played move differs from best move)
  const bestMoveArrow = useMemo(() => {
    if (!pgnAnalysis || !pgnAnalysis.moves || !isReviewMode) {
      return null
    }
    
    // Only show arrow for the current move being viewed
    if (currentMoveIndex === null || currentMoveIndex < 0) {
      return null // At start position, no move to show
    }
    
    const moveData = pgnAnalysis.moves[currentMoveIndex]
    if (!moveData || !moveData.uci || !moveData.best || !moveData.best.uci) {
      return null
    }
    
    const playedUci = moveData.uci
    const bestUci = moveData.best.uci
    
    // Normalize UCI moves (remove promotion suffix if present)
    const normalizeUci = (uci) => {
      if (!uci || uci.length < 4) return uci
      // UCI format is usually 4 chars (e2e4) or 5 chars with promotion (e7e8q)
      return uci.substring(0, 4)
    }
    
    const playedNormalized = normalizeUci(playedUci)
    const bestNormalized = normalizeUci(bestUci)
    
    // Only show arrow if played move is different from best move
    if (playedNormalized === bestNormalized) {
      return null
    }
    
    // Extract squares from best move UCI
    if (bestUci.length < 4) {
      return null
    }
    
    const arrow = {
      from: bestUci.substring(0, 2),
      to: bestUci.substring(2, 4)
    }
    
    return arrow
  }, [pgnAnalysis, currentMoveIndex, isReviewMode])

  if (authLoading) {
    return <PageLoader />
  }

  return (
    <div className="analysis-page">
      <div className="analysis-container">
        <div className="analysis-board-section" ref={sectionRef}>
          <ChessBoard
            position={game.fen()}
            onMove={handleMove}
            flipped={boardOrientation === 'black'}
            arePiecesDraggable={false}
            allowSquareClicks={false}
            allowFreeMoves={false}
            whitePlayer={whitePlayer}
            blackPlayer={blackPlayer}
            whiteTime={whiteTime !== null ? whiteTime : 600}
            blackTime={blackTime !== null ? blackTime : 600}
            isWhiteTurn={game.turn() === 'w'}
            isRunning={false}
            onTimeUpdate={handleTimeUpdate}
            sectionRef={sectionRef}
            showTimer={whiteTime !== null || blackTime !== null}
            moveQuality={moveQualityMap}
            bestMoveArrow={bestMoveArrow}
          />
        </div>

        <div className="analysis-content-section">
          {!user ? (
            <div className="engine-login-prompt">
              <div className="engine-login-content">
                <h2>Login Required</h2>
                <p>Please log in to analyze chess games.</p>
                <button
                  className="engine-login-btn"
                  onClick={() => {
                    const currentPath = location.pathname + location.search + location.hash
                    // Preserve PGN in state when navigating to login
                    navigate('/login', { state: { from: currentPath, pgn: initialPgn } })
                  }}
                >
                  Log In
                </button>
                <button
                  className="engine-signup-btn"
                  onClick={() => {
                    const currentPath = location.pathname + location.search + location.hash
                    // Preserve PGN in state when navigating to signup
                    navigate('/signup', { state: { from: currentPath, pgn: initialPgn } })
                  }}
                >
                  Sign Up
                </button>
              </div>
            </div>
          ) : !hasGame ? (
            <div className="analysis-controls">
              <div className="analysis-tabs">
                <button
                  className={`analysis-tab ${activeTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setActiveTab('upload')}
                >
                  <Upload size={16} />
                  <span>{t('analysis.uploadPgn') || 'Upload PGN'}</span>
                </button>
                <button
                  className={`analysis-tab ${activeTab === 'paste' ? 'active' : ''}`}
                  onClick={() => setActiveTab('paste')}
                >
                  <FileText size={16} />
                  <span>{t('analysis.pastePgn') || 'Paste PGN'}</span>
                </button>
                {user && (
                  <button
                    className={`analysis-tab ${activeTab === 'chesscom' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chesscom')}
                  >
                    <ChesscomIcon className="analysis-tab-icon" />
                    <span>Chess.com</span>
                  </button>
                )}
              </div>

              <div className="analysis-tab-content">
                {activeTab === 'upload' && (
                  <div className="analysis-upload-section">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pgn,.txt"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                    <div
                      className="analysis-upload-area"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={32} />
                      <p>{t('analysis.dragDrop') || 'Drag and drop a PGN file here, or click to browse'}</p>
                      <span className="analysis-upload-hint">.pgn or .txt files</span>
                    </div>
                  </div>
                )}

                {activeTab === 'paste' && (
                  <div className="analysis-paste-section">
                    <textarea
                      className="analysis-pgn-textarea"
                      placeholder={t('analysis.pastePgn') || 'Paste PGN here...'}
                      value={pgnText}
                      onChange={(e) => handlePastePgnChange(e.target.value)}
                      rows={12}
                    />
                  </div>
                )}

                {activeTab === 'chesscom' && user && (
                  <div className="analysis-chesscom-section">
                    {gamesLoading ? (
                      <div className="analysis-loading">
                        <Loader2 size={24} className="spinning" />
                        <p>{t('analysis.loading') || 'Loading games...'}</p>
                      </div>
                    ) : chesscomGames && chesscomGames.length > 0 ? (
                      <div className="analysis-games-list">
                      {chesscomGames.slice(0, 50).map((g, index) => (
                        <button
                          key={index}
                          className={`analysis-game-item ${selectedGame === g ? 'selected' : ''}`}
                          onClick={() => handleSelectGame(g)}
                        >
                          <div className="analysis-game-content">
                            <div className="analysis-game-main">
                              <div className="analysis-game-players-row">
                                <Users size={16} className="analysis-game-icon" />
                                <div className="analysis-game-players">
                                  <span className="analysis-game-player">{g.white}</span>
                                  <span className="analysis-game-vs">vs</span>
                                  <span className="analysis-game-player">{g.black}</span>
                                </div>
                              </div>
                              <div className="analysis-game-info-row">
                                {g.end_time && (
                                  <div className="analysis-game-date">
                                    <Calendar size={14} />
                                    <span>{new Date(g.end_time).toLocaleDateString(undefined, { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}</span>
                                  </div>
                                )}
                                {g.result && (
                                  <span className={`analysis-game-result ${g.result === '1-0' ? 'white-win' : g.result === '0-1' ? 'black-win' : 'draw'}`}>
                                    {g.result}
                                  </span>
                                )}
                                {g.time_control && (
                                  <span className="analysis-game-time">{g.time_control}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                      </div>
                    ) : (
                      <div className="analysis-empty">
                        <p>{t('analysis.noGames') || 'No games found. Make sure your Chess.com username is verified in settings.'}</p>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="analysis-error">
                    {error}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="analysis-game-view">
              {/* Game Info Header */}
              <div className="analysis-game-header-section">
                <div className="analysis-game-header-top">
                  <h3 className="analysis-game-title">Game Analysis</h3>
                  <button
                    className="analysis-clear-btn"
                    onClick={handleClearGame}
                    title="Clear game"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                {/* Match Info */}
                {(originalGame || game) && (() => {
                  // Use originalGame for headers if available, otherwise use current game
                  const gameForHeaders = originalGame || game
                  const getHeader = (key) => {
                    try {
                      const value = gameForHeaders.header(key)
                      // Ensure we return a string, not an object
                      if (value && typeof value === 'string') {
                        return value
                      }
                      // If it's an object, try to get the specific key
                      if (value && typeof value === 'object' && key in value) {
                        return typeof value[key] === 'string' ? value[key] : null
                      }
                      return null
                    } catch {
                      return null
                    }
                  }
                  
                  const white = getHeader('White') || whitePlayer.name
                  const black = getHeader('Black') || blackPlayer.name
                  const whiteElo = getHeader('WhiteElo')
                  const blackElo = getHeader('BlackElo')
                  const result = getHeader('Result')
                  const event = getHeader('Event')
                  const date = getHeader('Date')
                  const termination = getHeader('Termination')
                  
                  // Format date from PGN (can be YYYY.MM.DD, YYYY-MM-DD, or YYYY/MM/DD)
                  const formatDate = (dateStr) => {
                    if (!dateStr) return ''
                    try {
                      // Handle various PGN date formats
                      let dateToParse = String(dateStr)
                      // Replace dots and slashes with hyphens for consistent parsing
                      dateToParse = dateToParse.replace(/[.\/]/g, '-')
                      // Handle partial dates (YYYY.MM or YYYY)
                      const parts = dateToParse.split('-')
                      if (parts.length === 2) {
                        // YYYY-MM format, add day 1
                        dateToParse = `${dateToParse}-01`
                      } else if (parts.length === 1 && parts[0].length === 4) {
                        // YYYY format, add month and day
                        dateToParse = `${dateToParse}-01-01`
                      }
                      const parsedDate = new Date(dateToParse)
                      if (isNaN(parsedDate.getTime())) {
                        return dateStr // Return original if parsing fails
                      }
                      return parsedDate.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })
                    } catch {
                      return dateStr
                    }
                  }
                  
                  return (
                    <div className="analysis-match-info">
                      <div className="analysis-match-players">
                        <div className="analysis-player">
                          <span className="analysis-player-label">White:</span>
                          <span className="analysis-player-name">{String(white || '')}</span>
                          {whiteElo && <span className="analysis-player-elo">({String(whiteElo)})</span>}
                        </div>
                        <div className="analysis-player">
                          <span className="analysis-player-label">Black:</span>
                          <span className="analysis-player-name">{String(black || '')}</span>
                          {blackElo && <span className="analysis-player-elo">({String(blackElo)})</span>}
                        </div>
                      </div>
                      {(result || event || date || termination) && (
                        <div className="analysis-match-meta">
                          {date && <span className="analysis-match-date">{formatDate(date)}</span>}
                          {result && <span className="analysis-match-result">{String(result)}</span>}
                          {termination && <span className="analysis-match-termination">{String(termination)}</span>}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Analyzing Status */}
              {(loading || (analyzing && !isReviewMode && !pgnAnalysis) || isAnalyzingReview) && (
                <div className="analysis-status">
                  <Loader2 size={20} className="spinning" />
                  <span>
                    {loading ? 'Loading game...' : 
                     isAnalyzingReview ? `Analyzing game... ${reviewProgress.current}/${reviewProgress.total} moves (${reviewProgress.percentage}%)` :
                     'Analyzing position...'}
                  </span>
                  {isAnalyzingReview && reviewProgress.total > 0 && (
                    <div className="analysis-progress-bar">
                      <div 
                        className="analysis-progress-fill"
                        style={{ width: `${reviewProgress.percentage}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Start Review Button */}
              {pgnAnalysis && !isAnalyzingReview && !isReviewMode && (
                <div className="analysis-start-review">
                  <button
                    className="analysis-start-review-btn"
                    onClick={() => {
                      setIsReviewMode(true)
                      // Go to initial position (before first move) when starting review
                      setCurrentMoveIndex(null)
                      handleMoveClick(-1)
                    }}
                  >
                    Start Review
                  </button>
                </div>
              )}

              {/* Move History - Only show in review mode */}
              {isReviewMode && (
                <>
                  {moves.length > 0 ? (
                    <MoveHistory
                      moves={moves}
                      currentMoveIndex={currentMoveIndex}
                      onMoveClick={handleMoveClick}
                      flipped={false}
                      moveQuality={pgnAnalysis?.moves?.map(m => ({ move: m.ply, quality: m.category }))}
                    />
                  ) : (
                    <div className="analysis-empty">
                      <p>No moves available</p>
                    </div>
                  )}
                </>
              )}

              {/* Position Data - Shown in Review Mode */}
              {isReviewMode && pgnAnalysis && (() => {
                // Show position data for the current move
                // If at start position (currentMoveIndex < 0), show first move data
                const moveIndexToShow = currentMoveIndex !== null && currentMoveIndex >= 0 ? currentMoveIndex : 0
                const moveData = pgnAnalysis.moves.find(m => m.ply === moveIndexToShow + 1)
                if (!moveData) return null

                const formatMoveUci = (uci) => {
                  if (!uci || uci.length < 4) return uci
                  return `${uci.substring(0, 2)} → ${uci.substring(2, 4)}`
                }

                return (
                  <div className="analysis-position-data">
                    <div className="analysis-position-header">
                      <h4>Move {Math.floor((currentMoveIndex + 1) / 2) + (currentMoveIndex % 2 === 0 ? 1 : 0)}{currentMoveIndex % 2 === 0 ? '' : '...'}</h4>
                    </div>

                    {/* Position Info Grid */}
                    <div className="analysis-position-grid">
                      <div className="analysis-position-item">
                        <span className="analysis-position-label">Side to Move</span>
                        <span className="analysis-position-value">
                          {moveData.side === 'white' ? 'White' : 'Black'}
                        </span>
                      </div>
                      <div className="analysis-position-item">
                        <span className="analysis-position-label">Evaluation</span>
                        <span className="analysis-position-value">
                          {moveData.score_after ? (
                            moveData.score_after.type === 'mate' 
                              ? `M${Math.abs(moveData.score_after.value)}`
                              : `${moveData.score_after.value >= 0 ? '+' : ''}${(moveData.score_after.value / 100).toFixed(2)}`
                          ) : 'N/A'}
                        </span>
                      </div>
                      <div className="analysis-position-item">
                        <span className="analysis-position-label">Best Move</span>
                        <span className="analysis-position-value best-move">
                          {formatMoveUci(moveData.best.uci)}
                        </span>
                      </div>
                      <div className="analysis-position-item">
                        <span className="analysis-position-label">Move Quality</span>
                        <span className={`analysis-position-value quality-${moveData.category}`}>
                          {moveData.category.charAt(0).toUpperCase() + moveData.category.slice(1)}
                        </span>
                      </div>
                      <div className="analysis-position-item">
                        <span className="analysis-position-label">CPL</span>
                        <span className="analysis-position-value">
                          {moveData.cpl !== null ? moveData.cpl.toFixed(1) : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Principal Variation */}
                    {moveData.best.pv_san && moveData.best.pv_san.length > 0 && (
                      <div className="analysis-pv-section">
                        <h5>Principal Variation</h5>
                        <div className="analysis-pv-moves">
                          {moveData.best.pv_san.map((move, idx) => (
                            <span key={idx} className="analysis-pv-move-tag">
                              {move}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Alternative Lines */}
                    {moveData.alt_lines && moveData.alt_lines.length > 0 && (
                      <div className="analysis-alt-lines-section">
                        <h5>Alternative Lines</h5>
                        <div className="analysis-alt-lines">
                          {moveData.alt_lines.map((line) => (
                            <div key={line.rank} className="analysis-alt-line">
                              <div className="analysis-alt-line-header">
                                <span>Line {line.rank}: </span>
                                <span className="analysis-alt-line-score">
                                  {line.score.type === 'cp' 
                                    ? `${(line.score.value / 100).toFixed(2)} cp`
                                    : `${line.score.value > 0 ? '+' : ''}${line.score.value} mate`}
                                </span>
                              </div>
                              <div className="analysis-alt-line-moves">
                                {line.pv_san.map((move, idx) => (
                                  <span key={idx} className="analysis-alt-move-tag">
                                    {move}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Analysis Results - Graph and Charts */}
              {pgnAnalysis && !isAnalyzingReview && !isReviewMode && (
                <div className="analysis-review-results">
                  {/* Evaluation Graph */}
                  <div className="analysis-graph-container">
                    <div className="analysis-graph-wrapper" ref={graphContainerRef}>
                      <svg className="analysis-graph-svg" viewBox="0 0 800 200" preserveAspectRatio="none">
                        {/* Baseline (center line) */}
                        <line x1="0" y1="100" x2="800" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                        
                        {/* Background: White area (top) and Black area (bottom) */}
                        <rect x="0" y="0" width="800" height="100" fill="rgba(0,0,0,0.4)" />
                        <rect x="0" y="100" width="800" height="100" fill="rgba(0,0,0,0.4)" />
                        
                        {/* Create path for the evaluation line */}
                        {pgnAnalysis.moves.length > 0 && (() => {
                          const displayEval = (rawEval) => {
                            if (rawEval <= -100) return -15
                            if (rawEval >= 100) return 15
                            return Math.max(-15, Math.min(15, rawEval))
                          }
                          
                          const evaluations = pgnAnalysis.moves.map(m => {
                            // score_after is from white's perspective
                            let evalValue
                            if (m.score_after.type === 'cp') {
                              evalValue = m.score_after.value / 100
                            } else {
                              evalValue = m.score_after.value > 0 ? 10 : -10
                            }
                            
                            const displayEvalValue = displayEval(evalValue)
                            
                            return { 
                              eval: displayEvalValue,
                              rawEval: evalValue,
                              isWhite: m.side === 'white',
                              side: m.side
                            }
                          })
                          
                          const maxEval = Math.max(
                            ...evaluations.map(e => Math.abs(e.eval)),
                            0.5
                          )
                          
                          const scale = maxEval * 1.1
                          
                          const points = evaluations.map((e, i) => {
                            const x = (i / (evaluations.length - 1 || 1)) * 800
                            const y = Math.max(0, Math.min(200, 100 - (e.eval / scale) * 100))
                            return { x, y, eval: e.eval, isWhite: e.isWhite }
                          })
                          
                          const fillPoints = []
                          fillPoints.push({ x: 0, y: 200, eval: 0 })
                          points.forEach(p => fillPoints.push(p))
                          fillPoints.push({ x: 800, y: 200, eval: 0 })
                          
                          return (
                            <>
                              <polygon
                                points={fillPoints.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="rgba(255,255,255,0.5)"
                              />
                              
                              {points.map((p, i) => {
                                if (i === 0) return null
                                const prev = points[i - 1]
                                return (
                                  <line
                                    key={i}
                                    x1={prev.x}
                                    y1={prev.y}
                                    x2={p.x}
                                    y2={p.y}
                                    stroke={p.isWhite ? '#ffffff' : '#000000'}
                                    strokeWidth="1.5"
                                  />
                                )
                              })}
                              
                              {points.map((p, i) => {
                                const moveData = pgnAnalysis.moves[i]
                                const moveQuality = moveData ? { quality: moveData.category } : null
                                let markerColor = p.isWhite ? '#ffffff' : '#000000'
                                let strokeColor = p.isWhite ? '#000000' : '#ffffff'
                                
                                if (moveQuality) {
                                  if (moveQuality.quality === 'brilliant') {
                                    markerColor = '#f59e0b'
                                    strokeColor = '#ffffff'
                                  } else if (moveQuality.quality === 'great') {
                                    markerColor = '#14b8a6'
                                    strokeColor = '#ffffff'
                                  } else if (moveQuality.quality === 'best') {
                                    markerColor = '#2563eb'
                                    strokeColor = '#ffffff'
                                  } else if (moveQuality.quality === 'excellent') {
                                    markerColor = '#22c55e'
                                    strokeColor = '#ffffff'
                                  } else if (moveQuality.quality === 'good') {
                                    markerColor = '#0ea5e9'
                                    strokeColor = '#ffffff'
                                  } else if (moveQuality.quality === 'book') {
                                    markerColor = '#d97706'
                                    strokeColor = '#ffffff'
                                  } else if (moveQuality.quality === 'inaccuracy') {
                                    markerColor = '#eab308'
                                    strokeColor = '#ffffff'
                                  } else if (moveQuality.quality === 'mistake') {
                                    markerColor = '#f97316'
                                    strokeColor = '#ffffff'
                                  } else if (['blunder', 'miss'].includes(moveQuality.quality)) {
                                    markerColor = moveQuality.quality === 'miss' ? '#ef4444' : '#dc2626'
                                    strokeColor = '#ffffff'
                                  }
                                }
                                
                                const baseRadius = 3
                                const rx = baseRadius * markerAspectRatio
                                const ry = baseRadius
                                return (
                                  <ellipse
                                    key={i}
                                    cx={p.x}
                                    cy={p.y}
                                    rx={rx}
                                    ry={ry}
                                    fill={markerColor}
                                    stroke={strokeColor}
                                    strokeWidth="1"
                                    vectorEffect="non-scaling-stroke"
                                  />
                                )
                              })}
                            </>
                          )
                        })()}
                      </svg>
                    </div>
                  </div>

                  {/* Accuracy Cards */}
                  <div className="analysis-accuracy-cards">
                    <div className="analysis-accuracy-card">
                      <div className="analysis-accuracy-header">
                        <TrendingUp size={20} />
                        <span>White Accuracy</span>
                      </div>
                      <p className="analysis-accuracy-value">{pgnAnalysis.summary.white.accuracy.toFixed(1)}%</p>
                    </div>
                    <div className="analysis-accuracy-card">
                      <div className="analysis-accuracy-header">
                        <TrendingUp size={20} />
                        <span>Black Accuracy</span>
                      </div>
                      <p className="analysis-accuracy-value">{pgnAnalysis.summary.black.accuracy.toFixed(1)}%</p>
                    </div>
                  </div>

                  {/* Move Quality Chart */}
                  <div className="analysis-quality-chart">
                    <table className="analysis-quality-table">
                      <thead>
                        <tr>
                          <th>Move Quality</th>
                          <th className="text-center">
                            <span className="analysis-player-indicator white">White</span>
                          </th>
                          <th className="text-center"></th>
                          <th className="text-center">
                            <span className="analysis-player-indicator black">Black</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Brilliant</td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.white.counts.brilliant}</span>
                          </td>
                          <td className="text-center">
                            <div className="analysis-quality-icon brilliant">
                              <Sparkles size={16} />
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.black.counts.brilliant}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>Great</td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.white.counts.great}</span>
                          </td>
                          <td className="text-center">
                            <div className="analysis-quality-icon great">
                              <Zap size={16} />
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.black.counts.great}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>Best</td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.white.counts.best}</span>
                          </td>
                          <td className="text-center">
                            <div className="analysis-quality-icon best">
                              <Star size={16} />
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.black.counts.best}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>Excellent</td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.white.counts.excellent}</span>
                          </td>
                          <td className="text-center">
                            <div className="analysis-quality-icon excellent">
                              <CheckCircle size={16} />
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.black.counts.excellent}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>Good</td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.white.counts.good}</span>
                          </td>
                          <td className="text-center">
                            <div className="analysis-quality-icon good">
                              <ThumbsUp size={16} />
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.black.counts.good}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>Book</td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.white.counts.book}</span>
                          </td>
                          <td className="text-center">
                            <div className="analysis-quality-icon book">
                              <BookOpen size={16} />
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="analysis-quality-count">{pgnAnalysis.summary.black.counts.book}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>Inaccuracy</td>
                          <td className="text-center">
                            <span className="analysis-quality-count inaccuracy">{pgnAnalysis.summary.white.counts.inaccuracy}</span>
                          </td>
                          <td className="text-center">
                            <div className="analysis-quality-icon inaccuracy">
                              <AlertTriangle size={16} />
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="analysis-quality-count inaccuracy">{pgnAnalysis.summary.black.counts.inaccuracy}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>Mistake</td>
                          <td className="text-center">
                            <span className="analysis-quality-count mistake">{pgnAnalysis.summary.white.counts.mistake}</span>
                          </td>
                          <td className="text-center">
                            <div className="analysis-quality-icon mistake">
                              <HelpCircle size={16} />
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="analysis-quality-count mistake">{pgnAnalysis.summary.black.counts.mistake}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>Miss</td>
                          <td className="text-center">
                            <span className="analysis-quality-count miss">{pgnAnalysis.summary.white.counts.miss}</span>
                          </td>
                          <td className="text-center">
                            <div className="analysis-quality-icon miss">
                              <XCircle size={16} />
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="analysis-quality-count miss">{pgnAnalysis.summary.black.counts.miss}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>Blunder</td>
                          <td className="text-center">
                            <span className="analysis-quality-count blunder">{pgnAnalysis.summary.white.counts.blunder}</span>
                          </td>
                          <td className="text-center">
                            <div className="analysis-quality-icon blunder">
                              <AlertCircle size={16} />
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="analysis-quality-count blunder">{pgnAnalysis.summary.black.counts.blunder}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
