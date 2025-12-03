import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { FileText, Mail } from 'lucide-react'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import './Terms.css'

export function Terms() {
  const { t } = useLanguage()
  useSEO({
    title: t('policy.terms.seoTitle'),
    description: t('policy.terms.seoDescription'),
    keywords: t('policy.terms.seoKeywords'),
    url: '/terms',
  })

  const content = [
    {
      heading: t('policy.termsOfService.acceptanceOfTerms.heading'),
      text: t('policy.termsOfService.acceptanceOfTerms.text'),
    },
    {
      heading: t('policy.termsOfService.userAccounts.heading'),
      text: t('policy.termsOfService.userAccounts.text'),
    },
    {
      heading: t('policy.termsOfService.userConduct.heading'),
      text: t('policy.termsOfService.userConduct.text'),
    },
    {
      heading: t('policy.termsOfService.tournamentParticipation.heading'),
      text: t('policy.termsOfService.tournamentParticipation.text'),
    },
    {
      heading: t('policy.termsOfService.intellectualProperty.heading'),
      text: t('policy.termsOfService.intellectualProperty.text'),
    },
    {
      heading: t('policy.termsOfService.limitationOfLiability.heading'),
      text: t('policy.termsOfService.limitationOfLiability.text'),
    },
    {
      heading: t('policy.termsOfService.termination.heading'),
      text: t('policy.termsOfService.termination.text'),
    },
  ]

  return (
    <Container>
      {/* Hero Section */}
      <section className="terms-hero">
          <div className="terms-hero-content">
            <p className="terms-hero-label">{t('policy.terms.subtitle')}</p>
            <h1 className="terms-hero-title">
              {t('policy.termsOfService.title')}
            </h1>
          </div>
          <p className="terms-hero-description">
            {t('policy.description')}
          </p>
        </section>

        {/* Terms Content */}
        <section className="terms-content-section">
          <Card className="terms-card">
            <div className="terms-card-header">
              <div className="terms-card-icon">
                <FileText className="terms-icon" />
              </div>
              <h2 className="terms-card-title">
                {t('policy.termsOfService.title')}
              </h2>
            </div>
            <div className="terms-card-content">
              {content.map((item, itemIndex) => (
                <div key={itemIndex} className="terms-content-item">
                  <h3 className="terms-content-heading">
                    {item.heading}
                  </h3>
                  <p className="terms-content-text">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Contact Section */}
        <section className="terms-contact">
          <Card className="terms-contact-card">
            <div className="terms-contact-card-content">
              <div className="terms-contact-icon">
                <Mail className="terms-contact-icon-svg" />
              </div>
              <div className="terms-contact-header">
                <p className="terms-contact-label">{t('policy.contact.contactUs')}</p>
                <h2 className="terms-contact-title">
                  {t('policy.contact.title')}
                </h2>
              </div>
              <p className="terms-contact-description">
                {t('policy.contact.description')}{' '}
                <a
                  href="https://discord.gg/hyYchyQKDe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="terms-contact-link"
                >
                  {t('policy.contact.discordServer')}
                </a>
                {' '}{t('policy.contact.or')}{' '}
                <a
                  href="https://www.chess.com/club/team-chessbd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="terms-contact-link"
                >
                  {t('policy.contact.chesscomClub')}
                </a>
                .
              </p>
              <p className="terms-contact-updated">
                {t('policy.contact.lastUpdated')} {new Intl.DateTimeFormat('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
                }).format(new Date())}
              </p>
            </div>
          </Card>
        </section>
    </Container>
  )
}

