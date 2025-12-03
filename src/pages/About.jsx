import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { ActionCard } from '../components/ui/ActionCard'
import { Trophy, Users, Zap, Award, ExternalLink, UserCheck, Gamepad2, BarChart3 } from 'lucide-react'
import { DiscordIcon } from '../components/ui/DiscordIcon'
import { ChesscomIcon } from '../components/ui/ChesscomIcon'
import { LichessIcon } from '../components/ui/LichessIcon'
import { useStats } from '../hooks/use-stats'
import { useLanguage } from '../contexts/LanguageContext'
import './About.css'

export function About() {
  const { t } = useLanguage()
  const { data: stats, isLoading: statsLoading } = useStats()

  const formatNumber = (num) => {
    if (num >= 1000) {
      const k = num / 1000
      // If it's a whole number, don't show decimal
      if (k % 1 === 0) {
        return `${k}k`
      }
      // Otherwise show one decimal place
      return `${k.toFixed(1)}k`
    }
    return `${num}`
  }

  const features = [
    {
      icon: Trophy,
      title: t('about.feature.tournamentManagement.title'),
      description: t('about.feature.tournamentManagement.description'),
    },
    {
      icon: Users,
      title: t('about.feature.communityDriven.title'),
      description: t('about.feature.communityDriven.description'),
    },
    {
      icon: ChesscomIcon,
      title: t('about.feature.chesscomIntegration.title'),
      description: t('about.feature.chesscomIntegration.description'),
    },
    {
      icon: Zap,
      title: t('about.feature.realTimeUpdates.title'),
      description: t('about.feature.realTimeUpdates.description'),
    },
    {
      icon: BarChart3,
      title: t('about.feature.gameAnalysis.title'),
      description: t('about.feature.gameAnalysis.description'),
    },
    {
      icon: Award,
      title: t('about.feature.ratingSystem.title'),
      description: t('about.feature.ratingSystem.description'),
    },
  ]

  const statsData = [
    { 
      label: t('about.stats.verifiedPlayers'), 
      value: stats ? `${formatNumber(stats.verifiedUsers)}+` : '0',
      icon: UserCheck,
      subtext: t('home.chesscomLichessFeeds') || 'Chess.com + Lichess feeds',
    },
    { 
      label: t('about.stats.tournaments'), 
      value: stats ? `${formatNumber(stats.totalEvents)}+` : '0',
      icon: Trophy,
      subtext: t('home.nationalAndOnline') || 'National & Online',
    },
    { 
      label: t('about.stats.gamesPlayed'), 
      value: stats ? `${formatNumber(stats.totalGames)}+` : '0',
      icon: Gamepad2,
      subtext: t('home.autoSyncedGames') || 'Auto-synced games',
    },
    { 
      label: t('about.stats.communityMembers'), 
      value: stats ? `${formatNumber(stats.totalUsers)}+` : '0',
      icon: Users,
      subtext: t('home.activeCommunity') || 'Active community',
    },
  ]

  return (
    <Container>
      <div className="about-page">
        {/* Hero Section */}
        <section className="about-hero">
          <div className="about-hero-content">
            <p className="about-hero-label">{t('about.aboutUs') || 'About Us'}</p>
            <h1 className="about-hero-title">
              {t('about.title')}
            </h1>
          </div>
          <p className="about-hero-description">
            {t('about.descriptionFull')}
          </p>
          <div className="about-hero-disclaimer">
            <p className="about-hero-disclaimer-text">
              {t('about.disclaimer')}
            </p>
          </div>
        </section>

        {/* Stats Section */}
        <section className="about-stats">
          <div className="about-stats-grid">
            {statsData.map((stat, index) => (
              <StatCard
                key={index}
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                subtext={stat.subtext}
                loading={statsLoading}
              />
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="about-features">
          <div className="about-features-header">
            <p className="about-features-label">{t('about.featuresLabel') || 'Features'}</p>
            <h2 className="about-features-title">
              {t('about.features')}
            </h2>
          </div>
          <div className="about-features-grid">
            {features.map((feature, index) => (
              <ActionCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                showActions={false}
              />
            ))}
          </div>
        </section>

        {/* Mission Section */}
        <section className="about-mission">
          <Card className="about-mission-card">
            <div className="about-mission-card-glow"></div>
            <div className="about-mission-card-content">
              <div className="about-mission-header">
                <p className="about-mission-label">{t('about.mission.label') || 'Our Mission'}</p>
                <h2 className="about-mission-title">
                  {t('about.mission.title')}
                </h2>
              </div>
              <div className="about-mission-text">
                <p className="about-mission-paragraph">
                  {t('about.mission.paragraph1')}
                </p>
                <p className="about-mission-paragraph">
                  {t('about.mission.paragraph2')}
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* How It Works */}
        <section className="about-how-it-works">
          <div className="about-how-it-works-header">
            <p className="about-how-it-works-label">{t('about.howItWorks.label') || 'How It Works'}</p>
            <h2 className="about-how-it-works-title">
              {t('about.howItWorks.title')}
            </h2>
          </div>
          <div className="about-how-it-works-grid">
            <Card className="about-step-card">
              <div className="about-step-card-glow"></div>
              <div className="about-step-card-content">
                <div className="about-step-number-wrapper">
                  <div className="about-step-number">1</div>
                </div>
                <h3 className="about-step-title">{t('about.howItWorks.step1.title')}</h3>
                <p className="about-step-description">
                  {t('about.howItWorks.step1.description')}
                </p>
              </div>
            </Card>
            <Card className="about-step-card">
              <div className="about-step-card-glow"></div>
              <div className="about-step-card-content">
                <div className="about-step-number-wrapper">
                  <div className="about-step-number">2</div>
                </div>
                <h3 className="about-step-title">{t('about.howItWorks.step2.title')}</h3>
                <p className="about-step-description">
                  {t('about.howItWorks.step2.description')}
                </p>
              </div>
            </Card>
            <Card className="about-step-card">
              <div className="about-step-card-glow"></div>
              <div className="about-step-card-content">
                <div className="about-step-number-wrapper">
                  <div className="about-step-number">3</div>
                </div>
                <h3 className="about-step-title">{t('about.howItWorks.step3.title')}</h3>
                <p className="about-step-description">
                  {t('about.howItWorks.step3.description')}
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* Join Community */}
        <section className="about-join-community">
          <Card className="about-join-community-card">
            <div className="about-join-community-card-glow"></div>
            <div className="about-join-community-card-content">
              <div className="about-join-community-header">
                <p className="about-join-community-label">{t('about.joinCommunity.label') || 'Join Us'}</p>
                <h2 className="about-join-community-title">
                  {t('about.joinCommunity.title')}
                </h2>
              </div>
              <p className="about-join-community-description">
                {t('about.joinCommunity.description')}
              </p>
              <div className="about-join-community-buttons">
                <a
                  href="https://discord.gg/hyYchyQKDe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-join-community-btn about-join-community-btn-discord"
                >
                  <DiscordIcon className="about-join-community-btn-icon" />
                  {t('about.joinCommunity.discordServer')}
                  <ExternalLink className="about-join-community-btn-external" />
                </a>
                <a
                  href="https://www.chess.com/club/team-chessbd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-join-community-btn about-join-community-btn-secondary"
                >
                  <ChesscomIcon className="about-join-community-btn-icon" />
                  {t('about.joinCommunity.chesscomClub')}
                  <ExternalLink className="about-join-community-btn-external" />
                </a>
                <a
                  href="https://lichess.org/team/team-chessbd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-join-community-btn about-join-community-btn-secondary"
                >
                  <LichessIcon className="about-join-community-btn-icon" />
                  {t('about.joinCommunity.lichessTeam') || 'Lichess Team'}
                  <ExternalLink className="about-join-community-btn-external" />
                </a>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </Container>
  )
}

