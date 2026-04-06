import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { createTeam } from '../services/supabaseApi'
import { createTeamMongo, getSelectedEventId } from '../services/mongoApi'
import { supabase } from '../lib/supabase'

export function TeamRegisterPage() {
  const navigate = useNavigate()
  const { profile, refreshFeed, refreshProfile, useApiBackend } = useApp()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!profile?.team_id) return
    if (profile.approval_status === 'approved')
      navigate('/team', { replace: true })
    else navigate('/pending-approval', { replace: true })
  }, [profile?.team_id, profile?.approval_status, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!profile) {
      setError('Not signed in.')
      return
    }
    if (!name.trim()) {
      setError('Enter a team name.')
      return
    }
    setBusy(true)
    try {
      if (useApiBackend) {
        await createTeamMongo(name.trim(), getSelectedEventId())
      } else {
        if (!supabase) {
          setError('Not signed in.')
          setBusy(false)
          return
        }
        await createTeam(name.trim(), profile.id)
      }
      await refreshProfile()
      await refreshFeed()
      navigate('/pending-approval', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create team.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-8 shadow-[var(--shadow-soft)]">
        <Users className="h-10 w-10 text-violet-400" />
        <h1 className="mt-4 text-2xl font-bold text-zinc-100">Create your team</h1>
        <p className="mt-2 text-sm text-zinc-400">
          After you submit, an admin must approve your team before your project appears
          in the judge feed.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-zinc-300">
            Team name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-dark mt-1.5 w-full"
              placeholder="e.g. Vector Labs"
              required
            />
          </label>
          {error && (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <Button size="lg" className="w-full" disabled={busy} type="submit">
            {busy ? 'Saving…' : 'Register team'}
          </Button>
        </form>
      </div>
    </div>
  )
}
