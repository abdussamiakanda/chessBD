import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Plus, Pin, Lock, Eye, User, Calendar, HelpCircle, MessageCircle, Users, Hash, ArrowRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuthStore } from '../store/auth-store'
import { useToastStore } from '../store/toast-store'
import { api } from '../lib/api'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { formatLocalDate } from '../lib/utils/date-format'
import { generateForumPostSlug } from '../lib/utils/slug'
import { useLanguage } from '../contexts/LanguageContext'
import './Forum.css'

export function Forum() {
  const { t } = useLanguage()
  const { user } = useAuthStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('question')
  const [selectedCategory, setSelectedCategory] = useState(null)

  const { data: posts, isLoading } = useQuery({
    queryKey: ['forum-posts'],
    queryFn: () => api.getForumPosts(),
  })

  const createPostMutation = useMutation({
    mutationFn: (post) => api.createForumPost(post),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      setTitle('')
      setContent('')
      setCategory('question')
      setShowCreateForm(false)
      addToast({ message: t('forum.postCreated'), type: 'success' })
    },
    onError: (error) => {
      addToast({ message: error.message || t('forum.createError'), type: 'error' })
    },
  })

  // Deduplicate posts by ID
  const processedPosts = posts?.filter((post, index, self) => 
    index === self.findIndex((p) => p.id === post.id)
  )

  const filteredPosts = selectedCategory
    ? processedPosts?.filter(p => p.category === selectedCategory)
    : processedPosts

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!user) {
      addToast({ message: t('forum.loginRequired'), type: 'error' })
      return
    }
    if (!title.trim() || !content.trim()) {
      addToast({ message: t('forum.fillAllFields'), type: 'error' })
      return
    }

    createPostMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      author_id: user.id,
      author_name: user.name || null,
      author_email: user.email || null,
      category,
    })
  }

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'help':
        return <HelpCircle className="forum-category-icon" />
      case 'question':
        return <MessageCircle className="forum-category-icon" />
      case 'discussion':
        return <Users className="forum-category-icon" />
      default:
        return <Hash className="forum-category-icon" />
    }
  }

  const getCategoryLabel = (cat) => {
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

  return (
    <Container>
      <div className="forum-page">
        {/* Hero Section */}
        <section className="forum-hero">
          <div className="forum-hero-content">
            <p className="forum-hero-label">{t('forum.subtitle')}</p>
            <h1 className="forum-hero-title">{t('forum.title')}</h1>
            <p className="forum-hero-description">{t('forum.description')}</p>
          </div>
        </section>

        {/* Category Filter */}
        <div className="forum-category-filter">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`forum-category-btn ${selectedCategory === null ? 'active' : ''}`}
          >
            {t('forum.allCategories')}
          </button>
          {['help', 'question', 'discussion', 'general'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`forum-category-btn ${selectedCategory === cat ? 'active' : ''}`}
            >
              {getCategoryIcon(cat)}
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* Create Post Button */}
        {user && !showCreateForm && (
          <div className="forum-create-btn-wrapper">
            <button
              onClick={() => setShowCreateForm(true)}
              className="forum-create-btn"
            >
              <Plus className="forum-create-icon" />
              {t('forum.createPost')}
            </button>
          </div>
        )}

        {/* Login to Post Message */}
        {!user && (
          <div className="forum-login-message">
            <p>{t('forum.loginToPost')}</p>
          </div>
        )}

        {/* Create Post Form */}
        {showCreateForm && (
          <Card className="forum-create-form">
            <div className="forum-create-form-header">
              <h2>{t('forum.createPost')}</h2>
            </div>
            <form onSubmit={handleSubmit} className="forum-form">
              <div className="forum-form-field">
                <label>{t('forum.category.label')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="forum-form-select"
                >
                  <option value="help">{t('forum.category.help')}</option>
                  <option value="question">{t('forum.category.question')}</option>
                  <option value="discussion">{t('forum.category.discussion')}</option>
                  <option value="general">{t('forum.category.general')}</option>
                </select>
              </div>
              <div className="forum-form-field">
                <label>{t('forum.titleLabel')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('forum.titlePlaceholder')}
                  className="forum-form-input"
                  required
                />
              </div>
              <div className="forum-form-field">
                <label>{t('forum.contentLabel')}</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t('forum.contentPlaceholder')}
                  rows={6}
                  className="forum-form-textarea"
                  required
                />
                <p className="forum-form-hint">{t('forum.markdownSupported')}</p>
              </div>
              <div className="forum-form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setTitle('')
                    setContent('')
                  }}
                  className="forum-form-cancel-btn"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  disabled={createPostMutation.isPending}
                  className="forum-form-submit-btn"
                >
                  {createPostMutation.isPending ? (t('common.loading') || 'Submitting...') : t('forum.submit')}
                </button>
              </div>
            </form>
          </Card>
        )}

        {/* Posts List */}
        {isLoading ? (
          <div className="forum-posts-skeleton">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="forum-post-skeleton" />
            ))}
          </div>
        ) : filteredPosts && filteredPosts.length > 0 ? (
          <div className="forum-posts-list">
            {filteredPosts.map((post) => {
              // Skip posts with invalid data
              if (!post.title || !post.id) return null
              const postSlug = generateForumPostSlug(post.title, post.id)
              // If slug generation fails, use the ID as fallback
              if (!postSlug) {
                console.warn('Failed to generate slug for post:', post.id, post.title)
                return null
              }
              return (
                <Link to={`/forum/${postSlug}`} key={post.id} className="forum-post-link">
                  <Card className="forum-post-card">
                    <div className="forum-post-header">
                      <div className="forum-post-icon-wrapper">
                        <div className="forum-post-icon">
                          {getCategoryIcon(post.category)}
                        </div>
                      </div>
                      <div className="forum-post-content">
                        <div className="forum-post-title-row">
                          {post.is_pinned && (
                            <Pin className="forum-post-pin" />
                          )}
                          {post.is_locked && (
                            <Lock className="forum-post-lock" />
                          )}
                          <h3 className="forum-post-title">{post.title}</h3>
                        </div>
                        <div className="forum-post-meta">
                          <span className="forum-post-category-badge">
                            {getCategoryLabel(post.category)}
                          </span>
                          <div className="forum-post-meta-items">
                            <div className="forum-post-meta-item">
                              <User className="forum-post-meta-icon" />
                              <span className="forum-post-meta-text">
                                {post.author_name || post.author_email || t('forum.anonymous')}
                              </span>
                            </div>
                            <div className="forum-post-meta-item">
                              <Calendar className="forum-post-meta-icon" />
                              <span className="forum-post-meta-text">
                                {formatLocalDate(post.created_at, { format: 'date' })}
                              </span>
                            </div>
                            <div className="forum-post-meta-item">
                              <MessageSquare className="forum-post-meta-icon" />
                              <span className="forum-post-meta-text">
                                {post.replies_count || 0} {t('forum.replies')}
                              </span>
                            </div>
                            <div className="forum-post-meta-item">
                              <Eye className="forum-post-meta-icon" />
                              <span className="forum-post-meta-text">
                                {post.views_count || 0} {t('forum.views')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content Preview */}
                    <div className="forum-post-preview">
                      <div className="forum-post-preview-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {post.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Read More Link */}
                    <div className="forum-post-read-more">
                      <span>{t('forum.readMore')}</span>
                      <ArrowRight className="forum-post-arrow" />
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <Card className="forum-empty-state">
            <div className="forum-empty-content">
              <div className="forum-empty-icon-wrapper">
                <MessageSquare className="forum-empty-icon" />
              </div>
              <div>
                <h3 className="forum-empty-title">{t('forum.noPosts')}</h3>
                {user && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="forum-create-btn"
                  >
                    <Plus className="forum-create-icon" />
                    {t('forum.createFirstPost')}
                  </button>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </Container>
  )
}

