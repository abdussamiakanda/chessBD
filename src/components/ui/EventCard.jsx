import { Link } from 'react-router-dom'
import { Card } from './Card'
import { Calendar, Clock, Trophy } from 'lucide-react'
import { useState } from 'react'
import './EventCard.css'

// Default chess tournament image
const DEFAULT_EVENT_IMAGE = '/2150844773.jpg'

const getEventImage = (event) => {
  // If event has an image_url, use it
  if (event.image_url) {
    return event.image_url
  }
  
  // Otherwise use the default chessBD image
  return DEFAULT_EVENT_IMAGE
}

export function EventCard({ event, className = '' }) {
  const statusLabels = {
    upcoming: 'Upcoming',
    in_progress: 'Live',
    finished: 'Finished',
  }

  const eventUrl = event.slug || event.id
  const eventImage = getEventImage(event)
  const [imageError, setImageError] = useState(false)
  
  return (
    <Link to={`/events/${eventUrl}`} className={`event-card-link ${className}`}>
      <Card className="event-card">
        <div className="event-card-image-wrapper">
          {!imageError ? (
            <img
              src={eventImage}
              alt={event.name}
              className="event-card-image"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="event-card-image-fallback"></div>
          )}
          <div className="event-card-image-overlay"></div>
          {event.status && (
            <span className="event-card-status">{statusLabels[event.status] || event.status}</span>
          )}
        </div>
        <div className="event-card-content">
          <h3 className="event-card-title">{event.name}</h3>
          <div className="event-card-meta">
            {event.start_time && (
              <span className="event-card-meta-item">
                <Calendar className="event-card-meta-icon" />
                {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {event.time_control && (
                <span className="event-card-meta-item">
                    <Clock className="event-card-meta-icon" />
                    {event.time_control}
                </span>
            )}
            <span className="event-card-meta-item">
                <Trophy className="event-card-meta-icon" />
                {event.type?.toUpperCase() || 'TOURNAMENT'}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

