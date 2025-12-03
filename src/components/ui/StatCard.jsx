import { Card } from './Card'
import './StatCard.css'

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subtext, 
  loading = false,
  className = '' 
}) {
  return (
    <Card className={`stat-card ${className}`}>
      <div className="stat-card-header">
        <div className="stat-card-icon-wrapper">
          <Icon className="stat-card-icon" />
        </div>
        <p className="stat-card-label">{label}</p>
      </div>
      <div className="stat-card-content">
        {loading ? (
          <div className="stat-card-skeleton"></div>
        ) : (
          <p className="stat-card-value">{value}</p>
        )}
        <p className="stat-card-subtext">{subtext}</p>
      </div>
    </Card>
  )
}

