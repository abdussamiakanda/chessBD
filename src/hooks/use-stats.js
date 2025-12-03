import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      try {
        return await api.getStats()
      } catch (error) {
        console.error('Error fetching stats:', error)
        throw error
      }
    },
    staleTime: 60000, // Cache for 1 minute
    retry: 2,
    refetchOnWindowFocus: false,
  })
}

