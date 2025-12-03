// Local bot move logic - ported from bots.py
import { Chess } from 'chess.js'

// Piece values for evaluation
const PIECE_VALUES = {
  'p': 1,
  'n': 3,
  'b': 3,
  'r': 5,
  'q': 9,
  'k': 0,
}

/**
 * Evaluate a move heuristically
 */
function evaluateMove(board, move) {
  let score = 0
  
  // Captures are good (especially if capturing higher value piece)
  if (move.captured) {
    const capturedPiece = move.captured.toLowerCase()
    score += PIECE_VALUES[capturedPiece] || 0
  }
  
  // Checks are good
  const testBoard = new Chess(board.fen())
  testBoard.move(move)
  if (testBoard.inCheck()) {
    score += 2
  }
  
  // Center control (e4, e5, d4, d5)
  const centerSquares = ['e4', 'e5', 'd4', 'd5']
  if (centerSquares.includes(move.to)) {
    score += 0.5
  }
  
  // Piece development (moving knights/bishops from starting squares)
  if ((move.piece === 'n' || move.piece === 'b') && 
      (move.from[1] === '1' || move.from[1] === '8')) {
    score += 0.3
  }
  
  return score
}

/**
 * Fallback heuristic move when engine fails
 * Improved version with better move evaluation
 */
function fallbackHeuristicMove(board, blunderLevel) {
  const legalMoves = board.moves({ verbose: true })
  if (legalMoves.length === 0) {
    return null
  }

  // Evaluate all moves
  const evaluatedMoves = legalMoves.map(move => ({
    move,
    score: evaluateMove(board, move),
  }))
  
  // Sort by score (highest first)
  evaluatedMoves.sort((a, b) => b.score - a.score)

  if (Math.random() < blunderLevel) {
    // Random move (blunder) - severity based on blunderLevel
    const r = Math.random()
    
    // For high blunder levels, more likely to pick truly bad moves
    if (blunderLevel > 0.3) {
      if (r < 0.5 && evaluatedMoves.length > 2) {
        // Pick from bottom third
        const bottomThird = evaluatedMoves.slice(Math.floor(evaluatedMoves.length * 0.67))
        return bottomThird[Math.floor(Math.random() * bottomThird.length)].move
      } else if (r < 0.8 && evaluatedMoves.length > 1) {
        // Pick from bottom half
        const bottomHalf = evaluatedMoves.slice(Math.floor(evaluatedMoves.length / 2))
        return bottomHalf[Math.floor(Math.random() * bottomHalf.length)].move
      }
    } else if (blunderLevel > 0.2) {
      // Medium blunder: sometimes pick from bottom half
      if (r < 0.4 && evaluatedMoves.length > 1) {
        const bottomHalf = evaluatedMoves.slice(Math.floor(evaluatedMoves.length / 2))
        return bottomHalf[Math.floor(Math.random() * bottomHalf.length)].move
      }
    }
    
    // Random move (any move)
    return legalMoves[Math.floor(Math.random() * legalMoves.length)]
  } else {
    // Prefer good moves, but add some randomness based on blunder level
    const topCount = blunderLevel < 0.15 ? 2 : blunderLevel < 0.25 ? 3 : 4
    const topMoves = evaluatedMoves.slice(0, Math.min(topCount, evaluatedMoves.length))
    return topMoves[Math.floor(Math.random() * topMoves.length)].move
  }
}

/**
 * Choose move with personality using Stockfish engine
 * Similar to choose_move_with_personality in bots.py
 */
export async function chooseMoveWithPersonality(board, personality, engine) {
  const legalMoves = board.moves({ verbose: true })
  if (legalMoves.length === 0) {
    return null
  }

  const blunderLevel = parseFloat(personality.blunder_level || 0.3)
  const depth = parseInt(personality.depth || 0)
  const maxMs = parseInt(personality.max_ms || 350)

  // If no engine provided, use fallback
  if (!engine || !engine.getIsReady()) {
    const fallbackMove = fallbackHeuristicMove(board, blunderLevel)
    return fallbackMove ? `${fallbackMove.from}${fallbackMove.to}${fallbackMove.promotion || ''}` : null
  }

  try {
    const fen = board.fen()
    
    // Set multipv to get multiple candidate moves
    // Use more candidates for higher blunder levels (more variety)
    const multipvCount = blunderLevel > 0.3 ? 5 : blunderLevel > 0.2 ? 4 : 3
    if (engine.setMultiPv) {
      try {
        await engine.setMultiPv(multipvCount)
      } catch (e) {
        // If setting multipv fails, continue with default
      }
    }
    
    // Use depth if specified, otherwise use time-based
    let evaluation
    if (depth > 0) {
      evaluation = await engine.evaluatePosition(fen, depth)
    } else {
      // For time-based, calculate depth based on max_ms
      // Higher max_ms = deeper search, but cap it reasonably
      const timeBasedDepth = Math.max(8, Math.min(14, Math.floor(maxMs / 25)))
      evaluation = await engine.evaluatePosition(fen, timeBasedDepth)
    }

    // Get candidate moves from evaluation lines
    const candidates = []
    if (evaluation.lines && evaluation.lines.length > 0) {
      for (const line of evaluation.lines) {
        if (line.pv && line.pv.length > 0) {
          const moveUci = line.pv[0]
          // Validate move is legal
          const move = legalMoves.find(m => {
            const moveUciStr = `${m.from}${m.to}${m.promotion || ''}`
            return moveUciStr === moveUci
          })
          if (move && !candidates.find(c => c.uci === moveUci)) {
            candidates.push({
              uci: moveUci,
              move: move,
              score: line.cp || 0,
            })
          }
        }
      }
    }

    // Fallback to bestMove if no candidates from lines
    if (candidates.length === 0 && evaluation.bestMove) {
      const move = legalMoves.find(m => 
        `${m.from}${m.to}${m.promotion || ''}` === evaluation.bestMove
      )
      if (move) {
        candidates.push({
          uci: evaluation.bestMove,
          move: move,
          score: 0,
        })
      }
    }

    // If still no candidates, use fallback
    if (candidates.length === 0) {
      const fallbackMove = fallbackHeuristicMove(board, blunderLevel)
      return fallbackMove ? `${fallbackMove.from}${fallbackMove.to}${fallbackMove.promotion || ''}` : null
    }

    // Sort candidates by score (best first)
    candidates.sort((a, b) => b.score - a.score)
    
    // Decide which candidate to play based on blunder_level
    // blunder_level is the probability of NOT playing the best move
    const r = Math.random()
    
    // If we should play best move (most of the time for low blunder levels)
    if (r > blunderLevel || candidates.length === 1) {
      // For very strong bots (blunder_level < 0.1), always play best
      if (blunderLevel < 0.1) {
        return candidates[0].uci
      }
      
      // For strong bots (blunder_level < 0.2), occasionally play 2nd best for variety
      if (blunderLevel < 0.2 && candidates.length > 1 && Math.random() < 0.05) {
        return candidates[1].uci
      }
      
      // For medium bots, small chance to play 2nd best
      if (candidates.length > 1 && Math.random() < 0.08) {
        return candidates[1].uci
      }
      
      return candidates[0].uci
    } else {
      // Within "blunder zone" - we're going to play a suboptimal move
      const r2 = Math.random()
      
      if (r2 < 0.5 && candidates.length > 1) {
        // 50% chance: Play from top 3 candidates (mild blunder)
        const topCandidates = candidates.slice(0, Math.min(3, candidates.length))
        // Prefer 2nd and 3rd best, but sometimes include best for variety
        const weakerCandidates = topCandidates.slice(1)
        if (weakerCandidates.length > 0) {
          return weakerCandidates[Math.floor(Math.random() * weakerCandidates.length)].uci
        }
        return topCandidates[Math.floor(Math.random() * topCandidates.length)].uci
      } else if (r2 < 0.75) {
        // 25% chance: Use fallback heuristic (moderate blunder)
        // Use a scaled blunder level for the fallback
        const fallbackBlunderLevel = Math.min(0.3, blunderLevel * 1.5)
        const fallbackMove = fallbackHeuristicMove(board, fallbackBlunderLevel)
        if (fallbackMove) {
          return `${fallbackMove.from}${fallbackMove.to}${fallbackMove.promotion || ''}`
        }
        // If fallback fails, use random move
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)]
        return `${randomMove.from}${randomMove.to}${randomMove.promotion || ''}`
      } else {
        // 25% chance: Big blunder - random legal move
        // For very high blunder levels, make this more likely
        if (blunderLevel > 0.3 && Math.random() < 0.5) {
          // Extra random move for high blunder bots
          const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)]
          return `${randomMove.from}${randomMove.to}${randomMove.promotion || ''}`
        }
        // Otherwise, use fallback heuristic
        const fallbackMove = fallbackHeuristicMove(board, Math.min(0.5, blunderLevel * 2))
        if (fallbackMove) {
          return `${fallbackMove.from}${fallbackMove.to}${fallbackMove.promotion || ''}`
        }
        // Last resort: random move
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)]
        return `${randomMove.from}${randomMove.to}${randomMove.promotion || ''}`
      }
    }
    
    // Fallback (should never reach here, but just in case)
    return candidates[0]?.uci || legalMoves[0] ? `${legalMoves[0].from}${legalMoves[0].to}${legalMoves[0].promotion || ''}` : null
  } catch (error) {
    // On any engine problem, fall back to simple heuristic
    const fallbackMove = fallbackHeuristicMove(board, blunderLevel)
    return fallbackMove ? `${fallbackMove.from}${fallbackMove.to}${fallbackMove.promotion || ''}` : null
  }
}

/**
 * Generate annotated PGN with player information
 */
function generateAnnotatedPGN(board, botColor) {
  const history = board.history({ verbose: true })
  if (history.length === 0) {
    return ''
  }

  const userColor = botColor === 'w' ? 'b' : 'w'
  let annotatedPGN = ''
  
  for (let i = 0; i < history.length; i++) {
    const move = history[i]
    const moveNumber = Math.floor(i / 2) + 1
    const isWhiteMove = i % 2 === 0
    const moveColor = isWhiteMove ? 'w' : 'b'
    const player = moveColor === botColor ? 'Bot' : 'User'
    
    if (isWhiteMove) {
      annotatedPGN += `${moveNumber}. ${move.san} {${player}}`
    } else {
      annotatedPGN += ` ${move.san} {${player}}`
    }
    
    if (i < history.length - 1) {
      annotatedPGN += ' '
    }
    }
   
  return annotatedPGN
}

/**
 * Get personalized message from API based on bot description and game PGN
 */
async function getPersonalizedMessage(botDescription, board, botColor) {
  try {
    // Generate annotated PGN with player information
    const annotatedPGN = generateAnnotatedPGN(board, botColor)
    
    if (!annotatedPGN) {
      return null
    }

    // Determine which player made the last move
    const history = board.history({ verbose: true })
    const lastMoveIndex = history.length - 1
    const isLastMoveWhite = lastMoveIndex % 2 === 0
    const lastMoveColor = isLastMoveWhite ? 'w' : 'b'
    const lastMovePlayer = lastMoveColor === botColor ? 'Bot' : 'User'
    
    // Get API key from environment variable
    const apiKey = import.meta.env.VITE_GROK_API_KEY
    if (!apiKey) {
      throw new Error('Groq API key not found')
    }

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a chess bot with this personality: "${botDescription}". Reply ONLY in Bangla, no English please! (only when needed like when explaining a move), 1–2 short lines, use personality-appropriate metaphors and language, light roasting but not vulgar.`
          },
          {
            role: 'user',
            content: `Here is a chess game PGN where each move is annotated with who made it (User or Bot):
${annotatedPGN}

The last move was made by: ${lastMovePlayer}
${lastMovePlayer === 'User' ? 'React to the user\'s last move.' : 'The last move was made by you, you can comment on it.'}

Reply in Bangla only, 1-2 short lines.`
          }
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    // Extract message from Groq API response structure
    const message = data.choices?.[0]?.message?.content
    if (message && typeof message === 'string') {
      return message.trim()
    }
    throw new Error('Invalid response format')
  } catch (error) {
    // Return null on error, will use fallback
    if (error.name !== 'AbortError') {
      // Silently fail - we'll use fallback messages
    }
    return null
  }
}

/**
 * Pick message based on game state and personality
 * Similar to pick_message in bots.py
 * Now uses API for personalized messages
 */
export async function pickMessage(board, personality, botColor = null, botDescription = null) {
  // Try to get personalized message from API if we have bot description, bot color, and moves
  if (botDescription && botColor && board.history().length > 0) {
    // Check if the last move was made by the user (not the bot)
    const history = board.history({ verbose: true })
    const lastMoveIndex = history.length - 1
    const isLastMoveWhite = lastMoveIndex % 2 === 0
    const lastMoveColor = isLastMoveWhite ? 'w' : 'b'
    const lastMovePlayer = lastMoveColor === botColor ? 'Bot' : 'User'
    
    // Only call API if the last move was made by the user
    if (lastMovePlayer === 'User') {
      try {
        const apiMessage = await getPersonalizedMessage(botDescription, board, botColor)
        if (apiMessage) {
          return apiMessage
        }
      } catch (error) {
        // Fall through to placeholder messages
      }
    }
  }

  // Fallback to placeholder messages
  // Not game over yet
  if (!board.isGameOver()) {
    const msgs = personality.midgame || ["Your move!"]
    if (msgs.length > 0) {
      return msgs[Math.floor(Math.random() * msgs.length)]
    }
    return "Your move!"
  }

  // Game is over - determine result
  let result
  if (board.isCheckmate()) {
    result = board.turn() === 'w' ? '0-1' : '1-0'
  } else if (board.isDraw()) {
    result = '1/2-1/2'
  } else {
    result = '1/2-1/2'
  }

  // If we don't know bot_color, just use generic game_over list
  if (botColor === null) {
    const msgs = (
      personality.game_over ||
      personality.game_over_win ||
      personality.game_over_loss ||
      ["GG!"]
    )
    if (msgs.length > 0) {
      return msgs[Math.floor(Math.random() * msgs.length)]
    }
    return "GG!"
  }

  let botWon = null
  if (result === '1-0' || result === '0-1') {
    if ((result === '1-0' && botColor === 'w') ||
        (result === '0-1' && botColor === 'b')) {
      botWon = true
    } else {
      botWon = false
    }
  } else {
    botWon = null // draw
  }

  let msgs
  if (botWon === true) {
    msgs = (
      personality.game_over_win ||
      personality.game_over ||
      ["GG, I won this one!"]
    )
  } else if (botWon === false) {
    msgs = (
      personality.game_over_loss ||
      personality.game_over ||
      ["GG, you got me this time!"]
    )
  } else {
    msgs = (
      personality.game_over_draw ||
      personality.game_over ||
      ["Draw! Good fight 💪"]
    )
  }

  if (msgs.length > 0) {
    return msgs[Math.floor(Math.random() * msgs.length)]
  }
  return "GG!"
}

