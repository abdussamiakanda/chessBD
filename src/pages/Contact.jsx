import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { MessageSquare, ExternalLink, Mail } from 'lucide-react'
import { DiscordIcon } from '../components/ui/DiscordIcon'
import { ChesscomIcon } from '../components/ui/ChesscomIcon'
import { LichessIcon } from '../components/ui/LichessIcon'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import './Contact.css'

export function Contact() {
  const { t } = useLanguage()
  
  useSEO({
    title: t('contact.title'),
    description: t('contact.description'),
    keywords: 'contact ChessBD, support, Discord, Chess.com club, Lichess team, community',
    url: '/contact',
  })

  const contactMethods = [
    {
      icon: DiscordIcon,
      title: t('contact.discordServer'),
      description: t('contact.discordDescription'),
      link: 'https://discord.gg/hyYchyQKDe',
      linkText: t('contact.joinDiscord'),
      isDiscord: true,
    },
    {
      icon: ChesscomIcon,
      title: t('contact.chesscomClub'),
      description: t('contact.chesscomDescription'),
      link: 'https://www.chess.com/club/team-chessbd',
      linkText: t('contact.joinClub'),
    },
    {
      icon: LichessIcon,
      title: t('contact.lichessTeam'),
      description: t('contact.lichessDescription'),
      link: 'https://lichess.org/team/team-chessbd',
      linkText: t('contact.joinTeam'),
    },
    {
      icon: Mail,
      title: t('contact.emailSupport'),
      description: t('contact.emailDescription'),
      link: `mailto:${t('contact.supportEmail')}`,
      linkText: t('contact.sendEmail'),
    },
  ]

  return (
    <Container>
      {/* Hero Section */}
      <section className="contact-hero">
          <div className="contact-hero-content">
            <p className="contact-hero-label">{t('contact.subtitle')}</p>
            <h1 className="contact-hero-title">
              {t('contact.title')}
            </h1>
          </div>
          <p className="contact-hero-description">
            {t('contact.description')}
          </p>
        </section>

        {/* Contact Methods */}
        <section className="contact-methods">
          <div className="contact-methods-grid">
            {contactMethods.map((method, index) => {
              const Icon = method.icon
              return (
                <Card key={index} className={`contact-method-card ${method.isDiscord ? 'contact-method-discord' : ''}`}>
                  <div className="contact-method-header">
                    <div className={`contact-method-icon ${method.isDiscord ? 'contact-method-icon-discord' : ''}`}>
                      <Icon className={`contact-method-icon-svg ${method.isDiscord ? 'contact-method-icon-svg-discord' : ''}`} />
                    </div>
                    <h3 className="contact-method-title">
                      {method.title}
                    </h3>
                  </div>
                  <p className="contact-method-description">
                    {method.description}
                  </p>
                  <a
                    href={method.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`contact-method-link ${method.isDiscord ? 'contact-method-link-discord' : 'contact-method-link-secondary'}`}
                  >
                    <span>{method.linkText}</span>
                    <ExternalLink className="contact-method-link-icon" />
                  </a>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Additional Information */}
        <section className="contact-info">
          <Card className="contact-info-card">
            <div className="contact-info-card-content">
              <div className="contact-info-icon">
                <MessageSquare className="contact-info-icon-svg" />
              </div>
              <div className="contact-info-header">
                <p className="contact-info-label">{t('contact.communitySupport')}</p>
                <h2 className="contact-info-title">
                  {t('contact.weAreHereToHelp')}
                </h2>
              </div>
              <p className="contact-info-description">
                {t('contact.supportDescription')}
              </p>
              <div className="contact-info-buttons">
                <a
                  href="https://discord.gg/hyYchyQKDe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-info-button contact-info-button-discord"
                >
                  <DiscordIcon className="contact-info-button-icon" />
                  {t('contact.joinDiscordServer')}
                  <ExternalLink className="contact-info-button-link-icon" />
                </a>
              <a
                href="https://www.chess.com/club/team-chessbd"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-info-button contact-info-button-secondary"
              >
                <ChesscomIcon className="contact-info-button-icon" />
                {t('contact.chesscomClubButton')}
                <ExternalLink className="contact-info-button-link-icon" />
              </a>
              <a
                href="https://lichess.org/team/team-chessbd"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-info-button contact-info-button-secondary"
              >
                <LichessIcon className="contact-info-button-icon" />
                {t('contact.lichessTeamButton')}
                <ExternalLink className="contact-info-button-link-icon" />
              </a>
              </div>
            </div>
          </Card>
        </section>
    </Container>
  )
}

