import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function usePlayer(username) {
  return useQuery({
    queryKey: ['player', username],
    queryFn: () => api.getPlayer(username),
    enabled: !!username,
    staleTime: 300000, // 5 minutes
  })
}

export function usePlayerGames(username) {
  return useQuery({
    queryKey: ['player-games', username],
    queryFn: () => api.getPlayerGames(username),
    enabled: !!username,
    staleTime: 60000, // 1 minute (matching chessbd)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })
}

