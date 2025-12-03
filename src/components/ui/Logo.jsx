import { Crown } from 'lucide-react'

export function Logo({ className = "w-8 h-8", style }) {
  return (
    <Crown 
      className={`${className} transition-colors`} 
      style={style || { color: 'var(--color-text-primary)' }} 
    />
  )
}

