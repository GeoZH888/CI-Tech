import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthProvider'

// Shared bar across the admin pages: who's logged in, a link back to the
// public site, and sign out.
export default function AdminBar() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-bar">
      <span className="muted" style={{ fontSize: '0.85rem' }}>
        {t('admin.signedInAs')} <strong>{user?.email}</strong>
      </span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Link to="/" className="btn btn-ghost btn-sm">{t('admin.viewSite')} ↗</Link>
        <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
          {t('admin.signOut')}
        </button>
      </div>
    </div>
  )
}
