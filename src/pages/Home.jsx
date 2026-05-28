import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getPublishedProjects } from '../lib/queries'
import { getAllProjects, setPublished } from '../lib/adminQueries'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../context/AuthProvider'
import { Loading, ErrorState, Empty } from '../components/Status'
import CategoryFilter from '../components/CategoryFilter'
import ProjectCard from '../components/ProjectCard'
import Footer from '../components/Footer'

// Stable display order for the filter chips, regardless of data order.
const CATEGORY_ORDER = ['education', 'cultural', 'community', 'tools', 'other']

export default function Home() {
  const { t } = useTranslation()
  const { isSuperAdmin } = useAuth()

  // Super admins see the entire catalog (including unpublished) so they can
  // curate from the public view. Anonymous visitors only see published.
  const loader = isSuperAdmin ? getAllProjects : getPublishedProjects
  const { data: projects, loading, error } = useFetch(loader, [isSuperAdmin])

  const [filter, setFilter] = useState('all')
  // Local mirror so the publish-toggle pill updates without a refetch.
  const [overrides, setOverrides] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  // Merge the local publish overrides on top of the fetched data.
  const merged = useMemo(() => {
    if (!projects) return null
    return projects.map((p) =>
      p.id in overrides ? { ...p, is_published: overrides[p.id] } : p
    )
  }, [projects, overrides])

  const categories = useMemo(() => {
    if (!merged) return []
    const present = new Set(merged.map((p) => p.category || 'other'))
    return CATEGORY_ORDER.filter((c) => present.has(c))
  }, [merged])

  const visible = useMemo(() => {
    if (!merged) return []
    return filter === 'all'
      ? merged
      : merged.filter((p) => (p.category || 'other') === filter)
  }, [merged, filter])

  const hiddenCount = useMemo(
    () => (merged ? merged.filter((p) => !p.is_published).length : 0),
    [merged]
  )

  async function togglePublish(project) {
    if (!isSuperAdmin) return
    setBusyId(project.id)
    setActionError('')
    const next = !project.is_published
    setOverrides((o) => ({ ...o, [project.id]: next })) // optimistic
    try {
      await setPublished(project.id, next)
    } catch (err) {
      setOverrides((o) => ({ ...o, [project.id]: !next })) // revert
      setActionError(err.message || 'update failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">{t('home.title')}</h1>
          <p className="hero-subtitle">{t('home.subtitle')}</p>

          {merged?.length > 0 && (
            <div className="hero-stats">
              <span className="stat">
                <strong>{merged.length}</strong>{' '}
                {t('home.projectsCount', { count: merged.length })}
              </span>
              <span className="stat-dot" aria-hidden="true">·</span>
              <span className="stat">
                <strong>{categories.length}</strong>{' '}
                {t('home.categoriesCount', { count: categories.length })}
              </span>
              {isSuperAdmin && hiddenCount > 0 && (
                <>
                  <span className="stat-dot" aria-hidden="true">·</span>
                  <span className="stat hidden-stat">
                    <strong>{hiddenCount}</strong> {t('home.hiddenCount')}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="page">
        {loading && <Loading />}
        {error && <ErrorState error={error} />}
        {!loading && !error && merged?.length === 0 && <Empty />}
        {actionError && <p className="auth-error">{actionError}</p>}

        {!loading && !error && merged?.length > 0 && (
          <>
            {categories.length > 1 && (
              <CategoryFilter
                categories={categories}
                value={filter}
                onChange={setFilter}
              />
            )}
            <div className="card-grid">
              {visible.map((project) =>
                isSuperAdmin ? (
                  <AdminCardWrap
                    key={project.id}
                    project={project}
                    busy={busyId === project.id}
                    onTogglePublish={() => togglePublish(project)}
                  />
                ) : (
                  <ProjectCard key={project.id} project={project} />
                )
              )}
            </div>
          </>
        )}
      </div>

      <Footer />
    </>
  )
}

// Card + admin toolbar (publish toggle + edit shortcut). Kept inline because
// it's only rendered from one place and shares state with Home.
function AdminCardWrap({ project, busy, onTogglePublish }) {
  const { t } = useTranslation()
  return (
    <div className={`admin-card-wrap${project.is_published ? '' : ' is-hidden'}`}>
      {!project.is_published && (
        <span className="hidden-badge" aria-hidden="true">{t('admin.hidden')}</span>
      )}
      <ProjectCard project={project} />
      <div className="admin-quick">
        <button
          className={`pub-toggle${project.is_published ? ' on' : ''}`}
          disabled={busy}
          onClick={onTogglePublish}
          aria-label={project.is_published ? t('admin.hidden') : t('admin.published')}
        >
          {project.is_published ? t('admin.published') : t('admin.hidden')}
        </button>
        <Link
          to={`/admin/edit/${project.id}`}
          className="btn btn-ghost btn-sm"
          aria-label={t('admin.edit')}
          title={t('admin.edit')}
        >
          ✎ {t('admin.edit')}
        </Link>
      </div>
    </div>
  )
}
