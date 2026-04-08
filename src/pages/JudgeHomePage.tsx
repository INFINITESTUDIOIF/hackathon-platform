import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'
import { useApp } from '../context/AppContext'
import { fetchEvents, fetchJudgeStats, type EventRow } from '../services/aeviniteApi'
import { ShieldCheck, RefreshCw, Zap, Clock, CheckCircle2, FileCode, ArrowRight } from 'lucide-react'

export function JudgeHomePage() {
  const { profile } = useApp()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [events, setEvents] = useState<EventRow[]>([])
  const [stats, setStats] = useState({ completedCount: 0, pendingCount: 0 })
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (isManual = false) => {
    if (!profile) return
    if (isManual) setBusy(true)
    setError(null)
    try {
      const results = await Promise.allSettled([
        fetchEvents(), 
        fetchJudgeStats(profile.id)
      ])

      const rows = results[0].status === 'fulfilled' ? results[0].value as EventRow[] : null
      const s = results[1].status === 'fulfilled' ? results[1].value as { completedCount: number; pendingCount: number } : null

      if (rows) setEvents(rows)
      if (s) setStats(s)

      // If both failed, show error
      if (results.every(res => res.status === 'rejected')) {
        const firstError = (results[0] as PromiseRejectedResult).reason
        setError(firstError instanceof Error ? firstError.message : 'Failed to synchronize dashboard.')
      }
    } catch (e) {
      console.error('Judge dashboard refresh error:', e)
      setError(e instanceof Error ? e.message : 'Failed to synchronize dashboard.')
    } finally {
      setBusy(false)
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    refresh()
  }, [refresh])

  const now = Date.now()
  const sorted = useMemo(() => {
    return [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [events])

  if (loading) return <FullScreenLoader label="Accessing judge environment…" />

  return (
    <div className="mx-auto max-w-7xl px-8 py-12">
      {busy && <FullScreenLoader label="Processing..." />}

      {/* Header */}
      <header className="mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full opacity-[0.03] pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
            <path d="M0,50 Q250,80 500,50 T1000,50" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500" />
            <path d="M0,40 Q250,70 500,40 T1000,40" fill="none" stroke="currentColor" strokeWidth="1" className="text-violet-400" />
          </svg>
        </div>
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2 text-violet-400 font-black text-[10px] uppercase tracking-[0.3em]">
            <ShieldCheck className="w-3 h-3" />
            Evaluation Command
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-5xl font-black tracking-tighter text-white">
              JUDGE <span className="text-zinc-700">PANEL</span>
            </h1>
            <button 
              onClick={() => void refresh(true)} 
              disabled={busy}
              className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] transition-all group active:scale-95 disabled:opacity-50"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-5 h-5 text-zinc-500 group-hover:text-white transition-colors ${busy ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-zinc-500 font-bold text-lg">
            Signed in as <span className="text-violet-400">@{profile?.username ?? profile?.email?.split('@')[0]}</span>
          </p>
        </div>

        {/* Global Judge Stats */}
        <div className="flex gap-4 relative z-10">
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-[32px] p-6 min-w-[180px] shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:scale-110 transition-transform duration-500">
              <Zap className="w-12 h-12 text-violet-500" />
            </div>
            <p className="text-4xl font-black text-white tracking-tighter mb-1">{stats.pendingCount}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Projects Left</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-[32px] p-6 min-w-[180px] shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:scale-110 transition-transform duration-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <p className="text-4xl font-black text-white tracking-tighter mb-1">{stats.completedCount}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Evaluations Done</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-10 animate-fade-in">
          <div className="rounded-[24px] border border-red-500/20 bg-red-500/5 px-6 py-4 flex items-center justify-between gap-4 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
            <div className="flex items-center gap-4">
              <Zap className="w-5 h-5 shrink-0" />
              <p className="text-sm font-bold tracking-tight">{error}</p>
            </div>
            <button 
              onClick={() => void refresh(true)}
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Retry Sync
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 animate-fade-in">
        {sorted.map((e) => {
          const unlocked = now >= new Date(e.submission_deadline).getTime()
          const isOngoing = e.status === 'ongoing' || e.status === 'submission_closed' || e.status === 'judging'
          
          return (
            <Link
              key={e.id}
              to={unlocked ? `/judge/events/${e.id}` : '#'}
              onClick={(ev) => {
                if (!unlocked) ev.preventDefault()
              }}
              className={`group relative overflow-hidden rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-8 transition-all duration-500 hover:border-violet-500/30 hover:bg-zinc-900/30 shadow-sm ${
                unlocked ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700 pointer-events-none">
                <FileCode className="w-32 h-32 text-violet-500" />
              </div>

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <Badge className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                    unlocked 
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                      : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                  }`}>
                    {unlocked ? 'Judging Open' : 'Locked'}
                  </Badge>
                  {isOngoing && unlocked && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[9px] font-black uppercase">
                      <Clock className="w-3 h-3" /> Active Session
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-2xl font-black text-white group-hover:text-violet-400 transition-colors mb-2 tracking-tight">
                    {e.title}
                  </h3>
                  <p className="line-clamp-2 text-sm font-bold text-zinc-500 mb-6 leading-relaxed">
                    {e.description}
                  </p>
                </div>

                <div className="pt-6 border-t border-white/5 mt-auto">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-black tracking-[0.2em] text-zinc-600 mb-1">Submission Deadline</span>
                      <span className="text-xs text-zinc-400 font-bold">{new Date(e.submission_deadline).toLocaleDateString()}</span>
                    </div>
                    {unlocked && (
                      <div className="p-3 rounded-2xl bg-zinc-950/50 border border-white/5 text-zinc-600 group-hover:text-violet-400 group-hover:border-violet-500/30 transition-all duration-500">
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

