import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { PageLoader } from '../components/ui/PageLoader'
import { Calendar, User, ArrowLeft, Newspaper } from 'lucide-react'
import { formatLocalDate } from '../lib/utils/date-format'
import { generateNewsSlug } from '../lib/utils/slug'
import { useLanguage } from '../contexts/LanguageContext'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEffect } from 'react'
import './NewsDetail.css'

export function NewsDetail() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { slug } = useParams()
  const { data: article, isLoading, error } = useQuery({
    queryKey: ['news-item', slug],
    queryFn: () => api.getNewsItem(slug || ''),
    enabled: !!slug,
    staleTime: 300000,
  })

  // Redirect to slug URL if article was found by ID but has a slug
  useEffect(() => {
    if (article && slug && article.slug && slug !== article.slug) {
      // Check if slug is an ID (long alphanumeric or starts with -)
      const isId = slug.startsWith('-') || (/^[a-zA-Z0-9]+$/.test(slug) && slug.length > 15)
      if (isId) {
        // Redirect to slug URL
        navigate(`/news/${article.slug}`, { replace: true })
      }
    }
  }, [article, slug, navigate])


  if (isLoading) {
    return <PageLoader />
  }

  if (error || !article) {
    return (
      <Container>
        <div className="news-detail-page">
          <Card className="news-detail-error-card">
            <div className="news-detail-error-content">
              <div className="news-detail-error-icon-wrapper">
                <Newspaper className="news-detail-error-icon" />
              </div>
              <div className="news-detail-error-text">
                <h3 className="news-detail-error-title">
                  {error ? t('news.failedToLoadArticle') || 'Failed to load article' : t('news.articleNotFound') || 'Article not found'}
                </h3>
                <p className="news-detail-error-description">
                  {error ? t('news.tryAgainLater') || 'Please try again later' : t('news.articleNotFoundDescription') || 'The article you are looking for does not exist'}
                </p>
                <Link
                  to="/news"
                  className="news-detail-back-btn"
                >
                  <ArrowLeft className="news-detail-back-icon" />
                  <span>{t('news.backToNews') || 'Back to News'}</span>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </Container>
    )
  }

  const displayDate = article.published_at || article.created_at
  const coverImage = article.cover || article.featured_image

  return (
    <Container>
      <div className="news-detail-page">
        {/* Back Button */}
        <Link
          to="/news"
          className="news-detail-back-btn"
        >
          <ArrowLeft className="news-detail-back-icon" />
          <span>{t('news.backToNews') || 'Back to News'}</span>
        </Link>

        {/* Article */}
        <article className="news-detail-article">
          {/* Cover Image */}
          <div className="news-detail-image-wrapper">
            {coverImage ? (
              <img
                src={coverImage}
                alt={article.title}
                className="news-detail-image"
              />
            ) : (
              <div className="news-detail-image-fallback">
                <Newspaper className="news-detail-placeholder-icon" />
                <p className="news-detail-placeholder-text">{t('news.chessbdNews') || 'ChessBD News'}</p>
              </div>
            )}
          </div>

          {/* Article Content */}
          <div className="news-detail-content">
            <div className="news-detail-header">
              <h1 className="news-detail-title">
                {article.title}
              </h1>

              <div className="news-detail-meta">
                {article.author_name && (
                  <div className="news-detail-meta-item">
                    <User className="news-detail-meta-icon" />
                    <span>{article.author_name}</span>
                  </div>
                )}
                <div className="news-detail-meta-item">
                  <Calendar className="news-detail-meta-icon" />
                  <span>{formatLocalDate(displayDate, { format: 'date' })}</span>
                </div>
              </div>
            </div>

            {/* Article Body */}
            <div className="news-detail-body">
              {article.content && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="news-detail-markdown-p">{children}</p>,
                    h1: ({ children }) => <h1 className="news-detail-markdown-h1">{children}</h1>,
                    h2: ({ children }) => <h2 className="news-detail-markdown-h2">{children}</h2>,
                    h3: ({ children }) => <h3 className="news-detail-markdown-h3">{children}</h3>,
                    ul: ({ children }) => <ul className="news-detail-markdown-ul">{children}</ul>,
                    ol: ({ children }) => <ol className="news-detail-markdown-ol">{children}</ol>,
                    li: ({ children }) => <li className="news-detail-markdown-li">{children}</li>,
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="news-detail-markdown-a">
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => <strong className="news-detail-markdown-strong">{children}</strong>,
                    em: ({ children }) => <em className="news-detail-markdown-em">{children}</em>,
                    code: ({ children, ...props }) => <code {...props} className="news-detail-markdown-code">{children}</code>,
                    pre: ({ children }) => <pre className="news-detail-markdown-pre">{children}</pre>,
                    blockquote: ({ children }) => <blockquote className="news-detail-markdown-blockquote">{children}</blockquote>,
                    table: ({ children }) => (
                      <div className="news-detail-markdown-table-wrapper">
                        <table className="news-detail-markdown-table">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="news-detail-markdown-thead">{children}</thead>,
                    tbody: ({ children }) => <tbody className="news-detail-markdown-tbody">{children}</tbody>,
                    tr: ({ children }) => <tr className="news-detail-markdown-tr">{children}</tr>,
                    th: ({ children }) => <th className="news-detail-markdown-th">{children}</th>,
                    td: ({ children }) => <td className="news-detail-markdown-td">{children}</td>,
                  }}
                >
                  {article.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        </article>
      </div>
    </Container>
  )
}

