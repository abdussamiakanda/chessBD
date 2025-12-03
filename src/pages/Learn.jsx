import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { BookOpen, Target, Puzzle, Cpu, Crown, Brain, Layers, Video, GraduationCap, FileText, Book, Network } from 'lucide-react'
import { useSEO } from '../hooks/use-seo'
import { useLanguage } from '../contexts/LanguageContext'
import { Link } from 'react-router-dom'
import './Learn.css'

export function Learn() {
  const { t } = useLanguage()
  
  useSEO({
    title: t('learn.title'),
    description: t('learn.description'),
    keywords: 'chess learning, chess tutorials, chess basics, chess tactics, chess openings, chess endgames, chess puzzles',
    url: '/learn',
  })

  const categories = [
    {
      id: 'basics',
      icon: BookOpen,
      title: t('learn.categories.basics.title'),
      description: t('learn.categories.basics.description'),
      href: '/learn/basics',
    },
    {
      id: 'tactics',
      icon: Target,
      title: t('learn.categories.tactics.title'),
      description: t('learn.categories.tactics.description'),
      href: '/learn/tactics',
    },
    {
      id: 'openings',
      icon: Layers,
      title: t('learn.categories.openings.title'),
      description: t('learn.categories.openings.description'),
      href: '/learn/openings',
    },
    {
      id: 'endgames',
      icon: Crown,
      title: t('learn.categories.endgames.title'),
      description: t('learn.categories.endgames.description'),
      href: '/learn/endgames',
    },
    {
      id: 'strategy',
      icon: Network,
      title: t('learn.categories.strategy.title'),
      description: t('learn.categories.strategy.description'),
      href: '/learn/strategy',
    },
    {
      id: 'analysis',
      icon: Brain,
      title: t('learn.categories.analysis.title'),
      description: t('learn.categories.analysis.description'),
      href: '/analysis',
    },
  ]

  const resources = [
    {
      icon: Video,
      title: t('learn.resources.videos'),
      link: '/learn/tutorials',
    },
    {
      icon: Puzzle,
      title: t('learn.resources.puzzles'),
      link: '/puzzles',
    },
    {
      icon: GraduationCap,
      title: t('learn.resources.lessons'),
      link: '/learn/lessons',
    },
    {
      icon: FileText,
      title: t('learn.resources.articles'),
      link: null,
    },
    {
      icon: Book,
      title: t('learn.resources.books'),
      link: '/learn/books',
    },
    {
      icon: Cpu,
      title: `${t('nav.play')} ${t('nav.engine')}`,
      link: '/engine',
    },
  ]

  return (
    <Container>
      <div className="learn-page">
        {/* Hero Section */}
        <section className="learn-hero">
          <div className="learn-hero-content">
            <p className="learn-hero-label">{t('learn.masterTheGame')}</p>
            <h1 className="learn-hero-title">{t('learn.title')}</h1>
            <p className="learn-hero-description">{t('learn.descriptionFull') || t('learn.description')}</p>
          </div>
        </section>

        {/* Learning Categories */}
        <section className="learn-categories">
          <div className="learn-categories-header">
            <p className="learn-categories-label">{t('learn.learningPaths') || 'Learning paths'}</p>
            <h2 className="learn-categories-title">{t('learn.categoriesTitle')}</h2>
            <p className="learn-categories-description">{t('learn.categoriesDescription')}</p>
          </div>

          <div className="learn-categories-grid">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <Link
                  key={category.id}
                  to={category.href}
                  className="learn-category-card-link"
                >
                  <Card className="learn-category-card">
                    <div className="learn-category-card-content">
                      <div className="learn-category-header">
                        <div className="learn-category-icon-wrapper">
                          <Icon className="learn-category-icon" />
                        </div>
                        <h3 className="learn-category-title">{category.title}</h3>
                      </div>
                      <p className="learn-category-description">{category.description}</p>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Learning Resources */}
        <section className="learn-resources">
          <div className="learn-resources-header">
            <p className="learn-resources-label">{t('learn.exploreResources') || 'Explore resources'}</p>
            <h2 className="learn-resources-title">{t('learn.resources.title')}</h2>
            <p className="learn-resources-description">{t('learn.resources.description')}</p>
          </div>

          <div className="learn-resources-grid">
            {resources.map((resource, index) => {
              const Icon = resource.icon
              const content = (
                <Card className={`learn-resource-card ${resource.link ? 'learn-resource-card-clickable' : ''}`}>
                  <div className="learn-resource-card-content">
                    <div className="learn-resource-icon-wrapper">
                      <Icon className="learn-resource-icon" />
                    </div>
                    <h3 className="learn-resource-title">{resource.title}</h3>
                  </div>
                </Card>
              )
              
              return resource.link ? (
                <Link key={index} to={resource.link} className="learn-resource-card-link">
                  {content}
                </Link>
              ) : (
                <div key={index} className="learn-resource-card-link">
                  {content}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </Container>
  )
}

