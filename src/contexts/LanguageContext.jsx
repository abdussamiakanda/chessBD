import { createContext, useContext, useState, useEffect } from 'react'
import enTranslations from '../locales/en.json'
import bnTranslations from '../locales/bn.json'

const LanguageContext = createContext(undefined)

// Translation files
const translations = {
  en: enTranslations,
  bn: bnTranslations,
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    // Get from localStorage or default to 'en'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chessbd-language')
      return saved && (saved === 'en' || saved === 'bn') ? saved : 'en'
    }
    return 'en'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chessbd-language', language)
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = (lang) => {
    setLanguageState(lang)
  }

  const t = (key, params) => {
    const keys = key.split('.')
    let value = translations[language]
    
    for (const k of keys) {
      value = value?.[k]
    }
    
    if (value === undefined) {
      // Fallback to English if translation missing
      let fallback = translations.en
      for (const k of keys) {
        fallback = fallback?.[k]
      }
      value = fallback || key
    }
    
    // Replace parameters if provided
    if (params && typeof value === 'string') {
      return value.replace(/\{\{(\w+)\}\}/g, (match, param) => {
        return params[param]?.toString() || match
      })
    }
    
    return value || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

