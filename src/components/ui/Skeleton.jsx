import './Skeleton.css'

export function Skeleton({ className = '' }) {
  return (
    <div 
      className={`skeleton ${className}`}
      aria-hidden="true"
    >
      {/* Animated shimmer effect */}
      <div className="skeleton-shimmer" />
    </div>
  )
}

