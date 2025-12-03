import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { Briefcase, Heart, Users, MapPin, ExternalLink, CheckCircle2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'
import './Jobs.css'

export function Jobs() {
  const { t } = useLanguage()
  
  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.getJobs(true), // Get only published jobs
    staleTime: 300000, // 5 minutes
  })

  const getTypeBadge = (type) => {
    const styles = {
      volunteer: 'jobs-type-badge-volunteer',
      'part-time': 'jobs-type-badge-part-time',
      'full-time': 'jobs-type-badge-full-time'
    }
    const labels = {
      volunteer: t('jobs.volunteer'),
      'part-time': t('jobs.partTime'),
      'full-time': t('jobs.fullTime')
    }
    return (
      <span className={`jobs-type-badge ${styles[type] || styles.volunteer}`}>
        <Heart className="jobs-type-badge-icon" />
        {labels[type] || labels.volunteer}
      </span>
    )
  }

  return (
    <Container>
      <div className="jobs-page">
        {/* Hero Section */}
        <section className="jobs-hero">
          <div className="jobs-hero-content">
            <p className="jobs-hero-label">{t('jobs.subtitle') || 'Join Our Team'}</p>
            <h1 className="jobs-hero-title">
              {t('jobs.title') || 'Jobs & Volunteer Opportunities'}
            </h1>
          </div>
          <p className="jobs-hero-description">
            {t('jobs.heroDescription')}
          </p>
        </section>

        {/* Open Positions */}
        <section className="jobs-positions">
          <div className="jobs-positions-header">
            <div className="jobs-positions-header-content">
              <p className="jobs-positions-label">{t('jobs.availableRoles') || 'Available roles'}</p>
              <h2 className="jobs-positions-title">
                {t('jobs.openPositions') || 'Open Positions'}
              </h2>
              <p className="jobs-positions-description">
                {t('jobs.openPositionsDescription')}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="jobs-list">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="jobs-card">
                  <Skeleton className="jobs-skeleton" />
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card className="jobs-error-card">
              <div className="jobs-error-content">
                <div className="jobs-error-icon-wrapper">
                  <Briefcase className="jobs-error-icon" />
                </div>
                <div className="jobs-error-text">
                  <h3 className="jobs-error-title">
                    {t('jobs.errorLoading') || 'Error Loading Jobs'}
                  </h3>
                  <p className="jobs-error-description">
                    {t('jobs.errorDescription') || 'Failed to load job positions. Please try again later.'}
                  </p>
                </div>
              </div>
            </Card>
          ) : jobs && jobs.length > 0 ? (
            <div className="jobs-list">
              {jobs.map((job) => (
                <div key={job.id} className="jobs-card-wrapper">
                  <div className="jobs-card-glow"></div>
                  <Card className="jobs-card">
                    {/* Header */}
                    <div className="jobs-card-header">
                      <div className="jobs-card-header-content">
                        <div className="jobs-card-title-row">
                          <h3 className="jobs-card-title">
                            {job.title}
                          </h3>
                          {getTypeBadge(job.type)}
                        </div>
                        <div className="jobs-card-meta">
                          <div className="jobs-card-meta-item">
                            <Briefcase className="jobs-card-meta-icon" />
                            <span>{job.department}</span>
                          </div>
                          <div className="jobs-card-meta-item">
                            <MapPin className="jobs-card-meta-icon" />
                            <span>{job.location}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="jobs-card-description">
                      {job.description}
                    </p>

                    {/* Details Grid */}
                    <div className="jobs-card-details">
                      <div className="jobs-card-details-item">
                        <h4 className="jobs-card-details-title">
                          <Users className="jobs-card-details-icon" />
                          {t('jobs.responsibilities') || 'Responsibilities'}
                        </h4>
                        <ul className="jobs-card-details-list">
                          {job.responsibilities && job.responsibilities.map((resp, idx) => (
                            <li key={idx} className="jobs-card-details-list-item">
                              <span className="jobs-card-details-bullet">•</span>
                              <span>{resp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="jobs-card-details-item">
                        <h4 className="jobs-card-details-title">
                          <CheckCircle2 className="jobs-card-details-icon" />
                          {t('jobs.requirements') || 'Requirements'}
                        </h4>
                        <ul className="jobs-card-details-list">
                          {job.requirements && job.requirements.map((req, idx) => (
                            <li key={idx} className="jobs-card-details-list-item">
                              <span className="jobs-card-details-bullet">•</span>
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Benefits */}
                    {job.benefits && job.benefits.length > 0 && (
                      <div className="jobs-card-benefits">
                        <h4 className="jobs-card-details-title">
                          <Heart className="jobs-card-details-icon" />
                          {t('jobs.benefits') || 'Benefits'}
                        </h4>
                        <ul className="jobs-card-details-list">
                          {job.benefits.map((benefit, idx) => (
                            <li key={idx} className="jobs-card-details-list-item">
                              <span className="jobs-card-details-bullet">•</span>
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Apply Button */}
                    <div className="jobs-card-apply">
                      {job.application_email ? (
                        <a
                          href={`mailto:${job.application_email}?subject=${encodeURIComponent(t('jobs.applicationSubject') || 'Application for')} ${encodeURIComponent(job.title)}`}
                          className="jobs-card-apply-btn"
                          onClick={(e) => e.stopPropagation()}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="jobs-card-apply-icon" />
                          {t('jobs.applyViaEmail') || 'Apply via Email'}
                        </a>
                      ) : job.application_link ? (
                        <a
                          href={job.application_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="jobs-card-apply-btn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="jobs-card-apply-icon" />
                          {t('jobs.applyNow') || 'Apply Now'}
                        </a>
                      ) : null}
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <Card className="jobs-empty-card">
              <div className="jobs-empty-content">
                <div className="jobs-empty-icon-wrapper">
                  <Briefcase className="jobs-empty-icon" />
                </div>
                <div className="jobs-empty-text">
                  <h3 className="jobs-empty-title">
                    {t('jobs.noOpenPositions') || 'No Open Positions'}
                  </h3>
                  <p className="jobs-empty-description">
                    {t('jobs.noOpenPositionsDescription')}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </section>

        {/* General Application Section */}
        <section className="jobs-general">
          <div className="jobs-general-wrapper">
            <div className="jobs-general-glow"></div>
            <Card className="jobs-general-card">
              <div className="jobs-general-content">
                <h2 className="jobs-general-title">
                  {t('jobs.dontSeeMatch') || "Don't See a Match?"}
                </h2>
                <p className="jobs-general-description">
                  {t('jobs.dontSeeMatchDescription')}
                </p>
                <a
                  href={`mailto:${t('jobs.contactEmail') || 'support@chessbd.app'}?subject=${encodeURIComponent(t('jobs.generalInquiry') || 'General Inquiry')}`}
                  className="jobs-general-btn"
                >
                  <ExternalLink className="jobs-general-btn-icon" />
                  {t('jobs.getInTouch') || 'Get in Touch'}
                </a>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </Container>
  )
}

