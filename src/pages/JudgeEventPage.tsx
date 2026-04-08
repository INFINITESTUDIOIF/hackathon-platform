import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'
import { useApp } from '../context/AppContext'
import {
  fetchEvent,
  fetchMyJudgmentsMap,
  fetchSubmittedProjectsForJudge,
  upsertJudgment,
  fetchEventLeaderboard,
  type EventRow,
} from '../services/aeviniteApi'
import { 
  ChevronLeft, 
  Play, 
  Layout, 
  MessageSquare, 
  CheckCircle2, 
  Trophy, 
  Clock, 
  Star, 
  RefreshCw, 
  Zap, 
  ArrowRight,
  MonitorPlay,
  CheckCircle,
  AlertCircle,
  Lock
} from 'lucide-react'

type ProjectCard = {
  id: string
  teamName: string
  github_url: string | null
  video_url: string | null
  comment_for_judges: string | null
}

export function JudgeEventPage() {
  const { eventId } = useParams()
  const { profile } = useApp()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'projects' | 'results'>('projects')
  const [event, setEvent] = useState<EventRow | null>(null)
  const [projects, setProjects] = useState<ProjectCard[]>([])
  const [judgedMap, setJudgedMap] = useState<Map<string, { scores: Record<string, number>; total_score: number }>>(
    () => new Map(),
  )
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [scoresDraft, setScoresDraft] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Leaderboard for results tab
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  const refresh = useCallback(async (isManual = false) => {
    if (!eventId || !profile) return
    if (isManual) setBusy(true)
    setError(null)
    try {
      const ev = await fetchEvent(eventId)
      const now = Date.now()
      const unlocked = now >= new Date(ev.submission_deadline).getTime()
      
      setEvent(ev)
      if (!unlocked) {
        setProjects([])
        return
      }

      const [list, jm] = await Promise.all([
        fetchSubmittedProjectsForJudge(eventId),
        fetchMyJudgmentsMap(profile.id, eventId),
      ])
      
      setJudgedMap(jm)
      setProjects(
        list.map((p) => ({
          id: p.id,
          teamName: p.teams?.name ?? 'Team',
          github_url: p.github_url,
          video_url: p.video_url,
          comment_for_judges: p.comment_for_judges,
        })),
      )

      if (ev.is_result_public) {
        const lb = await fetchEventLeaderboard(eventId)
        setLeaderboard(lb)
      }
    } catch (e) {
      console.error('Judge event page refresh error:', e)
      setError(e instanceof Error ? e.message : 'Failed to synchronize evaluation data.')
    } finally {
      setBusy(false)
      setLoading(false)
    }
  }, [eventId, profile])

  useEffect(() => {
    refresh()
  }, [refresh])

  const active = useMemo(() => projects.find((p) => p.id === activeProjectId) ?? null, [projects, activeProjectId])
  const categories = event?.judging_categories ?? []
  const unlocked = event ? Date.now() >= new Date(event.submission_deadline).getTime() : false

  const openEvaluate = (projectId: string) => {
    setActiveProjectId(projectId)
    const existing = judgedMap.get(projectId)
    setScoresDraft(existing?.scores ?? {})
  }

  const save = async () => {
    if (!eventId || !profile || !activeProjectId) return
    setBusy(true)
    try {
      await upsertJudgment({
        event_id: eventId,
        project_id: activeProjectId,
        judge_id: profile.id,
        scores: scoresDraft,
      })
      await refresh()
      setActiveProjectId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not synchronize evaluation.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <FullScreenLoader label="Syncing evaluation console…" />
  if (!event) return (
    <div className="mx-auto max-w-7xl px-8 py-12 text-center">
      <div className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-20">
        <AlertCircle className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
        <h2 className="text-2xl font-black text-white mb-2">Target Event Not Found</h2>
        <Link to="/judge" className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-white text-black text-sm font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl mt-8">
          <ChevronLeft className="w-4 h-4" />
          Evaluation Dashboard
        </Link>
      </div>
    </div>
  )

  const handleTabChange = (t: 'projects' | 'results') => {
    setBusy(true)
    setActiveTab(t)
    setTimeout(() => setBusy(false), 300)
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-12">
      {busy && <FullScreenLoader label="Synchronizing logs…" />}
      
      {/* Breadcrumbs & Navigation */}
      <div className="mb-12 flex flex-wrap items-center justify-between gap-8">
        <Link to="/judge" className="group inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-all text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Evaluation Control
        </Link>
        
        <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.05] shadow-2xl backdrop-blur-xl h-fit">
          {(['projects', 'results'] as const).map((k) => {
            const locked = k === 'results' && !event.is_result_public
            return (
              <button
                key={k}
                type="button"
                className={`px-6 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all duration-300 ${
                  activeTab === k ? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]' : 'text-zinc-500 hover:text-zinc-300'
                } ${locked ? 'opacity-30 cursor-not-allowed' : ''}`}
                onClick={() => !locked && handleTabChange(k)}
              >
                {k === 'projects' ? 'Queue' : k}
              </button>
            )
          })}
        </div>
      </div>

      <header className="mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
        <div className="space-y-4 max-w-4xl">
          <div className="flex items-center gap-4 mb-2">
            <Badge className="px-3 py-1 bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] font-black uppercase tracking-widest">
              {unlocked ? 'Judging Active' : 'Submission Window'}
            </Badge>
            <span className="text-zinc-600 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Announcement: {new Date(event.result_announcement_time).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-white leading-[0.9]">{event.title}</h1>
          
          <div className="flex flex-wrap gap-8 pt-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-600 mb-2">Evaluated Nodes</span>
              <span className="text-3xl font-black text-white tabular-nums">{judgedMap.size} <span className="text-zinc-700 text-xl">/ {projects.length}</span></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-600 mb-2">Total Submissions</span>
              <span className="text-3xl font-black text-white tabular-nums">{projects.length}</span>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => void refresh(true)} 
          disabled={busy}
          className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] transition-all group active:scale-95 disabled:opacity-50"
          title="Force Sync"
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

      {!unlocked ? (
        <div className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-20 text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
            <Lock className="w-48 h-48 text-violet-500" />
          </div>
          <div className="relative z-10 max-w-lg mx-auto space-y-6">
            <div className="w-20 h-20 rounded-[32px] bg-zinc-900 border border-white/5 mx-auto flex items-center justify-center">
              <Clock className="w-10 h-10 text-zinc-700" />
            </div>
            <h3 className="text-3xl font-black text-white tracking-tight">System Evaluation Locked</h3>
            <p className="text-zinc-500 font-bold text-lg leading-relaxed">Project nodes will be accessible for evaluation once the submission deadline passes on <span className="text-violet-400">{new Date(event.submission_deadline).toLocaleString()}</span>.</p>
          </div>
        </div>
      ) : activeTab === 'projects' ? (
        <div className="grid gap-12 lg:grid-cols-[1fr_400px]">
          <section className="space-y-8 animate-fade-in">
            {projects.length === 0 ? (
              <div className="rounded-[40px] border border-dashed border-white/[0.06] p-20 text-center bg-zinc-900/10 text-zinc-600 font-black uppercase tracking-widest italic">No project submissions detected.</div>
            ) : (
              projects.map((p) => {
                const isEvaluated = judgedMap.has(p.id)
                const isActive = p.id === activeProjectId
                return (
                  <div 
                    key={p.id} 
                    className={`group rounded-[40px] border transition-all duration-500 p-10 relative overflow-hidden ${
                      isActive 
                        ? 'bg-violet-600/10 border-violet-500/40 shadow-[0_0_40px_rgba(139,92,246,0.1)]' 
                        : isEvaluated 
                          ? 'bg-zinc-950/40 border-emerald-500/20 opacity-60' 
                          : 'bg-zinc-900/20 border-white/[0.06] hover:border-white/[0.15] hover:bg-zinc-900/30'
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700">
                      {isEvaluated ? <CheckCircle className="w-32 h-32 text-emerald-500" /> : <MonitorPlay className="w-32 h-32 text-violet-500" />}
                    </div>

                    <div className="relative z-10 flex flex-col sm:flex-row items-start justify-between gap-8">
                      <div className="flex-1 space-y-8">
                        <div className="flex items-center gap-4">
                          <h3 className="text-3xl font-black text-white group-hover:text-violet-400 transition-colors tracking-tighter">@{p.teamName}</h3>
                          {isEvaluated && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black uppercase tracking-widest">Logged</Badge>}
                        </div>

                        <div className="flex flex-wrap gap-4">
                          <a 
                            href={p.video_url ?? '#'} 
                            target="_blank" 
                            rel="noreferrer" 
                            className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all text-xs font-black uppercase tracking-widest shadow-xl ${
                              p.video_url ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-zinc-700 border border-white/5 cursor-not-allowed'
                            }`}
                          >
                            <Play className="w-4 h-4 fill-current" />
                            Launch Demo
                          </a>
                          <a 
                            href={p.github_url ?? '#'} 
                            target="_blank" 
                            rel="noreferrer" 
                            className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all text-xs font-black uppercase tracking-widest border ${
                              p.github_url ? 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white hover:border-violet-500/30' : 'bg-zinc-900 border-white/5 text-zinc-700 cursor-not-allowed'
                            }`}
                          >
                            <Layout className="w-4 h-4" />
                            Source Code
                          </a>
                        </div>

                        {p.comment_for_judges && (
                          <div className="p-6 rounded-[28px] bg-zinc-950/60 border border-violet-500/10 text-sm text-zinc-400 font-bold italic flex gap-4 max-w-2xl leading-relaxed">
                            <MessageSquare className="w-5 h-5 text-violet-500 shrink-0 mt-1" />
                            "{p.comment_for_judges}"
                          </div>
                        )}
                      </div>
                      
                      <button 
                        className={`w-full sm:w-40 h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-2xl ${
                          isEvaluated 
                            ? 'bg-zinc-800 text-zinc-500 hover:bg-violet-600 hover:text-white' 
                            : 'bg-violet-600 text-white hover:bg-violet-500 shadow-violet-900/20'
                        }`}
                        onClick={() => openEvaluate(p.id)}
                      >
                        {isEvaluated ? 'Re-Evaluate' : 'Execute Entry'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </section>

          <aside className="relative">
            <div className="sticky top-12 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700">
                  <Star className="w-24 h-24 text-violet-500" />
                </div>
                
                <h2 className="text-xl font-black text-white tracking-tight mb-10 flex items-center gap-3 relative z-10">
                  <CheckCircle2 className="w-5 h-5 text-violet-400" />
                  Evaluation Protocol
                </h2>
                
                {!active ? (
                  <div className="text-center py-16 space-y-6 relative z-10">
                    <div className="w-16 h-16 rounded-3xl bg-zinc-950 border border-white/5 mx-auto flex items-center justify-center">
                      <ArrowRight className="w-8 h-8 text-zinc-800" />
                    </div>
                    <p className="text-sm text-zinc-600 font-black uppercase tracking-widest italic leading-relaxed px-4">Initialize protocol by selecting a target team from the queue.</p>
                  </div>
                ) : (
                  <div className="space-y-10 relative z-10">
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-[0.3em] text-zinc-600 mb-2">Analyzing Node</p>
                      <h3 className="text-3xl font-black text-white tracking-tighter">@{active.teamName}</h3>
                    </div>

                    <div className="space-y-8">
                      {categories.map((c) => {
                        const v = Number(scoresDraft[c.name] ?? 0)
                        const max = Math.max(1, Math.round(Number(c.weight) || 20))
                        return (
                          <div key={c.name} className="space-y-4 group/slider">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 group-hover/slider:text-violet-400 transition-colors">{c.name}</p>
                              <p className="text-xl font-black text-white tabular-nums">{v} <span className="text-zinc-700 text-xs font-bold">/ {max}</span></p>
                            </div>
                            <div className="relative h-6 flex items-center">
                              <input
                                type="range"
                                min={0}
                                max={max}
                                value={v}
                                onChange={(e) =>
                                  setScoresDraft((prev) => ({
                                    ...prev,
                                    [c.name]: Number(e.target.value),
                                  }))
                                }
                                className="w-full accent-violet-500 h-1.5 bg-zinc-950 rounded-full appearance-none cursor-pointer border border-white/[0.03]"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="pt-10 border-t border-white/[0.05] flex flex-col gap-4">
                      <button 
                        className="w-full h-16 rounded-[28px] bg-white text-black font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-white/5 hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50" 
                        onClick={() => void save()} 
                        disabled={busy}
                      >
                        Synchronize Scores
                      </button>
                      <button
                        className="w-full h-14 rounded-2xl bg-zinc-900 border border-white/5 text-zinc-500 font-black uppercase tracking-widest text-[10px] hover:text-zinc-300 transition-all"
                        onClick={() => setActiveProjectId(null)}
                        disabled={busy}
                      >
                        Abort Operation
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <div className="p-8 rounded-[32px] border border-amber-500/10 bg-amber-500/5 space-y-4">
                <div className="flex items-center gap-3 text-amber-500/60">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Protocol Notice</span>
                </div>
                <p className="text-[13px] text-amber-300/40 font-bold leading-relaxed italic">
                  "Scores are individual and encrypted. Final weightage logic is handled by the Root Admin. All evaluations remain editable until system finalization."
                </p>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-12 relative overflow-hidden group animate-fade-in">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
            <Trophy className="w-48 h-48 text-amber-500" />
          </div>
          
          <div className="flex items-center justify-between mb-16 relative z-10">
            <div>
              <h2 className="text-4xl font-black text-white tracking-tighter mb-2">Final Standings</h2>
              <p className="text-zinc-500 font-bold text-lg">System-wide composite rankings.</p>
            </div>
            <Trophy className="w-16 h-16 text-amber-500/20" />
          </div>

          <div className="grid gap-4 relative z-10">
            {leaderboard.length === 0 ? (
              <div className="py-20 text-center text-zinc-700 font-black uppercase tracking-[0.2em] italic">Standings pending finalization...</div>
            ) : (
              leaderboard.map((r, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-8 rounded-[32px] border border-white/[0.03] bg-zinc-950/40 hover:bg-zinc-950/60 transition-all duration-500"
                >
                  <div className="flex items-center gap-8">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-2xl ${
                      i === 0 ? 'bg-amber-500 text-zinc-950 shadow-amber-900/20' : 
                      i === 1 ? 'bg-zinc-300 text-zinc-950 shadow-zinc-900/20' : 
                      i === 2 ? 'bg-amber-700 text-zinc-950 shadow-amber-950/20' : 
                      'bg-zinc-900 text-zinc-600 border border-white/5'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-white tracking-tight">@{r.team_name}</h4>
                      <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-[0.2em] font-black">Verified Unit</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-black text-zinc-600 tracking-[0.2em] mb-2">Composite Rank</p>
                    <p className="text-4xl font-black text-violet-400 tracking-tighter tabular-nums">{Number(r.avg_score).toFixed(1)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}

