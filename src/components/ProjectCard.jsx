import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { localized } from '../lib/supabase'

// A single project tile in the showcase grid.
// The whole card links to the detail page; the "Visit" button opens the
// external live site in a new tab (and stops the card link from firing).
export default function ProjectCard({ project }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const name = localized(project, 'name', lang)
  const tagline = localized(project, 'tagline', lang)
  const category = project.category || 'other'
  const tags = Array.isArray(project.tech_stack) ? project.tech_stack.slice(0, 4) : []
  const hasUrl = project.external_url && project.external_url !== '#'

  return (
    <Link to={`/project/${project.id}`} className="project-card">
      <div className="project-card-body">
        {project.logo_url ? (
          <img className="project-logo" src={project.logo_url} alt={name} loading="lazy" />
        ) : (
          <div className="project-logo placeholder" aria-hidden="true">
            {(name || '?').trim().charAt(0).toUpperCase()}
          </div>
        )}
        <span className={`cat-tag cat-${category}`}>{t(`categories.${category}`)}</span>
        <h3 className="project-name">{name}</h3>
        {tagline && <p className="project-tagline">{tagline}</p>}
        {tags.length > 0 && (
          <div className="tech-tags">
            {tags.map((tag) => (
              <span key={tag} className="tech-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="project-card-foot">
        <span className="muted" style={{ fontSize: '0.82rem' }}>{t('card.details')} →</span>
        {hasUrl ? (
          <a
            className="btn btn-sm"
            href={project.external_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {t('card.visit')} →
          </a>
        ) : (
          <span className="btn btn-sm btn-ghost" aria-disabled="true">{t('card.noUrl')}</span>
        )}
      </div>
    </Link>
  )
}
