import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getPublishedProjects } from '../lib/queries'
import { useFetch } from '../lib/useFetch'
import { Loading, ErrorState, Empty } from '../components/Status'
import CategoryFilter from '../components/CategoryFilter'
import ProjectCard from '../components/ProjectCard'

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
    <div className="page">
      <h1 className="page-title">{t('home.title')}</h1>
      <p className="page-subtitle">{t('home.subtitle')}</p>

      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {!loading && !error && projects?.length === 0 && <Empty />}

      {!loading && !error && projects?.length > 0 && (
        <>
          {categories.length > 1 && (
            <CategoryFilter categories={categories} value={filter} onChange={setFilter} />
          )}
          <div className="card-grid">
            {visible.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
