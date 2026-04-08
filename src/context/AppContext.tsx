/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Profile, ProfileRole } from '../services/aeviniteApi'
import { fetchMyProfile } from '../services/aeviniteApi'

type AppState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileReady: boolean
  supabaseMode: boolean
  signInWithGoogle: (opts?: { next?: string }) => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, opts?: { next?: string }) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  mainAdminEmails: string[]
  isRole: (role: ProfileRole) => boolean
}

const Ctx = createContext<AppState | null>(null)

function parseEmailList(v: string | undefined): string[] {
  if (!v) return []
  return v
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const supabaseMode = isSupabaseConfigured
  const mainAdminEmails = useMemo(
    () => parseEmailList(import.meta.env.VITE_MAIN_ADMIN_EMAILS as string | undefined),
    [],
  )

  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileReady, setProfileReady] = useState(false)

  const isMainAdminEmail = useCallback(
    (email: string | undefined) => {
      if (!email) return false
      const e = email.toLowerCase()
      return mainAdminEmails.includes(e) || e === 'aevinite@gmail.com'
    },
    [mainAdminEmails],
  )

  const refreshProfile = useCallback(async () => {
    if (!supabase || !session?.user) {
      setProfile(null)
      setProfileReady(true)
      return
    }
    try {
      const row = await fetchMyProfile(session.user.id)
      if (row) {
        setProfile(row)
      } else if (isMainAdminEmail(session.user.email)) {
        // Synthesize a profile for main admin if it's missing in DB
        const adminProfile: Profile = {
          id: session.user.id,
          email: session.user.email ?? null,
          username: 'admin',
          role: 'main_admin',
          is_approved: true,
          onboarding_complete: true,
          avatar_url: null,
          created_at: new Date().toISOString(),
        }
        setProfile(adminProfile)
        
        // Try to create the profile in DB so subsequent reads work.
        // We await this for main admins to ensure RLS is satisfied before they hit the dashboard.
        try {
          await supabase.from('profiles').upsert(adminProfile, { onConflict: 'id' })
        } catch (err) {
          console.warn('Silent admin upsert failed (expected if RLS is strict):', err)
        }
      } else {
        setProfile(null)
      }
    } catch (e) {
      console.error('Failed to refresh profile:', e)
      if (isMainAdminEmail(session.user.email)) {
        setProfile({
          id: session.user.id,
          email: session.user.email ?? null,
          username: 'admin',
          role: 'main_admin',
          is_approved: true,
          onboarding_complete: true,
          avatar_url: null,
          created_at: new Date().toISOString(),
        })
      } else {
        setProfile(null)
      }
    } finally {
      setProfileReady(true)
    }
  }, [session?.user, isMainAdminEmail])

  useEffect(() => {
    if (!supabaseMode || !supabase) {
      setLoading(false)
      return
    }
    const sb = supabase
    let cancelled = false

    const init = async () => {
      setLoading(true)
      const { data } = await sb.auth.getSession()
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    }
    void init()

    const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [supabaseMode])

  useEffect(() => {
    if (!supabaseMode) return
    if (!session?.user) {
      setProfile(null)
      setProfileReady(false)
      return
    }
    setProfileReady(false)
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        if (cancelled) return
        try {
          await refreshProfile()
        } catch {
          // If profile read fails due to schema mismatch, mark ready so routing can proceed.
          if (!cancelled) {
            // refreshProfile already sets profileReady in finally when possible; keep safe.
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session?.user, supabaseMode, refreshProfile])

  const signInWithGoogle = useCallback(async (opts?: { next?: string }) => {
    if (!supabase) throw new Error('Supabase is not configured.')
    const next = opts?.next ?? '/'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) throw error
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
  }, [])

  const signUpWithEmail = useCallback(
    async (email: string, password: string, opts?: { next?: string }) => {
      if (!supabase) throw new Error('Supabase is not configured.')
      const next = opts?.next ?? '/onboarding'
      const e = email.trim().toLowerCase()

      // Store password to autofill after verification link returns.
      localStorage.setItem('aevinite:signup_password', password)
      localStorage.setItem('aevinite:signup_email', e)

      const { error } = await supabase.auth.signUp({
        email: e,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (error) throw error
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setProfileReady(false)
  }, [])

  const isRole = useCallback(
    (role: ProfileRole) => {
      return profile?.role === role
    },
    [profile?.role],
  )

  const value = useMemo<AppState>(
    () => ({
      session,
      profile,
      loading,
      profileReady,
      supabaseMode,
      signInWithGoogle,
      signInWithPassword,
      signUpWithEmail,
      signOut,
      refreshProfile,
      mainAdminEmails,
      isRole,
    }),
    [
      session,
      profile,
      loading,
      profileReady,
      supabaseMode,
      signInWithGoogle,
      signInWithPassword,
      signUpWithEmail,
      signOut,
      refreshProfile,
      mainAdminEmails,
      isRole,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp requires AppProvider')
  return v
}
