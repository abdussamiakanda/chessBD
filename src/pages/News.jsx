import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { NewsCard } from '../components/ui/NewsCard'
import { Newspaper } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'
import { PageLoader } from '../components/ui/PageLoader'
import './News.css'

export function News() {
  const { t } = useLanguage()
  
  const { data: news, isLoading, error } = useQuery({
    queryKey: ['news'],
    queryFn: () => api.getNews(true), // Only published news
    staleTime: 300000, // 5 minutes
  })

  if (isLoading) {
    return <PageLoader />
  }

  return (
    <Container>
      <div className="news-page">
        {/* Hero Section */}
        <section className="news-hero">
          <div className="news-hero-content">
            <p className="news-hero-label">{t('news.subtitle') || 'Latest Updates'}</p>
            <h1 className="news-hero-title">
              {t('news.title') || 'News & Updates'}
            </h1>
          </div>
          <p className="news-hero-description">
            {t('news.description')}
          </p>
        </section>

        {/* News List */}
        {error ? (
          <Card className="news-error-card">
            <div className="news-error-content">
              <div className="news-error-icon-wrapper">
                <Newspaper className="news-error-icon" />
              </div>
              <div className="news-error-text">
                <h3 className="news-error-title">
                  {t('news.failedToLoad') || 'Failed to load news. Please try again later.'}
                </h3>
                <p className="news-error-description">
                  {t('news.tryAgainLater') || 'Please try again later'}
                </p>
              </div>
            </div>
          </Card>
        ) : !news || news.length === 0 ? (
          <Card className="news-empty-card">
            <div className="news-empty-content">
              <div className="news-empty-icon-wrapper">
                <Newspaper className="news-empty-icon" />
              </div>
              <div className="news-empty-text">
                <h3 className="news-empty-title">
                  {t('news.noNews') || 'No news articles available yet.'}
                </h3>
                <p className="news-empty-description">
                  {t('news.noNewsDescription') || 'Check back soon for the latest updates!'}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="news-list">
            {news.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}

