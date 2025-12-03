import { Card } from './Card'
import { User } from 'lucide-react'
import { useState } from 'react'
import './TestimonialCard.css'

export function TestimonialCard({ testimonial, userInfo, style, className = '' }) {
  const [imageError, setImageError] = useState(false)
  
  const name = userInfo?.displayName || testimonial.user_id || 'Chess Player'
  const title = testimonial.title || (userInfo?.is_streamer 
    ? 'Chess Streamer' 
    : userInfo?.is_admin 
      ? 'ChessBD Admin' 
      : 'Verified Player')
  const avatar = userInfo?.avatarUrl || userInfo?.avatar_url || null

  return (
    <Card className={`testimonial-card ${className}`}>
      <div className="testimonial-card-header">
        {avatar && !imageError ? (
          <img
            src={avatar}
            alt={name}
            className="testimonial-card-avatar"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className={`testimonial-card-avatar-placeholder ${style?.gradient || ''} ${style?.border || ''}`}>
            <User className={`testimonial-card-avatar-icon ${style?.iconColor || ''}`} />
          </div>
        )}
        <div className="testimonial-card-info">
          <p className="testimonial-card-name">{name}</p>
          <p className="testimonial-card-title">{title}</p>
        </div>
      </div>
      <blockquote className="testimonial-card-quote">
        "{testimonial.quote}"
      </blockquote>
    </Card>
  )
}

