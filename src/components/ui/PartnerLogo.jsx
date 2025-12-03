import { useState } from 'react'
import './PartnerLogo.css'

export function PartnerLogo({ partner }) {
  const [imageError, setImageError] = useState(false)

  if (!partner.logo_url || imageError) {
    return (
      <span className="partner-logo-placeholder">
        {partner.name}
      </span>
    )
  }

  return (
    <div className="partner-logo-wrapper">
      <img
        src={partner.logo_url}
        alt={partner.name}
        className="partner-logo"
        onError={() => setImageError(true)}
        loading="lazy"
      />
      <span className="partner-logo-name">{partner.name}</span>
    </div>
  )
}

