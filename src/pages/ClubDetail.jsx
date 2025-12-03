import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { PageLoader } from '../components/ui/PageLoader'
import { Users, MapPin, ExternalLink, Clock, ArrowLeft, Calendar, FileText, Link2, User, UserPlus, Check, X, Edit2, Trash2, Save, Club as ClubIcon } from 'lucide-react'
import { useSEO } from '../hooks/use-seo'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { generateClubSlug } from '../lib/utils/slug'
import { ChesscomIcon } from '../components/ui/ChesscomIcon'
import { LichessIcon } from '../components/ui/LichessIcon'
import { useAuthStore } from '../store/auth-store'
import { useToastStore } from '../store/toast-store'
import { useLanguage } from '../contexts/LanguageContext'
import { formatLocalDate } from '../lib/utils/date-format'
import './ClubDetail.css'

export function ClubDetail() {
  const { t } = useLanguage()
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()

  const { data: club, isLoading, error } = useQuery({
    queryKey: ['club', slug],
    queryFn: () => api.getClub(slug || ''),
    enabled: !!slug,
    staleTime: 300000,
  })

  // Redirect to slug URL if club was found by ID but has a slug
  useEffect(() => {
    if (club && slug && club.slug && slug !== club.slug) {
      // Check if slug is an ID (long alphanumeric or starts with -)
      const isId = slug.startsWith('-') || (/^[a-zA-Z0-9]+$/.test(slug) && slug.length > 15)
      if (isId) {
        // Redirect to slug URL
        navigate(`/clubs/${club.slug}`, { replace: true })
      }
    }
  }, [club, slug, navigate])

  // Set SEO based on club data
  const clubSlug = club?.slug || (club?.name ? generateClubSlug(club.name) : null)
  useSEO({
    title: club?.name || 'Club Details',
    description: club?.description 
      ? `${club.description.substring(0, 150)}...` 
      : `View details and information for ${club?.name || 'this chess club'}.`,
    keywords: club?.name ? `chess club, ${club.name}, chess community, Bangladesh chess` : 'chess club, chess community',
    url: clubSlug ? `/clubs/${clubSlug}` : '/clubs',
  })

  // Calculate members count
  const membersCount = Array.isArray(club?.members) 
    ? club.members.length 
    : (club?.members_count || 0)

  const chesscomUrl = club?.chesscom_club_id
    ? `https://www.chess.com/club/${club.chesscom_club_id}`
    : null
  const lichessUrl = club?.lichess_team_id
    ? `https://lichess.org/team/${club.lichess_team_id}`
    : null

  // Fetch user data for members to get avatars
  const { data: usersMap } = useQuery({
    queryKey: ['club-members-users'],
    queryFn: async () => {
      if (!club?.members || !Array.isArray(club.members) || club.members.length === 0) return {}
      const { collection, getDocs } = await import('firebase/firestore')
      const { db } = await import('../lib/firebase')
      if (!db) return {}
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = {}
      usersSnapshot.docs.forEach(doc => {
        users[doc.id] = { id: doc.id, ...doc.data() }
      })
      return users
    },
    enabled: !!club && Array.isArray(club.members) && club.members.length > 0,
    staleTime: 300000,
  })

  // Helper to get user info by Chess.com username
  const getUserByChesscomUsername = (username) => {
    if (!usersMap) return null
    const foundUser = Object.values(usersMap).find(
      (u) => u.chesscom_username?.toLowerCase() === username.toLowerCase()
    )
    return foundUser || null
  }

  // Check user's relationship with the club
  const isMember = user?.chesscom_username && Array.isArray(club?.members) 
    ? club.members.some(m => m.toLowerCase() === user.chesscom_username.toLowerCase())
    : false
  
  const hasRequested = user?.chesscom_username && Array.isArray(club?.join_requests)
    ? club.join_requests.some(r => r.toLowerCase() === user.chesscom_username.toLowerCase())
    : false
  
  const isOwner = user?.id && club?.created_by 
    ? user.id === club.created_by
    : false

  // Join request mutations
  const requestJoinMutation = useMutation({
    mutationFn: () => {
      if (!club?.id || !user?.chesscom_username) {
        throw new Error('Club ID and Chess.com username are required')
      }
      return api.requestToJoinClub(club.id, user.chesscom_username)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', slug] })
      addToast({
        type: 'success',
        message: t('clubs.joinRequestSent'),
      })
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error?.message || t('clubs.joinRequestFailed'),
      })
    },
  })

  const approveRequestMutation = useMutation({
    mutationFn: (chesscomUsername) => {
      if (!club?.id) throw new Error('Club ID is required')
      return api.approveJoinRequest(club.id, chesscomUsername)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', slug] })
      addToast({
        type: 'success',
        message: t('clubs.joinRequestApproved'),
      })
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error?.message || t('clubs.approveRequestFailed'),
      })
    },
  })

  const rejectRequestMutation = useMutation({
    mutationFn: (chesscomUsername) => {
      if (!club?.id) throw new Error('Club ID is required')
      return api.rejectJoinRequest(club.id, chesscomUsername)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', slug] })
      addToast({
        type: 'success',
        message: t('clubs.joinRequestRejected'),
      })
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error?.message || t('clubs.rejectRequestFailed'),
      })
    },
  })

  // Edit club state
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    description: '',
    logo_url: '',
    website_url: '',
    chesscom_club_id: '',
    lichess_team_id: '',
  })

  // Initialize edit form when club loads or editing starts
  useEffect(() => {
    if (club && isEditing) {
      setEditForm({
        description: club.description || '',
        logo_url: club.logo_url || '',
        website_url: club.website_url || '',
        chesscom_club_id: club.chesscom_club_id || '',
        lichess_team_id: club.lichess_team_id || '',
      })
    }
  }, [club, isEditing])

  const updateClubMutation = useMutation({
    mutationFn: (updates) => {
      if (!club?.id) throw new Error('Club ID is required')
      return api.updateClub(club.id, updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', slug] })
      setIsEditing(false)
      addToast({
        type: 'success',
        message: t('clubs.clubUpdated') || 'Club updated successfully',
      })
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error?.message || t('clubs.updateFailed') || 'Failed to update club',
      })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (chesscomUsername) => {
      if (!club?.id) throw new Error('Club ID is required')
      return api.removeMember(club.id, chesscomUsername)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', slug] })
      addToast({
        type: 'success',
        message: t('clubs.memberRemoved') || 'Member removed successfully',
      })
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error?.message || t('clubs.removeMemberFailed') || 'Failed to remove member',
      })
    },
  })

  const handleSaveEdit = () => {
    const updates = {
      description: editForm.description.trim() || null,
      logo_url: editForm.logo_url.trim() || null,
      website_url: editForm.website_url.trim() || null,
      chesscom_club_id: editForm.chesscom_club_id.trim() || null,
      lichess_team_id: editForm.lichess_team_id.trim() || null,
    }
    updateClubMutation.mutate(updates)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (club) {
      setEditForm({
        description: club.description || '',
        logo_url: club.logo_url || '',
        website_url: club.website_url || '',
        chesscom_club_id: club.chesscom_club_id || '',
        lichess_team_id: club.lichess_team_id || '',
      })
    }
  }

  if (isLoading) {
    return <PageLoader />
  }

  if (error || !club) {
    return (
      <Container>
        <div className="club-detail-page">
          <Card className="club-detail-error-card">
            <div className="club-detail-error-content">
              <div className="club-detail-error-icon-wrapper">
                <ClubIcon className="club-detail-error-icon" />
              </div>
              <div>
                <h3 className="club-detail-error-title">{t('clubs.clubNotFound')}</h3>
                <p className="club-detail-error-description">{t('clubs.clubNotFoundDescription')}</p>
                <Link to="/clubs" className="club-detail-back-btn">
                  <ArrowLeft className="club-detail-back-icon" />
                  <span>{t('clubs.backToClubs')}</span>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </Container>
    )
  }

  return (
    <Container>
      <div className="club-detail-page">
        {/* Back Button */}
        <Link to="/clubs" className="club-detail-back-btn">
          <ArrowLeft className="club-detail-back-icon" />
          <span>{t('clubs.backToClubs')}</span>
        </Link>

        {/* Hero Section */}
        <section className="club-detail-hero">
          <div className="club-detail-hero-content">
            {/* Club Logo */}
            <div className="club-detail-logo-wrapper">
              {club.logo_url ? (
                <img
                  src={club.logo_url}
                  alt={club.name}
                  className="club-detail-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const parent = e.currentTarget.parentElement
                    if (parent) {
                      const placeholder = document.createElement('div')
                      placeholder.className = 'club-detail-logo-placeholder'
                      placeholder.innerHTML = '<svg class="club-detail-logo-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>'
                      parent.appendChild(placeholder)
                    }
                  }}
                />
              ) : (
                <div className="club-detail-logo-placeholder">
                  <ClubIcon className="club-detail-logo-icon" />
                </div>
              )}
              <div className="club-detail-profile-label">{t('clubs.clubProfile')}</div>
            </div>

            {/* Club Info */}
            <div className="club-detail-info">
              <h1 className="club-detail-title">{club.name}</h1>
              
              {club.location && (
                <div className="club-detail-location">
                  <MapPin className="club-detail-location-icon" />
                  <span>{club.location}</span>
                </div>
              )}

              {/* Actions and Stats */}
              <div className="club-detail-actions">
                {isOwner && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="club-detail-edit-btn"
                  >
                    <Edit2 className="club-detail-edit-icon" />
                    <span>{t('clubs.editClub') || 'Edit Club'}</span>
                  </button>
                )}

                {user && !isOwner && (
                  <>
                    {isMember ? (
                      <div className="club-detail-member-badge">
                        <Users className="club-detail-member-icon" />
                        <span>{t('clubs.youreAMember')}</span>
                      </div>
                    ) : hasRequested ? (
                      <div className="club-detail-request-badge">
                        <Clock className="club-detail-request-icon" />
                        <span>{t('clubs.joinRequestPending')}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => requestJoinMutation.mutate()}
                        disabled={requestJoinMutation.isPending || !user?.chesscom_username}
                        className="club-detail-join-btn"
                      >
                        {requestJoinMutation.isPending ? (
                          <>
                            <div className="club-detail-spinner"></div>
                            <span>{t('clubs.requesting')}</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="club-detail-join-icon" />
                            <span>{t('clubs.requestToJoin')}</span>
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}

                <div className="club-detail-stat">
                  <Users className="club-detail-stat-icon" />
                  <span>{membersCount} {membersCount === 1 ? t('clubs.member') : t('clubs.members')}</span>
                </div>
                
                {club.created_at && (
                  <div className="club-detail-stat">
                    <Calendar className="club-detail-stat-icon" />
                    <span>{t('clubs.foundedIn')} {new Date(club.created_at).getFullYear()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="club-detail-content">
          {/* Left Column */}
          <div className="club-detail-main">
            {/* About Section */}
            {(club.description || isOwner) && (
              <Card className="club-detail-section">
                <div className="club-detail-section-header">
                  <div className="club-detail-section-icon">
                    <FileText className="club-detail-section-icon-svg" />
                  </div>
                  <h2 className="club-detail-section-title">{t('clubs.aboutThisClub')}</h2>
                </div>
                {club.description ? (
                  <div className="club-detail-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {club.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="club-detail-no-description">{t('clubs.noDescription') || 'No description available.'}</p>
                )}
              </Card>
            )}

            {/* Edit Club Modal */}
            {isEditing && (
              <EditClubModal
                club={club}
                editForm={editForm}
                setEditForm={setEditForm}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                isLoading={updateClubMutation.isPending}
              />
            )}

            {/* Members Section */}
            {Array.isArray(club.members) && club.members.length > 0 && (
              <Card className="club-detail-section">
                <div className="club-detail-section-header">
                  <div className="club-detail-section-icon">
                    <Users className="club-detail-section-icon-svg" />
                  </div>
                  <div>
                    <h2 className="club-detail-section-title">{t('clubs.membersSection')}</h2>
                    <p className="club-detail-section-subtitle">
                      {membersCount} {membersCount === 1 ? t('clubs.member') : t('clubs.members')} {t('clubs.inThisClub')}
                    </p>
                  </div>
                </div>
                
                <div className="club-detail-members-grid">
                  {club.members.map((username, index) => {
                    const memberUser = getUserByChesscomUsername(username)
                    const avatarUrl = memberUser?.avatar_url || null
                    const isOwnerMember = user?.chesscom_username?.toLowerCase() === username.toLowerCase()
                    return (
                      <div key={index} className="club-detail-member-card">
                        <Link
                          to={`/player/${username}`}
                          className="club-detail-member-link"
                        >
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={username}
                              className="club-detail-member-avatar"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                                const parent = e.currentTarget.parentElement
                                if (parent) {
                                  const placeholder = document.createElement('div')
                                  placeholder.className = 'club-detail-member-avatar-placeholder'
                                  placeholder.innerHTML = '<svg class="club-detail-member-avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>'
                                  parent.insertBefore(placeholder, e.currentTarget)
                                }
                              }}
                            />
                          ) : (
                            <div className="club-detail-member-avatar-placeholder">
                              <User className="club-detail-member-avatar-icon" />
                            </div>
                          )}
                          <div className="club-detail-member-info">
                            <div className="club-detail-member-name">{username}</div>
                            <div className="club-detail-member-action">{t('clubs.viewProfile')}</div>
                          </div>
                        </Link>
                        {isOwner && !isOwnerMember && (
                          <button
                            onClick={() => {
                              const confirmMessage = t('clubs.confirmRemoveMember', { username }) || `Remove ${username} from the club?`
                              if (confirm(confirmMessage)) {
                                removeMemberMutation.mutate(username)
                              }
                            }}
                            disabled={removeMemberMutation.isPending}
                            className="club-detail-member-remove-btn"
                            title={t('clubs.removeMember') || 'Remove member'}
                          >
                            <Trash2 className="club-detail-member-remove-icon" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Join Requests Section - Only for Club Owner */}
            {isOwner && Array.isArray(club.join_requests) && club.join_requests.length > 0 && (
              <Card className="club-detail-section">
                <div className="club-detail-section-header">
                  <div className="club-detail-section-icon">
                    <UserPlus className="club-detail-section-icon-svg" />
                  </div>
                  <div>
                    <h2 className="club-detail-section-title">{t('clubs.joinRequests')}</h2>
                    <p className="club-detail-section-subtitle">
                      {club.join_requests.length} {club.join_requests.length === 1 ? t('clubs.request') : t('clubs.requests')} {t('clubs.pendingStatus')}
                    </p>
                  </div>
                </div>
                
                <div className="club-detail-requests-list">
                  {club.join_requests.map((username, index) => {
                    const requestUser = getUserByChesscomUsername(username)
                    const avatarUrl = requestUser?.avatar_url || null
                    return (
                      <div key={index} className="club-detail-request-card">
                        <div className="club-detail-request-info">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={username}
                              className="club-detail-request-avatar"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                                const parent = e.currentTarget.parentElement
                                if (parent) {
                                  const placeholder = document.createElement('div')
                                  placeholder.className = 'club-detail-request-avatar-placeholder'
                                  placeholder.innerHTML = '<svg class="club-detail-request-avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>'
                                  parent.insertBefore(placeholder, e.currentTarget)
                                }
                              }}
                            />
                          ) : (
                            <div className="club-detail-request-avatar-placeholder">
                              <User className="club-detail-request-avatar-icon" />
                            </div>
                          )}
                          <div className="club-detail-request-text">
                            <Link
                              to={`/player/${username}`}
                              className="club-detail-request-name"
                            >
                              {username}
                            </Link>
                            <div className="club-detail-request-label">{t('clubs.wantsToJoin')}</div>
                          </div>
                        </div>
                        <div className="club-detail-request-actions">
                          <button
                            onClick={() => approveRequestMutation.mutate(username)}
                            disabled={approveRequestMutation.isPending || rejectRequestMutation.isPending}
                            className="club-detail-request-approve-btn"
                            title={t('clubs.approveRequest') || 'Approve'}
                          >
                            <Check className="club-detail-request-action-icon" />
                          </button>
                          <button
                            onClick={() => rejectRequestMutation.mutate(username)}
                            disabled={approveRequestMutation.isPending || rejectRequestMutation.isPending}
                            className="club-detail-request-reject-btn"
                            title={t('clubs.rejectRequest') || 'Reject'}
                          >
                            <X className="club-detail-request-action-icon" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="club-detail-sidebar">
            {/* Quick Links Card */}
            {(chesscomUrl || lichessUrl || club.website_url) && (
              <Card className="club-detail-links-card">
                <div className="club-detail-links-header">
                  <div className="club-detail-links-icon">
                    <Link2 className="club-detail-links-icon-svg" />
                  </div>
                  <h3 className="club-detail-links-title">{t('clubs.connect')}</h3>
                </div>
                
                <div className="club-detail-links-list">
                  {chesscomUrl && (
                    <a
                      href={chesscomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="club-detail-link-item"
                    >
                      <div className="club-detail-link-icon">
                        <ChesscomIcon className="club-detail-link-icon-svg" />
                      </div>
                      <div className="club-detail-link-text">
                        <div className="club-detail-link-label">Chess.com</div>
                        <div className="club-detail-link-action">{t('clubs.visitClub')}</div>
                      </div>
                    </a>
                  )}
                  {lichessUrl && (
                    <a
                      href={lichessUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="club-detail-link-item"
                    >
                      <div className="club-detail-link-icon">
                        <LichessIcon className="club-detail-link-icon-svg" />
                      </div>
                      <div className="club-detail-link-text">
                        <div className="club-detail-link-label">Lichess</div>
                        <div className="club-detail-link-action">{t('clubs.visitTeam')}</div>
                      </div>
                    </a>
                  )}
                  {club.website_url && (
                    <a
                      href={club.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="club-detail-link-item"
                    >
                      <div className="club-detail-link-icon">
                        <ExternalLink className="club-detail-link-icon-svg" />
                      </div>
                      <div className="club-detail-link-text">
                        <div className="club-detail-link-label">{t('clubs.website')}</div>
                        <div className="club-detail-link-action">{t('clubs.visitSite')}</div>
                      </div>
                    </a>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Container>
  )
}

function EditClubModal({ club, editForm, setEditForm, onSave, onCancel, isLoading }) {
  const { t } = useLanguage()

  const locationOptions = [
    "Bagerhat", "Bandarban", "Barguna", "Barisal", "Bhola", "Bogra", "Brahmanbaria",
    "Chandpur", "Chittagong", "Chuadanga", "Comilla", "Cox's Bazar", "Dhaka", "Dinajpur",
    "Faridpur", "Feni", "Gaibandha", "Gazipur", "Gopalganj", "Habiganj", "Jamalpur",
    "Jessore", "Jhalokati", "Jhenaidah", "Joypurhat", "Khagrachari", "Khulna", "Kishoreganj",
    "Kurigram", "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur", "Magura", "Manikganj",
    "Maulvibazar", "Meherpur", "Munshiganj", "Mymensingh", "Narail", "Narayanganj", "Narsingdi",
    "Naogaon", "Natore", "Nawabganj", "Netrokona", "Nilphamari", "Noakhali", "Pabna",
    "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi", "Rangamati", "Rangpur",
    "Satkhira", "Shariatpur", "Sherpur", "Sirajgonj", "Sunamganj", "Sylhet", "Tangail", "Thakurgaon"
  ]

  return (
    <div className="club-detail-modal-overlay" onClick={onCancel}>
      <div className="club-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="club-detail-modal-header">
          <h2 className="club-detail-modal-title">{t('clubs.editClub')}</h2>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="club-detail-modal-close"
            aria-label={t('common.close') || 'Close'}
          >
            <X className="club-detail-modal-close-icon" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="club-detail-modal-form">
          <div className="club-detail-form-field">
            <label htmlFor="edit-name" className="club-detail-form-label">
              {t('clubs.clubName')} <span className="club-detail-form-required">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              value={club.name}
              disabled
              className="club-detail-form-input club-detail-form-input-disabled"
            />
            <p className="club-detail-form-hint">{t('clubs.nameCannotBeChanged') || 'Club name cannot be changed'}</p>
          </div>

          <div className="club-detail-form-field">
            <label htmlFor="edit-location" className="club-detail-form-label">
              {t('clubs.location')} <span className="club-detail-form-required">*</span>
            </label>
            <select
              id="edit-location"
              value={club.location || ''}
              disabled
              className="club-detail-form-select club-detail-form-input-disabled"
            >
              <option value="">{t('locations.selectLocation') || 'Select Location'}</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {t(`locations.${loc}`) || loc}
                </option>
              ))}
            </select>
            <p className="club-detail-form-hint">{t('clubs.locationCannotBeChanged') || 'Club location cannot be changed'}</p>
          </div>

          <div className="club-detail-form-field">
            <label htmlFor="edit-description" className="club-detail-form-label">
              {t('clubs.clubDescription')} <span className="club-detail-form-required">*</span>
            </label>
            <textarea
              id="edit-description"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={6}
              className="club-detail-form-textarea"
              placeholder={t('clubs.describeClub')}
            />
          </div>

          <div className="club-detail-form-field">
            <label htmlFor="edit-logo-url" className="club-detail-form-label">
              {t('clubs.logoUrl')}
            </label>
            <input
              id="edit-logo-url"
              type="url"
              value={editForm.logo_url}
              onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })}
              className="club-detail-form-input"
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div className="club-detail-form-field">
            <label htmlFor="edit-website-url" className="club-detail-form-label">
              {t('clubs.websiteUrl')}
            </label>
            <input
              id="edit-website-url"
              type="url"
              value={editForm.website_url}
              onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })}
              className="club-detail-form-input"
              placeholder="https://example.com"
            />
          </div>

          <div className="club-detail-form-row">
            <div className="club-detail-form-field">
              <label htmlFor="edit-chesscom-id" className="club-detail-form-label">
                {t('clubs.chesscomClubId')}
              </label>
              <input
                id="edit-chesscom-id"
                type="text"
                value={editForm.chesscom_club_id}
                onChange={(e) => setEditForm({ ...editForm, chesscom_club_id: e.target.value })}
                className="club-detail-form-input"
                placeholder="club-id"
              />
            </div>
            <div className="club-detail-form-field">
              <label htmlFor="edit-lichess-id" className="club-detail-form-label">
                {t('clubs.lichessTeamId')}
              </label>
              <input
                id="edit-lichess-id"
                type="text"
                value={editForm.lichess_team_id}
                onChange={(e) => setEditForm({ ...editForm, lichess_team_id: e.target.value })}
                className="club-detail-form-input"
                placeholder="team-id"
              />
            </div>
          </div>

          <div className="club-detail-modal-actions">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="club-detail-modal-cancel-btn"
            >
              {t('common.cancel') || t('clubs.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="club-detail-modal-submit-btn"
            >
              {isLoading ? (
                <span className="club-detail-modal-loading">
                  <div className="club-detail-modal-spinner"></div>
                  {t('common.loading') || t('clubs.saving') || 'Saving...'}
                </span>
              ) : (
                <span className="club-detail-modal-submit-content">
                  <Save className="club-detail-modal-submit-icon" />
                  {t('clubs.save') || 'Save'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

