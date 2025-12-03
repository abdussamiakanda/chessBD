import { Link } from 'react-router-dom'
import { Calendar, Trophy, Info, MessageSquare, Newspaper, BookOpen, Mail, Facebook, Youtube, Sparkles, Brain } from 'lucide-react'
import { DiscordIcon } from './ui/DiscordIcon'
import { ChesscomIcon } from './ui/ChesscomIcon'
import { LichessIcon } from './ui/LichessIcon'
import { Logo } from './ui/Logo'
import { useLanguage } from '../contexts/LanguageContext'
import './Footer.css'

const getFooterLinks = (t) => [
  {
    title: t('nav.compete'),
    items: [
      { label: t('nav.events'), href: '/events', icon: Calendar },
      { label: t('nav.leaderboard'), href: '/leaderboard', icon: Trophy },
      { label: t('nav.showcase'), href: '/showcase', icon: Sparkles },
    ],
  },
  {
    title: t('nav.learn'),
    items: [
      { label: t('nav.learn'), href: '/learn', icon: BookOpen },
      { label: t('nav.news'), href: '/news', icon: Newspaper },
      { label: t('nav.analysis'), href: '/analysis', icon: Brain },
    ],
  },
  {
    title: t('nav.community'),
    items: [
      { label: t('nav.forum'), href: '/forum', icon: MessageSquare },
      { label: t('nav.about'), href: '/about', icon: Info },
      { label: t('nav.contact'), href: '/contact', icon: Mail },
    ],
  },
]

const getSocialLinks = (t) => [
  { label: t('footer.facebook') || 'Facebook', href: 'https://www.facebook.com/teamchessbd/', icon: Facebook },
  { label: t('footer.youtube') || 'YouTube', href: 'https://www.youtube.com/@TeamChessBD', icon: Youtube },
  { label: t('footer.discord') || 'Discord', href: 'https://discord.gg/hyYchyQKDe', icon: DiscordIcon },
  { label: t('footer.chesscom') || 'Chess.com', href: 'https://www.chess.com/club/team-chessbd', icon: ChesscomIcon },
  { label: t('footer.lichess') || 'Lichess', href: 'https://lichess.org/team/team-chessbd', icon: LichessIcon },
]

export function Footer() {
  const { t } = useLanguage()
  const footerLinks = getFooterLinks(t)
  const socialLinks = getSocialLinks(t)
  
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-container">
        <div className="footer-content">
          {/* Brand Section */}
          <div className="footer-brand">
            <div className="footer-brand-header">
              <div className="footer-logo-wrapper">
                <Logo className="footer-logo" style={{ color: 'var(--color-text-primary)' }} />
              </div>
              <div>
                <h3 className="footer-brand-title">ChessBD</h3>
                <p className="footer-brand-subtitle">{t('home.subtitle')}</p>
              </div>
            </div>
            <p className="footer-description">
              {t('footer.description') || 'Empowering Bangladeshi chess players with modern training tools, verified leaderboards, and inclusive events.'}
            </p>
            <div className="footer-social">
              {socialLinks.map((social) => {
                const IconComponent = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target={social.href.startsWith('http') ? '_blank' : undefined}
                    rel={social.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="footer-social-link"
                  >
                    <IconComponent className="footer-social-icon" />
                    <span className="footer-social-label">{social.label}</span>
                  </a>
                )
              })}
            </div>
          </div>

          {/* Links Sections */}
          {footerLinks.map((section) => (
            <div key={section.title} className="footer-links-section">
              <h4 className="footer-links-title">{section.title}</h4>
              <ul className="footer-links-list">
                {section.items.map((item) => {
                  const IconComponent = item.icon
                  return (
                    <li key={item.label}>
                      <Link
                        to={item.href}
                        className="footer-link"
                      >
                        <IconComponent className="footer-link-icon" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            {t('footer.copyright')?.replace('{{year}}', String(new Date().getFullYear())) || `© ${new Date().getFullYear()} ChessBD. Crafted in Bangladesh with inspiration from the global chess family.`}
          </p>
          <div className="footer-bottom-links">
            <Link to="/policy" className="footer-bottom-link">
              {t('footer.policy') || 'Privacy Policy'}
            </Link>
            <Link to="/terms" className="footer-bottom-link">
              {t('footer.terms') || 'Terms of Service'}
            </Link>
            <Link to="/about" className="footer-bottom-link">
              {t('nav.about')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

