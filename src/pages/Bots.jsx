import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { PageLoader } from '../components/ui/PageLoader'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuthStore } from '../store/auth-store'
import { Link } from 'react-router-dom'
import { ArrowRight, Package, Bot, Cpu } from 'lucide-react'
import { getBots } from '../lib/bots'
import './Bots.css'

export function Bots() {
  const { t } = useLanguage()
  const { loading: authLoading } = useAuthStore()

  useSEO({
    title: t('bots.title'),
    description: t('bots.description'),
    url: '/bots',
    keywords: 'chess bots, chess engines, play against bot, chess AI, chess computer',
  })

  const bots = getBots()

  if (authLoading) {
    return <PageLoader />
  }

  return (
    <Container>
      <div className="bots-page">
        {/* Hero Section */}
        <section className="bots-hero">
          <div className="bots-hero-content">
            <p className="bots-hero-label">{t('bots.heroLabel')}</p>
            <h1 className="bots-hero-title">{t('bots.title')}</h1>
            <p className="bots-hero-description">{t('bots.description')}</p>
          </div>
        </section>

        {/* Bots Grid */}
        <section className="bots-grid-section">
          {bots.length === 0 ? (
            <Card className="bots-empty-card">
              <div className="bots-empty-content">
                <div className="bots-empty-icon-wrapper">
                  <Package className="bots-empty-icon" />
                </div>
                <h2 className="bots-empty-title">{t('bots.emptyTitle')}</h2>
                <p className="bots-empty-message">{t('bots.emptyMessage')}</p>
              </div>
            </Card>
          ) : (
            <div className="bots-grid">
              {bots.map((bot) => {
                return (
                  <Link key={bot.id} to={bot.link} className="bots-card-link">
                    <Card className="bots-card">
                      <div className="bots-card-content">
                        <div className="bots-card-header">
                          <div className="bots-icon-wrapper">
                            <img 
                              src={bot.icon} 
                              alt={t(`bots.${bot.id}.name`) || bot.name}
                              className="bots-icon-image"
                            />
                          </div>
                          <div className="bots-info">
                            <h3 className="bots-name">{t(`bots.${bot.id}.name`) || bot.name}</h3>
                            <div className="bots-meta">
                              <span className="bots-strength">{t(`bots.${bot.id}.strength`) || bot.strength}</span>
                              {bot.elo && (
                                <span className="bots-elo">Elo: {bot.elo}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="bots-description-wrapper">
                          <p className="bots-description">
                            {t(`bots.${bot.id}.description`) || bot.description}
                          </p>
                        </div>
                        
                        <div className="bots-cta">
                          <span className="bots-cta-text">{t('bots.playNow') || 'Play Now'}</span>
                          <ArrowRight className="bots-cta-icon" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Bot Features Section */}
        <section className="bots-features-section">
          <div className="bots-features-header">
            <div className="bots-features-header-text">
              <p className="bots-features-label">Features</p>
              <h2 className="bots-features-title">Bot Features</h2>
              <p className="bots-features-description">Explore advanced bot interactions</p>
            </div>
          </div>
          <div className="bots-features-grid">
            <Link to="/bot-vs-bot" className="bots-feature-link">
              <Card className="bots-feature-card">
                <div className="bots-feature-content">
                  <div className="bots-feature-header">
                    <div className="bots-feature-icon-wrapper">
                      <Bot className="bots-feature-icon" />
                    </div>
                    <h3 className="bots-feature-title">Bot vs Bot</h3>
                  </div>
                  <p className="bots-feature-description">
                    Watch two bots play against each other. Select any two bots and see them compete.
                  </p>
                  <div className="bots-feature-cta">
                    <span>Try Bot vs Bot</span>
                    <ArrowRight className="bots-feature-cta-icon" />
                  </div>
                </div>
              </Card>
            </Link>

            <Link to="/bot-tournaments" className="bots-feature-link">
              <Card className="bots-feature-card">
                <div className="bots-feature-content">
                  <div className="bots-feature-header">
                    <div className="bots-feature-icon-wrapper">
                      <Cpu className="bots-feature-icon" />
                    </div>
                    <h3 className="bots-feature-title">Bot Tournaments</h3>
                  </div>
                  <p className="bots-feature-description">
                    Create and watch tournaments where bots compete in round-robin format. Admin only.
                  </p>
                  <div className="bots-feature-cta">
                    <span>View Tournaments</span>
                    <ArrowRight className="bots-feature-cta-icon" />
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </section>
      </div>
    </Container>
  )
}

