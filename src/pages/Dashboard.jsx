import { useState, useEffect, useMemo } from 'react'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { useAuthStore } from '../store/auth-store'
import { useEvents, useCreateEvent, useUpdateEvent } from '../hooks/use-events'
import { api } from '../lib/api'
import { useToastStore } from '../store/toast-store'
import { AuthGate } from '../components/auth/AuthGate'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Users, Calendar, Edit2, Trash2, Search, Newspaper, Plus, X, Video, Quote, Handshake, Briefcase, UsersRound, CheckCircle2, XCircle, Club as ClubIcon } from 'lucide-react'
// Types removed for JSX
import { formatLocalDate, formatEventDate } from '../lib/utils/date-format'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { generateClubApprovalEmail, generateClubRemovalEmail } from '../lib/utils/club-email'
import './Dashboard.css'

export function Dashboard() {
  useSEO({
    title: 'Admin Dashboard',
    description: 'Manage ChessBD events, news, and platform settings. Admin-only access to tournament and content management.',
    url: '/dashboard',
  })
  return (
    <AuthGate requireAdmin>
      <DashboardContent />
    </AuthGate>
  )
}

function DashboardContent() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('events')
  
  return (
    <Container>
      <div className="dashboard-py-6 dashboard-sm-py-12">
        <div className="dashboard-mb-6 dashboard-sm-mb-8">
          <div className="dashboard-mb-6 dashboard-sm-mb-8 dashboard-text-center">
            <h1 className="dashboard-flex dashboard-items-center dashboard-justify-center dashboard-gap-2 dashboard-sm-gap-3 dashboard-mb-3 dashboard-sm-mb-4 dashboard-text-3xl dashboard-sm-text-5xl dashboard-md-text-6xl dashboard-font-black gradient-text drop-shadow-2xl">
              <Settings className="dashboard-w-8 dashboard-h-8 dashboard-sm-w-10 dashboard-sm-h-10 dashboard-md-w-12 dashboard-md-h-12" style={{ color: 'var(--color-bg-active)' }} />
              {t('dashboard.title')}
            </h1>
          </div>
          
          {/* Tabs */}
          <div className="dashboard-tabs-container dashboard-overflow-x-auto">
            {[
              { id: 'events', label: t('dashboard.tabs.events'), icon: Calendar },
              { id: 'users', label: t('dashboard.tabs.users'), icon: Users },
              { id: 'news', label: t('dashboard.tabs.news'), icon: Newspaper },
              { id: 'streams', label: t('dashboard.tabs.streams'), icon: Video },
              { id: 'testimonials', label: t('dashboard.tabs.testimonials'), icon: Quote },
              { id: 'partners', label: t('dashboard.tabs.partners'), icon: Handshake },
              { id: 'jobs', label: t('dashboard.tabs.jobs'), icon: Briefcase },
              { id: 'clubs', label: t('dashboard.tabs.clubs'), icon: UsersRound },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                <tab.icon className="dashboard-tab-icon" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'events' && <EventsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'news' && <NewsTab />}
        {activeTab === 'streams' && <ManualStreamsTab />}
        {activeTab === 'testimonials' && <TestimonialsTab />}
        {activeTab === 'partners' && <PartnersTab />}
        {activeTab === 'jobs' && <JobsTab />}
        {activeTab === 'clubs' && <ClubsTab />}
      </div>
    </Container>
  )
}

function EventsTab() {
  const { user } = useAuthStore()
  const { data: events } = useEvents()
  const createMutation = useCreateEvent()
  const updateMutation = useUpdateEvent()
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()
  const [isCreating, setIsCreating] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [syncingEventId, setSyncingEventId] = useState(null)
  const [deletingEventId, setDeletingEventId] = useState(null)
  const [selectedPlatform, setSelectedPlatform] = useState('chesscom')
  const [editingPlatform, setEditingPlatform] = useState('chesscom')
  
  // Update editing platform when editing event changes
  useEffect(() => {
    if (editingEvent) {
      setEditingPlatform(editingEvent.platform || 'chesscom')
    }
  }, [editingEvent])

  const deleteMutation = useMutation({
    mutationFn: (eventId) => api.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      addToast({ message: 'Event deleted successfully', type: 'success' })
      setDeletingEventId(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to delete event', type: 'error' })
      setDeletingEventId(null)
    },
  })

  const handleSync = async (eventId) => {
    setSyncingEventId(eventId)
    try {
      await api.triggerSync(eventId)
      addToast({ message: 'Sync triggered successfully', type: 'success' })
    } catch (error) {
      addToast({ message: error.message || 'Sync failed', type: 'error' })
    } finally {
      setSyncingEventId(null)
    }
  }

  const handleDelete = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }
    setDeletingEventId(eventId)
    deleteMutation.mutate(eventId)
  }

  // Helper function to convert datetime-local value to ISO string
  // Converts the input time from the event's timezone to UTC for storage
  const convertLocalToISO = (localDateTime, eventTimezone = null) => {
    if (!localDateTime) return ''
    // datetime-local format is "YYYY-MM-DDTHH:mm"
    
    if (eventTimezone) {
      // Parse the input components and create a date string
      // The input is in the event timezone, so we need to treat it as such
      const [year, month, day, hour, minute] = localDateTime.split(/[-T:]/).map(Number)
      
      // Create a date object representing this time in the event timezone
      // We'll use date-fns-tz to convert from event timezone to UTC
      // Create a date object (this will be in user's local timezone)
      // But we need to treat it as if it's in the event timezone
      const localDate = new Date(year, month - 1, day, hour, minute)
      
      // Use fromZonedTime to convert from event timezone to UTC
      // fromZonedTime takes a date and treats it as if it's in the specified timezone
      // then returns the equivalent UTC date
      const utcDate = fromZonedTime(localDate, eventTimezone)
      return utcDate.toISOString()
    } else {
      // No event timezone specified, use user's local timezone
      const date = new Date(localDateTime)
      return date.toISOString()
    }
  }

  // Helper function to convert ISO string to datetime-local format
  // Converts UTC to the event's timezone (or user's local timezone if no event timezone)
  const convertISOToLocal = (isoString, eventTimezone = null) => {
    if (!isoString) return ''
    const utcDate = new Date(isoString)
    
    if (eventTimezone) {
      // Use date-fns-tz to convert from UTC to event timezone
      const zonedDate = toZonedTime(utcDate, eventTimezone)
      
      // Format as datetime-local string (YYYY-MM-DDTHH:mm)
      const year = zonedDate.getFullYear()
      const month = String(zonedDate.getMonth() + 1).padStart(2, '0')
      const day = String(zonedDate.getDate()).padStart(2, '0')
      const hours = String(zonedDate.getHours()).padStart(2, '0')
      const minutes = String(zonedDate.getMinutes()).padStart(2, '0')
      
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } else {
      // No event timezone specified, use user's local timezone
      const year = utcDate.getFullYear()
      const month = String(utcDate.getMonth() + 1).padStart(2, '0')
      const day = String(utcDate.getDate()).padStart(2, '0')
      const hours = String(utcDate.getHours()).padStart(2, '0')
      const minutes = String(utcDate.getMinutes()).padStart(2, '0')
      
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }
  }

  const handleCreateEvent = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    
    // Convert datetime-local input to ISO string with timezone
    const startTimeInput = formData.get('start_time')
    const endTimeInput = formData.get('end_time')
    const timezone = formData.get('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone
    
    // Convert to ISO string (datetime-local gives us local time, we need to preserve it)
    // Pass the event timezone so the input is interpreted in that timezone
    const startTime = convertLocalToISO(startTimeInput, timezone)
    const endTime = convertLocalToISO(endTimeInput, timezone)
    
    const platform = (formData.get('platform')) || 'chesscom'
    
    // Parse platform-specific fields
    let chesscomLink = null
    let chesscomClubId = null
    let chesscomTournamentId = null
    
    chesscomLink = formData.get('chesscom_link') || null
    chesscomClubId = formData.get('chesscom_club_id') || null
    chesscomTournamentId = formData.get('chesscom_tournament_id') || null
    
    if (chesscomLink) {
      const { parseChesscomUrl } = await import('../lib/utils/chesscom-url')
      const parsed = parseChesscomUrl(chesscomLink)
      if (parsed) {
        chesscomClubId = chesscomClubId || parsed.clubId
        chesscomTournamentId = chesscomTournamentId || parsed.tournamentId
      }
    }
    
    // Default to fixed club ID if not provided
    if (!chesscomClubId) {
      const { getClubId } = await import('../lib/utils/chesscom-url')
      chesscomClubId = getClubId()
    }
    
    const eventData = {
      name: formData.get('name'),
      type: formData.get('type'),
      platform: platform || null,
      start_time: startTime,
      end_time: endTime,
      timezone: timezone || null,
      time_control: formData.get('time_control') || null,
      chesscom_link: chesscomLink,
      chesscom_club_id: chesscomClubId,
      chesscom_tournament_id: chesscomTournamentId,
      lichess_link: null,
      lichess_tournament_id: null,
      description: formData.get('description') || null,
      created_by: user?.id || null,
    }

    try {
      await createMutation.mutateAsync(eventData)
      addToast({ message: 'Event created successfully', type: 'success' })
      setIsCreating(false)
      
      // Reset form if it still exists
      if (form) {
        form.reset()
      }
      
      // Force refetch events
      await queryClient.refetchQueries({ queryKey: ['events'] })
    } catch (error) {
      console.error('[Dashboard] Error creating event:', error)
      addToast({ message: error.message || 'Failed to create event', type: 'error' })
    }
  }

  const handleUpdateEvent = async (e) => {
    e.preventDefault()
    if (!editingEvent) return
    
    const formData = new FormData(e.currentTarget)
    
    // Convert datetime-local input to ISO string
    const startTimeInput = formData.get('start_time')
    const endTimeInput = formData.get('end_time')
    const timezone = formData.get('timezone') || editingEvent.timezone || null
    
    const startTime = startTimeInput ? convertLocalToISO(startTimeInput, timezone) : editingEvent.start_time
    const endTime = endTimeInput ? convertLocalToISO(endTimeInput, timezone) : editingEvent.end_time
    
    const platform = (formData.get('platform')) || editingEvent.platform || 'chesscom'
    
    // Parse platform-specific fields
    let chesscomLink = null
    let chesscomClubId = null
    let chesscomTournamentId = null
    
    chesscomLink = formData.get('chesscom_link') || editingEvent.chesscom_link || null
    chesscomClubId = formData.get('chesscom_club_id') || null
    chesscomTournamentId = formData.get('chesscom_tournament_id') || null
    
    if (chesscomLink) {
      const { parseChesscomUrl } = await import('../lib/utils/chesscom-url')
      const parsed = parseChesscomUrl(chesscomLink)
      if (parsed) {
        chesscomClubId = chesscomClubId || parsed.clubId
        chesscomTournamentId = chesscomTournamentId || parsed.tournamentId
      }
    }
    
    // Default to fixed club ID if not provided
    if (!chesscomClubId) {
      const { getClubId } = await import('../lib/utils/chesscom-url')
      chesscomClubId = getClubId()
    }
    
    // Don't update status - it's calculated automatically
    const updates = {
      name: formData.get('name'),
      type: formData.get('type'),
      platform: platform || null,
      start_time: startTime,
      end_time: endTime,
      timezone: timezone || null,
      time_control: formData.get('time_control') || null,
      chesscom_link: chesscomLink,
      chesscom_club_id: chesscomClubId,
      chesscom_tournament_id: chesscomTournamentId,
      lichess_link: null,
      lichess_tournament_id: null,
      description: formData.get('description') || null,
    }

    try {
      await updateMutation.mutateAsync({ id: editingEvent.id, updates })
      addToast({ message: 'Event updated successfully', type: 'success' })
      setEditingEvent(null)
    } catch (error) {
      addToast({ message: error.message || 'Failed to update event', type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="dashboard-flex dashboard-justify-end">
        <Button onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? 'Cancel' : 'Create Event'}
        </Button>
      </div>

      {isCreating && (
        <Card>
          <h2 className="dashboard-mb-4 dashboard-text-2xl dashboard-font-bold gradient-text-secondary">Create New Event</h2>
          <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="name" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
              />
            </div>
            <div className="dashboard-grid dashboard-grid-cols-2 dashboard-gap-4">
              <div>
                <label htmlFor="type" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                  Type
                </label>
                <select
                  id="type"
                  name="type"
                  required
                  className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]"
                >
                  <option value="arena" className="bg-[var(--color-bg-secondary)]">Arena</option>
                  <option value="swiss" className="bg-[var(--color-bg-secondary)]">Swiss</option>
                  <option value="league" className="bg-[var(--color-bg-secondary)]">League</option>
                  <option value="friendly" className="bg-[var(--color-bg-secondary)]">Friendly</option>
                </select>
              </div>
              <div>
                <label htmlFor="platform" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                  Platform
                </label>
                <select
                  id="platform"
                  name="platform"
                  required
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]"
                >
                  <option value="chesscom" className="bg-[var(--color-bg-secondary)]">Chess.com</option>
                </select>
              </div>
            </div>
              <div className="dashboard-grid dashboard-grid-cols-2 dashboard-gap-4">
                <div>
                  <label htmlFor="timezone" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    name="timezone"
                    className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]"
                    defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
                  >
                    <option value="Asia/Dhaka" className="bg-[var(--color-bg-secondary)]">Asia/Dhaka (BDT)</option>
                    <option value="UTC" className="bg-[var(--color-bg-secondary)]">UTC</option>
                    <option value="America/New_York" className="bg-[var(--color-bg-secondary)]">America/New_York (EST)</option>
                    <option value="Europe/London" className="bg-[var(--color-bg-secondary)]">Europe/London (GMT)</option>
                    <option value="Asia/Dubai" className="bg-[var(--color-bg-secondary)]">Asia/Dubai (GST)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="time_control" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                    Time Control (optional)
                  </label>
                  <input
                    id="time_control"
                    name="time_control"
                    type="text"
                    placeholder="5+0"
                    className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
                  />
                </div>
              </div>
              <div className="dashboard-grid dashboard-grid-cols-2 dashboard-gap-4">
                <div>
                  <label htmlFor="start_time" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                    Start Time
                  </label>
                  <input
                    id="start_time"
                    name="start_time"
                    type="datetime-local"
                    required
                    className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label htmlFor="end_time" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                    End Time
                  </label>
                  <input
                    id="end_time"
                    name="end_time"
                    type="datetime-local"
                    required
                    className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]"
                  />
                </div>
              </div>
              {/* Platform-specific fields */}
              {selectedPlatform === 'chesscom' ? (
                <>
                  <div>
                    <label htmlFor="chesscom_link" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                      Chess.com Arena Link (optional)
                    </label>
                    <input
                      id="chesscom_link"
                      name="chesscom_link"
                      type="url"
                      placeholder="https://www.chess.com/play/arena/4538135?clubId=409461"
                      className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
                      onChange={async (e) => {
                        // Auto-populate tournament ID from URL
                        const url = e.target.value
                        if (url) {
                          const { parseChesscomUrl } = await import('../lib/utils/chesscom-url')
                          const parsed = parseChesscomUrl(url)
                          if (parsed?.tournamentId) {
                            const tournamentInput = document.getElementById('chesscom_tournament_id')
                            if (tournamentInput) {
                              tournamentInput.value = parsed.tournamentId
                            }
                          }
                        }
                      }}
                    />
                    <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
                      Paste the arena/tournament URL to auto-fill tournament ID. Club ID is always 409461.
                    </p>
                  </div>
                  <div className="dashboard-grid dashboard-grid-cols-2 dashboard-gap-4">
                    <div>
                      <label htmlFor="chesscom_club_id" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                        Chess.com Club ID (auto-filled)
                      </label>
                      <input
                        id="chesscom_club_id"
                        name="chesscom_club_id"
                        type="text"
                        defaultValue="409461"
                        readOnly
                        className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/30 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]/70 cursor-not-allowed"
                      />
                      <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">Fixed club ID for ChessBD</p>
                    </div>
                    <div>
                      <label htmlFor="chesscom_tournament_id" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                        Chess.com Tournament ID (auto-filled)
                      </label>
                      <input
                        id="chesscom_tournament_id"
                        name="chesscom_tournament_id"
                        type="text"
                        placeholder="4538135"
                        className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
                      />
                      <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">Extracted from arena URL or enter manually</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="lichess_link" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                      Lichess Tournament Link (optional)
                    </label>
                    <input
                      id="lichess_link"
                      name="lichess_link"
                      type="url"
                      placeholder="https://lichess.org/tournament/abc123"
                      className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
                      onChange={(e) => {
                        // Auto-populate tournament ID from URL
                        const url = e.target.value
                        if (url) {
                          const match = url.match(/lichess\.org\/tournament\/([a-zA-Z0-9]+)/)
                          if (match) {
                            const tournamentInput = document.getElementById('lichess_tournament_id')
                            if (tournamentInput) {
                              tournamentInput.value = match[1]
                            }
                          }
                        }
                      }}
                    />
                    <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
                      Paste the Lichess tournament URL to auto-fill tournament ID.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="lichess_tournament_id" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                      Lichess Tournament ID (auto-filled)
                    </label>
                    <input
                      id="lichess_tournament_id"
                      name="lichess_tournament_id"
                      type="text"
                      placeholder="abc123"
                      className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
                    />
                    <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">Extracted from tournament URL or enter manually</p>
                  </div>
                </>
              )}
            <div>
              <label htmlFor="description" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                Description (optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
              />
            </div>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Event
            </Button>
          </form>
        </Card>
      )}

      {editingEvent && (
        <Card>
          <h2 className="dashboard-mb-4 dashboard-text-2xl dashboard-font-bold gradient-text-secondary">Edit Event</h2>
          <form onSubmit={handleUpdateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="edit-name" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                Name
              </label>
              <input
                id="edit-name"
                name="name"
                type="text"
                required
                defaultValue={editingEvent.name}
                className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
              />
            </div>
            <div className="dashboard-grid dashboard-grid-cols-2 dashboard-gap-4">
              <div>
                <label htmlFor="edit-type" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                  Type
                </label>
                <select
                  id="edit-type"
                  name="type"
                  required
                  defaultValue={editingEvent.type}
                  className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]"
                >
                  <option value="arena" className="bg-[var(--color-bg-secondary)]">Arena</option>
                  <option value="swiss" className="bg-[var(--color-bg-secondary)]">Swiss</option>
                  <option value="league" className="bg-[var(--color-bg-secondary)]">League</option>
                  <option value="friendly" className="bg-[var(--color-bg-secondary)]">Friendly</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-platform" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                  Platform
                </label>
                <select
                  id="edit-platform"
                  name="platform"
                  required
                  value={editingPlatform}
                  onChange={(e) => setEditingPlatform(e.target.value)}
                  className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]"
                >
                  <option value="chesscom" className="bg-[var(--color-bg-secondary)]">Chess.com</option>
                </select>
              </div>
            </div>
            <div className="dashboard-grid dashboard-grid-cols-2 dashboard-gap-4">
              <div>
                <label htmlFor="edit-timezone" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                  Timezone
                </label>
                <select
                  id="edit-timezone"
                  name="timezone"
                  className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]"
                  defaultValue={editingEvent.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                >
                  <option value="Asia/Dhaka" className="bg-[var(--color-bg-secondary)]">Asia/Dhaka (BDT)</option>
                  <option value="UTC" className="bg-[var(--color-bg-secondary)]">UTC</option>
                  <option value="America/New_York" className="bg-[var(--color-bg-secondary)]">America/New_York (EST)</option>
                  <option value="Europe/London" className="bg-[var(--color-bg-secondary)]">Europe/London (GMT)</option>
                  <option value="Asia/Dubai" className="bg-[var(--color-bg-secondary)]">Asia/Dubai (GST)</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-time_control" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                  Time Control (optional)
                </label>
                <input
                  id="edit-time_control"
                  name="time_control"
                  type="text"
                  placeholder="5+0"
                  defaultValue={editingEvent.time_control || ''}
                  className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
                />
              </div>
            </div>
            <div className="dashboard-grid dashboard-grid-cols-2 dashboard-gap-4">
              <div>
                <label htmlFor="edit-start_time" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                  Start Time
                </label>
                  <input
                    id="edit-start_time"
                    name="start_time"
                    type="datetime-local"
                    required
                    defaultValue={editingEvent.start_time ? convertISOToLocal(editingEvent.start_time, editingEvent.timezone) : ''}
                    className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label htmlFor="edit-end_time" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                    End Time
                  </label>
                  <input
                    id="edit-end_time"
                    name="end_time"
                    type="datetime-local"
                    required
                    defaultValue={editingEvent.end_time ? convertISOToLocal(editingEvent.end_time, editingEvent.timezone) : ''}
                    className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]"
                  />
              </div>
            </div>
            {/* Platform-specific fields */}
            {editingPlatform === 'chesscom' ? (
              <>
                <div>
                  <label htmlFor="edit-chesscom_link" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                    Chess.com Arena Link (optional)
                  </label>
                  <input
                    id="edit-chesscom_link"
                    name="chesscom_link"
                    type="url"
                    placeholder="https://www.chess.com/play/arena/4538135?clubId=409461"
                    defaultValue={editingEvent.chesscom_link || ''}
                    className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
                    onChange={async (e) => {
                      // Auto-populate tournament ID from URL
                      const url = e.target.value
                      if (url) {
                        const { parseChesscomUrl } = await import('../lib/utils/chesscom-url')
                        const parsed = parseChesscomUrl(url)
                        if (parsed?.tournamentId) {
                          const tournamentInput = document.getElementById('edit-chesscom_tournament_id')
                          if (tournamentInput) {
                            tournamentInput.value = parsed.tournamentId
                          }
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
                    Paste the arena/tournament URL to auto-fill tournament ID. Club ID is always 409461.
                  </p>
                </div>
                <div className="dashboard-grid dashboard-grid-cols-2 dashboard-gap-4">
                  <div>
                    <label htmlFor="edit-chesscom_club_id" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                      Chess.com Club ID (auto-filled)
                    </label>
                    <input
                      id="edit-chesscom_club_id"
                      name="chesscom_club_id"
                      type="text"
                      defaultValue={editingEvent.chesscom_club_id || '409461'}
                      readOnly
                      className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/30 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)]/70 cursor-not-allowed"
                    />
                    <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">Fixed club ID for ChessBD</p>
                  </div>
                  <div>
                    <label htmlFor="edit-chesscom_tournament_id" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                      Chess.com Tournament ID (auto-filled)
                    </label>
                    <input
                      id="edit-chesscom_tournament_id"
                      name="chesscom_tournament_id"
                      type="text"
                      placeholder="4538135"
                      defaultValue={editingEvent.chesscom_tournament_id || ''}
                      className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
                    />
                    <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">Extracted from arena URL or enter manually</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="edit-lichess_link" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                    Lichess Tournament Link (optional)
                  </label>
                  <input
                    id="edit-lichess_link"
                    name="lichess_link"
                    type="url"
                    placeholder="https://lichess.org/tournament/abc123"
                    defaultValue={editingEvent.lichess_link || ''}
                    className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
                    onChange={(e) => {
                      // Auto-populate tournament ID from URL
                      const url = e.target.value
                      if (url) {
                        const match = url.match(/lichess\.org\/tournament\/([a-zA-Z0-9]+)/)
                        if (match) {
                          const tournamentInput = document.getElementById('edit-lichess_tournament_id')
                          if (tournamentInput) {
                            tournamentInput.value = match[1]
                          }
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
                    Paste the Lichess tournament URL to auto-fill tournament ID.
                  </p>
                </div>
                <div>
                  <label htmlFor="edit-lichess_tournament_id" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                    Lichess Tournament ID (auto-filled)
                  </label>
                  <input
                    id="edit-lichess_tournament_id"
                    name="lichess_tournament_id"
                    type="text"
                    placeholder="abc123"
                    defaultValue={editingEvent.lichess_tournament_id || ''}
                    className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
                  />
                  <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">Extracted from tournament URL or enter manually</p>
                </div>
              </>
            )}
            <div>
              <label htmlFor="edit-time_control" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                Time Control (optional)
              </label>
              <input
                id="edit-time_control"
                name="time_control"
                type="text"
                placeholder="5+0"
                defaultValue={editingEvent.time_control || ''}
                className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
              />
            </div>
            <div>
              <label htmlFor="edit-chesscom_link" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                Chess.com Link (optional)
              </label>
              <input
                id="edit-chesscom_link"
                name="chesscom_link"
                type="url"
                placeholder="https://www.chess.com/..."
                defaultValue={editingEvent.chesscom_link || ''}
                className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
              />
            </div>
            <div>
              <label htmlFor="edit-description" className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/90">
                Description (optional)
              </label>
              <textarea
                id="edit-description"
                name="description"
                rows={3}
                defaultValue={editingEvent.description || ''}
                className="focus-ring mt-1 block w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" isLoading={updateMutation.isPending}>
                Update Event
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditingEvent(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-2xl font-bold gradient-text-secondary">Events</h2>
        {events && events.length > 0 ? (
          <div className="space-y-4">
                {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border-2 border-[var(--color-bg-active)]/30 bg-[var(--color-bg-secondary)]/30 p-4 hover:bg-[var(--color-bg-secondary)]/50 hover:border-[var(--color-bg-active)]/50 transition-all"
              >
                <div className="flex-1">
                  <h3 className="font-bold text-[var(--color-text-primary)] text-lg">{event.name}</h3>
                  <p className="text-sm text-[var(--color-text-primary)]/70">
                    {event.type} • {event.status}
                  </p>
                  {event.start_time && event.end_time && (
                    <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
                      {formatEventDate(event.start_time, event.timezone, 'long')} - {formatEventDate(event.end_time, event.timezone, 'long')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setEditingEvent(event)}
                    size="sm"
                    variant="secondary"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleSync(event.id)}
                    isLoading={syncingEventId === event.id}
                    size="sm"
                    variant="secondary"
                  >
                    Sync
                  </Button>
                  <Button
                    onClick={() => handleDelete(event.id)}
                    isLoading={deletingEventId === event.id}
                    size="sm"
                    variant="secondary"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-primary)]/70">No events yet.</p>
        )}
      </Card>
    </div>
  )
}

function UsersTab() {
  const { t } = useLanguage()
  const [searchTerm, setSearchTerm] = useState('')

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.getAllUsers(),
  })

  const filteredUsers = users?.filter(
    (u) =>
      !searchTerm ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.chesscom_username && u.chesscom_username.toLowerCase().includes(searchTerm.toLowerCase()))
  )?.sort((a, b) => {
    // Sort by joined date (created_at), newest first
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
    return dateB - dateA // Descending order (newest first)
  })

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--color-text-primary)]/50" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-4 py-2 pl-10 text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : filteredUsers && filteredUsers.length > 0 ? (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border-2 border-[var(--color-bg-active)]/30 bg-[var(--color-bg-secondary)]/30 p-4 hover:bg-[var(--color-bg-secondary)]/50 transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-[var(--color-text-primary)]">
                      {user.name || user.chesscom_username || user.email || 'Unknown User'}
                    </h3>
                    {user.is_admin && (
                      <span className="rounded-full bg-[var(--color-icon-border)]/10 px-2 py-1 text-xs font-medium text-[var(--color-icon-border)] border border-[var(--color-icon-border)]/30">
                        Admin
                      </span>
                    )}
                    {(user.verified_at || user.lichess_verified_at) && (
                      <span className="rounded-full bg-[var(--color-icon-border)]/10 px-2 py-1 text-xs font-medium text-[var(--color-icon-border)] border border-[var(--color-icon-border)]/30">
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-primary)]/70 mt-1">{user.email || 'No email'}</p>
                  {user.chesscom_username && (
                    <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
                      Chess.com: @{user.chesscom_username}
                    </p>
                  )}
                  {user.location && (
                    <p className="text-xs text-[var(--color-text-primary)]/50">{t(`locations.${user.location}`) || user.location}</p>
                  )}
                  {user.created_at && (
                    <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
                      Joined: {formatLocalDate(user.created_at, { format: "date" })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-primary)]/70">No users found.</p>
        )}
      </Card>
    </div>
  )
}

function NewsTab() {
  const { user } = useAuthStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()
  const [editingNews, setEditingNews] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: newsList, isLoading } = useQuery({
    queryKey: ['admin-news'],
    queryFn: () => api.getNews(false), // Get all news, including unpublished
  })

  const createMutation = useMutation({
    mutationFn: (news) =>
      api.createNews(news),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] })
      queryClient.invalidateQueries({ queryKey: ['news'] })
      addToast({ message: 'News article created successfully', type: 'success' })
      setShowForm(false)
      setEditingNews(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to create news', type: 'error' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) =>
      api.updateNews(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] })
      queryClient.invalidateQueries({ queryKey: ['news'] })
      queryClient.invalidateQueries({ queryKey: ['news-item'] })
      addToast({ message: 'News article updated successfully', type: 'success' })
      setShowForm(false)
      setEditingNews(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to update news', type: 'error' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteNews(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] })
      queryClient.invalidateQueries({ queryKey: ['news'] })
      addToast({ message: 'News article deleted successfully', type: 'success' })
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to delete news', type: 'error' })
    },
  })

  const filteredNews = newsList?.filter(
    (n) =>
      !searchTerm ||
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.content && n.content.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleEdit = (news) => {
    setEditingNews(news)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this news article?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingNews(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-primary)]/50" />
          <input
            type="text"
            placeholder="Search news..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 pl-9 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          />
        </div>
        <Button
          onClick={() => {
            setEditingNews(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create News
        </Button>
      </div>

      {showForm && (
        <NewsForm
          news={editingNews}
          user={user}
          onSave={(newsData) => {
            if (editingNews) {
              updateMutation.mutate({ id: editingNews.id, updates: newsData })
            } else {
              createMutation.mutate(newsData)
            }
          }}
          onCancel={handleCancel}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredNews && filteredNews.length > 0 ? (
          <div className="space-y-3">
            {filteredNews.map((news) => (
              <div
                key={news.id}
                className="p-4 rounded-lg border border-[var(--color-icon-border)]/20 bg-[var(--color-bg-secondary)]/30 hover:bg-[var(--color-bg-secondary)]/50 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2">
                      <h3 className="text-lg font-bold text-[var(--color-text-primary)] truncate">{news.title}</h3>
                      {news.published ? (
                        <span className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border border-[var(--color-icon-border)]/30 whitespace-nowrap">
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/40 whitespace-nowrap">
                          Draft
                        </span>
                      )}
                    </div>
                    {news.excerpt && (
                      <p className="text-sm text-[var(--color-text-primary)]/70 mb-2 line-clamp-2">{news.excerpt}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-primary)]/50">
                      {news.published_at && (
                        <span>Published: {formatLocalDate(news.published_at, { format: "date" })}</span>
                      )}
                      <span>Created: {formatLocalDate(news.created_at, { format: "date" })}</span>
                      {news.author_name && <span>By: {news.author_name}</span>}
                    </div>
                    {news.slug && (
                      <a
                        href={`/news/${news.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-bg-active)] hover:text-[var(--color-bg-active)]/80 mt-2 inline-block"
                      >
                        View Article →
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleEdit(news)}
                      size="sm"
                      variant="secondary"
                      className="flex items-center gap-1.5"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(news.id)}
                      size="sm"
                      variant="secondary"
                      className="flex items-center gap-1.5 text-[var(--color-danger)] hover:text-[var(--color-danger)]/80 hover:bg-[var(--color-danger)]/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-primary)]/70 py-6">No news articles found.</p>
        )}
      </Card>
    </div>
  )
}

// Props removed for JSX

function NewsForm({ news, user, onSave, onCancel, isLoading }) {
  const [title, setTitle] = useState(news?.title || '')
  const [content, setContent] = useState(news?.content || '')
  const [excerpt, setExcerpt] = useState(news?.excerpt || '')
  const [cover, setCover] = useState(news?.cover || '')
  const [featuredImage, setFeaturedImage] = useState(news?.featured_image || '')
  const [published, setPublished] = useState(news?.published || false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      return
    }

    onSave({
      title: title.trim(),
      content: content.trim(),
      excerpt: excerpt.trim() || null,
      cover: cover.trim() || null,
      featured_image: featuredImage.trim() || null,
      author_id: user?.id || '',
      author_name: user?.name || user?.email || 'Admin',
      published,
      // slug will be generated from title
    })
  }

  return (
    <Card className="dashboard-mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          {news ? 'Edit News Article' : 'Create News Article'}
        </h2>
        <button
          onClick={onCancel}
          className="text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            placeholder="News article title"
          />
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Excerpt (optional)
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50 resize-none"
            placeholder="Short excerpt or summary"
          />
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Content * (Markdown supported)
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={12}
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50 resize-none font-mono"
            placeholder="Write your news article content here (Markdown supported)..."
          />
          <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
            Markdown is supported. Use **bold**, *italic*, # headings, etc.
          </p>
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Cover Image URL (optional)
          </label>
          <input
            type="url"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            placeholder="https://example.com/cover.jpg"
          />
          {cover && (
            <img
              src={cover}
              alt="Preview"
              className="mt-2 max-w-xs rounded-lg border border-[var(--color-icon-border)]/30"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Featured Image URL (optional, fallback)
          </label>
          <input
            type="url"
            value={featuredImage}
            onChange={(e) => setFeaturedImage(e.target.value)}
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            placeholder="https://example.com/image.jpg"
          />
          {featuredImage && (
            <img
              src={featuredImage}
              alt="Preview"
              className="mt-2 max-w-xs rounded-lg border border-[var(--color-icon-border)]/30"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 text-[var(--color-bg-active)] focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          />
          <label htmlFor="published" className="text-sm font-medium text-[var(--color-text-primary)]/80 cursor-pointer">
            Publish immediately
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isLoading} className="flex-1 sm:flex-none">
            {isLoading ? 'Saving...' : news ? 'Update Article' : 'Create Article'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

function ManualStreamsTab() {
  const { user } = useAuthStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()
  const [editingStream, setEditingStream] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: streams, isLoading } = useQuery({
    queryKey: ['admin-manual-streams'],
    queryFn: () => api.getManualStreams(),
  })

  const createMutation = useMutation({
    mutationFn: (stream) =>
      api.createManualStream(stream),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-manual-streams'] })
      queryClient.invalidateQueries({ queryKey: ['live-streamers'] })
      addToast({ message: 'Manual stream created successfully', type: 'success' })
      setShowForm(false)
      setEditingStream(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to create stream', type: 'error' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) =>
      api.updateManualStream(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-manual-streams'] })
      queryClient.invalidateQueries({ queryKey: ['live-streamers'] })
      addToast({ message: 'Manual stream updated successfully', type: 'success' })
      setShowForm(false)
      setEditingStream(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to update stream', type: 'error' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteManualStream(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-manual-streams'] })
      queryClient.invalidateQueries({ queryKey: ['live-streamers'] })
      addToast({ message: 'Manual stream deleted successfully', type: 'success' })
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to delete stream', type: 'error' })
    },
  })

  const filteredStreams = streams?.filter(
    (s) =>
      !searchTerm ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEdit = (stream) => {
    setEditingStream(stream)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this manual stream?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingStream(null)
  }

  const getPlatformLabel = (platform) => {
    switch (platform) {
      case 'twitch':
        return 'Twitch'
      case 'youtube':
        return 'YouTube'
      case 'kick':
        return 'Kick'
      case 'chesscom':
        return 'Chess.com'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-primary)]/50" />
          <input
            type="text"
            placeholder="Search streams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 pl-9 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          />
        </div>
        <Button
          onClick={() => {
            setEditingStream(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Stream
        </Button>
      </div>

      {showForm && (
        <ManualStreamForm
          stream={editingStream}
          user={user}
          onSave={(streamData) => {
            if (editingStream) {
              updateMutation.mutate({ id: editingStream.id, updates: streamData })
            } else {
              createMutation.mutate(streamData)
            }
          }}
          onCancel={handleCancel}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredStreams && filteredStreams.length > 0 ? (
          <div className="space-y-3">
            {filteredStreams.map((stream) => (
              <div
                key={stream.id}
                className="p-4 rounded-lg border border-[var(--color-icon-border)]/20 bg-[var(--color-bg-secondary)]/30 hover:bg-[var(--color-bg-secondary)]/50 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2">
                      <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{stream.name}</h3>
                      <span className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border border-[var(--color-icon-border)]/30 whitespace-nowrap">
                        {getPlatformLabel(stream.platform)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-primary)]/70 mb-2">
                      <span className="font-medium">Username:</span> {stream.username}
                    </p>
                    {stream.description && (
                      <p className="text-sm text-[var(--color-text-primary)]/60 mb-2 line-clamp-2">{stream.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-primary)]/50">
                      <span>Created: {formatLocalDate(stream.created_at, { format: "date" })}</span>
                      <span>Updated: {formatLocalDate(stream.updated_at, { format: "date" })}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleEdit(stream)}
                      size="sm"
                      variant="secondary"
                      className="flex items-center gap-1.5"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(stream.id)}
                      size="sm"
                      variant="secondary"
                      className="flex items-center gap-1.5 text-[var(--color-danger)] hover:text-[var(--color-danger)]/80 hover:bg-[var(--color-danger)]/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-primary)]/70 py-6">No manual streams found.</p>
        )}
      </Card>
    </div>
  )
}

// Props removed for JSX

function ManualStreamForm({ stream, user, onSave, onCancel, isLoading }) {
  const [name, setName] = useState(stream?.name || '')
  const [platform, setPlatform] = useState(stream?.platform || 'twitch')
  const [username, setUsername] = useState(stream?.username || '')
  const [description, setDescription] = useState(stream?.description || '')
  const [streamsChessOnly, setStreamsChessOnly] = useState(stream?.streams_chess_only || false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !username.trim()) {
      return
    }

    onSave({
      name: name.trim(),
      platform,
      username: username.trim(),
      description: description.trim() || null,
      streams_chess_only: streamsChessOnly,
      created_by: user?.id || '',
    })
  }

  return (
    <Card className="dashboard-mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          {stream ? 'Edit Manual Stream' : 'Add Manual Stream'}
        </h2>
        <button
          onClick={onCancel}
          className="text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Display Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            placeholder="Streamer name or channel name"
          />
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Platform *
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            required
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          >
            <option value="twitch">Twitch</option>
            <option value="youtube">YouTube</option>
            <option value="kick">Kick</option>
            <option value="chesscom">Chess.com</option>
          </select>
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Username/Channel *
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            placeholder={platform === 'youtube' ? 'Channel username (e.g., @channelname)' : 'Platform username'}
          />
          <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
            {platform === 'youtube' && 'Enter the channel username (without @) or full channel URL'}
            {platform === 'twitch' && 'Enter the Twitch username'}
            {platform === 'kick' && 'Enter the Kick username'}
          </p>
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50 resize-none"
            placeholder="Optional description about the stream"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="chessOnly"
            checked={streamsChessOnly}
            onChange={(e) => setStreamsChessOnly(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 text-[var(--color-bg-active)] focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          />
          <label htmlFor="chessOnly" className="text-sm font-medium text-[var(--color-text-primary)]/80 cursor-pointer">
            Streams chess content only
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isLoading} className="flex-1 sm:flex-none">
            {isLoading ? 'Saving...' : stream ? 'Update Stream' : 'Create Stream'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

function TestimonialsTab() {
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()
  const [editingTestimonial, setEditingTestimonial] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: testimonialsList, isLoading } = useQuery({
    queryKey: ['admin-testimonials'],
    queryFn: () => api.getTestimonials(),
  })

  const { data: usersMap } = useQuery({
    queryKey: ['testimonials-users'],
    queryFn: async () => {
      const { collection, getDocs } = await import('firebase/firestore')
      const { db } = await import('../lib/firebase')
      if (!db) return {}
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = {}
      usersSnapshot.docs.forEach(doc => {
        users[doc.id] = { id: doc.id, ...doc.data() }
      })
      return users
    },
  })

  const createMutation = useMutation({
    mutationFn: (testimonial) =>
      api.createTestimonial(testimonial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] })
      queryClient.invalidateQueries({ queryKey: ['testimonials'] })
      addToast({ message: 'Testimonial created successfully', type: 'success' })
      setShowForm(false)
      setEditingTestimonial(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to create testimonial', type: 'error' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) =>
      api.updateTestimonial(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] })
      queryClient.invalidateQueries({ queryKey: ['testimonials'] })
      addToast({ message: 'Testimonial updated successfully', type: 'success' })
      setShowForm(false)
      setEditingTestimonial(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to update testimonial', type: 'error' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteTestimonial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] })
      queryClient.invalidateQueries({ queryKey: ['testimonials'] })
      addToast({ message: 'Testimonial deleted successfully', type: 'success' })
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to delete testimonial', type: 'error' })
    },
  })

  const filteredTestimonials = testimonialsList?.filter(
    (t) =>
      !searchTerm ||
      t.quote.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.title && t.title.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleEdit = (testimonial) => {
    setEditingTestimonial(testimonial)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this testimonial?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingTestimonial(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-primary)]/50" />
          <input
            type="text"
            placeholder="Search testimonials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 pl-9 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          />
        </div>
        <Button
          onClick={() => {
            setEditingTestimonial(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Testimonial
        </Button>
      </div>

      {showForm && (
        <TestimonialForm
          testimonial={editingTestimonial}
          usersMap={usersMap || {}}
          onSave={(testimonialData) => {
            if (editingTestimonial) {
              updateMutation.mutate({ id: editingTestimonial.id, updates: testimonialData })
            } else {
              createMutation.mutate(testimonialData)
            }
          }}
          onCancel={handleCancel}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredTestimonials && filteredTestimonials.length > 0 ? (
          <div className="space-y-3">
            {filteredTestimonials.map((testimonial) => {
              const user = usersMap?.[testimonial.user_id]
              const userName = user?.name || user?.chesscom_username || user?.email || 'Unknown User'
              
              return (
                <div
                  key={testimonial.id}
                  className="p-4 rounded-lg border border-[var(--color-icon-border)]/20 bg-[var(--color-bg-secondary)]/30 hover:bg-[var(--color-bg-secondary)]/50 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{userName}</h3>
                        {testimonial.featured && (
                          <span className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border border-[var(--color-icon-border)]/30 whitespace-nowrap">
                            Featured
                          </span>
                        )}
                        {testimonial.order !== null && testimonial.order !== undefined && (
                          <span className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border border-[var(--color-icon-border)]/30 whitespace-nowrap">
                            Order: {testimonial.order}
                          </span>
                        )}
                      </div>
                      {testimonial.title && (
                        <p className="text-sm text-[var(--color-text-primary)]/70 mb-2 font-medium">{testimonial.title}</p>
                      )}
                      <p className="text-sm text-[var(--color-text-primary)]/60 mb-2 line-clamp-2">"{testimonial.quote}"</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-primary)]/50">
                        <span>Created: {formatLocalDate(testimonial.created_at, { format: "date" })}</span>
                        <span>Updated: {formatLocalDate(testimonial.updated_at, { format: "date" })}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        onClick={() => handleEdit(testimonial)}
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-1.5"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(testimonial.id)}
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-1.5 text-[var(--color-danger)] hover:text-[var(--color-danger)]/80 hover:bg-[var(--color-danger)]/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-primary)]/70 py-6">No testimonials found.</p>
        )}
      </Card>
    </div>
  )
}

// Props removed for JSX

function TestimonialForm({ testimonial, usersMap, onSave, onCancel, isLoading }) {
  const [userId, setUserId] = useState(testimonial?.user_id || '')
  const [quote, setQuote] = useState(testimonial?.quote || '')
  const [title, setTitle] = useState(testimonial?.title || '')
  const [featured, setFeatured] = useState(testimonial?.featured || false)
  const [order, setOrder] = useState(testimonial?.order?.toString() || '')

  const users = usersMap ? Object.entries(usersMap).map(([id, data]) => ({
    id,
    ...data,
  })) : []

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!userId.trim() || !quote.trim()) {
      return
    }

    onSave({
      user_id: userId.trim(),
      quote: quote.trim(),
      title: title.trim() || null,
      featured,
      order: order ? parseInt(order, 10) : null,
    })
  }

  return (
    <Card className="dashboard-mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          {testimonial ? 'Edit Testimonial' : 'Create Testimonial'}
        </h2>
        <button
          onClick={onCancel}
          className="text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            User *
          </label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          >
            <option value="" className="bg-[var(--color-bg-secondary)]">Select a user...</option>
            {users.map((user) => (
              <option key={user.id} value={user.id} className="bg-[var(--color-bg-secondary)]">
                {user.name || user.chesscom_username || user.email || user.id}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
            Select the user who provided this testimonial
          </p>
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Quote *
          </label>
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            required
            rows={4}
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50 resize-none"
            placeholder="Enter the testimonial quote..."
          />
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Title (optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            placeholder="e.g., FIDE Master, Chess Streamer, National Champion"
          />
          <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
            Custom title to display (if not provided, will use user's role)
          </p>
        </div>

        <div className="dashboard-grid dashboard-grid-cols-2 dashboard-gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="featured"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 text-[var(--color-bg-active)] focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            />
            <label htmlFor="featured" className="text-sm font-medium text-[var(--color-text-primary)]/80 cursor-pointer">
              Featured (show on homepage)
            </label>
          </div>
          <div>
            <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
              Display Order (optional)
            </label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              min="0"
              className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
              placeholder="0"
            />
            <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
              Lower numbers appear first (0 = first)
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isLoading} className="flex-1 sm:flex-none">
            {isLoading ? 'Saving...' : testimonial ? 'Update Testimonial' : 'Create Testimonial'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

function PartnersTab() {
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()
  const [editingPartner, setEditingPartner] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: partnersList, isLoading } = useQuery({
    queryKey: ['admin-partners'],
    queryFn: () => api.getPartners(),
  })

  const createMutation = useMutation({
    mutationFn: (partner) =>
      api.createPartner(partner),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      addToast({ message: 'Partner created successfully', type: 'success' })
      setShowForm(false)
      setEditingPartner(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to create partner', type: 'error' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) =>
      api.updatePartner(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      addToast({ message: 'Partner updated successfully', type: 'success' })
      setShowForm(false)
      setEditingPartner(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to update partner', type: 'error' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deletePartner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      addToast({ message: 'Partner deleted successfully', type: 'success' })
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to delete partner', type: 'error' })
    },
  })

  const filteredPartners = partnersList?.filter(
    (p) =>
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEdit = (partner) => {
    setEditingPartner(partner)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this partner?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingPartner(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-primary)]/50" />
          <input
            type="text"
            placeholder="Search partners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 pl-9 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          />
        </div>
        <Button
          onClick={() => {
            setEditingPartner(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Partner
        </Button>
      </div>

      {showForm && (
        <PartnerForm
          partner={editingPartner}
          onSave={(partnerData) => {
            if (editingPartner) {
              updateMutation.mutate({ id: editingPartner.id, updates: partnerData })
            } else {
              createMutation.mutate(partnerData)
            }
          }}
          onCancel={handleCancel}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredPartners && filteredPartners.length > 0 ? (
          <div className="space-y-3">
            {filteredPartners.map((partner) => (
              <div
                key={partner.id}
                className="p-4 rounded-lg border border-[var(--color-icon-border)]/20 bg-[var(--color-bg-secondary)]/30 hover:bg-[var(--color-bg-secondary)]/50 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2">
                      <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{partner.name}</h3>
                      {partner.featured && (
                        <span className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border border-[var(--color-icon-border)]/30 whitespace-nowrap">
                          Featured
                        </span>
                      )}
                      {partner.order !== null && partner.order !== undefined && (
                        <span className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border border-[var(--color-icon-border)]/30 whitespace-nowrap">
                          Order: {partner.order}
                        </span>
                      )}
                    </div>
                    {partner.url && (
                      <a
                        href={partner.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-bg-active)] hover:text-[var(--color-bg-active)]/80 underline"
                      >
                        {partner.url}
                      </a>
                    )}
                    {partner.logo_url && (
                      <div className="mt-2">
                        <img
                          src={partner.logo_url}
                          alt={partner.name}
                          className="h-12 w-auto max-w-xs object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-primary)]/50 mt-2">
                      <span>Created: {formatLocalDate(partner.created_at, { format: "date" })}</span>
                      <span>Updated: {formatLocalDate(partner.updated_at, { format: "date" })}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleEdit(partner)}
                      size="sm"
                      variant="secondary"
                      className="flex items-center gap-1.5"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(partner.id)}
                      size="sm"
                      variant="secondary"
                      className="flex items-center gap-1.5 text-[var(--color-danger)] hover:text-[var(--color-danger)]/80 hover:bg-[var(--color-danger)]/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-primary)]/70 py-6">No partners found.</p>
        )}
      </Card>
    </div>
  )
}

// Props removed for JSX

function PartnerForm({ partner, onSave, onCancel, isLoading }) {
  const [name, setName] = useState(partner?.name || '')
  const [url, setUrl] = useState(partner?.url || '')
  const [logoUrl, setLogoUrl] = useState(partner?.logo_url || '')
  const [featured, setFeatured] = useState(partner?.featured || false)
  const [order, setOrder] = useState(partner?.order?.toString() || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      return
    }

    onSave({
      name: name.trim(),
      url: url.trim() || null,
      logo_url: logoUrl.trim() || null,
      featured,
      order: order ? parseInt(order, 10) : null,
    })
  }

  return (
    <Card className="dashboard-mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          {partner ? 'Edit Partner' : 'Create Partner'}
        </h2>
        <button
          onClick={onCancel}
          className="text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            placeholder="e.g., Bangladesh Chess Federation"
          />
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Website URL (optional)
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            placeholder="https://example.com"
          />
          <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
            Link to the partner's website
          </p>
        </div>

        <div>
          <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
            Logo URL (optional)
          </label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            placeholder="https://example.com/logo.png"
          />
          <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
            URL to the partner's logo image
          </p>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Preview"
              className="mt-2 h-16 w-auto max-w-xs object-contain rounded-lg border border-[var(--color-icon-border)]/30"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
        </div>

        <div className="dashboard-grid dashboard-grid-cols-2 dashboard-gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="featured"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 text-[var(--color-bg-active)] focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            />
            <label htmlFor="featured" className="text-sm font-medium text-[var(--color-text-primary)]/80 cursor-pointer">
              Featured (show on homepage)
            </label>
          </div>
          <div>
            <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
              Display Order (optional)
            </label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              min="0"
              className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
              placeholder="0"
            />
            <p className="text-xs text-[var(--color-text-primary)]/50 mt-1">
              Lower numbers appear first (0 = first)
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isLoading} className="flex-1 sm:flex-none">
            {isLoading ? 'Saving...' : partner ? 'Update Partner' : 'Create Partner'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

function JobsTab() {
  const { user } = useAuthStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()
  const [editingJob, setEditingJob] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: jobsList, isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: () => api.getJobs(false), // Get all jobs, including unpublished
  })

  const createMutation = useMutation({
    mutationFn: (job) =>
      api.createJob(job),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      addToast({ message: 'Job created successfully', type: 'success' })
      setShowForm(false)
      setEditingJob(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to create job', type: 'error' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) =>
      api.updateJob(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      addToast({ message: 'Job updated successfully', type: 'success' })
      setShowForm(false)
      setEditingJob(null)
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to update job', type: 'error' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (jobId) => api.deleteJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      addToast({ message: 'Job deleted successfully', type: 'success' })
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to delete job', type: 'error' })
    },
  })

  const filteredJobs = jobsList?.filter(
    (job) =>
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCancel = () => {
    setShowForm(false)
    setEditingJob(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-primary)]/50" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 pl-9 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          />
        </div>
        <Button
          onClick={() => {
            setEditingJob(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Job
        </Button>
      </div>

      {showForm && (
        <JobForm
          job={editingJob}
          user={user}
          onSave={(jobData) => {
            if (editingJob) {
              updateMutation.mutate({ id: editingJob.id, updates: jobData })
            } else {
              createMutation.mutate(jobData)
            }
          }}
          onCancel={handleCancel}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredJobs && filteredJobs.length > 0 ? (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border-2 border-[var(--color-bg-active)]/30 bg-[var(--color-bg-secondary)]/30 hover:bg-[var(--color-bg-secondary)]/50 transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{job.title}</h3>
                    {!job.published && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                        Draft
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                      job.type === 'volunteer' ? 'bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border-[var(--color-icon-border)]/30' :
                      job.type === 'part-time' ? 'bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border-[var(--color-icon-border)]/30' :
                      'bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border-[var(--color-icon-border)]/30'
                    }`}>
                      {job.type}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-primary)]/60">
                    <span>{job.department}</span>
                    <span>•</span>
                    <span>{job.location}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingJob(job)
                      setShowForm(true)
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this job?')) {
                        deleteMutation.mutate(job.id)
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-primary)]/70 py-6">No jobs found.</p>
        )}
      </Card>
    </div>
  )
}

// Props removed for JSX

function JobForm({ job, user, onSave, onCancel, isLoading }) {
  const [title, setTitle] = useState(job?.title || '')
  const [department, setDepartment] = useState(job?.department || '')
  const [type, setType] = useState(job?.type || 'volunteer')
  const [location, setLocation] = useState(job?.location || '')
  const [description, setDescription] = useState(job?.description || '')
  const [requirements, setRequirements] = useState(job?.requirements || [])
  const [responsibilities, setResponsibilities] = useState(job?.responsibilities || [])
  const [benefits, setBenefits] = useState(job?.benefits || [])
  const [applicationLink, setApplicationLink] = useState(job?.application_link || '')
  const [applicationEmail, setApplicationEmail] = useState(job?.application_email || '')
  const [published, setPublished] = useState(job?.published || false)
  const [newRequirement, setNewRequirement] = useState('')
  const [newResponsibility, setNewResponsibility] = useState('')
  const [newBenefit, setNewBenefit] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !department.trim() || !location.trim()) {
      return
    }

    onSave({
      title: title.trim(),
      department: department.trim(),
      type,
      location: location.trim(),
      description: description.trim(),
      requirements: requirements.filter(r => r.trim()),
      responsibilities: responsibilities.filter(r => r.trim()),
      benefits: benefits.length > 0 ? benefits.filter(b => b.trim()) : null,
      application_link: applicationLink.trim() || null,
      application_email: applicationEmail.trim() || null,
      published,
      created_by: user?.id || null,
    })
  }

  const addRequirement = () => {
    if (newRequirement.trim()) {
      setRequirements([...requirements, newRequirement.trim()])
      setNewRequirement('')
    }
  }

  const removeRequirement = (index) => {
    setRequirements(requirements.filter((_, i) => i !== index))
  }

  const addResponsibility = () => {
    if (newResponsibility.trim()) {
      setResponsibilities([...responsibilities, newResponsibility.trim()])
      setNewResponsibility('')
    }
  }

  const removeResponsibility = (index) => {
    setResponsibilities(responsibilities.filter((_, i) => i !== index))
  }

  const addBenefit = () => {
    if (newBenefit.trim()) {
      setBenefits([...benefits, newBenefit.trim()])
      setNewBenefit('')
    }
  }

  const removeBenefit = (index) => {
    setBenefits(benefits.filter((_, i) => i !== index))
  }

  return (
    <Card className="dashboard-mb-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Department *</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
              required
            >
              <option value="volunteer">Volunteer</option>
              <option value="part-time">Part-Time</option>
              <option value="full-time">Full-Time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Location *</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Requirements *</label>
          <div className="space-y-2">
            {requirements.map((req, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={req}
                  onChange={(e) => {
                    const newReqs = [...requirements]
                    newReqs[index] = e.target.value
                    setRequirements(newReqs)
                  }}
                  className="flex-1 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => removeRequirement(index)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newRequirement}
                onChange={(e) => setNewRequirement(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
                placeholder="Add requirement..."
                className="flex-1 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
              />
              <Button type="button" onClick={addRequirement}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Responsibilities *</label>
          <div className="space-y-2">
            {responsibilities.map((resp, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={resp}
                  onChange={(e) => {
                    const newResps = [...responsibilities]
                    newResps[index] = e.target.value
                    setResponsibilities(newResps)
                  }}
                  className="flex-1 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => removeResponsibility(index)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newResponsibility}
                onChange={(e) => setNewResponsibility(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addResponsibility())}
                placeholder="Add responsibility..."
                className="flex-1 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
              />
              <Button type="button" onClick={addResponsibility}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Benefits (Optional)</label>
          <div className="space-y-2">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={benefit}
                  onChange={(e) => {
                    const newBenefits = [...benefits]
                    newBenefits[index] = e.target.value
                    setBenefits(newBenefits)
                  }}
                  className="flex-1 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => removeBenefit(index)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                placeholder="Add benefit..."
                className="flex-1 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
              />
              <Button type="button" onClick={addBenefit}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Application Link (Optional)</label>
            <input
              type="url"
              value={applicationLink}
              onChange={(e) => setApplicationLink(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Application Email (Optional)</label>
            <input
              type="email"
              value={applicationEmail}
              onChange={(e) => setApplicationEmail(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 text-[var(--color-bg-active)] focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          />
          <label htmlFor="published" className="text-sm font-semibold text-[var(--color-text-primary)]">
            Published (visible to public)
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isLoading} className="flex-1 sm:flex-none">
            {isLoading ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

function ClubsTab() {
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [removingClubId, setRemovingClubId] = useState(null)
  const [removalReason, setRemovalReason] = useState('')
  const [showRemovalModal, setShowRemovalModal] = useState(false)

  const { data: clubsList, isLoading } = useQuery({
    queryKey: ['admin-clubs'],
    queryFn: () => api.getAllClubs(),
  })

  // Fetch all users to create a map for quick email lookup
  const { data: allUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.getAllUsers(),
  })

  // Create a map of user ID to user for quick lookup (memoized)
  const usersMap = useMemo(() => {
    const map = new Map()
    if (allUsers) {
      allUsers.forEach(user => {
        map.set(user.id, user)
      })
    }
    return map
  }, [allUsers])

  const approveMutation = useMutation({
    mutationFn: async ({ clubId, ownerEmail, ownerName, clubName }) => {
      // Update club approval status
      await api.updateClub(clubId, { approved: true })
      
      // Send approval email
      const emailHtml = generateClubApprovalEmail(clubName, ownerName)
      await api.sendEmail(
        ownerEmail,
        'no-reply@chessbd.app',
        'Your Club Has Been Approved - ChessBD',
        emailHtml
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clubs'] })
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      addToast({ message: 'Club approved and email sent successfully', type: 'success' })
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to approve club', type: 'error' })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async ({ clubId, reason }) => {
      const club = clubsList?.find(c => c.id === clubId)
      if (!club) throw new Error('Club not found')

      // Get owner email from users map
      let ownerEmail = null
      let ownerName = null
      if (club.created_by) {
        const owner = usersMap.get(club.created_by)
        if (owner && owner.email) {
          ownerEmail = owner.email
          ownerName = owner.name || null
        }
      }

      // Delete club
      await api.deleteClub(clubId)

      // Send removal email if owner email is available
      if (ownerEmail) {
        const emailHtml = generateClubRemovalEmail(club.name, ownerName, reason)
        await api.sendEmail(
          ownerEmail,
          'no-reply@chessbd.app',
          'Club Removal Notice - ChessBD',
          emailHtml
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clubs'] })
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      addToast({ message: 'Club removed and email sent successfully', type: 'success' })
      setShowRemovalModal(false)
      setRemovingClubId(null)
      setRemovalReason('')
    },
    onError: (error) => {
      addToast({ message: error.message || 'Failed to remove club', type: 'error' })
    },
  })

  const filteredClubs = clubsList?.filter(
    (c) =>
      !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleApprove = async (club) => {
    if (!club.created_by) {
      addToast({ message: 'Club has no owner to send email to', type: 'error' })
      return
    }

    if (usersLoading) {
      addToast({ message: 'Loading user data, please wait...', type: 'info' })
      return
    }

    let owner = usersMap.get(club.created_by)
    
    // Fallback: try to fetch user directly if not in map
    if (!owner) {
      try {
        console.warn('[ClubsTab] Owner not in map, fetching directly:', club.created_by)
        const fetchedOwner = await api.getUser(club.created_by)
        owner = fetchedOwner || undefined
        if (owner) {
          // Add to map for future use
          usersMap.set(owner.id, owner)
        }
      } catch (error) {
        console.error('[ClubsTab] Failed to fetch owner:', error)
      }
    }

    if (!owner) {
      console.error('[ClubsTab] Owner not found:', {
        clubId: club.id,
        clubName: club.name,
        created_by: club.created_by,
        usersMapSize: usersMap.size,
        allUsersCount: allUsers?.length || 0,
      })
      addToast({ 
        message: `Could not find owner email. Club owner ID: ${club.created_by}. Please ensure the user exists in the system.`, 
        type: 'error' 
      })
      return
    }

    if (!owner.email) {
      addToast({ 
        message: `Owner found but has no email address. Owner ID: ${club.created_by}`, 
        type: 'error' 
      })
      return
    }

    approveMutation.mutate({
      clubId: club.id,
      ownerEmail: owner.email,
      ownerName: owner.name || null,
      clubName: club.name,
    })
  }

  const handleRemoveClick = (clubId) => {
    setRemovingClubId(clubId)
    setShowRemovalModal(true)
    setRemovalReason('')
  }

  const handleRemoveConfirm = () => {
    if (!removingClubId || !removalReason.trim()) {
      addToast({ message: 'Please provide a reason for removal', type: 'error' })
      return
    }

    removeMutation.mutate({
      clubId: removingClubId,
      reason: removalReason.trim(),
    })
  }

  const handleRemoveCancel = () => {
    setShowRemovalModal(false)
    setRemovingClubId(null)
    setRemovalReason('')
  }

  const unapprovedClubs = filteredClubs?.filter(c => !c.approved) || []
  const approvedClubs = filteredClubs?.filter(c => c.approved) || []

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-primary)]/50" />
          <input
            type="text"
            placeholder="Search clubs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 pl-9 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50"
          />
        </div>
      </div>

      {showRemovalModal && (
        <Card>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Remove Club</h3>
          <div className="space-y-4">
            <div>
              <label className="dashboard-block dashboard-text-sm dashboard-font-medium text-[var(--color-text-primary)]/80 mb-1.5">
                Reason for Removal *
              </label>
              <textarea
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value)}
                required
                rows={4}
                className="w-full rounded-lg border-2 border-[var(--color-bg-active)]/50 bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-primary)]/50 focus:border-[var(--color-bg-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-bg-active)]/50 resize-none"
                placeholder="Enter the reason for removing this club..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleRemoveConfirm}
                disabled={removeMutation.isPending || !removalReason.trim()}
                className="flex items-center gap-2 bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90"
              >
                {removeMutation.isPending ? 'Removing...' : 'Remove Club'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleRemoveCancel} disabled={removeMutation.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Unapproved Clubs */}
      {unapprovedClubs.length > 0 && (
        <Card>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-[var(--color-warning)]" />
            Pending Approval ({unapprovedClubs.length})
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {unapprovedClubs.map((club) => (
                <div
                  key={club.id}
                  className="p-4 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 hover:bg-[var(--color-warning)]/10 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{club.name}</h3>
                        <span className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/40 whitespace-nowrap">
                          Pending
                        </span>
                      </div>
                      {club.location && (
                        <p className="text-sm text-[var(--color-text-primary)]/70 mb-1 flex items-center gap-1.5">
                          <ClubIcon className="w-4 h-4" />
                          {club.location}
                        </p>
                      )}
                      {club.description && (
                        <p className="text-sm text-[var(--color-text-primary)]/60 mb-2 line-clamp-2">{club.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-primary)]/50 mt-2">
                        <span>Created: {formatLocalDate(club.created_at, { format: "date" })}</span>
                        {club.members_count && (
                          <span>Members: {club.members_count}</span>
                        )}
                        {club.created_by && (
                          <span className="text-[var(--color-text-primary)]/40">
                            Owner: {usersMap.get(club.created_by)?.email || usersMap.get(club.created_by)?.name || club.created_by}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        onClick={() => handleApprove(club)}
                        size="sm"
                        disabled={approveMutation.isPending}
                        className="flex items-center gap-1.5 bg-[var(--color-icon-border)] hover:bg-[var(--color-icon-border)]/90"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {approveMutation.isPending ? 'Approving...' : 'Approve'}
                      </Button>
                      <Button
                        onClick={() => handleRemoveClick(club.id)}
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-1.5 text-[var(--color-danger)] hover:text-[var(--color-danger)]/80 hover:bg-[var(--color-danger)]/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Approved Clubs */}
      <Card>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[var(--color-icon-border)]" />
          Approved Clubs ({approvedClubs.length})
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : approvedClubs && approvedClubs.length > 0 ? (
          <div className="space-y-3">
            {approvedClubs.map((club) => (
              <div
                key={club.id}
                className="p-4 rounded-lg border border-[var(--color-icon-border)]/20 bg-[var(--color-bg-secondary)]/30 hover:bg-[var(--color-bg-secondary)]/50 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2">
                      <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{club.name}</h3>
                      <span className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border border-[var(--color-icon-border)]/30 whitespace-nowrap">
                        Approved
                      </span>
                      {club.featured && (
                        <span className="rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-icon-border)]/10 text-[var(--color-icon-border)] border border-[var(--color-icon-border)]/30 whitespace-nowrap">
                          Featured
                        </span>
                      )}
                    </div>
                    {club.location && (
                      <p className="text-sm text-[var(--color-text-primary)]/70 mb-1 flex items-center gap-1.5">
                        <ClubIcon className="w-4 h-4" />
                        {club.location}
                      </p>
                    )}
                    {club.description && (
                      <p className="text-sm text-[var(--color-text-primary)]/60 mb-2 line-clamp-2">{club.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-primary)]/50 mt-2">
                      <span>Created: {formatLocalDate(club.created_at, { format: "date" })}</span>
                      <span>Updated: {formatLocalDate(club.updated_at, { format: "date" })}</span>
                      {club.members_count && (
                        <span>Members: {club.members_count}</span>
                      )}
                      {club.created_by && (
                        <span className="text-[var(--color-text-primary)]/40">
                          Owner: {usersMap.get(club.created_by)?.email || usersMap.get(club.created_by)?.name || club.created_by}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleRemoveClick(club.id)}
                      size="sm"
                      variant="secondary"
                      className="flex items-center gap-1.5 text-[var(--color-danger)] hover:text-[var(--color-danger)]/80 hover:bg-[var(--color-danger)]/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--color-text-primary)]/70 py-6">
            {unapprovedClubs.length === 0 ? 'No clubs found.' : 'No approved clubs found.'}
          </p>
        )}
      </Card>
    </div>
  )
}
