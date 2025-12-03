import { useState, useEffect, useCallback } from 'react'
import { Palette } from 'lucide-react'
import './ThemeSwitcher.css'

/**
 * Theme Switcher Component
 * Cycles through Default, Dark, and Light themes
 * Applies CSS custom properties for theming
 */

const themes = {
  default: {
    name: 'Default',
    colors: {
      '--color-0': '#F5E8E0',
      '--color-1': '#E6C6B2',
      '--color-2': '#DCAF93',
      '--color-3': '#D29874',
      '--color-4': '#C88156',
      '--color-5': '#B96C3C',
      '--color-6': '#9A5A32',
      '--color-7': '#7B4828',
      '--color-8': '#5C361E',
      '--color-9': '#3E2414',
      '--color-10': '#1F120A',
      '--color-danger': '#dc2626',
      '--color-danger-hover': '#fca5a5',
    }
  },
  dark: {
    name: 'Dark',
    colors: {
      '--color-0': '#000000',
      '--color-1': '#1a1a1a',
      '--color-2': '#333333',
      '--color-3': '#4d4d4d',
      '--color-4': '#666666',
      '--color-5': '#808080',
      '--color-6': '#999999',
      '--color-7': '#b3b3b3',
      '--color-8': '#cccccc',
      '--color-9': '#e6e6e6',
      '--color-10': '#ffffff',
      '--color-danger': '#ef4444',
      '--color-danger-hover': '#7f1d1d',
    }
  },
  light: {
    name: 'Light',
    colors: {
      '--color-0': '#ffffff',
      '--color-1': '#e6e6e6',
      '--color-2': '#cccccc',
      '--color-3': '#b3b3b3',
      '--color-4': '#999999',
      '--color-5': '#808080',
      '--color-6': '#666666',
      '--color-7': '#4d4d4d',
      '--color-8': '#333333',
      '--color-9': '#1a1a1a',
      '--color-10': '#000000',
      '--color-danger': '#dc2626',
      '--color-danger-hover': '#fee2e2',
    }
  }
}

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chessbd-theme')
      return saved && themes[saved] ? saved : 'light'
    }
    return 'light'
  })

  // Apply theme to document
  const applyTheme = useCallback((themeName) => {
    const theme = themes[themeName]
    if (!theme) return
    
    const root = document.documentElement
    Object.entries(theme.colors).forEach(([property, value]) => {
      root.style.setProperty(property, value)
    })
  }, [])

  // Initialize theme on mount
  useEffect(() => {
    applyTheme(currentTheme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update theme when currentTheme changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chessbd-theme', currentTheme)
    }
    applyTheme(currentTheme)
  }, [currentTheme, applyTheme])

  const themeOrder = ['default', 'dark', 'light']
  
  const cycleTheme = () => {
    const currentIndex = themeOrder.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setCurrentTheme(themeOrder[nextIndex])
  }

  const nextTheme = themeOrder[(themeOrder.indexOf(currentTheme) + 1) % themeOrder.length]

  return (
    <button
      onClick={cycleTheme}
      className="theme-switcher-btn"
      aria-label={`Current theme: ${themes[currentTheme].name}. Click to cycle themes`}
      title={`Current theme: ${themes[currentTheme].name}. Click to change to ${themes[nextTheme].name}`}
      type="button"
    >
      <Palette className="theme-switcher-icon" size={16} aria-hidden="true" />
      <span className="theme-switcher-text" aria-hidden="false">
        {themes[currentTheme].name}
      </span>
    </button>
  )
}

