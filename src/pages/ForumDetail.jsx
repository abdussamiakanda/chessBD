import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Reply, User, Calendar, Eye, Pin, Lock, Trash2, MessageSquare, HelpCircle, MessageCircle, Users, Hash } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuthStore } from '../store/auth-store'
import { useToastStore } from '../store/toast-store'
import { api } from '../lib/api'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { PageLoader } from '../components/ui/PageLoader'
import { formatLocalDate } from '../lib/utils/date-format'
import { generateForumPostSlug } from '../lib/utils/slug'
import { useLanguage } from '../contexts/LanguageContext'
import './ForumDetail.css'

export function ForumDetail() {
  const { t } = useLanguage()
  const { id: idOrSlug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()
  const [replyContent, setReplyContent] = useState('')
  const [showReplyForm, setShowReplyForm] = useState(false)
  const viewsIncremented = useRef(false)

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ['forum-post', idOrSlug],
    queryFn: () => idOrSlug ? api.getForumPost(idOrSlug) : null,
    enabled: !!idOrSlug,
  })

  // Redirect to slug URL if post was found by ID but should use slug
  useEffect(() => {
    if (post && idOrSlug && post.id !== idOrSlug && post.title && post.id) {
      // Check if idOrSlug is an ID (long alphanumeric or starts with -)
      const isId = idOrSlug.startsWith('-') || (/^[a-zA-Z0-9]+$/.test(idOrSlug) && idOrSlug.length > 15)
      if (isId) {
        // Redirect to slug URL
        const postSlug = generateForumPostSlug(post.title, post.id)
        if (postSlug) {
          navigate(`/forum/${postSlug}`, { replace: true })
        }
      }
    }
  }, [post, idOrSlug, navigate])

  const postId = post?.id || idOrSlug || ''

  const { data: replies, isLoading: repliesLoading } = useQuery({
    queryKey: ['forum-replies', postId],
    queryFn: () => postId ? api.getForumReplies(postId) : null,
    enabled: !!postId,
  })

  // Increment views when post is loaded (only once per page load)
  useEffect(() => {
    if (postId && post && !viewsIncremented.current) {
      viewsIncremented.current = true
      api.updateForumPost(postId, {
        views_count: (post.views_count || 0) + 1,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['forum-post', idOrSlug] })
      })
    }
  }, [postId, post, idOrSlug, queryClient])

  const createReplyMutation = useMutation({
    mutationFn: (reply) => api.createForumReply(reply),
    onSuccess: async () => {
      // Invalidate and refetch queries
      await queryClient.invalidateQueries({ queryKey: ['forum-replies', postId] })
      await queryClient.invalidateQueries({ queryKey: ['forum-post', idOrSlug] })
      await queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      // Refetch replies immediately
      queryClient.refetchQueries({ queryKey: ['forum-replies', postId] })
      queryClient.refetchQueries({ queryKey: ['forum-post', idOrSlug] })
      setReplyContent('')
      setShowReplyForm(false)
      addToast({ message: t('forum.replyCreated'), type: 'success' })
    },
    onError: (error) => {
      addToast({ message: error.message || t('forum.replyError'), type: 'error' })
    },
  })

  const deletePostMutation = useMutation({
    mutationFn: () => postId ? api.deleteForumPost(postId) : Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      navigate('/forum')
      addToast({ message: t('forum.postDeleted'), type: 'success' })
    },
    onError: (error) => {
      addToast({ message: error.message || t('forum.deleteError'), type: 'error' })
    },
  })

  const deleteReplyMutation = useMutation({
    mutationFn: ({ replyId, replyPostId }) => api.deleteForumReply(replyId, replyPostId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['forum-replies', postId] })
      await queryClient.invalidateQueries({ queryKey: ['forum-post', idOrSlug] })
      await queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      queryClient.refetchQueries({ queryKey: ['forum-replies', postId] })
      queryClient.refetchQueries({ queryKey: ['forum-post', idOrSlug] })
      addToast({ message: t('forum.replyDeleted') || 'Reply deleted successfully', type: 'success' })
    },
    onError: (error) => {
      addToast({ message: error.message || t('forum.deleteError'), type: 'error' })
    },
  })

  const handleReply = (e) => {
    e.preventDefault()
    if (!user || !postId) {
      addToast({ message: t('forum.loginRequired'), type: 'error' })
      return
    }
    if (!replyContent.trim()) {
      addToast({ message: t('forum.fillAllFields'), type: 'error' })
      return
    }

    createReplyMutation.mutate({
      post_id: postId,
      content: replyContent.trim(),
      author_id: user.id,
      author_name: user.name || null,
      author_email: user.email || null,
    })
  }

  if (postLoading) {
    return <PageLoader />
  }

  if (!post) {
    return (
      <Container>
        <div className="forum-detail-page">
          <Card className="forum-detail-error-card">
            <div className="forum-detail-error-content">
              <div className="forum-detail-error-icon-wrapper">
                <MessageSquare className="forum-detail-error-icon" />
              </div>
              <div>
                <h3 className="forum-detail-error-title">{t('forum.postNotFound')}</h3>
                <Link to="/forum">
                  <button className="forum-detail-back-btn">
                    {t('forum.backToForum')}
                  </button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </Container>
    )
  }

  const canDelete = user && (user.id === post.author_id || user.is_admin)

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'help':
        return <HelpCircle className="forum-detail-category-icon" />
      case 'question':
        return <MessageCircle className="forum-detail-category-icon" />
      case 'discussion':
        return <Users className="forum-detail-category-icon" />
      default:
        return <Hash className="forum-detail-category-icon" />
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
      <div className="forum-detail-page">
        <Link to="/forum" className="forum-detail-back-btn">
          <ArrowLeft className="forum-detail-back-icon" />
          <span>{t('forum.backToForum')}</span>
        </Link>

        {/* Post */}
        <Card className="forum-detail-post">
          <div className="forum-detail-post-header">
            <div className="forum-detail-post-content">
              <div className="forum-detail-post-title-row">
                {post.is_pinned && (
                  <Pin className="forum-detail-post-pin" />
                )}
                {post.is_locked && (
                  <Lock className="forum-detail-post-lock" />
                )}
                <h1 className="forum-detail-post-title">{post.title}</h1>
              </div>
              <div className="forum-detail-post-meta">
                <span className="forum-detail-post-category-badge">
                  {getCategoryLabel(post.category)}
                </span>
                <div className="forum-detail-post-meta-item">
                  <User className="forum-detail-post-meta-icon" />
                  <span>{post.author_name || post.author_email || t('forum.anonymous')}</span>
                </div>
                <div className="forum-detail-post-meta-item">
                  <Calendar className="forum-detail-post-meta-icon" />
                  <span>{formatLocalDate(post.created_at, { format: 'date' })}</span>
                </div>
                <div className="forum-detail-post-meta-item">
                  <Eye className="forum-detail-post-meta-icon" />
                  <span>{post.views_count || 0} {t('forum.views')}</span>
                </div>
                <div className="forum-detail-post-meta-item">
                  <Reply className="forum-detail-post-meta-icon" />
                  <span>{post.replies_count || 0} {t('forum.replies')}</span>
                </div>
              </div>
            </div>
            {canDelete && (
              <button
                onClick={() => {
                  if (confirm(t('forum.confirmDelete'))) {
                    deletePostMutation.mutate()
                  }
                }}
                className="forum-detail-delete-btn"
                title={t('forum.deletePost')}
              >
                <Trash2 className="forum-detail-delete-icon" />
              </button>
            )}
          </div>
          <div className="forum-detail-post-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="forum-detail-paragraph">{children}</p>,
                h1: ({ children }) => <h1 className="forum-detail-heading-1">{children}</h1>,
                h2: ({ children }) => <h2 className="forum-detail-heading-2">{children}</h2>,
                h3: ({ children }) => <h3 className="forum-detail-heading-3">{children}</h3>,
                ul: ({ children }) => <ul className="forum-detail-list-ul">{children}</ul>,
                ol: ({ children }) => <ol className="forum-detail-list-ol">{children}</ol>,
                li: ({ children }) => <li className="forum-detail-list-item">{children}</li>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="forum-detail-link">
                    {children}
                  </a>
                ),
                strong: ({ children }) => <strong className="forum-detail-strong">{children}</strong>,
                em: ({ children }) => <em className="forum-detail-em">{children}</em>,
                code: ({ children, ...props }) => <code {...props} className="forum-detail-code">{children}</code>,
                pre: ({ children }) => <pre className="forum-detail-pre">{children}</pre>,
                blockquote: ({ children }) => <blockquote className="forum-detail-blockquote">{children}</blockquote>,
                table: ({ children }) => (
                  <div className="forum-detail-table-wrapper">
                    <table className="forum-detail-table">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="forum-detail-thead">{children}</thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="forum-detail-tbody">{children}</tbody>
                ),
                tr: ({ children }) => (
                  <tr className="forum-detail-tr">{children}</tr>
                ),
                th: ({ children }) => (
                  <th className="forum-detail-th">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="forum-detail-td">{children}</td>
                ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>
        </Card>

        {/* Replies */}
        <section className="forum-detail-replies">
          <div className="forum-detail-replies-header">
            <div>
              <p className="forum-detail-replies-label">Discussion</p>
              <h2 className="forum-detail-replies-title">
                {t('forum.replies')} ({replies?.length || 0})
              </h2>
            </div>
            {!post.is_locked && user && !showReplyForm && (
              <button 
                onClick={() => setShowReplyForm(true)} 
                className="forum-detail-reply-btn"
              >
                <Reply className="forum-detail-reply-icon" />
                {t('forum.addReply')}
              </button>
            )}
          </div>

          {/* Reply Form */}
          {!post.is_locked && user && showReplyForm && (
            <Card className="forum-detail-reply-form">
              <form onSubmit={handleReply} className="forum-detail-reply-form-content">
                <div className="forum-detail-reply-form-field">
                  <label>{t('forum.replyLabel')}</label>
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={t('forum.replyPlaceholder')}
                    rows={4}
                    className="forum-detail-reply-textarea"
                    required
                  />
                  <p className="forum-detail-reply-hint">{t('forum.markdownSupported')}</p>
                </div>
                <div className="forum-detail-reply-form-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplyForm(false)
                      setReplyContent('')
                    }}
                    className="forum-detail-reply-cancel-btn"
                  >
                    {t('common.cancel') || 'Cancel'}
                  </button>
                  <button 
                    type="submit" 
                    disabled={createReplyMutation.isPending}
                    className="forum-detail-reply-submit-btn"
                  >
                    {createReplyMutation.isPending ? (t('common.loading') || 'Submitting...') : t('forum.submit')}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {repliesLoading ? (
            <div className="forum-detail-replies-skeleton">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="forum-detail-reply-skeleton" />
              ))}
            </div>
          ) : replies && replies.length > 0 ? (
            <div className="forum-detail-replies-list">
              {replies.map((reply) => {
                const canDeleteReply = user && (user.id === reply.author_id || user.is_admin)
                return (
                  <Card key={reply.id} className="forum-detail-reply-card">
                    <div className="forum-detail-reply-header">
                      <div className="forum-detail-reply-author">
                        <div className="forum-detail-reply-avatar">
                          <User className="forum-detail-reply-avatar-icon" />
                        </div>
                        <div className="forum-detail-reply-author-info">
                          <span className="forum-detail-reply-author-name">
                            {reply.author_name || reply.author_email || t('forum.anonymous')}
                          </span>
                          <span className="forum-detail-reply-date">
                            {formatLocalDate(reply.created_at, { format: 'date' })}
                          </span>
                        </div>
                      </div>
                      {canDeleteReply && (
                        <button
                          onClick={() => {
                            if (confirm(t('forum.confirmDeleteReply') || 'Are you sure you want to delete this reply?')) {
                              deleteReplyMutation.mutate({ replyId: reply.id, replyPostId: postId })
                            }
                          }}
                          className="forum-detail-reply-delete-btn"
                          title={t('forum.deleteReply') || 'Delete reply'}
                        >
                          <Trash2 className="forum-detail-reply-delete-icon" />
                        </button>
                      )}
                    </div>
                    <div className="forum-detail-reply-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="forum-detail-reply-paragraph">{children}</p>,
                          h1: ({ children }) => <h1 className="forum-detail-reply-heading-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="forum-detail-reply-heading-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="forum-detail-reply-heading-3">{children}</h3>,
                          ul: ({ children }) => <ul className="forum-detail-reply-list-ul">{children}</ul>,
                          ol: ({ children }) => <ol className="forum-detail-reply-list-ol">{children}</ol>,
                          li: ({ children }) => <li className="forum-detail-reply-list-item">{children}</li>,
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="forum-detail-reply-link">
                              {children}
                            </a>
                          ),
                          strong: ({ children }) => <strong className="forum-detail-reply-strong">{children}</strong>,
                          em: ({ children }) => <em className="forum-detail-reply-em">{children}</em>,
                          code: ({ children, ...props }) => <code {...props} className="forum-detail-reply-code">{children}</code>,
                          pre: ({ children }) => <pre className="forum-detail-reply-pre">{children}</pre>,
                          blockquote: ({ children }) => <blockquote className="forum-detail-reply-blockquote">{children}</blockquote>,
                        }}
                      >
                        {reply.content}
                      </ReactMarkdown>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="forum-detail-replies-empty">
              <div className="forum-detail-replies-empty-content">
                <div className="forum-detail-replies-empty-icon-wrapper">
                  <Reply className="forum-detail-replies-empty-icon" />
                </div>
                <div>
                  <h3 className="forum-detail-replies-empty-title">{t('forum.noReplies')}</h3>
                  <p className="forum-detail-replies-empty-text">Be the first to reply to this post!</p>
                </div>
              </div>
            </Card>
          )}
        </section>

        {!user && (
          <Card className="forum-detail-login-message">
            <p>{t('forum.loginToReply')}</p>
          </Card>
        )}
      </div>
    </Container>
  )
}

