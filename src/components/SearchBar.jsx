import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, ArrowRight } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import './SearchBar.css'

/**
 * SearchBar Component
 * Provides a search input with keyboard shortcuts and navigation
 */
export function SearchBar({ className = '', onClose }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  // Focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim().length >= 2) {
      // Navigate to search results using React Router
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setQuery('')
      onClose?.()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose?.()
    }
  }

  const handleClear = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className={`search-bar-form ${className}`}>
      <div className="search-bar-input-wrapper">
        <Search className="search-bar-icon" size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="search-bar-input"
          aria-label={t('common.search')}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="search-bar-clear"
            aria-label={t('common.close')}
          >
            <X className="search-bar-clear-icon" size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={query.trim().length < 2}
        className="search-bar-submit"
        aria-label={t('common.search')}
      >
        <span className="search-bar-submit-text">{t('search.button')}</span>
        <ArrowRight className="search-bar-submit-icon" size={18} aria-hidden="true" />
      </button>
    </form>
  )
}

