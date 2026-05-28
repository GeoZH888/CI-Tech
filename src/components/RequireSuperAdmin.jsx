import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import { Loading } from './Status'

/**
 * Gate for the admin area.
 *  - still resolving session/profile  -> spinner
 *  - no session                        -> redirect to /admin/login
 *  - signed in but NOT super_admin     -> sign out + redirect with "denied" flag
 *  - super_admin                       -> render children
 */
export default function RequireSuperAdmin({ children }) {
  const { session, isSuperAdmin, loading, signOut } = useAuth()
  const location = useLocation()

  // A logged-in non-admin should never linger in an admin session.
  useEffect(() => {
    if (!loading && session && !isSuperAdmin) {
      signOut()
    }
  }, [loading, session, isSuperAdmin, signOut])

  if (loading) {
    return <div className="page"><Loading /></div>
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  if (!isSuperAdmin) {
    return <Navigate to="/admin/login" replace state={{ denied: true }} />
  }

  return children
}
