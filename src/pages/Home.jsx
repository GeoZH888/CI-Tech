import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getPublishedProjects } from '../lib/queries'
import { useFetch } from '../lib/useFetch'
import { Loading, ErrorState, Empty } from '../components/Status'
import CategoryFilter from '../components/CategoryFilter'
import ProjectCard from '../components/ProjectCard'
import Footer from '../components/Footer'

// Stable display order for the filter chips, regardless of data order.
const CATEGORY_ORDER = ['education', 'cultural', 'community', 'tools', 'other']

export default function Home() {
  const { t } = useTranslation()
  const { data: projects, loading, error } = useFetch(getPublishedProjects, [])
  const [filter, setFilter] = useState('all')

  // Which categories actually appear in the data (in the canonical order).
  const categories = useMemo(() => {
    if (!projects) return []
    const present = new Set(projects.map((p) => p.category || 'other'))
    return CATEGORY_ORDER.filter((c) => present.has(c))
  }, [projects])

  const visible = useMemo(() => {
    if (!projects) return []
    return filter === 'all'
      ? projects
      : projects.filter((p) => (p.category || 'other') === filter)
  }, [projects, filter])

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">{t('home.title')}</h1>
          <p className="hero-subtitle">{t('home.subtitle')}</p>

          {projects?.length > 0 && (
            <div className="hero-stats">
              <span className="stat">
                <strong>{projects.length}</strong>{' '}
                {t('home.projectsCount', { count: projects.length })}
              </span>
              <span className="stat-dot" aria-hidden="true">·</span>
              <span className="stat">
                <strong>{categories.length}</strong>{' '}
                {t('home.categoriesCount', { count: categories.length })}
              </span>
            </div>
          )}
        </div>
      </section>

      <div className="page">
        {loading && <Loading />}
        {error && <ErrorState error={error} />}
        {!loading && !error && projects?.length === 0 && <Empty />}

        {!loading && !error && projects?.length > 0 && (
          <>
            {categories.length > 1 && (
              <CategoryFilter
                categories={categories}
                value={filter}
                onChange={setFilter}
              />
            )}
            <div className="card-grid">
              {visible.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </>
        )}
      </div>

      <Footer />
    </>
  )
}
