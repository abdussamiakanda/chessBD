// Chess helper functions for engine
import { Chess } from "chess.js"

export const getIsStalemate = (fen) => {
  const game = new Chess(fen)
  return game.isStalemate()
}

export const getWhoIsCheckmated = (fen) => {
  const game = new Chess(fen)
  if (!game.isCheckmate()) return null
  return game.turn()
}

