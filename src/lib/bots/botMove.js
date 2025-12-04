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
 * Calculate blunder probability based on Elo rating
 * Lower Elo = more blunders, higher Elo = fewer blunders
 * Elo range: 1350-2850, maps to blunder probability 0.4-0.05
 */
function calculateBlunderProbabilityFromElo(elo) {
  // Normalize Elo to 0-1 range (1350-2850)
  const normalizedElo = (elo - 1350) / (2850 - 1350)
  // Lower Elo = higher blunder probability
  // 1350 Elo = 0.4 (40% blunder chance)
  // 2850 Elo = 0.05 (5% blunder chance)
  const baseBlunderProb = 0.4 - (normalizedElo * 0.35)
  return Math.max(0.05, Math.min(0.4, baseBlunderProb))
}

/**
 * Calculate blunder probability based on position characteristics and Elo
 * Elo determines base probability, position determines adjustments
 */
function calculateBlunderProbability(candidates, moveCount, gamePhase, elo) {
  if (candidates.length < 2) {
    return 0 // No blunder if only one candidate
  }

  // Start with Elo-based blunder probability
  let blunderProb = calculateBlunderProbabilityFromElo(elo)

  // Factor 1: Evaluation gap between best and second best
  // Smaller gap = easier to "accidentally" pick wrong move
  const bestScore = candidates[0].score
  const secondBestScore = candidates[1].score
  const scoreGap = Math.abs(bestScore - secondBestScore)
  
  // If moves are very close (within 50 centipawns), increase blunder chance
  // Lower Elo bots are more affected by this
  const eloFactor = (2850 - elo) / 1500 // 0-1, higher for lower Elo
  if (scoreGap < 50) {
    blunderProb *= (1.0 + 0.8 * eloFactor) // Lower Elo = more affected
  } else if (scoreGap < 100) {
    blunderProb *= (1.0 + 0.4 * eloFactor)
  } else if (scoreGap < 200) {
    blunderProb *= (1.0 + 0.2 * eloFactor)
  }

  // Factor 2: Number of candidate moves (more choices = harder decision)
  // Lower Elo bots struggle more with many options
  if (candidates.length >= 5) {
    blunderProb *= (1.0 + 0.3 * eloFactor)
  } else if (candidates.length >= 4) {
    blunderProb *= (1.0 + 0.15 * eloFactor)
  }

  // Factor 3: Game phase (more blunders in opening/middlegame, fewer in endgame)
  if (gamePhase === 'opening') {
    blunderProb *= (1.0 + 0.2 * eloFactor)
  } else if (gamePhase === 'endgame') {
    blunderProb *= (1.0 - 0.3 * eloFactor) // Fewer blunders in endgame, especially for higher Elo
  }

  // Factor 4: Position complexity (more pieces = more complexity)
  // Lower Elo bots struggle more in complex positions
  if (moveCount > 30) {
    blunderProb *= (1.0 + 0.15 * eloFactor)
  } else if (moveCount < 10) {
    blunderProb *= (1.0 - 0.1 * eloFactor)
  }

  // Cap the probability
  return Math.min(0.95, Math.max(0.05, blunderProb))
}

/**
 * Determine blunder severity based on Elo
 * Lower Elo = worse blunders (picks worse moves)
 */
function getBlunderSeverity(elo, candidates) {
  const normalizedElo = (elo - 1350) / (2850 - 1350) // 0-1
  
  // Lower Elo = more severe blunders
  // 1350 Elo: might pick 3rd-5th best
  // 2000 Elo: might pick 2nd-3rd best
  // 2850 Elo: only picks 2nd best occasionally
  
  if (normalizedElo < 0.3) {
    // Very low Elo (1350-1800): can pick from top 5
    return Math.min(5, candidates.length)
  } else if (normalizedElo < 0.6) {
    // Medium Elo (1800-2300): picks from top 3
    return Math.min(3, candidates.length)
  } else {
    // High Elo (2300-2850): only picks 2nd best
    return Math.min(2, candidates.length)
  }
}

/**
 * Determine game phase based on move count and material
 */
function getGamePhase(board) {
  const moveCount = board.history().length
  const material = board.fen().split(' ')[0]
  const queens = (material.match(/q/g) || []).length
  const rooks = (material.match(/r/g) || []).length
  
  if (moveCount < 15) {
    return 'opening'
  } else if (queens === 0 || (queens <= 1 && rooks <= 2)) {
    return 'endgame'
  } else {
    return 'middlegame'
  }
}

/**
 * Choose move with personality using Stockfish engine
 * Uses Elo-based strength limiting + intelligent blunder detection
 */
export async function chooseMoveWithPersonality(board, personality, engine) {
  const legalMoves = board.moves({ verbose: true })
  if (legalMoves.length === 0) {
    return null
  }

  const elo = parseInt(personality.elo || 2000)
  const depth = parseInt(personality.depth || 0)
  const maxMs = parseInt(personality.max_ms || 350)

  // If no engine provided, use fallback
  if (!engine || !engine.getIsReady()) {
    // Use a simple fallback - pick a reasonable move
    // Convert Elo to blunder rate for fallback (lower Elo = higher blunder rate)
    const fallbackBlunderRate = calculateBlunderProbabilityFromElo(elo)
    const fallbackMove = fallbackHeuristicMove(board, fallbackBlunderRate)
    return fallbackMove ? `${fallbackMove.from}${fallbackMove.to}${fallbackMove.promotion || ''}` : null
  }

  try {
    const fen = board.fen()
    
    // Configure engine strength based on Elo
    if (engine.setStrength) {
      try {
        // Clamp Elo to Stockfish's supported range (1350-2850)
        const clampedElo = Math.max(1350, Math.min(2850, elo))
        await engine.setStrength(true, clampedElo)
      } catch (e) {
        // If setting strength fails, continue without limiting
        console.warn('Failed to set engine strength:', e)
      }
    }
    
    // Set multipv to get multiple candidate moves
    // Lower Elo = more candidates needed (they might pick worse moves)
    const multipvCount = elo < 1800 ? 5 : elo < 2200 ? 4 : 3
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
      const fallbackBlunderRate = calculateBlunderProbabilityFromElo(elo)
      const fallbackMove = fallbackHeuristicMove(board, fallbackBlunderRate)
      return fallbackMove ? `${fallbackMove.from}${fallbackMove.to}${fallbackMove.promotion || ''}` : null
    }

    // Sort candidates by score (best first)
    candidates.sort((a, b) => b.score - a.score)
    
    // Calculate blunder probability based on Elo and position
    const gamePhase = getGamePhase(board)
    const blunderProbability = calculateBlunderProbability(
      candidates,
      legalMoves.length,
      gamePhase,
      elo
    )
    
    // Use a deterministic seed based on position + Elo to make it consistent
    // Same position + same Elo = same decision
    const positionHash = fen.split(' ').slice(0, 4).join('').replace(/[^a-zA-Z0-9]/g, '')
    let seed = elo // Start with Elo
    for (let i = 0; i < positionHash.length; i++) {
      seed = ((seed << 5) - seed) + positionHash.charCodeAt(i)
      seed = seed & seed // Convert to 32bit integer
    }
    // Use seed to create a deterministic value between 0 and 1
    const deterministicValue = Math.abs(Math.sin(seed)) % 1
    
    // Decide whether to blunder based on Elo-determined probability
    if (deterministicValue < blunderProbability && candidates.length > 1) {
      // We're going to blunder - severity determined by Elo
      const blunderSeverity = getBlunderSeverity(elo, candidates)
      
      // Lower Elo = picks from worse moves
      // Get evaluation gap to determine how bad the blunder should be
      const bestScore = candidates[0].score
      const worstCandidateScore = candidates[Math.min(blunderSeverity - 1, candidates.length - 1)].score
      const scoreRange = bestScore - worstCandidateScore
      
      // Pick a move from the blunder range based on Elo
      // Lower Elo = more likely to pick worse moves
      const normalizedElo = (elo - 1350) / (2850 - 1350) // 0-1
      const blunderIndex = Math.floor(
        (1 - normalizedElo) * (blunderSeverity - 1) + 1
      )
      
      // Ensure we don't pick the best move
      const selectedIndex = Math.min(blunderIndex, candidates.length - 1)
      return candidates[selectedIndex].uci
    } else {
      // Play normally - choose best move
      return candidates[0].uci
    }
  } catch (error) {
    // On any engine problem, fall back to simple heuristic
    const fallbackBlunderRate = calculateBlunderProbabilityFromElo(elo)
    const fallbackMove = fallbackHeuristicMove(board, fallbackBlunderRate)
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

