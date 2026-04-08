import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'
import { useApp } from '../context/AppContext'
import {
  adminApproveUser,
  adminFetchAllUsers,
  adminFetchAllJudges,
  adminFetchGlobalStats,
  adminFetchAllTeams,
  adminRemoveJudge,
  fetchEvents,
  type EventRow,
  type Profile,
  type TeamRow,
} from '../services/aeviniteApi'
import { supabase } from '../lib/supabase'
import { Users, Trophy, UsersRound, FileCode, CheckCircle2, ShieldCheck, Trash2, Search, ArrowRight, Plus, UserPlus, Zap, RefreshCw, Clock, UserCircle, X } from 'lucide-react'

type GlobalStats = {
  totalUsers: number
  pendingUsers: number
  totalEvents: number
  totalTeams: number
  totalProjects: number
  totalJudgments: number
}

export function AdminDashboardPage() {
  const { profile } = useApp()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'judges' | 'teams'>('overview')
  
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [judges, setJudges] = useState<Profile[]>([])
  const [teams, setTeams] = useState<Array<TeamRow & { events: { title: string }; profiles: { username: string; email: string } }>>([])
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)

  // Judge creation
  const [judgeEmail, setJudgeEmail] = useState('')
  const [judgePassword, setJudgePassword] = useState('')
  const [judgeMsg, setJudgeMsg] = useState<string | null>(null)

  // Create event form
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [topicsCsv, setTopicsCsv] = useState('')
  const [regDeadline, setRegDeadline] = useState('')
  const [subDeadline, setSubDeadline] = useState('')
  const [resTime, setResTime] = useState('')

  const refresh = async () => {
    setError(null)
    try {
      const results = await Promise.allSettled([
        adminFetchAllUsers(),
        adminFetchAllJudges(),
        adminFetchGlobalStats(),
        fetchEvents(),
        adminFetchAllTeams()
      ])

      const u = results[0].status === 'fulfilled' ? results[0].value as Profile[] : null
      const j = results[1].status === 'fulfilled' ? results[1].value as Profile[] : null
      const s = results[2].status === 'fulfilled' ? results[2].value as GlobalStats : null
      const e = results[3].status === 'fulfilled' ? results[3].value as EventRow[] : null
      const t = results[4].status === 'fulfilled' ? results[4].value as Array<TeamRow & { events: { title: string }; profiles: { username: string; email: string } }> : null

      if (u) setAllUsers(u)
      if (j) setJudges(j)
      if (s) setStats(s)
      if (e) setEvents(e)
      if (t) setTeams(t)
      
      // Check if critical data failed
      const criticalFailures = results.filter((res, i) => res.status === 'rejected' && i < 3) // Users, Judges, Stats are critical
      if (criticalFailures.length > 0) {
        const firstError = (criticalFailures[0] as PromiseRejectedResult).reason
        console.error('Critical sync failure:', firstError)
        setError(firstError instanceof Error ? firstError.message : 'Partial synchronization failure.')
      }

      // If everything is empty, it might be a permission issue or just a fresh DB
      if (!u?.length && !j?.length && !e?.length && !t?.length && s && s.totalUsers === 0) {
        console.warn('Dashboard loaded with empty data. This could be a permission issue.')
      }
    } catch (e) {
      console.error('Refresh error:', e)
      setError(e instanceof Error ? e.message : 'Failed to synchronize with backend.')
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refresh()
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const approve = async (userId: string, approved: boolean) => {
    setBusy(true)
    try {
      await adminApproveUser(userId, approved)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const removeJudge = async (judgeId: string) => {
    if (!window.confirm('Are you sure you want to remove this judge?')) return
    setBusy(true)
    try {
      await adminRemoveJudge(judgeId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove judge.')
    } finally {
      setBusy(false)
    }
  }

  const createEvent = async () => {
    if (!profile || !supabase) return
    setError(null)
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (!regDeadline || !subDeadline || !resTime) {
      setError('All deadlines are required.')
      return
    }
    setBusy(true)
    try {
      const topics = topicsCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const { error } = await supabase.from('events').insert({
        title: title.trim(),
        description: description.trim() || '—',
        rules: rules.trim() || '—',
        registration_deadline: new Date(regDeadline).toISOString(),
        submission_deadline: new Date(subDeadline).toISOString(),
        result_announcement_time: new Date(resTime).toISOString(),
        min_team_size: 1,
        max_team_size: 4,
        topics,
        judging_categories: [
          { name: 'UI', weight: 20 },
          { name: 'Functionality', weight: 20 },
          { name: 'Backend', weight: 20 },
          { name: 'Innovation', weight: 20 },
          { name: 'Bugs', weight: 20 },
        ],
        status: 'upcoming',
        created_by: profile.id,
      })
      if (error) throw error
      setCreateOpen(false)
      setTitle('')
      setDescription('')
      setRules('')
      setTopicsCsv('')
      setRegDeadline('')
      setSubDeadline('')
      setResTime('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create event.')
    } finally {
      setBusy(false)
    }
  }

  const createJudge = async () => {
    if (!supabase) {
      setJudgeMsg('Supabase is not configured.')
      return
    }
    setJudgeMsg(null)
    setError(null)
    const email = judgeEmail.trim().toLowerCase()
    if (!email.includes('@')) {
      setJudgeMsg('Enter a valid judge email.')
      return
    }
    if (judgePassword.length < 6) {
      setJudgeMsg('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email, password: judgePassword },
      })
      if (error) throw error
      if (!data?.ok) {
        throw new Error((data as { error?: string } | null)?.error || 'Could not create judge.')
      }
      setJudgeMsg(`Judge created: ${email}`)
      setJudgeEmail('')
      setJudgePassword('')
      await refresh()
    } catch (e) {
      setJudgeMsg(e instanceof Error ? e.message : 'Could not create judge.')
    } finally {
      setBusy(false)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return allUsers
    const q = searchQuery.toLowerCase()
    return allUsers.filter(u => 
      u.email?.toLowerCase().includes(q) || 
      u.username?.toLowerCase().includes(q)
    )
  }, [allUsers, searchQuery])

  const pendingUsers = useMemo(() => {
    return allUsers.filter(u => u.role === 'user' && !u.is_approved)
  }, [allUsers])

  const eventsSorted = useMemo(() => {
    return [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [events])

  if (loading) return <FullScreenLoader label="Syncing infrastructure…" />

  return (
    <div className="mx-auto max-w-7xl px-8 py-12">
      {busy && <FullScreenLoader label="Processing transaction…" />}
      
      {/* Premium Header */}
      <header className="mb-16 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-violet-400 font-black text-[10px] uppercase tracking-[0.3em]">
            <ShieldCheck className="w-3 h-3" />
            System Control
            {profile?.role === 'main_admin' && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px]">Root Access</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-5xl font-black tracking-tighter text-white">
              AEVINITE <span className="text-zinc-700">ADMIN</span>
            </h1>
            <button 
              onClick={() => void refresh()} 
              disabled={busy}
              className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] transition-all group active:scale-95 disabled:opacity-50"
              title="Force Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-zinc-500 group-hover:text-white transition-colors ${busy ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-zinc-500 font-bold text-lg">
            Manage infrastructure, orchestrate events, and oversee the ecosystem.
          </p>
        </div>
        
        <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.05] shadow-2xl">
          {(['overview', 'users', 'judges', 'teams'] as const).map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === tab ? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {tab}
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
              onClick={() => void refresh()}
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Retry Sync
            </button>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-12 animate-fade-in">
          {/* High-Contrast Stats Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Total Users', val: stats?.totalUsers, sub: `${stats?.pendingUsers} pending`, icon: Users },
              { label: 'Live Events', val: stats?.totalEvents, sub: 'Orchestrated', icon: Trophy },
              { label: 'Active Teams', val: stats?.totalTeams, sub: 'Competing', icon: UsersRound },
              { label: 'Submissions', val: stats?.totalProjects, sub: 'In repository', icon: FileCode },
              { label: 'Evaluations', val: stats?.totalJudgments, sub: 'Completed', icon: ShieldCheck },
              { label: 'System Uptime', val: '99.9%', sub: 'Healthy', icon: CheckCircle2, color: 'text-emerald-400' },
            ].map((s, i) => (
              <div key={i} className="group relative overflow-hidden rounded-[32px] border border-white/[0.06] bg-zinc-900/40 p-7 hover:border-violet-500/30 transition-all duration-500 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3 rounded-2xl bg-zinc-950/50 border border-white/[0.05] group-hover:scale-110 transition-transform duration-500">
                    <s.icon className="w-5 h-5 text-zinc-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-4xl font-black text-white tracking-tighter">{s.val ?? 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">{s.label}</p>
                </div>
                <div className={`mt-4 text-[11px] font-bold ${s.color || 'text-zinc-500'}`}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Pending Approvals Section */}
            <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity duration-700">
                <UserPlus className="w-32 h-32 text-violet-500" />
              </div>
              <div className="flex items-center justify-between mb-10 relative z-10">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white tracking-tight">Onboarding Queue</h2>
                  <p className="text-zinc-500 text-sm font-bold">New participants requiring manual system verification.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-black">
                  {pendingUsers.length} PENDING
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                {pendingUsers.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-white/[0.05] p-12 text-center">
                    <p className="text-zinc-600 font-bold text-sm italic">Queue is currently empty.</p>
                  </div>
                ) : (
                  pendingUsers.map((p) => (
                    <div key={p.id} className="group/item flex items-center justify-between p-5 rounded-[24px] bg-zinc-950/40 border border-white/[0.03] hover:border-violet-500/20 transition-all duration-300">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-sm font-black text-zinc-500">
                          {p.username?.substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-black text-white text-[15px]">@{p.username || 'unknown'}</p>
                          <p className="text-xs font-bold text-zinc-600">{p.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => void approve(p.id, true)} 
                          disabled={busy}
                          className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-violet-500 transition-all shadow-lg shadow-violet-900/20 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => void approve(p.id, false)} 
                          disabled={busy}
                          className="px-5 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 text-[11px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Quick Actions / Event Management */}
            <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-10">
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white tracking-tight">Active Repositories</h2>
                  <p className="text-zinc-500 text-sm font-bold">Direct access to current hackathon instances.</p>
                </div>
                <button 
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl"
                >
                  <Plus className="w-4 h-4" />
                  Initialize Event
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {eventsSorted.map((e) => (
                  <Link
                    key={e.id}
                    to={`/admin/events/${e.id}`}
                    className="group flex items-center justify-between p-6 rounded-[28px] bg-zinc-950/40 border border-white/[0.03] hover:border-violet-500/20 transition-all duration-500"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-[20px] bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-violet-400" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-black text-white group-hover:text-violet-400 transition-colors">{e.title}</h3>
                        <div className="flex items-center gap-3">
                          <Badge variant="accent" className="text-[9px] px-2 py-0.5 uppercase font-black bg-violet-500/10 text-violet-400 border-violet-500/20">
                            {e.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {new Date(e.registration_deadline).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-zinc-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
                {eventsSorted.length === 0 && (
                  <div className="rounded-[24px] border border-dashed border-white/[0.05] p-16 text-center">
                    <p className="text-zinc-600 font-bold text-sm">No instances initialized.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Other tabs follow similar premium high-contrast design... */}
      {activeTab === 'users' && (
        <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-10 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8 mb-12">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter">Identity Registry</h2>
              <p className="text-zinc-500 text-sm font-bold">Comprehensive list of all authenticated entities.</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name or email..."
                className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-violet-500/50 transition-all"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/5 bg-zinc-950/30">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">Entity</th>
                  <th className="px-8 py-6">Email Address</th>
                  <th className="px-8 py-6">Role</th>
                  <th className="px-8 py-6">Status</th>
                  <th className="px-8 py-6 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-zinc-700 font-black italic uppercase tracking-widest">No entities found in the registry.</td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr 
                      key={u.id} 
                      className="hover:bg-white/5 transition group cursor-pointer"
                      onClick={() => setSelectedUser(u)}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-xs font-black text-zinc-500 group-hover:text-violet-400 group-hover:border-violet-500/30 transition-all">
                            {u.username?.substring(0, 2).toUpperCase() || '??'}
                          </div>
                          <span className="font-black text-white group-hover:text-violet-400 transition-colors">@{u.username || 'unknown'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-zinc-400 font-bold">{u.email}</td>
                      <td className="px-8 py-6">
                        <Badge className={`text-[9px] font-black uppercase tracking-widest ${u.role === 'admin' || u.role === 'main_admin' ? 'bg-violet-500/10 text-violet-400' : u.role === 'judge' ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-500'}`}>
                          {u.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-8 py-6">
                        <Badge className={`text-[9px] font-black uppercase tracking-widest ${u.is_approved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                          {u.is_approved ? 'Verified' : 'Pending'}
                        </Badge>
                      </td>
                      <td className="px-8 py-6 text-right text-zinc-600 font-bold text-xs uppercase tracking-widest">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'judges' && (
        <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-10 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8 mb-12">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter">Evaluation Force</h2>
              <p className="text-zinc-500 text-sm font-bold">Manage system-authorized judges and evaluators.</p>
            </div>
            <div className="flex gap-4">
              <input 
                type="email" 
                value={judgeEmail} 
                onChange={(e) => setJudgeEmail(e.target.value)}
                placeholder="Judge Email"
                className="bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-3 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-violet-500/50 transition-all"
              />
              <input 
                type="password" 
                value={judgePassword} 
                onChange={(e) => setJudgePassword(e.target.value)}
                placeholder="Security Key"
                className="bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-3 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-violet-500/50 transition-all w-40"
              />
              <button 
                onClick={createJudge}
                disabled={busy}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl disabled:opacity-50"
              >
                Enroll Judge
              </button>
            </div>
          </div>

          {judgeMsg && (
            <div className="mb-8 p-4 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400 text-xs font-black uppercase tracking-widest animate-fade-in">
              {judgeMsg}
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {judges.map((j) => (
              <div key={j.id} className="group p-6 rounded-[32px] border border-white/[0.03] bg-zinc-950/40 hover:border-violet-500/30 transition-all duration-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700 pointer-events-none">
                  <ShieldCheck className="w-20 h-20 text-violet-500" />
                </div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-sm font-black text-zinc-500">
                      {j.username?.substring(0, 2).toUpperCase() || '??'}
                    </div>
                    <div>
                      <p className="font-black text-white">@{j.username || 'judge'}</p>
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Evaluator</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeJudge(j.id)}
                    className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs font-bold text-zinc-500 mb-4">{j.email}</p>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Enrolled {new Date(j.created_at).toLocaleDateString()}
                  </span>
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] uppercase font-black">ACTIVE</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'teams' && (
        <section className="rounded-[40px] border border-white/[0.06] bg-zinc-900/20 p-10 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8 mb-12">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter">Unit Deployment</h2>
              <p className="text-zinc-500 text-sm font-bold">Monitoring all active squads and their registration status.</p>
            </div>
            <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400 text-xs font-black uppercase tracking-widest">
              {teams.length} UNITS DETECTED
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/5 bg-zinc-950/30">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">Unit Name</th>
                  <th className="px-8 py-6">Event Instance</th>
                  <th className="px-8 py-6">Commander</th>
                  <th className="px-8 py-6">Status</th>
                  <th className="px-8 py-6 text-right">Formation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-zinc-700 font-black italic uppercase tracking-widest">No units found in the repository.</td>
                  </tr>
                ) : (
                  teams.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5 transition group">
                      <td className="px-8 py-6 font-black text-white text-lg tracking-tight group-hover:text-violet-400 transition-colors">@{t.name}</td>
                      <td className="px-8 py-6 text-zinc-400 font-bold uppercase tracking-widest text-[11px]">{t.events?.title || '—'}</td>
                      <td className="px-8 py-6 text-zinc-400 font-bold">@{t.profiles?.username}</td>
                      <td className="px-8 py-6">
                        <Badge className={`text-[9px] font-black uppercase tracking-widest ${t.status === 'registered' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-8 py-6 text-right text-zinc-600 font-bold text-xs uppercase tracking-widest">{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050508]/90 backdrop-blur-xl p-6">
          <div className="w-full max-w-2xl rounded-[48px] border border-white/[0.08] bg-zinc-950 p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <UserCircle className="w-48 h-48 text-violet-500" />
            </div>
            
            <header className="mb-10 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Badge className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${selectedUser.is_approved ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                  {selectedUser.is_approved ? 'Verified' : 'Pending Approval'}
                </Badge>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-white/5 rounded-full transition text-zinc-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <h3 className="text-4xl font-black tracking-tighter text-white mb-2">@{selectedUser.username || 'unknown'}</h3>
              <p className="text-zinc-500 font-bold text-lg">Detailed entity profile and credentials.</p>
            </header>

            <div className="space-y-10 relative z-10">
              <div className="grid grid-cols-2 gap-8">
                <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">Email Address</p>
                  <p className="text-lg font-black text-white tracking-tight break-all">{selectedUser.email}</p>
                </div>
                <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">Security Credential</p>
                  <p className="text-lg font-black text-violet-400 tracking-tight flex items-center gap-2">
                    ••••••••
                    <Badge className="text-[8px] bg-violet-500/10 text-violet-400 border-violet-500/20">Encrypted</Badge>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">System Role</p>
                  <p className="text-xl font-black text-white tracking-tight capitalize">{selectedUser.role.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">Registration Date</p>
                  <p className="text-xl font-black text-white tracking-tight">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                {!selectedUser.is_approved && selectedUser.role === 'user' && (
                  <button 
                    onClick={() => {
                      void approve(selectedUser.id, true)
                      setSelectedUser(null)
                    }}
                    className="flex-1 h-16 rounded-[24px] bg-violet-600 text-white text-sm font-black uppercase tracking-widest hover:bg-violet-500 transition-all shadow-xl shadow-violet-900/20"
                  >
                    Verify Entity
                  </button>
                )}
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 h-16 rounded-[24px] bg-zinc-900 text-zinc-400 text-sm font-black uppercase tracking-widest hover:bg-zinc-800 transition-all border border-white/[0.05]"
                >
                  Close Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High-End Modal for Event Creation */}
      {createOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050508]/90 backdrop-blur-xl p-6">
          <div className="w-full max-w-2xl rounded-[48px] border border-white/[0.08] bg-zinc-950 p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Zap className="w-48 h-48 text-violet-500" />
            </div>
            
            <header className="mb-10 relative z-10">
              <h3 className="text-4xl font-black tracking-tighter text-white mb-2">Initialize Instance</h3>
              <p className="text-zinc-500 font-bold text-lg">Configure the parameters for a new hackathon deployment.</p>
            </header>

            <div className="space-y-8 relative z-10">
              <div className="grid gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Instance Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-6 py-4 text-white font-bold placeholder:text-zinc-700 focus:border-violet-500/50 outline-none transition-all" placeholder="e.g. Genesis Protocol 2026" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Objectives & Rules</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-6 py-4 text-white font-bold placeholder:text-zinc-700 focus:border-violet-500/50 outline-none transition-all min-h-[120px] resize-none" placeholder="Describe the mission parameters..." />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: 'Reg Deadline', val: regDeadline, set: setRegDeadline },
                  { label: 'Sub Deadline', val: subDeadline, set: setSubDeadline },
                  { label: 'Announcement', val: resTime, set: setResTime },
                ].map((d, i) => (
                  <div key={i} className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">{d.label}</label>
                    <input type="datetime-local" value={d.val} onChange={(e) => d.set(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-4 text-white font-bold text-xs outline-none focus:border-violet-500/50 transition-all" />
                  </div>
                ))}
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  onClick={() => void createEvent()} 
                  disabled={busy}
                  className="flex-1 h-16 rounded-[24px] bg-violet-600 text-white text-sm font-black uppercase tracking-widest hover:bg-violet-500 transition-all shadow-xl shadow-violet-900/20 disabled:opacity-50"
                >
                  Deploy Instance
                </button>
                <button 
                  onClick={() => setCreateOpen(false)}
                  className="px-10 h-16 rounded-[24px] bg-zinc-900 text-zinc-400 text-sm font-black uppercase tracking-widest hover:bg-zinc-800 transition-all border border-white/[0.05]"
                >
                  Abort
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

