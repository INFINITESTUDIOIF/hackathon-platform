import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'
import { useApp } from '../context/AppContext'
import {
  createTeamWithInvites,
  fetchEvent,
  fetchEventLeaderboard,
  fetchMyMembershipForEvent,
  fetchMyProjects,
  fetchTeamMembers,
  respondToInvite,
  searchApprovedUsersForEvent,
  setTeamTopic,
  upsertProject,
  updateProjectComment,
  type EventRow,
  type Profile,
  type TeamMemberRow,
  type TeamRow,
  type TeamType,
} from '../services/aeviniteApi'
import { 
  ChevronLeft, 
  Calendar, 
  FileCode, 
  Trophy, 
  CheckCircle2, 
  Layout, 
  Play, 
  MessageSquare, 
  Search, 
  UserPlus, 
  X,
  Lock,
  Zap,
  AlertCircle,
  Star
} from 'lucide-react'

type Tab = 'overview' | 'my' | 'results'

function teamTypeToSize(t: TeamType) {
  if (t === 'solo') return 1
  if (t === 'duo') return 2
  if (t === 'trio') return 3
  return 4
}

type SearchUser = Profile & { __unavailable_reason?: 'already_registered' }

export function UserEventPage() {
  const { eventId } = useParams()
  const { profile } = useApp()
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [event, setEvent] = useState<EventRow | null>(null)
  const [team, setTeam] = useState<TeamRow | null>(null)
  const [, setMembership] = useState<{ invite_status: string } | null>(null)
  const [members, setMembers] = useState<Array<TeamMemberRow & { profiles: Profile }>>([])
  const [project, setProject] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Registration form state
  const [teamType, setTeamType] = useState<TeamType>('solo')
  const [teamName, setTeamName] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [picked, setPicked] = useState<SearchUser[]>([])

  // Topic / submission state
  const [topic, setTopic] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [description, setDescription] = useState('')
  const [commentForJudges, setCommentForJudges] = useState('')

  // Results
  const [leaderboard, setLeaderboard] = useState<
    Array<{ team_name: string; avg_score: number; rank: number; project_id: string }>
  >([])
  const [leaderboardErr, setLeaderboardErr] = useState<string | null>(null)

  const now = Date.now()
  const registrationClosed = useMemo(() => {
    if (!event) return true
    return now > new Date(event.registration_deadline).getTime()
  }, [event, now])
  const submissionClosed = useMemo(() => {
    if (!event) return true
    return now > new Date(event.submission_deadline).getTime()
  }, [event, now])

  const maxMembers = teamTypeToSize(teamType)

  const refresh = useCallback(async (isManual = false) => {
    if (!eventId || !profile) return
    if (isManual) setBusy(true)
    setError(null)
    try {
      const [ev, mem] = await Promise.all([
        fetchEvent(eventId),
        fetchMyMembershipForEvent(eventId, profile.id)
      ])
      
      const t = mem?.team ?? null
      setEvent(ev)
      setTeam(t)
      setMembership(mem ? { invite_status: mem.member.invite_status } : null)

      if (t) {
        const [ms, pr] = await Promise.all([
          fetchTeamMembers(t.id),
          fetchMyProjects(profile.id).then(all => all.find(p => p.team_id === t.id))
        ])
        
        setMembers(ms as any)
        setProject(pr)
        setTopic(t.selected_topic ?? '')
        setGithubUrl(pr?.github_url ?? '')
        setVideoUrl(pr?.video_url ?? '')
        setDescription(pr?.description ?? '')
        setCommentForJudges(pr?.comment_for_judges ?? '')
      }
    } catch (e) {
      console.error('Event page refresh error:', e)
      setError(e instanceof Error ? e.message : 'Failed to synchronize event data.')
    } finally {
      setBusy(false)
      setLoading(false)
    }
  }, [eventId, profile])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (tab !== 'results' || !eventId || !event) return
    if (!event.is_result_public) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchEventLeaderboard(eventId)
        if (cancelled) return
        setLeaderboard(
          rows.map((r) => ({
            team_name: r.team_name,
            avg_score: Number(r.avg_score ?? 0),
            rank: r.rank,
            project_id: r.project_id,
          })),
        )
        setLeaderboardErr(null)
      } catch (e) {
        if (cancelled) return
        setLeaderboardErr(e instanceof Error ? e.message : 'Could not load leaderboard.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, eventId, event?.is_result_public])

  const runSearch = async () => {
    if (!eventId) return
    if (!searchQ.trim()) return
    setSearchBusy(true)
    try {
      const rows = (await searchApprovedUsersForEvent(eventId, searchQ)) as SearchUser[]
      const alreadyPicked = new Set(picked.map((p) => p.id))
      setSearchResults(
        rows.filter((r) => !alreadyPicked.has(r.id) && r.id !== profile?.id),
      )
    } finally {
      setSearchBusy(false)
    }
  }

  const addPicked = (u: SearchUser) => {
    if (u.__unavailable_reason === 'already_registered') return
    if (picked.length >= maxMembers - 1) return
    setPicked((prev) => [...prev, u])
    setSearchResults((prev) => prev.filter((x) => x.id !== u.id))
  }

  const removePicked = (id: string) => {
    setPicked((prev) => prev.filter((p) => p.id !== id))
  }

  const registerTeam = async () => {
    if (!eventId || !profile) return
    setError(null)
    if (registrationClosed) {
      setError('Registration deadline has passed.')
      return
    }
    if (!teamName.trim()) {
      setError('Enter a team name.')
      return
    }
    const memberIds = [profile.id, ...picked.map((p) => p.id)]
    if (memberIds.length !== maxMembers) {
      setError(`Select exactly ${maxMembers} member(s) including you.`)
      return
    }
    setBusy(true)
    try {
      await createTeamWithInvites({
        event_id: eventId,
        leader_id: profile.id,
        name: teamName.trim(),
        team_type: teamType,
        member_ids: memberIds,
      })
      await refresh()
      setTab('my')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register team.')
    } finally {
      setBusy(false)
    }
  }

  const handleInviteResponse = async (status: 'accepted' | 'declined') => {
    if (!profile || !team) return
    setBusy(true)
    try {
      await respondToInvite({ team_id: team.id, user_id: profile.id, invite_status: status })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleTopicSave = async () => {
    if (!team || !topic) return
    setBusy(true)
    try {
      await setTeamTopic({ team_id: team.id, selected_topic: topic })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async () => {
    if (!event || !team) return
    setError(null)
    if (submissionClosed) {
      setError('Submission deadline has passed.')
      return
    }
    if (!githubUrl.trim() || !videoUrl.trim()) {
      setError('GitHub and Video are required.')
      return
    }
    setBusy(true)
    try {
      const p = await upsertProject({
        event_id: event.id,
        team_id: team.id,
        github_url: githubUrl.trim(),
        video_url: videoUrl.trim(),
        description: description.trim() || undefined,
      })
      setProject(p)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit project.')
    } finally {
      setBusy(false)
    }
  }

  const handleCommentSave = async () => {
    if (!team) return
    setBusy(true)
    try {
      await updateProjectComment({
        team_id: team.id,
        comment_for_judges: commentForJudges.trim() ? commentForJudges.trim() : null,
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <FullScreenLoader label="Syncing event details…" />
  if (!event) return (
    <div className="mx-auto max-w-7xl px-8 py-12 text-center">
      <div className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-20">
        <AlertCircle className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
        <h2 className="text-2xl font-black text-white mb-2">Event Not Found</h2>
        <p className="text-zinc-500 font-bold mb-8">This hackathon instance may have been archived or removed.</p>
        <Link to="/dashboard" className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-white text-black text-sm font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl">
          <ChevronLeft className="w-4 h-4" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  )

  const participated = Boolean(team)
  const isLeader = team?.leader_id === profile?.id
  
  // A team is considered "fully formed" or "registered" only when all invited members have accepted.
  const allAccepted = useMemo(() => {
    if (!team || members.length === 0) return false
    const expectedCount = teamTypeToSize(team.team_type)
    const acceptedCount = members.filter(m => m.invite_status === 'accepted').length
    return acceptedCount === expectedCount
  }, [team, members])

  const isRegistered = team?.status === 'registered' || allAccepted

  const handleTabChange = (t: Tab) => {
    setBusy(true)
    setTab(t)
    setTimeout(() => setBusy(false), 300)
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-12">
      {busy && <FullScreenLoader label="Processing transaction…" />}
      
      {/* Breadcrumbs */}
      <div className="mb-12">
        <Link to="/dashboard" className="group inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-all text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          System Dashboard
        </Link>
      </div>

      {/* Header Section */}
      <header className="mb-16 flex flex-col lg:flex-row lg:items-end justify-between gap-12">
        <div className="max-w-4xl space-y-4">
          <div className="flex items-center gap-4 mb-2">
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
        
        <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.05] shadow-2xl backdrop-blur-xl h-fit">
          {(['overview', 'my', 'results'] as const).map((k) => {
            const hidden = k === 'results' && (!participated || !event.is_result_public)
            return (
              <button
                key={k}
                type="button"
                className="px-6 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all duration-300"
                style={{ backgroundColor: tab === k ? 'rgb(124, 58, 237)' : 'transparent', color: tab === k ? 'white' : 'rgb(113, 113, 122)', opacity: hidden ? 0.3 : 1, cursor: hidden ? 'not-allowed' : 'pointer' }}
                onClick={() => !hidden && handleTabChange(k)}
              >
                {k === 'my' ? 'My Hackathon' : k}
              </button>
            )
          })}
        </div>
      </header>

      {error && (
        <p className="mb-6 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {tab === 'overview' && (
        <div className="space-y-8">
          {/* Milestone Waveform (Visual only) */}
          <section className="rounded-3xl border border-white/10 bg-zinc-900/40 p-8 overflow-hidden relative">
            <h2 className="text-xl font-bold text-zinc-100 mb-8 flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              Event Timeline
            </h2>
            <div className="relative h-24">
              <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 1000 100" preserveAspectRatio="none">
                <path d="M0,50 Q250,0 500,50 T1000,50" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500" />
              </svg>
              <div className="relative flex justify-between">
                {[
                  { label: 'Registration', date: event.created_at, active: true },
                  { label: 'Forming', date: event.registration_deadline, active: new Date() > new Date(event.registration_deadline) },
                  { label: 'Build', date: event.submission_deadline, active: new Date() > new Date(event.submission_deadline) },
                  { label: 'Results', date: event.result_announcement_time, active: event.status === 'completed' }
                ].map((m, i) => (
                  <div key={i} className="flex flex-col items-center gap-3 relative z-10">
                    <div className={`w-4 h-4 rounded-full border-2 shadow-[0_0_15px_rgba(139,92,246,0.3)] ${m.active ? 'bg-violet-500 border-violet-400' : 'bg-zinc-950 border-zinc-800'}`} />
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-200">{m.label}</p>
                      <p className="text-[10px] text-zinc-500 mt-1 font-mono">{new Date(m.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-zinc-900/40 p-8">
              <h2 className="text-xl font-bold text-zinc-100 mb-6 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-violet-400" />
                Rules & Guidelines
              </h2>
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-zinc-400 leading-relaxed">{event.rules}</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-8">
                <h2 className="text-xl font-bold text-zinc-100 mb-6 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-violet-400" />
                  Judging Criteria
                </h2>
                <div className="space-y-4">
                  {event.judging_categories?.map((c: any, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-zinc-300 font-bold">{c.name}</span>
                        <span className="text-violet-400">{c.weight}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-600/50" style={{ width: `${c.weight}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'my' && (
        <div className="mt-6 space-y-8">
          {!team ? (
            <section className="rounded-3xl border border-white/10 bg-zinc-900/40 p-8">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-black text-zinc-100 mb-2">Team Registration</h2>
                <p className="text-zinc-400 mb-8">Create your squad or go solo to enter the hackathon.</p>
                
                {registrationClosed && (
                  <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-bold flex items-center gap-3">
                    <Lock className="w-4 h-4" />
                    Registration is now closed for this event.
                  </div>
                )}

                <div className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Team Type</label>
                      <select
                        value={teamType}
                        onChange={(e) => {
                          setTeamType(e.target.value as TeamType)
                          setPicked([])
                        }}
                        className="input-dark w-full h-12"
                        disabled={registrationClosed || busy}
                      >
                        <option value="solo">Solo Warrior</option>
                        <option value="duo">Duo (2 Members)</option>
                        <option value="trio">Trio (3 Members)</option>
                        <option value="squad">Squad (4 Members)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Team Name</label>
                      <input
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="input-dark w-full h-12 font-bold"
                        placeholder="e.g. Genesis Force"
                        disabled={registrationClosed || busy}
                      />
                    </div>
                  </div>

                  {teamType !== 'solo' && (
                    <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950/40 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-300">Invite Members ({picked.length}/{maxMembers - 1})</h3>
                        <Badge variant="muted" className="text-[10px]">Approved users only</Badge>
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                          <input
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                            className="input-dark w-full pl-10 h-10"
                            placeholder="Search by username..."
                            disabled={registrationClosed || busy}
                          />
                        </div>
                        <Button variant="secondary" onClick={() => void runSearch()} disabled={registrationClosed || busy || searchBusy} className="h-10 px-6">
                          {searchBusy ? '...' : 'Search'}
                        </Button>
                      </div>

                      {picked.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {picked.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-200 text-sm font-bold animate-in fade-in zoom-in duration-200">
                              @{p.username}
                              <button onClick={() => removePicked(p.id)} className="p-1 hover:bg-violet-500/20 rounded-full transition">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {searchResults.length > 0 && (
                        <div className="mt-4 overflow-hidden rounded-xl border border-white/5 bg-zinc-900/40">
                          {searchResults.map((u) => {
                            const unavailable = u.__unavailable_reason === 'already_registered'
                            const full = picked.length >= maxMembers - 1
                            return (
                              <button
                                key={u.id}
                                type="button"
                                disabled={unavailable || full || busy}
                                onClick={() => addPicked(u)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition disabled:opacity-30 group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                                    {u.username?.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="text-left">
                                    <p className="text-sm font-bold text-zinc-100">@{u.username}</p>
                                    <p className="text-[10px] text-zinc-500">{u.email}</p>
                                  </div>
                                </div>
                                {unavailable ? (
                                  <span className="text-[10px] font-bold text-zinc-600">Already Registered</span>
                                ) : (
                                  <UserPlus className="w-4 h-4 text-violet-400 opacity-0 group-hover:opacity-100 transition" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <Button 
                    className="w-full h-14 bg-violet-600 hover:bg-violet-500 text-lg font-black shadow-lg shadow-violet-600/20"
                    onClick={() => void registerTeam()}
                    disabled={registrationClosed || busy || (!isLeader && participated)}
                  >
                    Complete Registration
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Left Column: Team & Topic */}
              <div className="lg:col-span-1 space-y-8">
                {/* Team Info Card */}
                <section className="rounded-3xl border border-white/10 bg-zinc-900/40 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-zinc-100">My Team</h2>
                    <Badge variant="accent" className="capitalize px-3 py-1 bg-violet-500/10 text-violet-400 border-violet-500/20">
                      {team.status}
                    </Badge>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-6">{team.name}</h3>
                  
                  <div className="space-y-4">
                    {members.map((m) => {
                      const isMe = m.user_id === profile?.id
                      const isLeaderRow = m.user_id === team.leader_id
                      return (
                        <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/40 border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-xs font-bold text-zinc-400">
                              {(m as any).profiles?.username?.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                                @{(m as any).profiles?.username}
                                {isLeaderRow && <Trophy className="w-3 h-3 text-amber-500" />}
                                {isMe && <Badge className="text-[8px] h-4">Me</Badge>}
                              </p>
                              <p className="text-[10px] text-zinc-500 capitalize">{m.invite_status}</p>
                            </div>
                          </div>
                          {isMe && m.invite_status === 'pending' && (
                            <div className="flex gap-2">
                              <button onClick={() => handleInviteResponse('accepted')} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition"><CheckCircle2 className="w-4 h-4" /></button>
                              <button onClick={() => handleInviteResponse('declined')} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition"><X className="w-4 h-4" /></button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* Topic Selection */}
                {isRegistered && (
                  <section className="rounded-3xl border border-white/10 bg-zinc-900/40 p-6">
                    <h2 className="text-xl font-bold text-zinc-100 mb-6">Selected Topic</h2>
                    {team.selected_topic ? (
                      <div className="p-4 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400 font-bold text-center">
                        {team.selected_topic}
                      </div>
                    ) : isLeader ? (
                      <div className="space-y-4">
                        <select
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          className="input-dark w-full h-12"
                        >
                          <option value="">Select a topic...</option>
                          {event.topics?.map((t: string) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <Button className="w-full" onClick={handleTopicSave} disabled={!topic || busy}>Lock Topic</Button>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500 text-center italic">Waiting for leader to choose topic...</p>
                    )}
                  </section>
                )}
              </div>

              {/* Right Column: Submission */}
              <div className="lg:col-span-2">
                {isRegistered && team.selected_topic ? (
                  <section className="rounded-3xl border border-white/10 bg-zinc-900/40 p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-2xl font-black text-zinc-100">Project Submission</h2>
                        <p className="text-sm text-zinc-400">Submit your work before the deadline.</p>
                      </div>
                      {project && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">Submitted</Badge>}
                    </div>

                    <div className="space-y-6">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <Layout className="w-3 h-3" />
                            GitHub Repository URL
                          </span>
                          <input
                            value={githubUrl}
                            onChange={(e) => setGithubUrl(e.target.value)}
                            className="input-dark w-full h-12"
                            placeholder="https://github.com/..."
                            disabled={submissionClosed || busy}
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <Play className="w-3 h-3" />
                            Video Link (Demo/Pitch)
                          </span>
                          <input
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            className="input-dark w-full h-12"
                            placeholder="https://youtube.com/... or Loom"
                            disabled={submissionClosed || busy}
                          />
                        </label>
                      </div>

                      <label className="block space-y-2">
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Project Description</span>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="input-dark w-full min-h-[120px] resize-none"
                          placeholder="What did you build? (Optional)"
                          disabled={submissionClosed || busy}
                        />
                      </label>

                      {project && (
                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" />
                            Note for Judges (Optional)
                          </span>
                          <div className="flex gap-2">
                            <input
                              value={commentForJudges}
                              onChange={(e) => setCommentForJudges(e.target.value)}
                              className="input-dark flex-1 h-12"
                              placeholder="Add a quick note..."
                              disabled={submissionClosed || busy}
                            />
                            <Button variant="secondary" onClick={handleCommentSave} disabled={submissionClosed || busy}>Save Note</Button>
                          </div>
                        </label>
                      )}

                      {!submissionClosed && (
                        <Button 
                          className="w-full h-14 bg-violet-600 hover:bg-violet-500 text-lg font-black"
                          onClick={handleSubmit}
                          disabled={busy}
                        >
                          {project ? 'Update Submission' : 'Submit Project'}
                        </Button>
                      )}
                      
                      {submissionClosed && (
                        <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5 text-zinc-500 text-center text-sm italic">
                          Submission phase has ended. No more changes allowed.
                        </div>
                      )}
                    </div>
                  </section>
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-20 text-center flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-zinc-900 border border-white/5">
                      <Lock className="w-8 h-8 text-zinc-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-300">Form your team first</h3>
                      <p className="text-sm text-zinc-500">All members must accept their invites and a topic must be selected before you can submit a project.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'results' && (
        <div className="mt-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-4">
              <Trophy className="w-8 h-8 text-violet-400" />
              Event Leaderboard
            </h2>
            <div className="p-3 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400 text-xs font-black uppercase tracking-widest">
              Final Standings
            </div>
          </div>

          {leaderboardErr ? (
            <div className="p-8 rounded-[40px] border border-red-500/20 bg-red-500/5 text-red-400 text-center font-bold">
              {leaderboardErr}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-20 rounded-[40px] border border-dashed border-white/10 text-center text-zinc-600 italic font-bold text-lg">
              No results have been posted yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {leaderboard.map((row, i) => (
                <div 
                  key={row.project_id} 
                  className={`flex items-center justify-between p-8 rounded-[40px] border transition-all duration-500 hover:scale-[1.01] ${
                    i === 0 
                      ? 'bg-gradient-to-r from-violet-600/20 to-transparent border-violet-500/30 shadow-[0_0_50px_rgba(139,92,246,0.1)]' 
                      : 'bg-zinc-900/20 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-8">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${
                      i === 0 ? 'bg-violet-600 text-white' : i === 1 ? 'bg-zinc-700 text-zinc-300' : i === 2 ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-900 text-zinc-600'
                    }`}>
                      {row.rank}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white mb-1">{row.team_name}</h3>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Global Score</span>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                              <Star 
                                key={s} 
                                className={`w-3 h-3 ${s <= Math.round(row.avg_score / 20) ? 'text-violet-400 fill-violet-400' : 'text-zinc-800'}`}
                              />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-white tracking-tighter tabular-nums">{row.avg_score.toFixed(1)}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mt-1">Total Points</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

