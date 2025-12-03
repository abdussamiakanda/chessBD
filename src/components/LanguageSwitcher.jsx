import { Globe } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import './LanguageSwitcher.css'

/**
 * Language Switcher Component
 * Toggles between English and Bengali languages
 */
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'bn' : 'en'
    setLanguage(newLang)
  }

  return (
    <button
      onClick={toggleLanguage}
      className="language-switcher-btn"
      aria-label={`Current language: ${language === 'en' ? 'English' : 'Bengali'}. Click to switch to ${language === 'en' ? 'Bengali' : 'English'}`}
      title={language === 'en' ? 'Switch to Bengali (বাংলা)' : 'Switch to English'}
      type="button"
    >
      <Globe className="language-switcher-icon" size={16} aria-hidden="true" />
      <span className="language-switcher-text" aria-hidden="false">
        {language === 'en' ? 'EN' : 'BN'}
      </span>
    </button>
  )
}

