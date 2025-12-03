import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { EventCard } from '../components/ui/EventCard'
import { EventFilters } from '../components/ui/EventFilters'
import { Calendar } from 'lucide-react'
import { useEvents } from '../hooks/use-events'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { calculateEventStatus } from '../lib/utils/event-status'
import { PageLoader } from '../components/ui/PageLoader'
import './Events.css'

export function Events() {
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const [statusFilter, setStatusFilter] = useState(statusParam || undefined)
  const { data: events, isLoading } = useEvents({ status: statusFilter })

  useSEO({
    title: t('events.title'),
    description: t('events.description'),
    keywords: 'chess tournaments, chess events, chess competitions, tournament registration, chess matches',
    url: '/events',
  })

  const handleStatusChange = (status) => {
    setStatusFilter(status)
    if (status) {
      setSearchParams({ status })
    } else {
      setSearchParams({})
    }
  }

  // Get status label for display
  const getStatusLabel = () => {
    if (statusFilter === 'upcoming') return t('events.filters.upcoming')
    if (statusFilter === 'in_progress') return t('events.filters.inProgress')
    if (statusFilter === 'finished') return t('events.filters.finished')
    return t('events.title')
  }

  const getStatusDescription = () => {
    if (statusFilter === 'upcoming') {
      return t('events.upcomingDesc') || 'Register for elite championships, community leagues, and weekly online arenas curated for ChessBD players.'
    }
    if (statusFilter === 'in_progress') {
      return t('events.inProgressDesc') || 'Watch live tournaments and follow the action as it happens in real-time.'
    }
    if (statusFilter === 'finished') {
      return t('events.finishedDesc') || 'Review past tournaments, check final standings, and relive the best moments.'
    }
    return t('events.description') || 'Browse and participate in chess tournaments and events. Find upcoming tournaments, view in-progress events, and check out recent tournament results.'
  }

  // Map status values from API to expected values
  const normalizeStatus = (status) => {
    if (status === 'live') return 'in_progress'
    if (status === 'completed') return 'finished'
    return status
  }

  // Filter events by status if needed (since API might return different status values)
  const filteredEvents = events?.map(event => {
    // Calculate status if not present or normalize existing status
    const calculatedStatus = event.status || calculateEventStatus(event)
    return {
      ...event,
      status: normalizeStatus(calculatedStatus)
    }
  }).filter(event => {
    if (!statusFilter) return true
    return event.status === statusFilter
  }) || []

  if (isLoading) {
    return <PageLoader />
  }

  return (
    <Container>
      <div className="events-page">
        {/* Header Section */}
        <div className="events-header">
          <div className="events-header-content">
            <p className="events-header-label">
              {t('events.tournamentCalendar') || 'Tournament Calendar'}
            </p>
            <h1 className="events-header-title">
              <Calendar className="events-header-icon" />
              {getStatusLabel()}
            </h1>
            <p className="events-header-description">
              {getStatusDescription()}
            </p>
          </div>
          
          {/* Filters */}
          <div className="events-filters-wrapper">
            <EventFilters status={statusFilter} onStatusChange={handleStatusChange} />
          </div>
        </div>

        {/* Events Grid */}
        {filteredEvents && filteredEvents.length > 0 ? (
          <div className="events-grid">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card className="events-empty-card">
            <div className="events-empty-content">
              <div className="events-empty-icon">
                <Calendar className="events-empty-icon-svg" />
              </div>
              <div>
                <h3 className="events-empty-title">
                  {t('events.noEvents')}
                </h3>
                <p className="events-empty-description">
                  {statusFilter 
                    ? (t('events.noEventsFiltered', { status: getStatusLabel() }) || `No ${getStatusLabel().toLowerCase()} events at the moment. Check back soon!`)
                    : (t('events.noEventsAvailable') || 'No events available at the moment. Check back soon for new tournaments and competitions.')}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Container>
  )
}

