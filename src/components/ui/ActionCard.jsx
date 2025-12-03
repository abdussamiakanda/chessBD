import { Link } from 'react-router-dom'
import { Card } from './Card'
import { ArrowRight } from 'lucide-react'
import './ActionCard.css'

export function ActionCard({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel,
  actionText,
  actionTo,
  showActions = true,
  className = '' 
}) {
  return (
    <Card className={`action-card ${className}`}>
      <div className="action-card-header">
        <div className="action-card-icon-wrapper">
          <Icon className="action-card-icon" />
        </div>
        <h3 className="action-card-title">{title}</h3>
      </div>
      <p className="action-card-description">{description}</p>
      {showActions && actionLabel && actionText && actionTo && (
        <div className="action-card-footer">
          <p className="action-card-label">{actionLabel}</p>
          <Link to={actionTo} className="action-card-btn">
            <span>{actionText}</span>
            <ArrowRight className="action-card-btn-icon" />
          </Link>
        </div>
      )}
    </Card>
  )
}

