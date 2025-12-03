import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { Search, User, Calendar, Newspaper, MapPin, Briefcase, Club as ClubIcon, MessageSquare, Eye } from 'lucide-react'
import { useSEO } from '../hooks/use-seo'
import { PlayerName } from '../components/PlayerName'
import { NewsCard } from '../components/ui/NewsCard'
import { EventCard } from '../components/ui/EventCard'
import { ClubCard } from '../components/ui/ClubCard'
import { useLanguage } from '../contexts/LanguageContext'
import { generateForumPostSlug } from '../lib/utils/slug'
import { formatLocalDate } from '../lib/utils/date-format'
import { PageLoader } from '../components/ui/PageLoader'
import './SearchResults.css'

function PlayerCard({ player }) {
  const { t } = useLanguage()
  
  // Fetch avatar from Chess.com if not available in database
  const { data: chesscomProfile } = useQuery({
    queryKey: ['chesscom-profile', player.chesscom_username],
    queryFn: () => player.chesscom_username && !player.avatar_url ? api.getChesscomPlayerProfile(player.chesscom_username) : null,
    enabled: !!player.chesscom_username && !player.avatar_url,
    staleTime: 300000, // 5 minutes
  })

  const avatarUrl = player.avatar_url || chesscomProfile?.avatar
  const displayName = player.name || player.email
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <Link
      to={player.chesscom_username ? `/player/${player.chesscom_username}` : '#'}
      className="search-player-card-link"
    >
      <Card className="search-player-card">
        <div className="search-player-card-content">
          <div className="search-player-card-avatar-wrapper">
            {avatarUrl ? (
              <>
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="search-player-card-avatar"
                  onError={(e) => {
                    const target = e.target
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      const fallback = parent.querySelector('.search-player-card-avatar-fallback')
                      if (fallback) {
                        fallback.style.display = 'flex'
                      }
                    }
                  }}
                />
                <div className="search-player-card-avatar-fallback" style={{ display: 'none' }}>
                  {initial}
                </div>
              </>
            ) : (
              <div className="search-player-card-avatar-fallback">
                {initial}
              </div>
            )}
          </div>
          <div className="search-player-card-info">
            <h3 className="search-player-card-name">
              <PlayerName
                username={player.chesscom_username}
                name={player.name}
                email={player.email}
                showTitle={true}
              />
            </h3>
            {player.chesscom_username && (
              <p className="search-player-card-username">@{player.chesscom_username}</p>
            )}
            {player.location && (
              <p className="search-player-card-location">
                <MapPin className="search-player-card-location-icon" />
                <span>{t(`locations.${player.location}`)}, {t('common.bangladesh') || 'Bangladesh'}</span>
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

export function SearchResults() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  
  useSEO({
    title: query ? `${t('search.seoTitlePrefix')}${query}` : t('search.seoTitle'),
    description: query 
      ? `${t('search.seoDescriptionPrefix')}"${query}"${t('search.seoDescriptionSuffix')}`
      : t('search.seoDescription'),
    keywords: query ? `${t('search.seoKeywordsPrefix')}${query}${t('search.seoKeywordsSuffix')}` : t('search.seoKeywords'),
    url: query ? `/search?q=${encodeURIComponent(query)}` : '/search',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: query.length >= 2,
    staleTime: 30000,
  })

  const results = data || { players: [], events: [], news: [], jobs: [], clubs: [], locations: [], forums: [] }
  const totalResults = results.players.length +
    results.events.length +
    results.news.length +
    results.jobs.length +
    results.clubs.length +
    results.locations.length +
    results.forums.length

  const getForumCategoryLabel = (cat) => {
    switch (cat) {
      case 'help':
        return t('forum.category.help')
      case 'question':
        return t('forum.category.question')
      case 'discussion':
        return t('forum.category.discussion')
      default:
        return t('forum.category.general')
    }
  }

  const stripMarkdown = (text = '') => {
    return text
      .replace(/!\[[^\]]*]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
      .replace(/[`*_>#~]/g, '')
      .replace(/-{3,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  if (isLoading && query.length >= 2) {
    return <PageLoader />
  }

  return (
    <Container>
      <div className="search-results-page">
        {/* Hero Section */}
        <section className="search-results-hero">
          <div className="search-results-hero-content">
            <p className="search-results-hero-label">
              {t('search.subtitle') || 'Search Results'}
            </p>
            <h1 className="search-results-hero-title">
              {t('search.title')}
            </h1>
            {query.length >= 2 && (
              <div className="search-results-query-badge">
                <span className="search-results-query-label">{t('search.searchingFor') || 'Searching for:'}</span>
                <span className="search-results-query-value">"{query}"</span>
              </div>
            )}
            <p className="search-results-hero-description">
              {query.length < 2 
                ? t('search.enterAtLeast2')
                : totalResults > 0 
                  ? t(totalResults === 1 ? 'search.foundResults' : 'search.foundResultsPlural', { count: totalResults })
                  : t('search.noResults')}
            </p>
          </div>
        </section>

        {query.length < 2 ? (
          <Card className="search-results-empty-card">
            <div className="search-results-empty-content">
              <div className="search-results-empty-icon">
                <Search className="search-results-empty-icon-svg" />
              </div>
              <div>
                <h3 className="search-results-empty-title">
                  {t('search.startSearching') || 'Start Searching'}
                </h3>
                <p className="search-results-empty-description">
                  {t('search.enterAtLeast2Message')}
                </p>
              </div>
            </div>
          </Card>
        ) : totalResults === 0 ? (
          <Card className="search-results-empty-card">
            <div className="search-results-empty-content">
              <div className="search-results-empty-icon">
                <Search className="search-results-empty-icon-svg" />
              </div>
              <div>
                <h3 className="search-results-empty-title">
                  {t('search.noResults')}
                </h3>
                <p className="search-results-empty-description">
                  {t('search.tryDifferentTerm')}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="search-results-sections">
            {/* Players */}
            {results.players.length > 0 && (
              <section className="search-results-section">
                <div className="search-results-section-header">
                  <div className="search-results-section-icon">
                    <User className="search-results-section-icon-svg" />
                  </div>
                  <div>
                    <h2 className="search-results-section-title">
                      {t('search.players')}
                    </h2>
                    <p className="search-results-section-count">
                      {results.players.length} {results.players.length === 1 ? t('search.result') || 'result' : t('search.results') || 'results'}
                    </p>
                  </div>
                </div>
                <div className="search-results-grid">
                  {results.players.map((player) => (
                    <PlayerCard key={player.id} player={player} />
                  ))}
                </div>
              </section>
            )}

            {/* Events */}
            {results.events.length > 0 && (
              <section className="search-results-section">
                <div className="search-results-section-header">
                  <div className="search-results-section-icon">
                    <Calendar className="search-results-section-icon-svg" />
                  </div>
                  <div>
                    <h2 className="search-results-section-title">
                      {t('search.events')}
                    </h2>
                    <p className="search-results-section-count">
                      {results.events.length} {results.events.length === 1 ? t('search.result') || 'result' : t('search.results') || 'results'}
                    </p>
                  </div>
                </div>
                <div className="search-results-grid">
                  {results.events.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </section>
            )}

            {/* News */}
            {results.news.length > 0 && (
              <section className="search-results-section">
                <div className="search-results-section-header">
                  <div className="search-results-section-icon">
                    <Newspaper className="search-results-section-icon-svg" />
                  </div>
                  <div>
                    <h2 className="search-results-section-title">
                      {t('search.news')}
                    </h2>
                    <p className="search-results-section-count">
                      {results.news.length} {results.news.length === 1 ? t('search.result') || 'result' : t('search.results') || 'results'}
                    </p>
                  </div>
                </div>
                <div className="search-results-grid">
                  {results.news.map((article) => (
                    <NewsCard key={article.id} article={article} />
                  ))}
                </div>
              </section>
            )}

            {/* Forums */}
            {results.forums.length > 0 && (
              <section className="search-results-section">
                <div className="search-results-section-header">
                  <div className="search-results-section-icon">
                    <MessageSquare className="search-results-section-icon-svg" />
                  </div>
                  <div>
                    <h2 className="search-results-section-title">
                      {t('search.forums') || 'Forums'}
                    </h2>
                    <p className="search-results-section-count">
                      {results.forums.length}{' '}
                      {results.forums.length === 1 ? t('search.result') || 'result' : t('search.results') || 'results'}
                    </p>
                  </div>
                </div>
                <div className="search-results-grid">
                  {results.forums.map((post) => {
                    if (!post?.title || !post?.id) return null
                    const slug = generateForumPostSlug(post.title, post.id) || post.id
                    const excerpt = stripMarkdown(post.content || '')
                    const truncatedExcerpt =
                      excerpt.length > 200 ? `${excerpt.slice(0, 200).trim()}…` : excerpt
                    const authorName = post.author_name || post.author_email || t('forum.anonymous')
                    const categoryLabel = getForumCategoryLabel(post.category)
                    return (
                      <Link
                        key={post.id}
                        to={`/forum/${slug}`}
                        className="search-forum-card-link"
                      >
                        <Card className="search-forum-card">
                          <div className="search-forum-card-category-row">
                            {categoryLabel && (
                              <span className="search-forum-card-category">{categoryLabel}</span>
                            )}
                          </div>
                          <h3 className="search-forum-card-title">{post.title}</h3>
                          {truncatedExcerpt && (
                            <p className="search-forum-card-excerpt">{truncatedExcerpt}</p>
                          )}
                          <div className="search-forum-card-meta">
                            <span className="search-forum-card-meta-item">
                              <User className="search-forum-card-meta-icon" />
                              <span>{authorName}</span>
                            </span>
                            {post.created_at && (
                              <span className="search-forum-card-meta-item">
                                <Calendar className="search-forum-card-meta-icon" />
                                <span>{formatLocalDate(post.created_at, { format: 'date' })}</span>
                              </span>
                            )}
                            <span className="search-forum-card-meta-item">
                              <MessageSquare className="search-forum-card-meta-icon" />
                              <span>
                                {post.replies_count || 0} {t('forum.replies')}
                              </span>
                            </span>
                            <span className="search-forum-card-meta-item">
                              <Eye className="search-forum-card-meta-icon" />
                              <span>
                                {post.views_count || 0} {t('forum.views')}
                              </span>
                            </span>
                          </div>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Jobs */}
            {results.jobs.length > 0 && (
              <section className="search-results-section">
                <div className="search-results-section-header">
                  <div className="search-results-section-icon">
                    <Briefcase className="search-results-section-icon-svg" />
                  </div>
                  <div>
                    <h2 className="search-results-section-title">
                      {t('search.jobs') || 'Jobs'}
                    </h2>
                    <p className="search-results-section-count">
                      {results.jobs.length} {results.jobs.length === 1 ? t('search.result') || 'result' : t('search.results') || 'results'}
                    </p>
                  </div>
                </div>
                <div className="search-results-grid">
                  {results.jobs.map((job) => (
                    <Link key={job.id} to={`/jobs`} className="search-job-card-link">
                      <Card className="search-job-card">
                        <div className="search-job-card-content">
                          <h3 className="search-job-card-title">
                            {job.title}
                          </h3>
                          <div className="search-job-card-meta">
                            {job.department && (
                              <span className="search-job-card-meta-item">
                                <Briefcase className="search-job-card-meta-icon" />
                                <span>{job.department}</span>
                              </span>
                            )}
                            {job.location && (
                              <span className="search-job-card-meta-item">
                                <MapPin className="search-job-card-meta-icon" />
                                <span>{job.location}</span>
                              </span>
                            )}
                          </div>
                          {job.description && (
                            <p className="search-job-card-description">
                              {job.description.length > 150 ? job.description.slice(0, 150) + '...' : job.description}
                            </p>
                          )}
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Clubs */}
            {results.clubs.length > 0 && (
              <section className="search-results-section">
                <div className="search-results-section-header">
                  <div className="search-results-section-icon">
                    <ClubIcon className="search-results-section-icon-svg" />
                  </div>
                  <div>
                    <h2 className="search-results-section-title">
                      {t('search.clubs') || 'Clubs'}
                    </h2>
                    <p className="search-results-section-count">
                      {results.clubs.length} {results.clubs.length === 1 ? t('search.result') || 'result' : t('search.results') || 'results'}
                    </p>
                  </div>
                </div>
                <div className="search-results-grid">
                  {results.clubs.map((club) => (
                    <ClubCard key={club.id} club={club} />
                  ))}
                </div>
              </section>
            )}

            {/* Locations */}
            {results.locations.length > 0 && (
              <section className="search-results-section">
                <div className="search-results-section-header">
                  <div className="search-results-section-icon">
                    <MapPin className="search-results-section-icon-svg" />
                  </div>
                  <div>
                    <h2 className="search-results-section-title">
                      {t('search.locations') || 'Locations'}
                    </h2>
                    <p className="search-results-section-count">
                      {results.locations.length} {results.locations.length === 1 ? t('search.result') || 'result' : t('search.results') || 'results'}
                    </p>
                  </div>
                </div>
                <div className="search-results-grid">
                  {results.locations.map((location, index) => (
                    <Link 
                      key={location.district_name || location.name || index} 
                      to={`/locations/${location.district_name?.toLowerCase() || location.name?.toLowerCase()}`}
                      className="search-location-card-link"
                    >
                      <Card className="search-location-card">
                        <div className="search-location-card-content">
                          <div className="search-location-card-icon">
                            <MapPin className="search-location-card-icon-svg" />
                          </div>
                          <h3 className="search-location-card-title">
                            {t(`locations.${location.district_name || location.name}`) || location.district_name || location.name}
                          </h3>
                          <p className="search-location-card-subtitle">
                            {t('common.bangladesh') || 'Bangladesh'}
                          </p>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Container>
  )
}

