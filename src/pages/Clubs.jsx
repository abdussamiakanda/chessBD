import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { ClubCard } from '../components/ui/ClubCard'
import { Plus, X, Club as ClubIcon } from 'lucide-react'
import { useSEO } from '../hooks/use-seo'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth-store'
import { useToastStore } from '../store/toast-store'
import { useLanguage } from '../contexts/LanguageContext'
import { PageLoader } from '../components/ui/PageLoader'
import './Clubs.css'

export function Clubs() {
  const { t } = useLanguage()
  
  useSEO({
    title: t('nav.clubs'),
    description: 'Discover chess clubs in Bangladesh. Join local and online chess communities, connect with players, and participate in club tournaments.',
    keywords: 'chess clubs, chess communities, Bangladesh chess, chess groups, chess organizations',
    url: '/clubs',
  })

  const { user, loading: authLoading } = useAuthStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: clubs, isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => api.getClubs(),
    staleTime: 300000, // 5 minutes
  })

  if (authLoading || isLoading) {
    return <PageLoader />
  }

  const createMutation = useMutation({
    mutationFn: (clubData) => api.createClub(clubData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      setShowCreateModal(false)
      addToast({
        type: 'success',
        message: t('clubs.clubCreated'),
      })
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error?.message || t('clubs.createError'),
      })
    },
  })

  // Sort clubs: featured first, then by order, then by name
  const sortedClubs = clubs
    ? [...clubs].sort((a, b) => {
        // Featured clubs first
        if (a.featured && !b.featured) return -1
        if (!a.featured && b.featured) return 1
        
        // Then by order (lower = first)
        const orderA = a.order ?? 999
        const orderB = b.order ?? 999
        if (orderA !== orderB) return orderA - orderB
        
        // Finally by name
        return (a.name || '').localeCompare(b.name || '')
      })
    : []

  return (
    <Container>
      <div className="clubs-page">
        {/* Hero Section */}
        <section className="clubs-hero">
          <div className="clubs-hero-content">
            <p className="clubs-hero-label">{t('clubs.subtitle')}</p>
            <h1 className="clubs-hero-title">{t('clubs.title')}</h1>
            <p className="clubs-hero-description">{t('clubs.description')}</p>
          </div>
          {/* Create Club Button */}
          {user && (
            <div className="clubs-create-btn-wrapper">
              <button
                onClick={() => setShowCreateModal(true)}
                className="clubs-create-btn"
              >
                <Plus className="clubs-create-icon" />
                <span>{t('clubs.createClub')}</span>
              </button>
            </div>
          )}
        </section>

        {/* Clubs Grid */}
        {isLoading ? (
          <div className="clubs-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="clubs-card-skeleton">
                <div className="clubs-card-skeleton-content">
                  <Skeleton className="clubs-card-skeleton-logo" />
                  <div className="clubs-card-skeleton-text">
                    <Skeleton className="clubs-card-skeleton-title" />
                    <Skeleton className="clubs-card-skeleton-location" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : sortedClubs && sortedClubs.length > 0 ? (
          <div className="clubs-grid">
            {sortedClubs.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        ) : (
          <Card className="clubs-empty-state">
            <div className="clubs-empty-content">
              <div className="clubs-empty-icon-wrapper">
                <ClubIcon className="clubs-empty-icon" />
              </div>
              <div>
                <h3 className="clubs-empty-title">{t('clubs.noClubsAvailable')}</h3>
                <p className="clubs-empty-text">{t('clubs.noClubsDescription')}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Create Club Modal */}
        {showCreateModal && (
          <CreateClubModal
            user={user}
            onClose={() => setShowCreateModal(false)}
            onSubmit={(clubData) => {
              createMutation.mutate(clubData)
            }}
            isLoading={createMutation.isPending}
          />
        )}
      </div>
    </Container>
  )
}


function CreateClubModal({ user, onClose, onSubmit, isLoading }) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [chesscomClubId, setChesscomClubId] = useState('')
  const [lichessTeamId, setLichessTeamId] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  
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

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      return
    }

    // Add creator's Chess.com username to members array
    const members = user?.chesscom_username ? [user.chesscom_username] : []

    onSubmit({
      name: name.trim(),
      location: location.trim() || null,
      description: description.trim() || null,
      website_url: websiteUrl.trim() || null,
      chesscom_club_id: chesscomClubId.trim() || null,
      lichess_team_id: lichessTeamId.trim() || null,
      logo_url: logoUrl.trim() || null,
      members, // Include creator as first member
      members_count: members.length,
      featured: false, // Default to false, admin can set this
      order: null, // Default to null, admin can set this
      approved: false, // Will be set to false by API
      created_by: user?.id || null,
    })
  }

  return (
    <div className="clubs-modal-overlay" onClick={onClose}>
      <div className="clubs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="clubs-modal-header">
          <h2 className="clubs-modal-title">{t('clubs.createClub')}</h2>
          <button
            onClick={onClose}
            className="clubs-modal-close"
            aria-label={t('common.close')}
          >
            <X className="clubs-modal-close-icon" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="clubs-modal-form">
          <div className="clubs-form-field">
            <label htmlFor="name" className="clubs-form-label">
              {t('clubs.clubName')} <span className="clubs-form-required">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="clubs-form-input"
              placeholder={t('clubs.enterClubName')}
            />
          </div>

          <div className="clubs-form-field">
            <label htmlFor="location" className="clubs-form-label">
              {t('clubs.location')} <span className="clubs-form-required">*</span>
            </label>
            <select
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              className="clubs-form-select"
            >
              <option value="">{t('locations.selectLocation') || 'Select Location'}</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {t(`locations.${loc}`) || loc}
                </option>
              ))}
            </select>
          </div>

          <div className="clubs-form-field">
            <label htmlFor="description" className="clubs-form-label">
              {t('clubs.clubDescription')} <span className="clubs-form-required">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="clubs-form-textarea"
              placeholder={t('clubs.describeClub')}
            />
          </div>

          <div className="clubs-form-row">
            <div className="clubs-form-field">
              <label htmlFor="websiteUrl" className="clubs-form-label">
                {t('clubs.websiteUrl')}
              </label>
              <input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="clubs-form-input"
                placeholder="https://example.com"
              />
            </div>

            <div className="clubs-form-field">
              <label htmlFor="logoUrl" className="clubs-form-label">
                {t('clubs.logoUrl')}
              </label>
              <input
                id="logoUrl"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="clubs-form-input"
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>

          <div className="clubs-form-row">
            <div className="clubs-form-field">
              <label htmlFor="chesscomClubId" className="clubs-form-label">
                {t('clubs.chesscomClubId')}
              </label>
              <input
                id="chesscomClubId"
                type="text"
                value={chesscomClubId}
                onChange={(e) => setChesscomClubId(e.target.value)}
                className="clubs-form-input"
                placeholder="club-id"
              />
            </div>

            <div className="clubs-form-field">
              <label htmlFor="lichessTeamId" className="clubs-form-label">
                {t('clubs.lichessTeamId')}
              </label>
              <input
                id="lichessTeamId"
                type="text"
                value={lichessTeamId}
                onChange={(e) => setLichessTeamId(e.target.value)}
                className="clubs-form-input"
                placeholder="team-id"
              />
            </div>
          </div>

          <div className="clubs-modal-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="clubs-modal-cancel-btn"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="clubs-modal-submit-btn"
            >
              {isLoading ? (
                <span className="clubs-modal-loading">
                  <div className="clubs-modal-spinner"></div>
                  {t('common.loading')}
                </span>
              ) : (
                <span className="clubs-modal-submit-content">
                  <Plus className="clubs-modal-submit-icon" />
                  {t('clubs.createClub')}
                </span>
              )}
            </button>
          </div>

          <p className="clubs-modal-hint">
            {t('clubs.clubWillBeReviewed')}
          </p>
        </form>
      </div>
    </div>
  )
}

