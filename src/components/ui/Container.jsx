import './Container.css'

export function Container({ children, className = '' }) {
  return (
    <div className={`container container-max-width ${className}`}>
      {children}
    </div>
  )
}

