import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'
import { Badge } from '../components/ui/Badge'
import { useApp } from '../context/AppContext'
import { fetchEvents, fetchMyProjects, type EventRow } from '../services/aeviniteApi'
import { Calendar, Trophy, FileCode, CheckCircle2, Star, ChevronRight, Clock, Zap, RefreshCw } from 'lucide-react'

type Tab = 'ongoing' | 'upcoming' | 'completed'

function sortByTimeDesc(a: EventRow, b: EventRow) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

export function UserDashboardPage() {
  const { profile } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(tabParam || 'ongoing')

  useEffect(() => {
    if (tabParam && (['ongoing', 'upcoming', 'completed'] as Tab[]).includes(tabParam)) {
      setTab(tabParam)
    }
  }, [tabParam])

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [events, setEvents] = useState<EventRow[]>([])
  const [myProjects, setMyProjects] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (isManual = false) => {
    if (!profile) return
    if (isManual) setBusy(true)
    setError(null)
    try {
      const results = await Promise.allSettled([
        fetchEvents(), 
        fetchMyProjects(profile.id)
      ])
      
      const rows = results[0].status === 'fulfilled' ? results[0].value as EventRow[] : null
      const projects = results[1].status === 'fulfilled' ? results[1].value as any[] : null
      
      if (rows) setEvents(rows)
      if (projects) setMyProjects(projects)

      // If both failed, show error
      if (results.every(res => res.status === 'rejected')) {
        const firstError = (results[0] as PromiseRejectedResult).reason
        setError(firstError instanceof Error ? firstError.message : 'Failed to synchronize dashboard.')
      }
    } catch (e) {
      console.error('User dashboard refresh error:', e)
      setError(e instanceof Error ? e.message : 'Failed to synchronize dashboard.')
    } finally {
      setBusy(false)
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    refresh()
  }, [refresh])

  const grouped = useMemo(() => {
    const upcoming = events.filter((e) => e.status === 'upcoming' || e.status === 'registration_open')
    const ongoing = events.filter((e) => e.status === 'ongoing' || e.status === 'submission_closed' || e.status === 'judging')
    const completed = events.filter((e) => e.status === 'completed')
    return {
      upcoming: upcoming.sort(sortByTimeDesc),
      ongoing: ongoing.sort(sortByTimeDesc),
      completed: completed.sort(sortByTimeDesc),
    }
  }, [events])

  const results = useMemo(() => {
    return myProjects.filter(p => p.events?.status === 'completed' && p.events?.is_result_public)
  }, [myProjects])

  const list = grouped[tab]

  if (loading) return <FullScreenLoader label="Syncing your profile…" />

  const handleTabChange = (t: Tab) => {
    setBusy(true)
    setTab(t)
    setSearchParams({ tab: t })
    setTimeout(() => setBusy(false), 300)
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-12">
      {busy && <FullScreenLoader label="Processing..." />}

      {/* Header */}
      <header className="mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full opacity-[0.03] pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
            <path d="M0,80 Q250,20 500,80 T1000,80" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500" />
            <path d="M0,90 Q250,30 500,90 T1000,90" fill="none" stroke="currentColor" strokeWidth="1" className="text-violet-400" />
          </svg>
        </div>
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2 text-violet-400 font-black text-[10px] uppercase tracking-[0.3em]">
            <Star className="w-3 h-3" />
            Participant Portal
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-5xl font-black tracking-tighter text-white">
              AEVINITE
            </h1>
            <button 
              onClick={() => void refresh(true)} 
              disabled={busy}
              className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] transition-all group active:scale-95 disabled:opacity-50"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-5 h-5 text-zinc-500 group-hover:text-white transition-colors ${busy ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-zinc-500 font-bold text-lg">
            Welcome back, <span className="text-violet-400">@{profile?.username ?? 'user'}</span>
          </p>
        </div>
        
        <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.05] shadow-2xl backdrop-blur-xl relative z-10">
          {(['ongoing', 'upcoming', 'completed'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`px-6 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all duration-300 ${
                tab === k ? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => handleTabChange(k)}
            >
              {k}
            </button>
          ))}
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

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-12">
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-600/10 border border-violet-500/20">
                <Trophy className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight capitalize">{tab} Hackathons</h2>
            </div>
            
            <div className="grid gap-6">
              {list.length === 0 ? (
                <div className="rounded-[40px] border border-dashed border-white/[0.06] p-20 text-center bg-zinc-900/10">
                  <p className="text-zinc-600 font-bold text-lg italic">No events found in this category.</p>
                </div>
              ) : (
                list.map((e) => (
                  <Link
                    key={e.id}
                    to={`/dashboard/events/${e.id}`}
                    className="group flex flex-col sm:flex-row items-start sm:items-center gap-8 rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-8 transition-all duration-500 hover:border-violet-500/30 hover:bg-zinc-900/40 shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700 pointer-events-none">
                      <Trophy className="w-32 h-32 text-violet-500" />
                    </div>

                    <div className="flex-1 min-w-0 relative z-10">
                      <div className="flex items-center gap-4 mb-4">
                        <Badge className="px-3 py-1 bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] font-black uppercase tracking-widest">
                          {e.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          Starts {new Date(e.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-3xl font-black text-white group-hover:text-violet-400 transition-colors mb-3 tracking-tighter">
                        {e.title}
                      </h3>
                      <p className="line-clamp-2 text-[15px] font-bold text-zinc-500 mb-6 max-w-xl leading-relaxed">
                        {e.description}
                      </p>
                      <div className="flex gap-8">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-600 mb-2">Registration Ends</span>
                          <span className="text-sm text-zinc-400 font-bold">{new Date(e.registration_deadline).toLocaleDateString()}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-600 mb-2">Submissions Due</span>
                          <span className="text-sm text-zinc-400 font-bold">{new Date(e.submission_deadline).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full sm:w-auto flex justify-end relative z-10">
                      <div className="p-5 rounded-[24px] bg-zinc-950/50 border border-white/5 text-zinc-600 group-hover:text-violet-400 group-hover:border-violet-400/30 transition-all duration-500 group-hover:scale-110">
                        <ChevronRight className="w-7 h-7" />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-12">
          {/* My Submissions */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-600/10 border border-violet-500/20">
                <FileCode className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">My Projects</h2>
            </div>
            <div className="space-y-5">
              {myProjects.length === 0 ? (
                <div className="rounded-[32px] border border-white/[0.06] bg-zinc-900/10 p-10 text-center">
                  <p className="text-zinc-600 font-bold text-sm italic">You haven't submitted any projects yet.</p>
                </div>
              ) : (
                myProjects.slice(0, 5).map((p) => (
                  <Link 
                    key={p.id} 
                    to={`/dashboard/events/${p.event_id}`}
                    className="block p-6 rounded-[32px] border border-white/[0.06] bg-zinc-900/20 hover:border-violet-500/30 hover:bg-zinc-900/30 transition-all duration-500 group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 pointer-events-none">
                      <FileCode className="w-16 h-16 text-violet-500" />
                    </div>
                    <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em] mb-2">{p.events?.title}</p>
                    <h4 className="text-lg font-black text-white group-hover:text-violet-400 transition-colors tracking-tight">{p.teams?.name}</h4>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(p.submitted_at).toLocaleDateString()}
                      </span>
                      <Badge className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2 py-0.5">Submitted</Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Results Panel */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-600/10 border border-violet-500/20">
                <Star className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Recent Results</h2>
            </div>
            <div className="space-y-5">
              {results.length === 0 ? (
                <div className="rounded-[32px] border border-white/[0.06] bg-zinc-900/10 p-10 text-center">
                  <p className="text-zinc-600 font-bold text-sm italic">Results will appear here once hackathons conclude.</p>
                </div>
              ) : (
                results.map((r) => (
                  <Link 
                    key={r.id} 
                    to={`/dashboard/events/${r.event_id}`}
                    className="block p-6 rounded-[32px] border border-white/[0.06] bg-zinc-900/20 hover:border-violet-500/30 hover:bg-zinc-900/30 transition-all duration-500 group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 pointer-events-none">
                      <Trophy className="w-16 h-16 text-amber-500" />
                    </div>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-2">{r.events?.title}</p>
                    <h4 className="text-lg font-black text-white group-hover:text-amber-500 transition-colors tracking-tight">Final Standings Live</h4>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                        Winner Announced
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-amber-500 transition-colors" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

