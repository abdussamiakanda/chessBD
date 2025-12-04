import { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react'
import { User, Trophy, Star, ThumbsUp, CheckCircle, BookOpen, HelpCircle, AlertCircle, Hash, Sparkles, Zap, XCircle, AlertTriangle } from 'lucide-react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { QueenIcon, RookIcon, BishopIcon, KnightIcon, PawnIcon, KingIcon } from '../ui/ChessPieceIcons'
import './ChessBoard.css'

export function ChessBoard({
  position,
  onMove,
  arePiecesDraggable = true,
  allowSquareClicks = true,
  boardWidth,
  allowFreeMoves = false,
  flipped = false,
  whitePlayer,
  blackPlayer,
  whiteTime,
  blackTime,
  isWhiteTurn,
  isRunning,
  onTimeUpdate,
  sectionRef,
  showTimer = true,
  lastMove = null, // Optional: { from: string, to: string }
  customPieces = null, // Optional: custom pieces object for react-chessboard
  moveQuality = null, // Optional: Map of square to quality { [square: string]: string } e.g., { 'e4': 'best', 'd5': 'mistake' }
  bestMoveArrow = null, // Optional: { from: string, to: string } for showing best move arrow
}) {
  const [game, setGame] = useState(new Chess())
  const [gamePosition, setGamePosition] = useState(game.fen())
  const [squareStyles, setSquareStyles] = useState({})
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [showPromotionModal, setShowPromotionModal] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState(null) // { from, to }
  const [checkmateSquare, setCheckmateSquare] = useState(null) // Square of checkmated king
  const [winnerSquare, setWinnerSquare] = useState(null) // Square of winning king
  const [stalemateSquares, setStalemateSquares] = useState([]) // Squares of both kings in stalemate
  const [drawSquares, setDrawSquares] = useState([]) // Squares of both kings in draw
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] }) // Captured pieces: { white: ['p', 'p', 'r'], black: ['q'] }
  const boardRef = useRef(null)
  const playersWrapperRef = useRef(null)
  const internalSectionRef = useRef(null)
  const sectionRefToUse = sectionRef || internalSectionRef
  const lastCalculatedSectionWidth = useRef(null)

  const [currentWhiteTime, setCurrentWhiteTime] = useState(whiteTime || 600)
  const [currentBlackTime, setCurrentBlackTime] = useState(blackTime || 600)

  // Track current theme
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chessbd-theme')
      return saved && ['default', 'dark', 'light'].includes(saved) ? saved : 'default'
    }
    return 'default'
  })

  // Calculate board colors based on theme
  const boardColors = useMemo(() => {
    if (currentTheme === 'dark' || currentTheme === 'light') {
      // Gray colors for dark and light themes
      return {
        dark: '#696969',
        light: '#d1d1d1'
      }
    } else {
      // Brown/beige colors for default theme
      return {
        dark: '#b58863',
        light: '#f0d9b5'
      }
    }
  }, [currentTheme])

  // Listen for theme changes
  useEffect(() => {
    const checkTheme = () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('chessbd-theme')
        const newTheme = saved && ['default', 'dark', 'light'].includes(saved) ? saved : 'default'
        if (newTheme !== currentTheme) {
          setCurrentTheme(newTheme)
        }
      }
    }

    // Check theme on mount and periodically
    checkTheme()
    const interval = setInterval(checkTheme, 1000) // Check every second
    
    // Check immediately when window gains focus
    window.addEventListener('focus', checkTheme)
    
    // Also listen for storage events (when theme changes in another tab)
    window.addEventListener('storage', checkTheme)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', checkTheme)
      window.removeEventListener('storage', checkTheme)
    }
  }, [currentTheme])

  useEffect(() => {
    if (position) {
      const newGame = new Chess()
      try {
        newGame.load(position)
        setGame(newGame)
        setGamePosition(newGame.fen())
      } catch (e) {
        const fallbackGame = new Chess()
        setGame(fallbackGame)
        setGamePosition(fallbackGame.fen())
      }
    } else {
      const newGame = new Chess()
      setGame(newGame)
      setGamePosition(newGame.fen())
    }
  }, [position])

  useEffect(() => {
    if (whiteTime !== undefined) {
      setCurrentWhiteTime(whiteTime)
    }
  }, [whiteTime])

  useEffect(() => {
    if (blackTime !== undefined) {
      setCurrentBlackTime(blackTime)
    }
  }, [blackTime])

  // Calculate captured pieces
  useEffect(() => {
    if (!game) return

    // Starting position piece counts
    const startingPieces = {
      white: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 },
      black: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 }
    }

    // Count current pieces on the board
    const currentPieces = { white: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 }, black: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 } }
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (8 - rank)
        const piece = game.get(square)
        if (piece) {
          const color = piece.color === 'w' ? 'white' : 'black'
          const type = piece.type.toLowerCase()
          if (currentPieces[color][type] !== undefined) {
            currentPieces[color][type]++
          }
        }
      }
    }

    // Calculate captured pieces
    // captured.white = pieces that white captured (black pieces that are missing)
    // captured.black = pieces that black captured (white pieces that are missing)
    const captured = { white: [], black: [] }
    
    // White captured pieces = missing black pieces
    Object.keys(startingPieces.black).forEach(type => {
      const missing = startingPieces.black[type] - currentPieces.black[type]
      for (let i = 0; i < missing; i++) {
        captured.white.push(type)
      }
    })

    // Black captured pieces = missing white pieces
    Object.keys(startingPieces.white).forEach(type => {
      const missing = startingPieces.white[type] - currentPieces.white[type]
      for (let i = 0; i < missing; i++) {
        captured.black.push(type)
      }
    })

    // Sort captured pieces by value (Q > R > B > N > P, K should never be captured)
    const pieceValue = { q: 5, r: 4, b: 3, n: 3, p: 1 }
    captured.white.sort((a, b) => (pieceValue[b] || 0) - (pieceValue[a] || 0))
    captured.black.sort((a, b) => (pieceValue[b] || 0) - (pieceValue[a] || 0))

    setCapturedPieces(captured)
  }, [game, gamePosition])

  // Check detection and last move highlighting
  useEffect(() => {
    if (!game) return

    // Check if the game is over
    const isCheckmate = game.isCheckmate()
    const isStalemate = game.isStalemate()
    const isDraw = game.isDraw()
    const isGameOver = game.isGameOver()
    
    // Reset all game end indicators
    setCheckmateSquare(null)
    setWinnerSquare(null)
    setStalemateSquares([])
    setDrawSquares([])
    
    // Check if the current player is in check (including checkmate)
    const isInCheck = game.inCheck()
    let kingInCheckSquare = null
    
    if (isInCheck) {
      // Find the king of the current player
      const currentTurn = game.turn()
      kingInCheckSquare = findKingSquare(game, currentTurn)
    }

    // If checkmate, find both kings
    if (isCheckmate) {
      const currentTurn = game.turn() // The player who is checkmated
      const checkmatedKingSquare = findKingSquare(game, currentTurn)
      const winnerColor = currentTurn === 'w' ? 'b' : 'w'
      const winnerKingSquare = findKingSquare(game, winnerColor)
      
      setCheckmateSquare(checkmatedKingSquare)
      setWinnerSquare(winnerKingSquare)
    } else if (isStalemate) {
      // Stalemate: both kings should show stalemate indicator
      const whiteKingSquare = findKingSquare(game, 'w')
      const blackKingSquare = findKingSquare(game, 'b')
      const squares = []
      if (whiteKingSquare) squares.push(whiteKingSquare)
      if (blackKingSquare) squares.push(blackKingSquare)
      setStalemateSquares(squares)
    } else if (isDraw && !isStalemate) {
      // Draw (not stalemate): both kings should show draw indicator
      const whiteKingSquare = findKingSquare(game, 'w')
      const blackKingSquare = findKingSquare(game, 'b')
      const squares = []
      if (whiteKingSquare) squares.push(whiteKingSquare)
      if (blackKingSquare) squares.push(blackKingSquare)
      setDrawSquares(squares)
    }
    
    // Get the last move - prefer prop, fallback to game history
    let lastMoveObj = null
    if (lastMove && lastMove.from && lastMove.to) {
      lastMoveObj = lastMove
    } else {
      const history = game.history({ verbose: true })
      lastMoveObj = history.length > 0 ? history[history.length - 1] : null
    }
    
    // Update square styles to show check and last move
    setSquareStyles(prevStyles => {
      const newStyles = {}
      
      // Remove old check styling
      Object.keys(prevStyles).forEach(square => {
        if (prevStyles[square]?.boxShadow?.includes('255, 0, 0') && prevStyles[square]?.boxShadow?.includes('inset')) {
          // Keep other styles but remove check-specific ones
          const { boxShadow, background, ...rest } = prevStyles[square]
          if (Object.keys(rest).length > 0) {
            newStyles[square] = rest
          }
        } else {
          // Keep non-check styles temporarily
          newStyles[square] = prevStyles[square]
        }
      })
      
      // Remove old last move highlighting (yellow background that's exactly rgba(255, 255, 0, 0.3))
      Object.keys(newStyles).forEach(square => {
        const bg = newStyles[square]?.background
        // Only remove if it's exactly the last move highlight color (not a gradient or other style)
        if (bg === 'rgba(255, 255, 0, 0.3)') {
          const { background, ...rest } = newStyles[square]
          if (Object.keys(rest).length > 0) {
            newStyles[square] = rest
          } else {
            delete newStyles[square]
          }
        }
      })
      
      // Add check styling if king is in check
      if (kingInCheckSquare) {
        newStyles[kingInCheckSquare] = {
          ...newStyles[kingInCheckSquare],
          background: newStyles[kingInCheckSquare]?.background || 'rgba(255, 0, 0, 0.3)',
          boxShadow: 'inset 0 0 0 3px rgba(255, 0, 0, 0.8)',
        }
      }
      
      // Add last move highlighting
      if (lastMoveObj && lastMoveObj.from && lastMoveObj.to) {
        // Highlight source square (only if not in check)
        if (lastMoveObj.from !== kingInCheckSquare) {
          newStyles[lastMoveObj.from] = {
            ...newStyles[lastMoveObj.from],
            background: 'rgba(255, 255, 0, 0.3)',
          }
        }

        // Highlight destination square (only if not in check)
        if (lastMoveObj.to !== kingInCheckSquare) {
          newStyles[lastMoveObj.to] = {
            ...newStyles[lastMoveObj.to],
            background: 'rgba(255, 255, 0, 0.3)',
          }
        }
      }
      
      return newStyles
    })
  }, [game, gamePosition, lastMove])
  
  // Helper function to render captured piece icon
  function renderCapturedPieceIcon(pieceType) {
    const iconProps = { className: 'captured-piece-icon' }
    
    switch (pieceType) {
      case 'q':
        return <QueenIcon {...iconProps} />
      case 'r':
        return <RookIcon {...iconProps} />
      case 'b':
        return <BishopIcon {...iconProps} />
      case 'n':
        return <KnightIcon {...iconProps} />
      case 'p':
        return <PawnIcon {...iconProps} />
      case 'k':
        return <KingIcon {...iconProps} />
      default:
        return null
    }
  }

  // Helper function to find king square
  function findKingSquare(gameInstance, color) {
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (8 - rank)
        const piece = gameInstance.get(square)
        if (piece && piece.type === 'k' && piece.color === color) {
          return square
        }
      }
    }
    return null
  }

  // Helper function to calculate square position (for corner positioning)
  function getSquarePosition(square, boardSize, boardOrientation) {
    if (!square) return null
    
    const file = square.charCodeAt(0) - 97 // a=0, b=1, etc.
    const rank = parseInt(square[1]) - 1 // 1=0, 2=1, etc.
    
    // Calculate position based on board orientation
    // When orientation is 'white': a1 is bottom-left, h8 is top-right
    // When orientation is 'black': a1 is top-right, h8 is bottom-left
    let x = file
    let y = 7 - rank // In standard view, rank 1 is at bottom (y=7), rank 8 is at top (y=0)
    
    // If board is oriented as black, flip both axes
    if (boardOrientation === 'black') {
      x = 7 - x
      y = 7 - y
    }
    
    const squareSize = boardSize / 8
    // Position at top-right corner of the square
    // Using translate(-50%, -50%) in CSS, so we position at the corner point
    return {
      left: (x + 1) * squareSize, // Right edge of square
      top: y * squareSize, // Top edge of square
    }
  }


  // Helper function to get quality icon component
  function getQualityIcon(quality) {
    switch (quality) {
      case 'brilliant':
        return <Sparkles size={10} strokeWidth={2.5} />
      case 'great':
        return <Zap size={10} strokeWidth={2.5} />
      case 'best':
        return <Star size={10} strokeWidth={2.5} />
      case 'excellent':
        return <CheckCircle size={10} strokeWidth={2.5} />
      case 'good':
        return <ThumbsUp size={10} strokeWidth={2.5} />
      case 'book':
        return <BookOpen size={10} strokeWidth={2.5} />
      case 'inaccuracy':
        return <AlertTriangle size={10} strokeWidth={2.5} />
      case 'mistake':
        return <HelpCircle size={10} strokeWidth={2.5} />
      case 'miss':
        return <XCircle size={10} strokeWidth={2.5} />
      case 'blunder':
        return <AlertCircle size={10} strokeWidth={2.5} />
      default:
        return null
    }
  }

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      if (isWhiteTurn) {
        setCurrentWhiteTime((prev) => {
          if (prev <= 0) return 0
          const newTime = prev - 1
          // Use setTimeout to defer the callback to avoid updating parent during render
          if (onTimeUpdate) {
            setTimeout(() => onTimeUpdate('white', newTime), 0)
          }
          return newTime
        })
      } else {
        setCurrentBlackTime((prev) => {
          if (prev <= 0) return 0
          const newTime = prev - 1
          // Use setTimeout to defer the callback to avoid updating parent during render
          if (onTimeUpdate) {
            setTimeout(() => onTimeUpdate('black', newTime), 0)
          }
          return newTime
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, isWhiteTurn, onTimeUpdate])

  function onDrop({ sourceSquare, targetSquare, piece }) {
    // Clear selection after move
    setSelectedSquare(null)
    
    // Clear move preview highlights but preserve check and last move styling
    const newSquareStyles = {}
    Object.keys(squareStyles).forEach(square => {
      const style = squareStyles[square]
      // Keep check styling (red box shadow)
      if (style?.boxShadow?.includes('255, 0, 0') && style?.boxShadow?.includes('inset')) {
        newSquareStyles[square] = style
      }
      // Keep last move highlighting (yellow background)
      else if (style?.background === 'rgba(255, 255, 0, 0.3)') {
        newSquareStyles[square] = style
      }
    })
    setSquareStyles(newSquareStyles)
    
    // Check if this is a promotion move
    const pieceOnSquare = game.get(sourceSquare)
    const isPawn = pieceOnSquare?.type === 'p'
    const rank = parseInt(targetSquare[1])
    const currentTurn = game.turn()
    const isPromotionMove = isPawn && (
      (currentTurn === 'w' && rank === 8) || 
      (currentTurn === 'b' && rank === 1)
    )
    
    // If it's a promotion move, show our custom promotion modal
    if (isPromotionMove && !pendingPromotion) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare })
      setShowPromotionModal(true)
      return false // Prevent the move until user selects promotion piece
    }
    
    // If we have a pending promotion, use it
    let promotion = undefined
    if (pendingPromotion && pendingPromotion.from === sourceSquare && pendingPromotion.to === targetSquare) {
      // This should be handled by handlePromotionSelect, but just in case
      setPendingPromotion(null)
      setShowPromotionModal(false)
    }
    
    // If external onMove handler is provided, use it
    // The parent component will handle state updates
    if (onMove) {
      // Check if onMove accepts promotion parameter
      if (onMove.length >= 3) {
        const result = onMove(sourceSquare, targetSquare, promotion)
        return result
      } else {
        const result = onMove(sourceSquare, targetSquare)
        return result
      }
    }
    
    // Default behavior - try to make the move internally
    const gameCopy = new Chess(game.fen())
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotion,
      })
      if (move) {
        setGame(gameCopy)
        setGamePosition(gameCopy.fen())
        return true
      }
    } catch (e) {
      // Invalid move
    }
    
    return false
  }
  
  // Handle promotion piece selection
  function handlePromotionSelect(promotionPiece) {
    if (!pendingPromotion) {
      return
    }
    
    const { from, to } = pendingPromotion
    setPendingPromotion(null)
    setShowPromotionModal(false)
    
    // Make the move with the selected promotion piece
    if (onMove) {
      // Always pass promotion parameter - functions with default parameters (like promotion = 'q')
      // will accept it even if .length doesn't reflect it. This ensures the selected promotion
      // piece is used instead of defaulting to queen.
      onMove(from, to, promotionPiece)
      // Note: result might be a Promise, but we don't await it - parent handles async
    } else {
      // Default behavior - make the move internally
      const gameCopy = new Chess(game.fen())
      try {
        const move = gameCopy.move({
          from,
          to,
          promotion: promotionPiece,
        })
        if (move) {
          setGame(gameCopy)
          setGamePosition(gameCopy.fen())
        }
      } catch (e) {
        // Invalid move
      }
    }
  }

  function showMovesForSquare(square) {
    const gameCopy = new Chess(game.fen())
    const pieceOnSquare = gameCopy.get(square)
    
    // Preserve check styling
    const preservedCheckStyles = {}
    Object.keys(squareStyles).forEach(sq => {
      if (squareStyles[sq]?.boxShadow?.includes('255, 0, 0') && squareStyles[sq]?.boxShadow?.includes('inset')) {
        preservedCheckStyles[sq] = squareStyles[sq]
      }
    })
    
    // If clicking on a piece, show its moves
    if (pieceOnSquare) {
      // Only show moves if it's the correct turn (unless allowFreeMoves)
      if (!allowFreeMoves && gameCopy.turn() !== pieceOnSquare.color) {
        setSquareStyles(preservedCheckStyles)
        return
      }
      
      const moves = gameCopy.moves({ square: square, verbose: true })
      
      if (moves.length > 0) {
        const newSquareStyles = { ...preservedCheckStyles }
        
        // Highlight source square (merge with check if same square)
        newSquareStyles[square] = {
          ...newSquareStyles[square],
          background: newSquareStyles[square]?.background 
            ? newSquareStyles[square].background 
            : 'rgba(255, 255, 0, 0.4)',
        }
        
        // Highlight possible moves
        moves.forEach((move) => {
          const isCapture = move.captured !== undefined
          if (isCapture) {
            // Captures: show border around the square (merge with check if same square)
            newSquareStyles[move.to] = {
              ...newSquareStyles[move.to],
              boxShadow: 'inset 0 0 0 4px rgba(255, 0, 0, 0.6)',
            }
          } else {
            // Regular moves: show a circle/dot in the center
            newSquareStyles[move.to] = {
              ...newSquareStyles[move.to],
              background: 'radial-gradient(circle, rgba(0, 0, 0, 0.3) 30%, transparent 30%)',
            }
          }
        })
        
        setSquareStyles(newSquareStyles)
      } else {
        setSquareStyles(preservedCheckStyles)
      }
    } else {
      // No piece on square, clear move styles but keep check
      setSquareStyles(preservedCheckStyles)
    }
  }

  // Throttle onPieceDrag to improve performance
  const dragThrottleRef = useRef(null)
  const lastDraggedSquareRef = useRef(null)
  
  const onPieceDrag = useCallback(({ piece, square }) => {
    // Only update if the square changed (avoid unnecessary recalculations)
    if (lastDraggedSquareRef.current === square) {
      return
    }
    lastDraggedSquareRef.current = square
    
    // Clear any existing throttle
    if (dragThrottleRef.current) {
      clearTimeout(dragThrottleRef.current)
    }
    
    // Throttle the move highlighting to avoid lag
    dragThrottleRef.current = setTimeout(() => {
      showMovesForSquare(square)
    }, 50) // 50ms throttle
  }, [showMovesForSquare])
  
  // Cleanup throttle on unmount
  useEffect(() => {
    return () => {
      if (dragThrottleRef.current) {
        clearTimeout(dragThrottleRef.current)
      }
    }
  }, [])

  function onSquareClick({ square, piece }) {
    // Preserve check styling
    const preservedCheckStyles = {}
    Object.keys(squareStyles).forEach(sq => {
      if (squareStyles[sq]?.boxShadow?.includes('255, 0, 0') && squareStyles[sq]?.boxShadow?.includes('inset')) {
        preservedCheckStyles[sq] = squareStyles[sq]
      }
    })
    
    // If clicking the same square twice, clear selection
    if (selectedSquare === square) {
      setSquareStyles(preservedCheckStyles)
      setSelectedSquare(null)
      return
    }

    // If we have a selected square, try to make a move
    if (selectedSquare && selectedSquare !== square) {
      const gameCopy = new Chess(game.fen())
      const pieceOnSelected = gameCopy.get(selectedSquare)
      
      // Check if it's a valid move
      if (pieceOnSelected) {
        try {
          // Check if this is a pawn promotion
          const isPawn = pieceOnSelected.type === 'p'
          const rank = parseInt(square[1])
          const currentTurn = gameCopy.turn()
          const isPromotionMove = isPawn && (
            (currentTurn === 'w' && rank === 8) || 
            (currentTurn === 'b' && rank === 1)
          )
          
          // If it's a promotion move, show modal instead of auto-promoting
          if (isPromotionMove && !pendingPromotion) {
            setPendingPromotion({ from: selectedSquare, to: square })
            setShowPromotionModal(true)
            setSelectedSquare(null)
            setSquareStyles(preservedCheckStyles)
            return
          }
          
          // If we have a pending promotion, use it
          let promotion = undefined
          if (isPromotionMove && pendingPromotion && pendingPromotion.from === selectedSquare && pendingPromotion.to === square) {
            // This should be handled by handlePromotionSelect, but just in case
            promotion = 'q' // fallback
          }
          
          const move = gameCopy.move({
            from: selectedSquare,
            to: square,
            promotion: promotion,
          })
          
          if (move) {
            // Clear selection and styles
            setSquareStyles({})
            setSelectedSquare(null)
            
            // Make the move via onMove handler if available
            if (onMove) {
              // Always pass promotion parameter if it's defined - functions with default parameters
              // (like promotion = 'q') will accept it even if .length doesn't reflect it
              if (promotion !== undefined) {
                onMove(selectedSquare, square, promotion)
              } else {
                onMove(selectedSquare, square)
              }
            } else {
              // Update internal game state
              setGame(gameCopy)
              setGamePosition(gameCopy.fen())
            }
            return
          }
        } catch (e) {
          // Invalid move, continue to select new square
        }
      }
    }

    // Select the clicked square and show its moves
    setSelectedSquare(square)
    showMovesForSquare(square)
  }

  const defaultWidth = typeof window !== 'undefined' && window.innerWidth < 768 ? 300 : 600
  const [calculatedWidth, setCalculatedWidth] = useState(boardWidth || defaultWidth)

  useLayoutEffect(() => {
    if (!boardWidth && (boardRef.current || playersWrapperRef.current)) {
      const updateWidth = () => {
        if (playersWrapperRef.current && sectionRefToUse.current) {
          const section = sectionRefToUse.current
          const windowWidth = window.innerWidth
          const isMobile = windowWidth < 768
          
          if (isMobile) {
            // Mobile: board takes the width and calculates height to be square
            const sectionWidth = section.clientWidth
            // Account for padding from chess-board-with-players (0.75rem = 12px on each side = 24px total)
            const padding = 24
            const availableWidth = sectionWidth - padding
            const size = Math.max(availableWidth, 200)
            if (size > 0 && size !== calculatedWidth) {
              setCalculatedWidth(size)
            }
            return
          } else {
            // Desktop: use available height to calculate width
            const sectionHeight = section.clientHeight
            const sectionComputedStyle = window.getComputedStyle(section)
            const borderLeft = parseFloat(sectionComputedStyle.borderLeftWidth) || 0
            const borderRight = parseFloat(sectionComputedStyle.borderRightWidth) || 0
            const sectionWidth = section.clientWidth + borderLeft + borderRight

            // Get player info elements to calculate their heights
            const whitePlayerEl = playersWrapperRef.current.querySelector('.chess-player-white')
            const blackPlayerEl = playersWrapperRef.current.querySelector('.chess-player-black')
            const whitePlayerHeight = whitePlayerEl ? whitePlayerEl.offsetHeight : 0
            const blackPlayerHeight = blackPlayerEl ? blackPlayerEl.offsetHeight : 0

            // Get gap from CSS
            const computedGap = window.getComputedStyle(playersWrapperRef.current).gap
            const gap = parseFloat(computedGap) || 8

            // Get padding from section
            const computedPadding = window.getComputedStyle(section).paddingTop
            const padding = parseFloat(computedPadding) || 16

            // Calculate available height for board
            const totalPadding = padding * 2
            const totalGaps = gap * 2
            const totalPlayerHeights = whitePlayerHeight + blackPlayerHeight
            const availableHeight = sectionHeight - totalPadding - totalPlayerHeights - totalGaps

            // For larger screens: use available height to calculate width (height-based)
            // This leaves space for right side content
            const size = Math.max(availableHeight, 200) // Minimum 200px

            if (size > 0 && size !== calculatedWidth) {
              // For larger screens, calculate and set section width
              const newSectionWidth = size + (padding * 2)

              // Prevent infinite loop - if we just set this width, don't recalculate
              if (lastCalculatedSectionWidth.current === newSectionWidth && Math.abs(sectionWidth - newSectionWidth) < 5) {
                return
              }

              setCalculatedWidth(size)
              lastCalculatedSectionWidth.current = newSectionWidth

              // Set section width to match board width + padding on both sides
              // Use box-sizing: border-box so width includes padding and borders
              section.style.boxSizing = 'border-box'
              section.style.width = `${newSectionWidth}px`
            }
          }
        } else if (boardRef.current) {
          const container = boardRef.current
          const containerWidth = container.clientWidth
          const containerHeight = container.clientHeight
          const size = Math.min(containerWidth, containerHeight)
          if (size > 0 && size !== calculatedWidth) {
            setCalculatedWidth(size)
          }
        }
      }
      
      const timeoutId = setTimeout(updateWidth, 0)
      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(updateWidth)
      })
      
      if (sectionRefToUse.current) {
        resizeObserver.observe(sectionRefToUse.current)
      }
      if (playersWrapperRef.current) {
        resizeObserver.observe(playersWrapperRef.current)
      }
      window.addEventListener('resize', updateWidth)
      
      return () => {
        clearTimeout(timeoutId)
        resizeObserver.disconnect()
        window.removeEventListener('resize', updateWidth)
      }
    } else if (boardWidth) {
      setCalculatedWidth(boardWidth)
    }
  }, [boardWidth, sectionRefToUse])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const safeSize = Math.max(calculatedWidth || defaultWidth, 200)
  const boardOrientation = flipped ? 'black' : 'white'

  // Format arrows for react-chessboard
  // Format: [{ startSquare, endSquare, color }] - goes in options object
  const arrowsArray = useMemo(() => {
    if (!bestMoveArrow || !bestMoveArrow.from || !bestMoveArrow.to) {
      return undefined
    }
    return [{
      startSquare: bestMoveArrow.from,
      endSquare: bestMoveArrow.to,
      color: 'rgb(16, 185, 129)' // teal/green color
    }]
  }, [bestMoveArrow?.from, bestMoveArrow?.to])

  if (whitePlayer || blackPlayer) {
    const defaultWhitePlayer = whitePlayer || {
      name: 'White Player',
      username: 'whiteplayer',
      avatar: null,
    }
    const defaultBlackPlayer = blackPlayer || {
      name: 'Black Player',
      username: 'blackplayer',
      avatar: null,
    }

    // Player positions should match where the pieces are visually:
    // When flipped=false: white pieces at bottom → white player at bottom
    // When flipped=true: black pieces at bottom → black player at bottom
    // The Engine page controls which actual player (user/engine) is white/black
    const bottomPlayer = flipped ? defaultBlackPlayer : defaultWhitePlayer
    const topPlayer = flipped ? defaultWhitePlayer : defaultBlackPlayer
    const bottomPlayerColor = flipped ? 'black' : 'white'
    const topPlayerColor = flipped ? 'white' : 'black'
    const bottomPlayerTime = flipped ? currentBlackTime : currentWhiteTime
    const topPlayerTime = flipped ? currentWhiteTime : currentBlackTime

    return (
      <div className="chess-board-with-players" ref={playersWrapperRef}>
        <div className={`chess-player-info chess-player-${topPlayerColor}`}>
          <div className="chess-player-info-inner">
            <div className="chess-player-avatar">
              {topPlayer.avatar ? (
                <img src={topPlayer.avatar} alt={topPlayer.name} />
              ) : topPlayer.icon ? (
                <topPlayer.icon className="chess-player-icon" />
              ) : (
                <User className="chess-player-icon" />
              )}
            </div>
            <div className="chess-player-details">
              <div className="chess-player-name">{topPlayer.name}</div>
              {topPlayer.username && (
                <div className="chess-player-username">@{topPlayer.username}</div>
              )}
            </div>
          </div>
          <div className={`chess-player-captured-piece chess-player-captured-piece-${topPlayerColor}`}>
            {capturedPieces[topPlayerColor].map((piece, index) => (
              <span key={`${piece}-${index}`} className="captured-piece">
                {renderCapturedPieceIcon(piece)}
              </span>
            ))}
          </div>
          {showTimer && (
            <div className={`chess-player-timer chess-player-timer-${topPlayerColor}`}>
              {formatTime(topPlayerTime)}
            </div>
          )}
        </div>

        <div className="chess-board-wrapper-inner">
          <div 
            className="chess-board-container" 
            ref={boardRef}
            style={{
              '--piece-size': `${safeSize / 8}px`,
              width: `${safeSize}px`,
              height: `${safeSize}px`,
            }}
          >
            <div
              style={{
                width: `${safeSize}px`, 
                height: `${safeSize}px`,
                minWidth: `${safeSize}px`,
                minHeight: `${safeSize}px`,
                position: 'relative'
              }}
            >
        <Chessboard
          key={customPieces ? 'custom-' + Object.keys(customPieces).length : 'default'}
          customPieces={customPieces || undefined}
          options={{
            position: gamePosition,
            onPieceDrop: arePiecesDraggable ? onDrop : undefined,
            onPieceDrag: onPieceDrag,
            onSquareClick: allowSquareClicks ? onSquareClick : undefined,
            boardOrientation: boardOrientation,
            animationDurationInMs: 200,
            allowDragging: arePiecesDraggable,
            arrows: arrowsArray,
            squareStyles: squareStyles,
            boardStyle: {
              borderRadius: '4px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              width: '100%',
              height: '100%',
            },
            darkSquareStyle: { backgroundColor: boardColors.dark },
            lightSquareStyle: { backgroundColor: boardColors.light },
            draggingPieceStyle: {
              opacity: 0.8,
              cursor: 'grabbing',
              zIndex: 1000,
              width: 'auto',
              height: 'auto',
              maxWidth: 'none',
              maxHeight: 'none',
              transform: 'none',
            },
            draggingPieceGhostStyle: {
              opacity: 0.3,
            },
          }}
        />
        
        {/* Checkmate and Winner Indicators */}
        {checkmateSquare && (() => {
          const pos = getSquarePosition(checkmateSquare, safeSize, boardOrientation)
          if (!pos) return null
          // Ensure position is within board bounds
          if (pos.left < 0 || pos.left > safeSize || pos.top < 0 || pos.top > safeSize) {
            return null
          }
          return (
            <div 
              className="chess-square-indicator chess-checkmate-indicator"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              <Hash size={10} strokeWidth={2.5} />
            </div>
          )
        })()}
        {winnerSquare && (() => {
          const pos = getSquarePosition(winnerSquare, safeSize, boardOrientation)
          if (!pos) return null
          // Ensure position is within board bounds
          if (pos.left < 0 || pos.left > safeSize || pos.top < 0 || pos.top > safeSize) {
            return null
          }
          return (
            <div 
              className="chess-square-indicator chess-winner-indicator"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              <Trophy size={10} strokeWidth={2.5} />
            </div>
          )
        })()}
        {/* Stalemate Indicators */}
        {stalemateSquares.map((square, index) => {
          const pos = getSquarePosition(square, safeSize, boardOrientation)
          if (!pos) return null
          // Ensure position is within board bounds
          if (pos.left < 0 || pos.left > safeSize || pos.top < 0 || pos.top > safeSize) {
            return null
          }
          return (
            <div 
              key={`stalemate-${square}-${index}`}
              className="chess-square-indicator chess-stalemate-indicator"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '1' }}>S</span>
            </div>
          )
        })}
        {/* Draw Indicators */}
        {drawSquares.map((square, index) => {
          const pos = getSquarePosition(square, safeSize, boardOrientation)
          if (!pos) return null
          // Ensure position is within board bounds
          if (pos.left < 0 || pos.left > safeSize || pos.top < 0 || pos.top > safeSize) {
            return null
          }
          return (
            <div 
              key={`draw-${square}-${index}`}
              className="chess-square-indicator chess-draw-indicator"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '1' }}>=</span>
            </div>
          )
        })}
        {/* Move Quality Indicators */}
        {moveQuality && Object.entries(moveQuality).map(([square, quality]) => {
          // Skip if this square already has checkmate/winner/stalemate/draw indicator
          if (checkmateSquare === square || winnerSquare === square || 
              stalemateSquares.includes(square) || drawSquares.includes(square)) {
            return null
          }
          const pos = getSquarePosition(square, safeSize, boardOrientation)
          if (!pos) return null
          
          return (
            <div 
              key={`quality-${square}`}
              className={`chess-square-indicator chess-quality-indicator chess-quality-${quality}`}
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              {getQualityIcon(quality)}
            </div>
          )
        })}
            </div>
            
            {/* Promotion Modal - Inside board container */}
            {showPromotionModal && (
              <div className="promotion-modal-container">
                <div className="promotion-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="promotion-modal-title">Choose promotion piece</div>
                  <div className="promotion-modal-pieces">
                    <button onClick={() => handlePromotionSelect('q')} className="promotion-piece-btn">
                      <QueenIcon className="promotion-piece-icon" />
                      <span className="promotion-label">Queen</span>
                    </button>
                    <button onClick={() => handlePromotionSelect('r')} className="promotion-piece-btn">
                      <RookIcon className="promotion-piece-icon" />
                      <span className="promotion-label">Rook</span>
                    </button>
                    <button onClick={() => handlePromotionSelect('b')} className="promotion-piece-btn">
                      <BishopIcon className="promotion-piece-icon" />
                      <span className="promotion-label">Bishop</span>
                    </button>
                    <button onClick={() => handlePromotionSelect('n')} className="promotion-piece-btn">
                      <KnightIcon className="promotion-piece-icon" />
                      <span className="promotion-label">Knight</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`chess-player-info chess-player-${bottomPlayerColor}`}>
          <div className="chess-player-info-inner">
            <div className="chess-player-avatar">
              {bottomPlayer.avatar ? (
                <img src={bottomPlayer.avatar} alt={bottomPlayer.name} />
              ) : bottomPlayer.icon ? (
                <bottomPlayer.icon className="chess-player-icon" />
              ) : (
                <User className="chess-player-icon" />
              )}
            </div>
            <div className="chess-player-details">
              <div className="chess-player-name">{bottomPlayer.name}</div>
              {bottomPlayer.username && (
                <div className="chess-player-username">@{bottomPlayer.username}</div>
              )}
            </div>
          </div>
          <div className={`chess-player-captured-piece chess-player-captured-piece-${bottomPlayerColor}`}>
            {capturedPieces[bottomPlayerColor].map((piece, index) => (
              <span key={`${piece}-${index}`} className="captured-piece">
                {renderCapturedPieceIcon(piece)}
              </span>
            ))}
          </div>
          {showTimer && (
            <div className={`chess-player-timer chess-player-timer-${bottomPlayerColor}`}>
              {formatTime(bottomPlayerTime)}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div 
      className="chess-board-container" 
      ref={boardRef}
      style={{
        '--piece-size': `${safeSize / 8}px`
      }}
    >
      <div 
        style={{ 
          width: `${safeSize}px`, 
          height: `${safeSize}px`,
          minWidth: `${safeSize}px`,
          minHeight: `${safeSize}px`,
          position: 'relative'
        }}
      >
        <Chessboard
          key={customPieces ? 'custom-' + Object.keys(customPieces).length : 'default'}
          customPieces={customPieces || undefined}
          options={{
            position: gamePosition,
            onPieceDrop: arePiecesDraggable ? onDrop : undefined,
            onPieceDrag: onPieceDrag,
            onSquareClick: allowSquareClicks ? onSquareClick : undefined,
            boardOrientation: boardOrientation,
            animationDurationInMs: 200,
            allowDragging: arePiecesDraggable,
            arrows: arrowsArray,
            squareStyles: squareStyles,
            boardStyle: {
              borderRadius: '4px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              width: '100%',
              height: '100%',
            },
            darkSquareStyle: { backgroundColor: boardColors.dark },
            lightSquareStyle: { backgroundColor: boardColors.light },
            draggingPieceStyle: {
              opacity: 0.8,
              cursor: 'grabbing',
              zIndex: 1000,
            },
            draggingPieceGhostStyle: {
              opacity: 0.3,
            },
          }}
        />
        
        {/* Checkmate and Winner Indicators */}
        {checkmateSquare && (() => {
          const pos = getSquarePosition(checkmateSquare, safeSize, boardOrientation)
          if (!pos) return null
          // Ensure position is within board bounds
          if (pos.left < 0 || pos.left > safeSize || pos.top < 0 || pos.top > safeSize) {
            return null
          }
          return (
            <div 
              className="chess-square-indicator chess-checkmate-indicator"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              <Hash size={10} strokeWidth={2.5} />
            </div>
          )
        })()}
        {winnerSquare && (() => {
          const pos = getSquarePosition(winnerSquare, safeSize, boardOrientation)
          if (!pos) return null
          // Ensure position is within board bounds
          if (pos.left < 0 || pos.left > safeSize || pos.top < 0 || pos.top > safeSize) {
            return null
          }
          return (
            <div 
              className="chess-square-indicator chess-winner-indicator"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              <Trophy size={10} strokeWidth={2.5} />
            </div>
          )
        })()}
        {/* Stalemate Indicators */}
        {stalemateSquares.map((square, index) => {
          const pos = getSquarePosition(square, safeSize, boardOrientation)
          if (!pos) return null
          // Ensure position is within board bounds
          if (pos.left < 0 || pos.left > safeSize || pos.top < 0 || pos.top > safeSize) {
            return null
          }
          return (
            <div 
              key={`stalemate-${square}-${index}`}
              className="chess-square-indicator chess-stalemate-indicator"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '1' }}>S</span>
            </div>
          )
        })}
        {/* Draw Indicators */}
        {drawSquares.map((square, index) => {
          const pos = getSquarePosition(square, safeSize, boardOrientation)
          if (!pos) return null
          // Ensure position is within board bounds
          if (pos.left < 0 || pos.left > safeSize || pos.top < 0 || pos.top > safeSize) {
            return null
          }
          return (
            <div 
              key={`draw-${square}-${index}`}
              className="chess-square-indicator chess-draw-indicator"
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '1' }}>=</span>
            </div>
          )
        })}
        {/* Move Quality Indicators */}
        {moveQuality && Object.entries(moveQuality).map(([square, quality]) => {
          // Skip if this square already has checkmate/winner/stalemate/draw indicator
          if (checkmateSquare === square || winnerSquare === square || 
              stalemateSquares.includes(square) || drawSquares.includes(square)) {
            return null
          }
          const pos = getSquarePosition(square, safeSize, boardOrientation)
          if (!pos) return null
          
          return (
            <div 
              key={`quality-${square}`}
              className={`chess-square-indicator chess-quality-indicator chess-quality-${quality}`}
              style={{
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              {getQualityIcon(quality)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

