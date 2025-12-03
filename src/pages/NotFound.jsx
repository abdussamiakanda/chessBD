import { Link } from 'react-router-dom'
import { Container } from '../components/ui/Container'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { Home, Search } from 'lucide-react'
import './NotFound.css'

export function NotFound() {
  const { t } = useLanguage()

  useSEO({
    title: t('notFound.title'),
    description: t('notFound.description'),
    url: '/404',
  })

  return (
    <Container>
      <div className="not-found-page">
        <div className="not-found-content">
          <div className="not-found-icon-wrapper">
            <div className="not-found-icon">404</div>
          </div>
          
          <h1 className="not-found-title">{t('notFound.heading')}</h1>
          <p className="not-found-description">{t('notFound.message')}</p>

          <div className="not-found-actions">
            <Link to="/" className="not-found-button not-found-button-primary">
              <Home className="not-found-button-icon" />
              {t('notFound.goHome')}
            </Link>
            <Link to="/events" className="not-found-button not-found-button-secondary">
              <Search className="not-found-button-icon" />
              {t('notFound.browseEvents')}
            </Link>
          </div>

          <div className="not-found-suggestions">
            <h2 className="not-found-suggestions-title">{t('notFound.suggestionsTitle')}</h2>
            <ul className="not-found-suggestions-list">
              <li>
                <Link to="/">{t('nav.home')}</Link>
              </li>
              <li>
                <Link to="/events">{t('nav.events')}</Link>
              </li>
              <li>
                <Link to="/leaderboard">{t('nav.leaderboard')}</Link>
              </li>
              <li>
                <Link to="/news">{t('nav.news')}</Link>
              </li>
              <li>
                <Link to="/clubs">{t('nav.clubs')}</Link>
              </li>
              <li>
                <Link to="/watch">{t('nav.watch')}</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Container>
  )
}

