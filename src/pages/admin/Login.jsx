import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthProvider'
import { isSupabaseConfigured } from '../../lib/supabase'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signOut, session, isSuperAdmin, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  // Pre-seed the "access denied" message if a non-admin was bounced here.
  const [error, setError] = useState(location.state?.denied ? 'denied' : '')

  // Already signed in as a super admin? Skip the form.
  if (!loading && session && isSuperAdmin) {
    return <Navigate to="/admin" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { profile } = await signIn(email.trim(), password)
      if (profile?.role !== 'super_admin') {
        // Not an admin: don't keep the session around.
        await signOut()
        setError('denied')
        return
      }
      navigate(location.state?.from || '/admin', { replace: true })
    } catch (err) {
      setError(err?.message === 'denied' ? 'denied' : 'failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <h1 className="page-title">{t('auth.title')}</h1>
      <p className="page-subtitle">{t('auth.subtitle')}</p>

      {!isSupabaseConfigured && (
        <p className="auth-error">⚠️ {t('auth.notConfigured')}</p>
      )}

      <form className="stack auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>{t('auth.email')}</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('auth.password')}</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error === 'denied' && <p className="auth-error">{t('auth.denied')}</p>}
        {error === 'failed' && <p className="auth-error">{t('auth.failed')}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </div>
  )
}
