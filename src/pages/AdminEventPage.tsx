import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'
import {
  adminFetchEventStats,
  adminUpdateEvent,
  adminFetchEventTeams,
  adminFetchEventProjects,
  fetchEvent,
  type EventRow,
} from '../services/aeviniteApi'
import { 
  ChevronLeft, 
  Calendar, 
  Users, 
  FileCode, 
  CheckCircle2, 
  Settings, 
  Clock, 
  Zap, 
  RefreshCw, 
  TrendingUp, 
  Activity,
  X,
  Play,
  ExternalLink
} from 'lucide-react'

export function AdminEventPage() {
  const { eventId } = useParams()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<'analytics' | 'teams' | 'judging' | 'settings'>('analytics')
  
  const [event, setEvent] = useState<EventRow | null>(null)
  const [stats, setStats] = useState<Awaited<ReturnType<typeof adminFetchEventStats>> | null>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null)

  const refresh = useCallback(async (isManual = false) => {
    if (!eventId) return
    if (isManual) setBusy(true)
    setError(null)
    try {
      const [ev, st, tm, pr] = await Promise.all([
        fetchEvent(eventId), 
        adminFetchEventStats(eventId),
        adminFetchEventTeams(eventId),
        adminFetchEventProjects(eventId)
      ])
      setEvent(ev)
      setStats(st)
      setTeams(tm)
      setProjects(pr)
    } catch (e) {
      console.error('Admin event page refresh error:', e)
      setError(e instanceof Error ? e.message : 'Failed to synchronize event data.')
    } finally {
      setBusy(false)
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const update = async (patch: Parameters<typeof adminUpdateEvent>[1]) => {
    if (!eventId) return
    setBusy(true)
    try {
      await adminUpdateEvent(eventId, patch)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  const judgingProgress = useMemo(() => {
    if (!stats || !event) return { done: 0, total: 0 }
    return { done: stats.totalJudgments, total: stats.submitted }
  }, [stats, event])

  if (loading) return <FullScreenLoader label="Accessing event analytics…" />
  if (!event) return (
    <div className="mx-auto max-w-7xl px-8 py-12 text-center">
      <div className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-20">
        <h2 className="text-2xl font-black text-white mb-2">Event Not Found</h2>
        <Link to="/admin" className="text-violet-400 font-bold hover:underline underline-offset-4 flex items-center justify-center gap-2 mt-4">
          <ChevronLeft className="w-4 h-4" />
          Back to Admin Dashboard
        </Link>
      </div>
    </div>
  )

  const handleTabChange = (t: typeof activeTab) => {
    setBusy(true)
    setActiveTab(t)
    setTimeout(() => setBusy(false), 300)
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-12">
      {busy && <FullScreenLoader label="Processing deployment…" />}
      
      {/* Breadcrumbs & Navigation */}
      <div className="mb-12 flex flex-wrap items-center justify-between gap-8">
        <Link to="/admin" className="group inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-all text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          System Dashboard
        </Link>
        
        <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.05] shadow-2xl backdrop-blur-xl">
          {(['analytics', 'teams', 'judging', 'settings'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`px-6 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all duration-300 ${
                activeTab === k ? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => handleTabChange(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <header className="mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
        <div className="space-y-4 max-w-4xl">
          <div className="flex items-center gap-4">
            <Badge className="px-3 py-1 bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] font-black uppercase tracking-widest">
              {event.status.replace('_', ' ')}
            </Badge>
            <span className="text-zinc-600 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Initialized {new Date(event.created_at).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-white leading-[0.9]">{event.title}</h1>
          <p className="text-xl text-zinc-500 font-bold leading-relaxed">{event.description}</p>
        </div>
        
        <button 
          onClick={() => void refresh(true)} 
          disabled={busy}
          className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] transition-all group active:scale-95 disabled:opacity-50"
          title="Synchronize Data"
        >
          <RefreshCw className={`w-6 h-6 text-zinc-500 group-hover:text-white transition-colors ${busy ? 'animate-spin' : ''}`} />
        </button>
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

      {activeTab === 'analytics' && (
        <div className="space-y-12 animate-fade-in">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 pointer-events-none">
                <Users className="w-24 h-24 text-violet-500" />
              </div>
              <div className="flex items-center gap-2 text-zinc-600 mb-4">
                <Users className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Total Teams</span>
              </div>
              <p className="text-5xl font-black text-white tracking-tighter mb-6">{stats?.totalTeams ?? 0}</p>
              <div className="flex flex-wrap gap-2">
                <Badge className="text-[9px] font-black bg-zinc-800 text-zinc-500 border-zinc-700">FORMING: {stats?.forming ?? 0}</Badge>
                <Badge className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 border-emerald-500/20">READY: {stats?.registered ?? 0}</Badge>
              </div>
            </div>

            <div className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 pointer-events-none">
                <FileCode className="w-24 h-24 text-blue-500" />
              </div>
              <div className="flex items-center gap-2 text-zinc-600 mb-4">
                <FileCode className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Submissions</span>
              </div>
              <p className="text-5xl font-black text-white tracking-tighter mb-4">{stats?.submitted ?? 0}</p>
              <p className="text-[11px] font-bold text-zinc-500 mb-6 uppercase tracking-widest">Expected: {stats?.totalProjects ?? 0}</p>
              <div className="h-2 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.05]">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-1000" 
                  style={{ width: `${stats?.totalProjects ? (stats.submitted / stats.totalProjects) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 pointer-events-none">
                <CheckCircle2 className="w-24 h-24 text-emerald-500" />
              </div>
              <div className="flex items-center gap-2 text-zinc-600 mb-4">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Judging Efficiency</span>
              </div>
              <p className="text-5xl font-black text-white tracking-tighter mb-4">
                {stats?.submitted && event.judging_categories ? Math.round((judgingProgress.done / (stats.submitted * (event.judging_categories.length || 1))) * 100) : 0}%
              </p>
              <p className="text-[11px] font-bold text-zinc-500 mb-6 uppercase tracking-widest">
                {judgingProgress.done} / {stats?.submitted && event.judging_categories ? stats.submitted * (event.judging_categories.length || 1) : 0} Points Logged
              </p>
              <div className="h-2 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.05]">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-1000" 
                  style={{ width: `${stats?.submitted && event.judging_categories ? (judgingProgress.done / (stats.submitted * (event.judging_categories.length || 1))) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 pointer-events-none">
                <Clock className="w-24 h-24 text-amber-500" />
              </div>
              <div className="flex items-center gap-2 text-zinc-600 mb-4">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Event Phase</span>
              </div>
              <p className="text-3xl font-black text-white tracking-tighter mb-4 capitalize">{event.status.replace('_', ' ')}</p>
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Deadline: {new Date(event.submission_deadline).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Progress Waveform */}
          <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
              <Activity className="w-48 h-48 text-violet-500" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-16 flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-violet-400" />
              System Progress Map
            </h2>
            <div className="relative h-24">
              <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 1000 100" preserveAspectRatio="none">
                <path d="M0,50 C150,20 350,80 500,50 C650,20 850,80 1000,50" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500" />
              </svg>
              <div className="relative flex justify-between items-center h-full px-4">
                {[
                  { label: 'Initialized', date: event.created_at, active: true },
                  { label: 'Formation', date: event.registration_deadline, active: new Date() > new Date(event.registration_deadline) },
                  { label: 'Submissions', date: event.submission_deadline, active: new Date() > new Date(event.submission_deadline) },
                  { label: 'Evaluation', date: event.result_announcement_time, active: event.status === 'judging' || event.status === 'completed' },
                  { label: 'Archived', date: event.result_announcement_time, active: event.status === 'completed' }
                ].map((m, i) => (
                  <div key={i} className="flex flex-col items-center gap-4 relative z-10">
                    <div className={`w-5 h-5 rounded-full border-[3px] transition-all duration-500 shadow-[0_0_20px_rgba(139,92,246,0.2)] ${m.active ? 'bg-violet-500 border-white scale-110' : 'bg-zinc-950 border-zinc-800'}`} />
                    <div className="text-center">
                      <p className={`text-[11px] font-black uppercase tracking-widest transition-colors duration-500 ${m.active ? 'text-white' : 'text-zinc-600'}`}>{m.label}</p>
                      <p className="text-[10px] text-zinc-700 mt-1 font-black">{new Date(m.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'teams' && (
        <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-10 animate-fade-in">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-black text-white tracking-tighter">Event Teams</h2>
            <Badge className="px-5 py-2 rounded-2xl bg-violet-600/10 text-violet-400 border-violet-500/20 text-xs font-black uppercase tracking-widest">{teams.length} Verified Units</Badge>
          </div>
          <div className="overflow-hidden rounded-[32px] border border-white/5 bg-zinc-950/30">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">Team Identity</th>
                  <th className="px-8 py-6">Commander</th>
                  <th className="px-8 py-6">Operatives</th>
                  <th className="px-8 py-6">Status</th>
                  <th className="px-8 py-6">Focus Area</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-zinc-700 font-black italic uppercase tracking-widest">No teams registered in the system.</td>
                  </tr>
                ) : (
                  teams.map((t) => (
                    <tr 
                      key={t.id} 
                      className="hover:bg-white/5 transition group cursor-pointer"
                      onClick={() => setSelectedTeam(t)}
                    >
                      <td className="px-8 py-6 font-black text-white text-lg tracking-tight group-hover:text-violet-400 transition-colors">@{t.name}</td>
                      <td className="px-8 py-6 text-zinc-400 font-bold">@{t.profiles?.username}</td>
                      <td className="px-8 py-6">
                        <div className="flex -space-x-3">
                          {t.team_members?.map((m: any, idx: number) => (
                            <div key={idx} className="w-10 h-10 rounded-xl bg-zinc-900 border-2 border-zinc-950 flex items-center justify-center text-[10px] font-black text-zinc-500 shadow-xl group-hover:border-white/10 transition-all" title={m.profiles?.username}>
                              {m.profiles?.username?.substring(0, 2).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <Badge className={`text-[9px] font-black uppercase tracking-widest ${t.status === 'registered' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-8 py-6 text-zinc-600 font-black text-xs uppercase tracking-widest">{t.selected_topic || 'NOT SELECTED'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Team Details Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050508]/90 backdrop-blur-xl p-6">
          <div className="w-full max-w-2xl rounded-[48px] border border-white/[0.08] bg-zinc-950 p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Users className="w-48 h-48 text-violet-500" />
            </div>
            
            <header className="mb-10 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Badge className="px-4 py-1.5 bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] font-black uppercase tracking-widest">
                  {selectedTeam.status}
                </Badge>
                <button onClick={() => setSelectedTeam(null)} className="p-2 hover:bg-white/5 rounded-full transition text-zinc-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <h3 className="text-4xl font-black tracking-tighter text-white mb-2">@{selectedTeam.name}</h3>
              <p className="text-zinc-500 font-bold text-lg">Unit configuration and member status.</p>
            </header>

            <div className="space-y-10 relative z-10">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">Team Leader</p>
                  <p className="text-xl font-black text-white tracking-tight">@{selectedTeam.profiles?.username}</p>
                  <p className="text-xs font-bold text-zinc-500 mt-1">{selectedTeam.profiles?.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">Project Focus</p>
                  <p className="text-xl font-black text-violet-400 tracking-tight">{selectedTeam.selected_topic || 'Awaiting Selection'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-4">Operative Roster</p>
                <div className="grid gap-4">
                  {selectedTeam.team_members?.map((m: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-5 rounded-[24px] bg-zinc-900/40 border border-white/[0.03]">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-sm font-black text-zinc-500">
                          {m.profiles?.username?.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-black text-white text-[15px]">@{m.profiles?.username}</p>
                          <p className="text-xs font-bold text-zinc-600">{m.profiles?.email}</p>
                        </div>
                      </div>
                      <Badge className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">Active</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button 
                  onClick={() => setSelectedTeam(null)}
                  className="w-full h-16 rounded-[24px] bg-zinc-900 text-zinc-400 text-sm font-black uppercase tracking-widest hover:bg-zinc-800 transition-all border border-white/[0.05]"
                >
                  Close Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'judging' && (
        <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-10 animate-fade-in">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-black text-white tracking-tighter">Evaluation Metrics</h2>
            <Badge className="px-5 py-2 rounded-2xl bg-blue-600/10 text-blue-400 border-blue-500/20 text-xs font-black uppercase tracking-widest">{projects.length} Submissions</Badge>
          </div>
          <div className="overflow-hidden rounded-[32px] border border-white/5 bg-zinc-950/30">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">Target Team</th>
                  <th className="px-8 py-6">Source Nodes</th>
                  <th className="px-8 py-6">Judgments</th>
                  <th className="px-8 py-6">Composite Score</th>
                  <th className="px-8 py-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-zinc-700 font-black italic uppercase tracking-widest">No project submissions detected.</td>
                  </tr>
                ) : (
                  projects.map((p) => {
                    const avg = p.judgments?.length > 0 
                      ? p.judgments.reduce((acc: number, j: any) => acc + j.total_score, 0) / p.judgments.length 
                      : 0;
                    return (
                      <tr key={p.id} className="hover:bg-white/5 transition group">
                        <td className="px-8 py-6 font-black text-white text-lg tracking-tight group-hover:text-violet-400 transition-colors">@{p.teams?.name}</td>
                        <td className="px-8 py-6">
                          <div className="flex gap-3">
                            {p.github_url && <a href={p.github_url} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 text-zinc-500 hover:text-white hover:border-violet-500/50 transition-all"><ExternalLink className="w-4 h-4" /></a>}
                            {p.video_url && <a href={p.video_url} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 text-zinc-500 hover:text-white hover:border-violet-500/50 transition-all"><Play className="w-4 h-4" /></a>}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-black text-lg">{p.judgments?.length ?? 0}</span>
                            <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest pt-1">Logs</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-violet-400 font-black text-3xl tracking-tighter">{avg.toFixed(1)}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          {p.judgments?.length > 0 ? (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black uppercase tracking-widest">Fully Evaluated</Badge>
                          ) : (
                            <Badge className="bg-zinc-800 text-zinc-600 border-zinc-700 text-[9px] font-black uppercase tracking-widest">Awaiting Logs</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-12 animate-fade-in">
          <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
              <Settings className="w-48 h-48 text-violet-500" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tighter mb-12">Result Configuration</h2>
            <div className="grid gap-8 md:grid-cols-2">
              <div className="p-10 rounded-[32px] border border-white/5 bg-zinc-950/40 space-y-6">
                <h3 className="text-xl font-black text-white tracking-tight">Public Visibility</h3>
                <p className="text-zinc-500 font-bold leading-relaxed">Toggle whether participants and judges can see the final composite scores and rankings.</p>
                <button
                  onClick={() => void update({ is_result_public: !event.is_result_public })}
                  disabled={busy}
                  className={`w-full h-14 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${
                    event.is_result_public 
                      ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' 
                      : 'bg-white text-black hover:bg-zinc-200 shadow-2xl shadow-white/5'
                  }`}
                >
                  {event.is_result_public ? 'Restrict Leaderboard' : 'Authorize Leaderboard'}
                </button>
              </div>
              <div className="p-10 rounded-[32px] border border-violet-500/10 bg-violet-500/5 space-y-6">
                <h3 className="text-xl font-black text-violet-400 tracking-tight">System Finalization</h3>
                <p className="text-violet-300/60 font-bold leading-relaxed">Mark this hackathon as completed. This will lock all submissions and announce winners globally.</p>
                <button
                  onClick={() => void update({ status: 'completed', is_result_public: true })}
                  disabled={busy || event.status === 'completed'}
                  className="w-full h-14 rounded-2xl bg-violet-600 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-violet-500 transition-all shadow-2xl shadow-violet-900/20 disabled:opacity-30"
                >
                  Broadcast Final Results
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-12">
            <h2 className="text-3xl font-black text-white tracking-tighter mb-12">Lifecycle Management</h2>
            <div className="flex flex-wrap gap-3">
              {(['upcoming', 'registration_open', 'ongoing', 'submission_closed', 'judging', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => void update({ status: s })}
                  disabled={busy || event.status === s}
                  className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${
                    event.status === s 
                      ? 'bg-violet-600 text-white border-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.3)]' 
                      : 'bg-zinc-900 text-zinc-600 border-white/5 hover:border-zinc-700 hover:text-zinc-400'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

