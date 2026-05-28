import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getProjectById } from '../lib/queries'
import { useFetch } from '../lib/useFetch'
import { localized } from '../lib/supabase'
import { Loading, ErrorState } from '../components/Status'
import BackLink from '../components/BackLink'

export default function ProjectDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { data: project, loading, error } = useFetch(() => getProjectById(id), [id])

  if (loading) return <div className="page"><Loading /></div>
  if (error) return <div className="page"><BackLink /><ErrorState error={error} /></div>
  if (!project) return <div className="page"><BackLink /><p className="muted center">{t('detail.notFound')}</p></div>

  const name = localized(project, 'name', lang)
  const tagline = localized(project, 'tagline', lang)
  const description = localized(project, 'description', lang)
  const category = project.category || 'other'
  const tags = Array.isArray(project.tech_stack) ? project.tech_stack : []
  const shots = Array.isArray(project.screenshots) ? project.screenshots : []
  const hasUrl = project.external_url && project.external_url !== '#'

  return (
    <div className="page">
      <BackLink />

      <div className="detail-head">
        {project.logo_url ? (
          <img className="project-logo" src={project.logo_url} alt={name} />
        ) : (
          <div className="project-logo placeholder" aria-hidden="true">
            {(name || '?').trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{name}</h1>
          {tagline && <p className="page-subtitle" style={{ margin: '0.2rem 0 0' }}>{tagline}</p>}
          <span className={`cat-tag cat-${category}`} style={{ marginTop: '0.4rem', display: 'inline-block' }}>
            {t(`categories.${category}`)}
          </span>
        </div>
      </div>

      {hasUrl && (
        <a className="btn" href={project.external_url} target="_blank" rel="noopener noreferrer">
          {t('detail.visitSite')} →
        </a>
      )}

      {description && (
        <div className="detail-section">
          <h2>{t('detail.about')}</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{description}</p>
        </div>
      )}

      {tags.length > 0 && (
        <div className="detail-section">
          <h2>{t('detail.techStack')}</h2>
          <div className="tech-tags">
            {tags.map((tag) => (
              <span key={tag} className="tech-tag">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {shots.length > 0 && (
        <div className="detail-section">
          <h2>{t('detail.screenshots')}</h2>
          <div className="screenshot-grid">
            {shots.map((url, i) => (
              <img key={i} src={url} alt={`${name} screenshot ${i + 1}`} loading="lazy" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
