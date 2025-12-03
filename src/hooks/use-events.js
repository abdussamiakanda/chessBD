import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useEvents(filters) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => api.getEvents(filters),
    staleTime: 30000, // 30 seconds
  })
}

export function useEvent(id) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: () => api.getEvent(id),
    enabled: !!id,
    staleTime: 30000,
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (eventData) => api.createEvent(eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, updates }) => api.updateEvent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

