import { Link } from 'react-router-dom'
import { Card } from './Card'
import { Calendar, User, ArrowRight, Newspaper } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import './NewsCard.css'

// Simple slug generator
function generateNewsSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

export function NewsCard({ article, className = '' }) {
  const { t } = useLanguage()
  const displayDate = article.published_at || article.created_at
  const previewText = article.excerpt || (article.content ? article.content.slice(0, 150).replace(/\n/g, ' ') + '...' : '')
  const newsUrl = article.slug ? `/news/${article.slug}` : (article.title ? `/news/${generateNewsSlug(article.title)}` : `/news/${article.id}`)
  const coverImage = article.cover || article.featured_image
  const [imageError, setImageError] = useState(false)

  return (
    <Link to={newsUrl} className={`news-card-link ${className}`}>
      <Card className="news-card">
        <div className="news-card-image-wrapper">
          {!imageError && coverImage ? (
            <img
              src={coverImage}
              alt={article.title}
              className="news-card-image"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="news-card-image-fallback">
              <Newspaper className="news-card-placeholder-icon" />
              <p className="news-card-placeholder-text">{t('news.chessbdNews') || 'ChessBD News'}</p>
            </div>
          )}
          <div className="news-card-image-overlay"></div>
        </div>
        
        <div className="news-card-content">
          <h3 className="news-card-title">
            {article.title}
          </h3>

          <div className="news-card-meta">
            {article.author_name && (
              <span className="news-card-meta-item">
                <User className="news-card-meta-icon" />
                {article.author_name}
              </span>
            )}
            <span className="news-card-meta-item">
              <Calendar className="news-card-meta-icon" />
              {formatDate(displayDate)}
            </span>
          </div>

          {previewText && (
            <div className="news-card-preview">
              <p>{previewText}</p>
            </div>
          )}

          <div className="news-card-footer">
            <span>{t('home.readMore') || 'Read More'}</span>
            <ArrowRight className="news-card-footer-icon" />
          </div>
        </div>
      </Card>
    </Link>
  )
}

