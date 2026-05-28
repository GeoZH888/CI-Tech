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

  // We keep the raw error message in state so the user can see the real cause
  // if it's not one of the known ones (denied / failed / timeout).
  const [rawError, setRawError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setRawError('')
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
      const msg = err?.message || String(err)
      if (msg === 'signin_timeout') setError('timeout')
      else if (msg === 'denied') setError('denied')
      else if (/invalid login credentials/i.test(msg)) setError('failed')
      else {
        setError('other')
        setRawError(msg)
      }
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
        {error === 'timeout' && <p className="auth-error">{t('auth.timeout')}</p>}
        {error === 'other' && (
          <p className="auth-error">
            {t('auth.failed')}
            {rawError && <><br /><code style={{ fontSize: '0.78rem', opacity: 0.8 }}>{rawError}</code></>}
          </p>
        )}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </div>
  )
}
