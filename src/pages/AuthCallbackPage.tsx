import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiMode } from '../config/api'
import { mongoSupabaseOAuthSync } from '../services/mongoApi'
import { Button } from '../components/ui/Button'

function humanizeAuthError(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('provider is not enabled'))
    return 'Google provider is not enabled in Supabase Auth settings.'
  if (m.includes('invalid redirect') || m.includes('redirect_uri_mismatch'))
    return 'Google redirect URL mismatch. Check Supabase and Google OAuth redirect URLs.'
  if (m.includes('supabase_url') || m.includes('anon'))
    return 'Server OAuth sync is missing SUPABASE_URL or SUPABASE_ANON_KEY.'
  if (m.includes('email already') || m.includes('already registered'))
    return 'This email is already registered. Please sign in with your existing method.'
  return msg
}

/** OAuth return — session is read from URL hash/query by supabase-js (detectSessionInUrl). */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setError(
        'Google sign-in is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      )
      return
    }
    void (async () => {
      const url = new URL(window.location.href)
      const qErr = url.searchParams.get('error_description') || url.searchParams.get('error')
      if (qErr) {
        setError(humanizeAuthError(decodeURIComponent(qErr)))
        return
      }

      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession()
      if (sessErr) {
        setError(humanizeAuthError(sessErr.message || 'Could not read Google session.'))
        return
      }
      if (apiMode && session?.access_token) {
        try {
          await mongoSupabaseOAuthSync(session.access_token)
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Could not complete server sign-in.'
          setError(humanizeAuthError(message))
          return
        }
        window.location.assign('/')
        return
      }
      if (!session) {
        setError(
          'Google login did not return a valid session. Please retry and check OAuth redirect settings.',
        )
        return
      }
      navigate('/', { replace: true })
    })()
  }, [navigate])

  return (
    <div className="purple-auth-bg flex min-h-dvh items-center justify-center p-8">
      {error ? (
        <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-zinc-950/85 p-6 text-center shadow-[0_0_30px_rgba(220,38,38,0.2)]">
          <p className="text-sm font-semibold text-red-300">Google sign-in failed</p>
          <p className="mt-2 text-sm text-zinc-300">{error}</p>
          <div className="mt-5">
            <Button size="sm" onClick={() => navigate('/auth', { replace: true })}>
              Back to login
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm font-medium text-zinc-400">Signing you in…</p>
      )}
    </div>
  )
}
