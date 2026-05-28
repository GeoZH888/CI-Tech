import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Load the caller's own profile row (RLS: "read own profile").
async function fetchProfile(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('ct_user_profiles')
    .select('id, email, role')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Safety net: if Supabase Auth somehow never resolves (project paused,
    // refresh-token round-trip hung, browser extension blocking the endpoint),
    // unblock the UI after 5s so login / admin guards don't sit on a
    // perpetual "Loading…". Real session data will catch up when it arrives.
    const unblock = setTimeout(() => {
      if (active) setLoading(false)
    }, 5000)

    // Initial session on load.
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session
      const p = s ? await fetchProfile(s.user.id) : null
      if (!active) return
      clearTimeout(unblock)
      setSession(s)
      setProfile(p)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      clearTimeout(unblock)
      setLoading(false)
    })

    // Keep in sync with sign-in / sign-out / token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      const p = s ? await fetchProfile(s.user.id) : null
      if (!active) return
      setSession(s)
      setProfile(p)
      setLoading(false)
    })

    return () => {
      active = false
      clearTimeout(unblock)
      sub.subscription.unsubscribe()
    }
  }, [])

  // Sign in, then resolve the profile so the caller can role-check immediately.
  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const p = await fetchProfile(data.user.id)
    setProfile(p)
    return { session: data.session, profile: p }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    isSuperAdmin: profile?.role === 'super_admin',
    loading,
    signIn,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
