import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { localized } from '../../lib/supabase'
import { getAllProjects, deleteProject, setPublished, reorderProjects } from '../../lib/adminQueries'
import { deleteLogoByUrl } from '../../lib/storage'
import { useFetch } from '../../lib/useFetch'
import { Loading, ErrorState } from '../../components/Status'
import AdminBar from '../../components/AdminBar'

// ---- one draggable row ----------------------------------------------------
function ProjectRow({ project, onTogglePublish, onDelete, busyId }) {
  const { t, i18n } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  }
  const name = localized(project, 'name', i18n.language)
  const category = project.category || 'other'
  const busy = busyId === project.id

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`admin-row${project.is_published ? '' : ' is-hidden'}`}
    >
      <button
        className="drag-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      {project.logo_url ? (
        <img className="admin-row-logo" src={project.logo_url} alt="" />
      ) : (
        <div className="admin-row-logo placeholder" aria-hidden="true">
          {(name || '?').trim().charAt(0).toUpperCase()}
        </div>
      )}

      <div className="admin-row-main">
        <strong>{name || <span className="muted">(untitled)</span>}</strong>
        <span className={`cat-tag cat-${category}`}>{t(`categories.${category}`)}</span>
      </div>

      <button
        className={`pub-toggle${project.is_published ? ' on' : ''}`}
        disabled={busy}
        onClick={() => onTogglePublish(project)}
        title={project.is_published ? t('admin.published') : t('admin.hidden')}
      >
        {project.is_published ? t('admin.published') : t('admin.hidden')}
      </button>

      <div className="admin-row-actions">
        <Link to={`/admin/edit/${project.id}`} className="btn btn-ghost btn-sm">
          {t('admin.edit')}
        </Link>
        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => onDelete(project)}>
          {t('admin.delete')}
        </button>
      </div>
    </div>
  )
}

// ---- dashboard ------------------------------------------------------------
export default function AdminDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, loading, error } = useFetch(getAllProjects, [])

  const [projects, setProjects] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [toDelete, setToDelete] = useState(null) // project pending confirm
  const [actionError, setActionError] = useState('')
  // 'all' (default) | 'published' | 'hidden' — drives the filter chips below.
  const [statusFilter, setStatusFilter] = useState('all')

  const counts = useMemo(() => {
    if (!projects) return { all: 0, published: 0, hidden: 0 }
    const published = projects.filter((p) => p.is_published).length
    return { all: projects.length, published, hidden: projects.length - published }
  }, [projects])

  const visible = useMemo(() => {
    if (!projects) return []
    if (statusFilter === 'published') return projects.filter((p) => p.is_published)
    if (statusFilter === 'hidden') return projects.filter((p) => !p.is_published)
    return projects
  }, [projects, statusFilter])

  // Seed local list once the fetch lands.
  if (data && projects === null) setProjects(data)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = projects.findIndex((p) => p.id === active.id)
    const newIndex = projects.findIndex((p) => p.id === over.id)
    const next = arrayMove(projects, oldIndex, newIndex)
    const prev = projects
    setProjects(next) // optimistic
    try {
      await reorderProjects(next.map((p) => p.id))
    } catch (err) {
      setProjects(prev) // revert
      setActionError(err.message || 'reorder failed')
    }
  }

  async function handleTogglePublish(project) {
    setBusyId(project.id)
    setActionError('')
    try {
      await setPublished(project.id, !project.is_published)
      setProjects((list) =>
        list.map((p) => (p.id === project.id ? { ...p, is_published: !p.is_published } : p))
      )
    } catch (err) {
      setActionError(err.message || 'update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    const project = toDelete
    setBusyId(project.id)
    setActionError('')
    try {
      await deleteProject(project.id)
      if (project.logo_url) await deleteLogoByUrl(project.logo_url) // clean up storage
      setProjects((list) => list.filter((p) => p.id !== project.id))
      setToDelete(null)
    } catch (err) {
      setActionError(err.message || 'delete failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <AdminBar />

      <div className="admin-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{t('admin.title')}</h1>
          <p className="page-subtitle" style={{ margin: '0.2rem 0 0' }}>{t('admin.reorderHint')}</p>
        </div>
        <button className="btn" onClick={() => navigate('/admin/new')}>+ {t('admin.addProject')}</button>
      </div>

      {actionError && <p className="auth-error">{actionError}</p>}

      {loading && <Loading />}
      {error && <ErrorState error={error} />}

      {projects && projects.length === 0 && (
        <p className="muted center" style={{ padding: '2rem' }}>{t('admin.noProjects')}</p>
      )}

      {projects && projects.length > 0 && (
        <>
          {/* status filter — quick way to see which projects are live vs hidden */}
          <div className="filter-bar" role="group" aria-label="Filter by status">
            {[
              { key: 'all', label: t('admin.filter.all') },
              { key: 'published', label: t('admin.published') },
              { key: 'hidden', label: t('admin.hidden') }
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`chip${statusFilter === key ? ' active' : ''}`}
                aria-pressed={statusFilter === key}
                onClick={() => setStatusFilter(key)}
              >
                {label} <span className="chip-count">{counts[key]}</span>
              </button>
            ))}
            {statusFilter !== 'all' && (
              <span className="muted" style={{ fontSize: '0.82rem', marginLeft: '0.4rem' }}>
                {t('admin.reorderInAllOnly')}
              </span>
            )}
          </div>

          {/* Reorder only makes sense when showing the full list — dragging a
              filtered subset would mangle the positions of hidden rows. */}
          {statusFilter === 'all' ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visible.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="admin-list">
                  {visible.map((p) => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      busyId={busyId}
                      onTogglePublish={handleTogglePublish}
                      onDelete={setToDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="admin-list">
              {visible.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  busyId={busyId}
                  onTogglePublish={handleTogglePublish}
                  onDelete={setToDelete}
                />
              ))}
            </div>
          )}

          {visible.length === 0 && (
            <p className="muted center" style={{ padding: '1.5rem' }}>
              {statusFilter === 'hidden' ? t('admin.noHidden') : t('admin.noPublished')}
            </p>
          )}
        </>
      )}

      {/* delete confirmation modal */}
      {toDelete && (
        <div className="modal-backdrop" onClick={() => setToDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{t('admin.deleteTitle')}</h2>
            <p>{t('admin.deleteConfirm', { name: localized(toDelete, 'name', 'en') || '—' })}</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setToDelete(null)}>
                {t('admin.cancel')}
              </button>
              <button className="btn btn-danger" disabled={busyId === toDelete.id} onClick={confirmDelete}>
                {t('admin.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
