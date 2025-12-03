import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Star, ThumbsUp, CheckCircle, BookOpen, HelpCircle, AlertCircle, Sparkles, Zap, XCircle, AlertTriangle } from 'lucide-react'
import './MoveHistory.css'

export function MoveHistory({ moves, currentMoveIndex, onMoveClick, flipped = false, moveQuality = [] }) {
  const scrollRef = useRef(null)
  const containerRef = useRef(null)

  // Scroll to current move when it changes
  useEffect(() => {
    if (scrollRef.current && currentMoveIndex !== null) {
      const moveElement = scrollRef.current.querySelector(`[data-move-index="${currentMoveIndex}"]`)
      if (moveElement && scrollRef.current) {
        const container = scrollRef.current
        const containerRect = container.getBoundingClientRect()
        const elementRect = moveElement.getBoundingClientRect()
        
        // Check if element is outside the visible area
        const isAbove = elementRect.top < containerRect.top
        const isBelow = elementRect.bottom > containerRect.bottom
        
        if (isAbove || isBelow) {
          // Calculate scroll position to center the element in view
          const elementOffsetTop = moveElement.offsetTop
          const containerHeight = container.clientHeight
          const elementHeight = moveElement.offsetHeight
          
          // Calculate desired scroll position (center the element)
          const desiredScrollTop = elementOffsetTop - (containerHeight / 2) + (elementHeight / 2)
          
          // Smooth scroll within the container only
          container.scrollTo({
            top: desiredScrollTop,
            behavior: 'smooth'
          })
        }
      }
    }
  }, [currentMoveIndex])

  // Auto-scroll to bottom when a new move is added (user is at the latest move)
  useEffect(() => {
    if (scrollRef.current && moves.length > 0) {
      const isAtLatestMove = currentMoveIndex === null || currentMoveIndex === moves.length - 1
      if (isAtLatestMove) {
        // Scroll to bottom to show the latest move
        const container = scrollRef.current
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        })
      }
    }
  }, [moves.length, currentMoveIndex])

  const handleFirstMove = () => {
    if (onMoveClick && moves.length > 0) {
      onMoveClick(-1) // Go to start position
    }
  }

  const handlePreviousMove = () => {
    if (onMoveClick && currentMoveIndex !== null && currentMoveIndex >= 0) {
      const prevIndex = currentMoveIndex - 1
      onMoveClick(prevIndex >= 0 ? prevIndex : -1)
    }
  }

  const handleNextMove = () => {
    if (onMoveClick && moves.length > 0) {
      // If at start position (currentMoveIndex is null or -1), go to first move (index 0)
      if (currentMoveIndex === null || currentMoveIndex < 0) {
        onMoveClick(0)
      } else {
        const nextIndex = currentMoveIndex + 1
        if (nextIndex < moves.length) {
          onMoveClick(nextIndex)
        }
      }
    }
  }

  const handleLastMove = () => {
    if (onMoveClick && moves.length > 0) {
      onMoveClick(moves.length - 1)
    }
  }

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle keyboard events if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target.isContentEditable
      ) {
        return
      }

      // Only handle if moves exist and onMoveClick is available
      if (!moves || moves.length === 0 || !onMoveClick) {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          // Previous move
          if (currentMoveIndex !== null && currentMoveIndex >= 0) {
            const prevIndex = currentMoveIndex - 1
            onMoveClick(prevIndex >= 0 ? prevIndex : -1)
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          // Next move
          if (currentMoveIndex === null || currentMoveIndex < 0) {
            onMoveClick(0)
          } else {
            const nextIndex = currentMoveIndex + 1
            if (nextIndex < moves.length) {
              onMoveClick(nextIndex)
            }
          }
          break
        case 'Home':
          e.preventDefault()
          // First move (start position)
          onMoveClick(-1)
          break
        case 'End':
          e.preventDefault()
          // Last move
          if (moves.length > 0) {
            onMoveClick(moves.length - 1)
          }
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [moves, currentMoveIndex, onMoveClick])

  const formatMove = (move) => {
    if (!move) return ''
    let san = move.san || ''
    
    // Keep capture indicator as simple 'x' text
    // No special styling needed
    
    // Keep check/checkmate indicators as simple text
    // No special styling needed
    
    return san
  }

  const getQualityIcon = (quality) => {
    switch (quality) {
      case 'brilliant':
        return <Sparkles size={14} />
      case 'great':
        return <Zap size={14} />
      case 'best':
        return <Star size={14} />
      case 'excellent':
        return <CheckCircle size={14} />
      case 'good':
        return <ThumbsUp size={14} />
      case 'book':
        return <BookOpen size={14} />
      case 'inaccuracy':
        return <AlertTriangle size={14} />
      case 'mistake':
        return <HelpCircle size={14} />
      case 'miss':
        return <XCircle size={14} />
      case 'blunder':
        return <AlertCircle size={14} />
      default:
        return null
    }
  }

  if (!moves || moves.length === 0) {
    return (
      <div className="move-history">
        <div className="move-history-header">
          <h3 className="move-history-title">Move History</h3>
        </div>
        <div className="move-history-empty">
          <p>No moves yet</p>
        </div>
      </div>
    )
  }

  const movePairs = []
  for (let i = 0; i < moves.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1
    const whiteMove = moves[i]
    const blackMove = moves[i + 1]
    movePairs.push({ moveNumber, whiteMove, blackMove })
  }

  const canGoBack = currentMoveIndex !== null && currentMoveIndex > 0
  const canGoForward = currentMoveIndex === null || currentMoveIndex < 0 || (currentMoveIndex !== null && currentMoveIndex < moves.length - 1)
  const isAtStart = currentMoveIndex === null || currentMoveIndex < 0
  const isAtEnd = currentMoveIndex !== null && currentMoveIndex === moves.length - 1

  return (
    <div className="move-history">
      <div className="move-history-header">
        <h3 className="move-history-title">Move History</h3>
        <div className="move-history-controls">
          <button
            className="move-history-nav-btn"
            onClick={handleFirstMove}
            disabled={isAtStart}
            title="First move"
          >
            <SkipBack size={16} />
          </button>
          <button
            className="move-history-nav-btn"
            onClick={handlePreviousMove}
            disabled={!canGoBack}
            title="Previous move"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="move-history-nav-btn"
            onClick={handleNextMove}
            disabled={!canGoForward}
            title="Next move"
          >
            <ChevronRight size={16} />
          </button>
          <button
            className="move-history-nav-btn"
            onClick={handleLastMove}
            disabled={isAtEnd}
            title="Last move"
          >
            <SkipForward size={16} />
          </button>
        </div>
      </div>
      <div className="move-history-list" ref={scrollRef}>
        {movePairs.map((pair, index) => {
          const whiteMoveIndex = index * 2
          const blackMoveIndex = index * 2 + 1
          const isWhiteCurrent = currentMoveIndex === whiteMoveIndex
          const isBlackCurrent = currentMoveIndex === blackMoveIndex

          const whiteQuality = moveQuality.find(mq => mq.move === whiteMoveIndex + 1)?.quality
          const blackQuality = pair.blackMove ? moveQuality.find(mq => mq.move === blackMoveIndex + 1)?.quality : null

          return (
            <div key={index} className="move-history-pair">
              <span className="move-history-number">{pair.moveNumber}.</span>
              <button
                className={`move-history-move move-history-white ${isWhiteCurrent ? 'move-history-current' : ''}`}
                onClick={() => onMoveClick && onMoveClick(whiteMoveIndex)}
                data-move-index={whiteMoveIndex}
              >
                <span className="move-history-move-text" dangerouslySetInnerHTML={{ __html: formatMove(pair.whiteMove) || '...' }} />
                {whiteQuality && (
                  <span className={`move-quality-icon move-quality-icon-${whiteQuality}`}>
                    {getQualityIcon(whiteQuality)}
                  </span>
                )}
              </button>
              {pair.blackMove && (
                <button
                  className={`move-history-move move-history-black ${isBlackCurrent ? 'move-history-current' : ''}`}
                  onClick={() => onMoveClick && onMoveClick(blackMoveIndex)}
                  data-move-index={blackMoveIndex}
                >
                  <span className="move-history-move-text" dangerouslySetInnerHTML={{ __html: formatMove(pair.blackMove) }} />
                  {blackQuality && (
                    <span className={`move-quality-icon move-quality-icon-${blackQuality}`}>
                      {getQualityIcon(blackQuality)}
                    </span>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

