import { useLanguage } from '../../contexts/LanguageContext'
import './EventFilters.css'

export function EventFilters({ status, onStatusChange }) {
  const { t } = useLanguage()
  const filters = [
    { label: t('events.filters.all'), value: undefined },
    { label: t('events.filters.upcoming'), value: 'upcoming' },
    { label: t('events.filters.inProgress'), value: 'in_progress' },
    { label: t('events.filters.finished'), value: 'finished' },
  ]

  return (
    <div className="event-filters">
      {filters.map((filter) => (
        <button
          key={filter.value || 'all'}
          onClick={() => onStatusChange(filter.value)}
          className={`event-filter-btn ${status === filter.value ? 'event-filter-btn-active' : ''}`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}

