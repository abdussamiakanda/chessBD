import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Shield, Lock, Mail } from 'lucide-react'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import './Policy.css'

export function Policy() {
  const { t } = useLanguage()
  useSEO({
    title: t('policy.seoTitle'),
    description: t('policy.seoDescription'),
    keywords: t('policy.seoKeywords'),
    url: '/policy',
  })
  const sections = [
    {
      icon: Shield,
      title: t('policy.privacyPolicy.title'),
      content: [
        {
          heading: t('policy.privacyPolicy.informationWeCollect.heading'),
          text: t('policy.privacyPolicy.informationWeCollect.text'),
        },
        {
          heading: t('policy.privacyPolicy.howWeUseYourInformation.heading'),
          text: t('policy.privacyPolicy.howWeUseYourInformation.text'),
        },
        {
          heading: t('policy.privacyPolicy.dataSharing.heading'),
          text: t('policy.privacyPolicy.dataSharing.text'),
        },
        {
          heading: t('policy.privacyPolicy.dataSecurity.heading'),
          text: t('policy.privacyPolicy.dataSecurity.text'),
        },
        {
          heading: t('policy.privacyPolicy.yourRights.heading'),
          text: t('policy.privacyPolicy.yourRights.text'),
        },
      ],
    },
    {
      icon: Lock,
      title: t('policy.dataProtection.title'),
      content: [
        {
          heading: t('policy.dataProtection.dataCollection.heading'),
          text: t('policy.dataProtection.dataCollection.text'),
        },
        {
          heading: t('policy.dataProtection.dataStorage.heading'),
          text: t('policy.dataProtection.dataStorage.text'),
        },
        {
          heading: t('policy.dataProtection.dataRetention.heading'),
          text: t('policy.dataProtection.dataRetention.text'),
        },
        {
          heading: t('policy.dataProtection.thirdPartyServices.heading'),
          text: t('policy.dataProtection.thirdPartyServices.text'),
        },
      ],
    },
  ]

  return (
    <Container>
      {/* Hero Section */}
      <section className="policy-hero">
          <div className="policy-hero-content">
            <p className="policy-hero-label">{t('policy.subtitle')}</p>
            <h1 className="policy-hero-title">
              {t('policy.privacyPolicy.title')}
            </h1>
          </div>
          <p className="policy-hero-description">
            {t('policy.description')}
          </p>
        </section>

        {/* Policy Sections */}
        <div className="policy-sections">
          {sections.map((section, sectionIndex) => {
            const Icon = section.icon
            return (
              <section key={sectionIndex} className="policy-section">
                <Card className="policy-card">
                  <div className="policy-card-header">
                    <div className="policy-card-icon">
                      <Icon className="policy-icon" />
                    </div>
                    <h2 className="policy-card-title">
                      {section.title}
                    </h2>
                  </div>
                  <div className="policy-card-content">
                    {section.content.map((item, itemIndex) => (
                      <div key={itemIndex} className="policy-content-item">
                        <h3 className="policy-content-heading">
                          {item.heading}
                        </h3>
                        <p className="policy-content-text">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            )
          })}
        </div>

        {/* Contact Section */}
        <section className="policy-contact">
          <Card className="policy-contact-card">
            <div className="policy-contact-card-content">
              <div className="policy-contact-icon">
                <Mail className="policy-contact-icon-svg" />
              </div>
              <div className="policy-contact-header">
                <p className="policy-contact-label">{t('policy.contact.contactUs')}</p>
                <h2 className="policy-contact-title">
                  {t('policy.contact.title')}
                </h2>
              </div>
              <p className="policy-contact-description">
                {t('policy.contact.description')}{' '}
                <a
                  href="https://discord.gg/hyYchyQKDe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="policy-contact-link"
                >
                  {t('policy.contact.discordServer')}
                </a>
                {' '}{t('policy.contact.or')}{' '}
                <a
                  href="https://www.chess.com/club/team-chessbd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="policy-contact-link"
                >
                  {t('policy.contact.chesscomClub')}
                </a>
                .
              </p>
              <p className="policy-contact-updated">
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

