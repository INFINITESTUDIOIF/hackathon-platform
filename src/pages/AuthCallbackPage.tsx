import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiMode } from '../config/api'
import { mongoSupabaseOAuthSync } from '../services/mongoApi'

/** OAuth return — session is read from URL hash/query by supabase-js (detectSessionInUrl). */
export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase) {
      navigate('/auth', { replace: true })
      return
    }
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (apiMode && session?.access_token) {
        try {
          await mongoSupabaseOAuthSync(session.access_token)
        } catch {
          await supabase.auth.signOut()
          navigate('/auth', { replace: true })
          return
        }
        window.location.assign('/')
        return
      }
      navigate('/', { replace: true })
    })()
  }, [navigate])

  return (
    <div className="purple-auth-bg flex min-h-dvh items-center justify-center p-8">
      <p className="text-sm font-medium text-zinc-400">Signing you in…</p>
    </div>
  )
}
