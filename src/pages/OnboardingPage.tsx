import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

function normalizeUsername(input: string) {
  return input.trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '_')
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { session, profile, loading, profileReady, refreshProfile, signOut } = useApp()

  const storedPass = useMemo(
    () => localStorage.getItem('aevinite:signup_password') || '',
    [],
  )

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState(storedPass)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !profileReady) return
    if (!session) {
      navigate('/auth', { replace: true })
      return
    }
    // Admins bypass onboarding
    if (profile?.role === 'admin' || profile?.role === 'main_admin') {
      navigate('/admin', { replace: true })
      return
    }
    if (profile?.onboarding_complete) {
      navigate('/', { replace: true })
    }
  }, [loading, profileReady, session, profile?.onboarding_complete, profile?.role, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!session?.user) return
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }
    const u = normalizeUsername(username)
    if (!/^[a-z0-9_]{3,24}$/.test(u)) {
      setError('Username: 3–24 characters, letters, numbers, underscores only.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      // Always enforce an app password even for Google users.
      if (password) {
        const { error: pwErr } = await supabase.auth.updateUser({ password })
        if (pwErr) {
          const msg = pwErr.message?.toLowerCase?.() ?? ''
          // If password is already set to this value, don't block onboarding.
          if (!msg.includes('different from the old password')) {
            throw pwErr
          }
        }
      }

      // Profiles are created automatically by the database trigger on signup.
      // However, we use upsert here to be extra safe if the trigger failed or hasn't run.
      const sb = supabase
      const { error: upsertErr } = await sb.from('profiles').upsert({
        id: session.user.id,
        email: session.user.email ?? null,
        username: u,
        onboarding_complete: true,
        // If it's a main admin email, ensure they get the role even if trigger failed.
        role: (profile?.role === 'main_admin' || profile?.role === 'admin') 
          ? profile.role 
          : (session.user.email && (import.meta.env.VITE_MAIN_ADMIN_EMAILS as string || '').toLowerCase().includes(session.user.email.toLowerCase()))
            ? 'main_admin'
            : 'user',
        is_approved: (profile?.role === 'main_admin' || profile?.role === 'admin') ? true : false,
      })

      if (upsertErr) throw upsertErr

      localStorage.removeItem('aevinite:signup_password')
      localStorage.removeItem('aevinite:signup_email')

      // Force a read-back to avoid redirect loops caused by stale context state.
      await refreshProfile()
      
      // Delay slightly to ensure state propagation
      await new Promise(resolve => setTimeout(resolve, 500))
      
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish setup.')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !profileReady) return <FullScreenLoader label="Loading your profile…" />

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      {busy && <FullScreenLoader label="Saving profile…" />}
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 shadow-[var(--shadow-soft)]">
        <h1 className="text-2xl font-bold text-zinc-100">Finish your setup</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Choose a unique username and set an AEVINITE password (required even if you use
          Google).
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-zinc-300">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-dark mt-1.5 w-full"
              placeholder="your_handle"
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm font-medium text-zinc-300">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-dark mt-1.5 w-full"
              placeholder="••••••••"
              autoComplete="new-password"
              type="password"
              required
              minLength={6}
            />
          </label>
          {error && (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <Button size="lg" className="w-full" disabled={busy} type="submit">
            Complete setup
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            type="button"
            disabled={busy}
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </form>
      </div>
    </div>
  )
}

