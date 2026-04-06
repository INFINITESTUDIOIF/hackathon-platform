import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useApp } from '../context/AppContext'

export function PendingApprovalPage() {
  const navigate = useNavigate()
  const { profile, logout, supabaseMode } = useApp()

  useEffect(() => {
    if (!supabaseMode || !profile) return
    if (profile.approval_status === 'approved') navigate('/', { replace: true })
  }, [supabaseMode, profile, navigate])

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="rounded-3xl border border-violet-500/30 bg-zinc-900/60 p-10 shadow-[0_0_40px_rgba(124,58,237,0.2)]">
        <Clock className="mx-auto h-14 w-14 text-violet-400" />
        <h1 className="mt-6 text-2xl font-bold text-zinc-100">
          Waiting for admin approval
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Your account ({profile?.email ?? '—'}) is registered as{' '}
          <span className="text-zinc-200">{profile?.role}</span>. An organizer will
          approve you soon. You&apos;ll get access to the platform once approved.
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-8 text-sm font-medium text-violet-400 hover:text-violet-300"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
