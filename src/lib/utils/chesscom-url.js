/**
 * Chess.com URL parsing utilities
 * 
 * Club ID is always 409461
 * Arena URLs: https://www.chess.com/play/arena/{tournament_id}?clubId=409461
 */

const CHESSBD_CLUB_ID = '409461'

/**
 * Extract tournament ID from Chess.com arena URL
 * @param {string} url - Chess.com arena URL (e.g., https://www.chess.com/play/arena/4538135?clubId=409461)
 * @returns {string|null} Tournament ID in name-id format if possible, or numeric ID, or null if not found
 */
export function extractTournamentIdFromUrl(url) {
  if (!url) return null

  try {
    // Match tournament URLs with name-id format: /tournament/{name-id}
    // e.g., https://www.chess.com/tournament/live/arena/nmsdsdsd-4538327
    const nameIdMatch = url.match(/\/tournament\/[^\/]+\/([a-zA-Z0-9_-]+-\d+)/)
    if (nameIdMatch && nameIdMatch[1]) {
      return nameIdMatch[1]
    }

    // Match arena URLs: /play/arena/{tournament_id} (numeric only)
    const arenaMatch = url.match(/\/play\/arena\/(\d+)/)
    if (arenaMatch && arenaMatch[1]) {
      // Note: This returns numeric ID only. For API calls, you may need to fetch
      // the tournament name first to construct the full name-id format.
      return arenaMatch[1]
    }

    // Match other tournament URLs if needed
    // e.g., /tournament/{tournament_id}
    const tournamentMatch = url.match(/\/tournament\/(\d+)/)
    if (tournamentMatch && tournamentMatch[1]) {
      return tournamentMatch[1]
    }

    return null
  } catch (error) {
    console.error('[Chess.com URL] Error parsing URL:', error)
    return null
  }
}

/**
 * Get the ChessBD club ID (always 409461)
 * @returns {string} Club ID
 */
export function getClubId() {
  return CHESSBD_CLUB_ID
}

/**
 * Build a Chess.com arena URL from tournament ID
 * @param {string} tournamentId - Tournament ID
 * @returns {string} Full Chess.com arena URL
 */
export function buildArenaUrl(tournamentId) {
  return `https://www.chess.com/play/arena/${tournamentId}?clubId=${CHESSBD_CLUB_ID}`
}

/**
 * Parse Chess.com link and extract club ID and tournament ID
 * @param {string} url - Chess.com URL
 * @returns {{clubId: string, tournamentId: string|null}|null} Object with clubId and tournamentId, or null if parsing fails
 */
export function parseChesscomUrl(url) {
  if (!url) return null

  try {
    // Extract tournament ID
    const tournamentId = extractTournamentIdFromUrl(url)
    
    // Extract club ID from URL parameter or use default
    const urlParams = new URLSearchParams(url.split('?')[1] || '')
    const clubIdFromUrl = urlParams.get('clubId')
    const clubId = clubIdFromUrl || CHESSBD_CLUB_ID

    return {
      clubId,
      tournamentId,
    }
  } catch (error) {
    console.error('[Chess.com URL] Error parsing URL:', error)
    return null
  }
}

