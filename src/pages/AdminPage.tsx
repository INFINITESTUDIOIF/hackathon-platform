import {
  Plus,
  Settings2,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { SEEDED_DEMO_LOGINS } from '../config/demoAccounts'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import {
  approveProfileAndTeam,
  fetchPendingProfiles,
  type ProfileRow,
} from '../services/supabaseApi'
import {
  approveProfileMongo,
  type AdminTeamRow,
  fetchAdminTeamsMongo,
  fetchEmailStatsMongo,
  fetchPendingProfilesMongo,
} from '../services/mongoApi'

export function AdminPage() {
  const {
    eventSetup,
    admins,
    addAdminByEmail,
    invitedJudges,
    inviteJudgeByEmail,
    setJudgeStatus,
    announceWinners,
    winnerAnnouncedAt,
    supabaseMode,
    useApiBackend,
    refreshFeed,
  } = useApp()
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newJudgeEmail, setNewJudgeEmail] = useState('')
  const [adminMsg, setAdminMsg] = useState<string | null>(null)
  const [judgeMsg, setJudgeMsg] = useState<string | null>(null)
  const [pendingList, setPendingList] = useState<ProfileRow[]>([])
  const [emailStats, setEmailStats] = useState<{
    totalAllowed: number
    registeredCount: number
    notRegisteredCount: number
    allAccounts?: { email: string; role: string; approvalStatus: string }[]
  } | null>(null)
  const [adminTeams, setAdminTeams] = useState<AdminTeamRow[]>([])
  const [teamStats, setTeamStats] = useState<{
    totalTeams: number
    totalTeamRoleUsers: number
    usersWithTeams: number
  } | null>(null)
  const [teamDetail, setTeamDetail] = useState<AdminTeamRow | null>(null)

  useEffect(() => {
    if (!supabaseMode && !useApiBackend) return
    void (async () => {
      if (useApiBackend) {
        setPendingList(await fetchPendingProfilesMongo())
      } else {
        setPendingList(await fetchPendingProfiles())
      }
    })()
  }, [supabaseMode, useApiBackend])

  useEffect(() => {
    if (!useApiBackend) return
    void fetchEmailStatsMongo()
      .then((s) =>
        setEmailStats({
          totalAllowed: s.totalAllowed,
          registeredCount: s.registeredCount,
          notRegisteredCount: s.notRegisteredCount,
          allAccounts: s.allAccounts,
        }),
      )
      .catch(() => setEmailStats(null))
  }, [useApiBackend, pendingList.length])

  useEffect(() => {
    if (!useApiBackend) return
    void fetchAdminTeamsMongo()
      .then((d) => {
        setAdminTeams(d.teams)
        setTeamStats(d.stats)
      })
      .catch(() => {
        setAdminTeams([])
        setTeamStats(null)
      })
  }, [useApiBackend, pendingList.length, winnerAnnouncedAt])

  const addAdmin = () => {
    const ok = addAdminByEmail(newAdminEmail)
    setAdminMsg(
      ok ? `Added ${newAdminEmail.trim()}` : 'Invalid email or duplicate.',
    )
    if (ok) setNewAdminEmail('')
  }

  const inviteJudge = () => {
    void (async () => {
      const ok = await inviteJudgeByEmail(newJudgeEmail)
      if (ok) {
        setJudgeMsg(
          useApiBackend || supabaseMode
            ? `Judge invite sent for ${newJudgeEmail.trim()}`
            : `Invited ${newJudgeEmail.trim()}`,
        )
        setNewJudgeEmail('')
        if (useApiBackend) {
          setPendingList(await fetchPendingProfilesMongo())
        } else if (supabaseMode) {
          setPendingList(await fetchPendingProfiles())
        }
      } else {
        setJudgeMsg('Could not add judge email.')
      }
    })()
  }

  const approvePending = (p: ProfileRow) => {
    void (async () => {
      if (useApiBackend) {
        await approveProfileMongo(p.id)
        setPendingList(await fetchPendingProfilesMongo())
        try {
          const d = await fetchAdminTeamsMongo()
          setAdminTeams(d.teams)
          setTeamStats(d.stats)
        } catch {
          /* ignore */
        }
      } else {
        await approveProfileAndTeam(p)
        setPendingList(await fetchPendingProfiles())
      }
      await refreshFeed()
    })()
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Admin
          </h1>
          <p className="mt-2 text-zinc-400">
            Configure the hackathon, invite judges, and manage admins.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/event-setup"
            className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700"
          >
            Event setup →
          </Link>
          <Link
            to="/leaderboard"
            className="text-sm font-medium text-violet-400 hover:text-violet-300"
          >
            View leaderboard →
          </Link>
          <Button
            size="sm"
            onClick={() => void announceWinners()}
            className="rounded-xl"
            title="Publishes leaderboard and sends in-app winner notification."
          >
            <Trophy className="h-4 w-4" />
            Announce winner
          </Button>
        </div>
      </header>

      {/* Winner toast is handled globally in AppShell (3s animated). */}

      {useApiBackend && emailStats && (
        <section className="mb-8 surface-card rounded-[var(--radius-lg)] p-6">
          <h2 className="text-lg font-semibold text-zinc-100">
            Pre-approved Gmail pool
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Allow list (13011–13019 and 130110–130150): registered vs not signed up yet.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <dt className="text-zinc-500">On allow list</dt>
              <dd className="mt-1 text-2xl font-bold text-zinc-100">
                {emailStats.totalAllowed}
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <dt className="text-zinc-500">Registered</dt>
              <dd className="mt-1 text-2xl font-bold text-emerald-400">
                {emailStats.registeredCount}
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <dt className="text-zinc-500">Not registered</dt>
              <dd className="mt-1 text-2xl font-bold text-amber-400">
                {emailStats.notRegisteredCount}
              </dd>
            </div>
          </dl>
          {emailStats.allAccounts && emailStats.allAccounts.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-zinc-200">
                All accounts in database
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Every registered email, role, and approval state (not only the allow
                list).
              </p>
              <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/50">
                <ul className="divide-y divide-zinc-800 text-sm">
                  {emailStats.allAccounts.map((a) => (
                    <li
                      key={a.email}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="font-mono text-xs text-zinc-300">{a.email}</span>
                      <span className="text-xs text-zinc-500">
                        {a.role} · {a.approvalStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      {useApiBackend && (
        <section className="mb-8 surface-card rounded-[var(--radius-lg)] p-6">
          <h2 className="text-lg font-semibold text-zinc-100">
            Example / temp logins (after seed)
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Run <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">npm run seed</code>{' '}
            in <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">server/</code> first.
            Passwords match your server <code className="text-xs">.env</code> where noted.
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {SEEDED_DEMO_LOGINS.map((row) => (
              <li
                key={row.email}
                className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3"
              >
                <p className="font-medium text-violet-300">{row.label}</p>
                <p className="mt-1 text-zinc-300">
                  <span className="text-zinc-500">Email:</span> {row.email}
                </p>
                <p className="text-zinc-300">
                  <span className="text-zinc-500">Password:</span> {row.password}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{row.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(supabaseMode || useApiBackend) && pendingList.length > 0 && (
        <section className="mb-8 surface-card rounded-[var(--radius-lg)] p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <UserCheck className="h-5 w-5 text-violet-400" />
            Pending approvals
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Teams and judges must be approved before they can use the platform.
          </p>
          <ul className="mt-4 divide-y divide-zinc-800">
            {pendingList.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-100">{p.email}</p>
                  <p className="text-zinc-500">
                    Role: {p.role}
                    {p.team_id ? ' · Has team' : ''}
                  </p>
                </div>
                <Button size="sm" type="button" onClick={() => approvePending(p)}>
                  Approve
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="surface-card rounded-[var(--radius-lg)] p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <Settings2 className="h-5 w-5 text-violet-400" />
            Hackathon summary
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Full editing lives on Event setup — name:{' '}
            <span className="text-zinc-200">{eventSetup.name}</span>
          </p>
          <div className="mt-6">
            <Link
              to="/admin/event-setup"
              className="text-sm font-medium text-violet-400 hover:underline"
            >
              Open event setup (banner, timeline, rubric, tracks) →
            </Link>
          </div>
        </section>

        <section className="surface-card rounded-[var(--radius-lg)] p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Scoring setup</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Scoring mode is now configured in Event setup, so each event can define its
            own judging style.
          </p>
          <div className="mt-6">
            <Link
              to="/admin/event-setup"
              className="text-sm font-medium text-violet-400 hover:underline"
            >
              Open Event setup to change scoring mode →
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="surface-card rounded-[var(--radius-lg)] p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Admins</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Create additional admins by email (demo — stored in app state).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="admin@org.com"
              className="input-dark min-w-[200px] flex-1"
            />
            <Button type="button" variant="secondary" onClick={addAdmin}>
              <Plus className="h-4 w-4" />
              Add admin
            </Button>
          </div>
          {adminMsg && (
            <p className="mt-2 text-xs text-zinc-500">{adminMsg}</p>
          )}
          <ul className="mt-4 space-y-2 border-t border-zinc-800 pt-4">
            {admins.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between text-sm text-zinc-300"
              >
                <span>{a.email}</span>
                <Badge variant="accent">Admin</Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card rounded-[var(--radius-lg)] p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Invite judges</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {useApiBackend
              ? 'Add email — they appear in the table; mark accepted before they register so they get the judge role.'
              : supabaseMode
                ? 'Add email — when they sign in with Google they become a judge pending approval.'
                : 'Send an invite by email. Mark accepted when they register.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="email"
              value={newJudgeEmail}
              onChange={(e) => setNewJudgeEmail(e.target.value)}
              placeholder="judge@org.com"
              className="input-dark min-w-[200px] flex-1"
            />
            <Button type="button" variant="secondary" onClick={inviteJudge}>
              <Plus className="h-4 w-4" />
              Invite
            </Button>
          </div>
          {judgeMsg && (
            <p className="mt-2 text-xs text-zinc-500">{judgeMsg}</p>
          )}
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900/80 text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {invitedJudges.map((j) => (
                  <tr key={j.id}>
                    <td className="px-4 py-3 text-zinc-200">{j.email}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={j.status === 'accepted' ? 'success' : 'default'}
                      >
                        {j.status === 'accepted' ? 'Accepted' : 'Invited'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {j.status === 'invited' && (
                        <button
                          type="button"
                          className="text-sm font-medium text-violet-400 hover:underline"
                          onClick={() => void setJudgeStatus(j.id, 'accepted')}
                        >
                          Mark accepted
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-1">
        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-zinc-900/40 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 border-b border-zinc-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-zinc-100">
                <Users className="h-5 w-5 text-violet-400" />
                Teams & accounts
              </h2>
              {useApiBackend && teamStats && (
                <p className="mt-1 text-xs text-zinc-500">
                  {teamStats.totalTeams} team(s) · {teamStats.usersWithTeams} user(s) on a
                  team · {teamStats.totalTeamRoleUsers} team-role accounts total
                </p>
              )}
            </div>
          </div>
          {useApiBackend ? (
            <>
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-900/80 text-xs font-semibold uppercase text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Team</th>
                    <th className="px-6 py-3">Creator Gmail</th>
                    <th className="px-6 py-3">Project</th>
                    <th className="px-6 py-3">Members</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {adminTeams.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                        No teams yet — teams appear when participants register and create a
                        team.
                      </td>
                    </tr>
                  ) : (
                    adminTeams.map((t) => (
                      <tr
                        key={t.id}
                        className="cursor-pointer hover:bg-zinc-800/50"
                        onClick={() => setTeamDetail(t)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setTeamDetail(t)
                          }
                        }}
                        tabIndex={0}
                        role="button"
                      >
                        <td className="px-6 py-3 font-medium text-violet-200 underline decoration-violet-500/50 underline-offset-2">
                          {t.name}
                        </td>
                        <td className="px-6 py-3 text-zinc-300">
                          {t.creatorEmail ?? '—'}
                        </td>
                        <td className="px-6 py-3 text-zinc-400">{t.projectTitle}</td>
                        <td className="px-6 py-3 text-zinc-400">{t.members.length}</td>
                        <td className="px-6 py-3">
                          <Badge
                            variant={t.status === 'approved' ? 'success' : 'default'}
                          >
                            {t.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <p className="border-t border-zinc-800 px-6 py-3 text-xs text-zinc-500">
                Click a team row to see every member Gmail and role.
              </p>
            </>
          ) : (
            <p className="px-6 py-8 text-sm text-zinc-500">
              Connect <code className="rounded bg-zinc-800 px-1">VITE_API_URL</code> to list
              real teams from MongoDB with creator and member emails.
            </p>
          )}
        </section>
      </div>

      {teamDetail && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="team-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTeamDetail(null)
          }}
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="team-detail-title" className="text-lg font-semibold text-zinc-100">
                  {teamDetail.name}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Created from:{' '}
                  <span className="text-zinc-200">{teamDetail.creatorEmail ?? '—'}</span>
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={() => setTeamDetail(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-zinc-500">
              Project: <span className="text-zinc-300">{teamDetail.projectTitle}</span>
            </p>
            <h4 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              People on this team
            </h4>
            <ul className="mt-3 space-y-2">
              {teamDetail.members.map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                >
                  <p className="font-medium text-zinc-200">{m.email}</p>
                  <p className="text-xs text-zinc-500">
                    {m.fullName || '—'} · {m.role}
                  </p>
                </li>
              ))}
            </ul>
            {teamDetail.members.length === 0 && (
              <p className="mt-2 text-sm text-zinc-500">No members linked yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
