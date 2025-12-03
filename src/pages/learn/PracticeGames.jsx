import { Link } from 'react-router-dom'
import { Container } from '../../components/ui/Container'
import { Card } from '../../components/ui/Card'
import { ArrowLeft, Gamepad2, Clock } from 'lucide-react'
import { useSEO } from '../../hooks/use-seo'
import { useLanguage } from '../../contexts/LanguageContext'
import './ResourcePage.css'

export function PracticeGames() {
  const { t } = useLanguage()

  useSEO({
    title: t('learn.resources.practice'),
    description: t('learn.comingSoonDescription'),
    url: '/learn/practice',
  })

  return (
    <Container>
      <div className="learn-resource-page">
        <Link
          to="/learn"
          className="learn-resource-back-button"
        >
          <ArrowLeft className="learn-resource-back-icon" />
          <span>{t('learn.backToLearn')}</span>
        </Link>

        <section className="learn-resource-hero">
          <div className="learn-resource-hero-icon-wrapper">
            <Gamepad2 className="learn-resource-hero-icon" />
          </div>
          <h1 className="learn-resource-hero-title">
            {t('learn.resources.practice')}
          </h1>
          <p className="learn-resource-hero-description">
            {t('learn.comingSoonDescription')}
          </p>
        </section>

        <section>
          <Card className="learn-resource-coming-soon">
            <div className="learn-resource-coming-soon-content">
              <div className="learn-resource-coming-soon-icon-wrapper">
                <Clock className="learn-resource-coming-soon-icon" />
              </div>
              <div>
                <p className="learn-resource-coming-soon-label">{t('learn.comingSoon')}</p>
                <p className="learn-resource-coming-soon-text">
                  {t('learn.stayTuned')}
                </p>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </Container>
  )
}

