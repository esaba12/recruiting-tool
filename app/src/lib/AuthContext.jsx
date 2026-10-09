import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient.js'
import { setStorageUserId } from './scopedStorage.js'
import { setSentryUser } from './sentry.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  // Which user the current `profile` belongs to (set even when the read fails), so the gate
  // can tell "not loaded yet" apart from "loaded, no row" without a flash of the wrong screen.
  const [profileUserId, setProfileUserId] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); setProfileUserId(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data || null)
    setProfileUserId(userId)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setStorageUserId(data.session?.user?.id)
      setSentryUser(data.session?.user?.id)
      loadProfile(data.session?.user?.id).finally(() => setLoading(false))
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setStorageUserId(newSession?.user?.id)
      setSentryUser(newSession?.user?.id)
      loadProfile(newSession?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const refreshProfile = useCallback(() => loadProfile(session?.user?.id), [loadProfile, session])

  async function signUp({ email, password, fullName }) {
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  async function signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    user: session?.user || null,
    profile,
    loading,
    // Signed in, but this user's profile hasn't been read yet (e.g. right after sign-in).
    profileLoading: !!session?.user && profileUserId !== session.user.id,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
