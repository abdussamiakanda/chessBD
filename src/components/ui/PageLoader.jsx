import { Loader2 } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import './PageLoader.css'

export function PageLoader() {
  const { t } = useLanguage()
  
  return (
    <div className="page-loader">
      <div className="page-loader-content">
        {/* Animated background glow */}
        <div className="page-loader-glow"></div>
        
        {/* Main loading content */}
        <div className="page-loader-main">
          {/* Spinning loader with glow effect */}
          <div className="page-loader-spinner-wrapper">
            <div className="page-loader-spinner-glow"></div>
            <Loader2 className="page-loader-spinner" />
          </div>
          
          {/* Loading text with fade animation */}
          <div className="page-loader-text">
            <h2 className="page-loader-title">
              {t('common.loading') || 'Loading...'}
            </h2>
            <p className="page-loader-subtitle">
              {t('common.preparingExperience') || 'Preparing your experience'}
            </p>
          </div>
          
          {/* Animated dots */}
          <div className="page-loader-dots">
            <div className="page-loader-dot page-loader-dot-1"></div>
            <div className="page-loader-dot page-loader-dot-2"></div>
            <div className="page-loader-dot page-loader-dot-3"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

