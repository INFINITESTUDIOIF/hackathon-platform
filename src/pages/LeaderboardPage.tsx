import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Medal,
  Shield,
  Trophy,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { PROJECTS } from '../data/mock'
import type { Project } from '../data/mock'
import { useApp } from '../context/AppContext'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import type { LeaderboardVisibility } from '../services/supabaseApi'
import { fetchAllProjectsForLeaderboard, fetchScoresMap } from '../services/supabaseApi'
import {
  fetchAllProjectsLeaderboardMongo,
  fetchLeaderboardAwaitingMongo,
  fetchScoresMapMongo,
} from '../services/mongoApi'

export function LeaderboardPage() {
  const {
    role,
    leaderboardVisibility,
    setLeaderboardVisibility,
    announceWinners,
    winnerAnnouncedAt,
    useApiBackend,
    feedUsesDatabase,
    demoPasswordAuth,
  } = useApp()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [merged, setMerged] = useState<Project[]>(PROJECTS)
  const [awaitingRows, setAwaitingRows] = useState<
    { teamId: string; teamName: string; teamStatus: string; reason: string }[]
  >([])
  const isAdmin = role === 'admin'

  useEffect(() => {
    if (!feedUsesDatabase || demoPasswordAuth) {
      setMerged(PROJECTS)
      setAwaitingRows([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const projs = useApiBackend
          ? await fetchAllProjectsLeaderboardMongo()
          : await fetchAllProjectsForLeaderboard()
        if (useApiBackend) {
          try {
            const awaiting = await fetchLeaderboardAwaitingMongo()
            if (!cancelled) setAwaitingRows(awaiting)
          } catch {
            if (!cancelled) setAwaitingRows([])
          }
        } else if (!cancelled) {
          setAwaitingRows([])
        }
        const sm = useApiBackend
          ? await fetchScoresMapMongo()
          : await fetchScoresMap()
        const next = projs.map((p) => {
          const agg = sm.get(p.id)
          const judgeFeedback = agg?.byJudge.length
            ? agg.byJudge.map((j) => ({
                judge: j.judge,
                score: j.score,
                comment: j.comment,
              }))
            : p.judgeFeedback
          return {
            ...p,
            score: agg?.total ?? p.score ?? 0,
            judgeFeedback,
          }
        })
        next.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        if (!cancelled) setMerged(next.length ? next : PROJECTS)
      } catch {
        if (!cancelled) setMerged(PROJECTS)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    feedUsesDatabase,
    useApiBackend,
    demoPasswordAuth,
    leaderboardVisibility,
    winnerAnnouncedAt,
  ])

  const ranked = useMemo(
    () => [...merged].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [merged],
  )

  const toggle = (id: string) => {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }

  const visibilityForUi =
    !useApiBackend && demoPasswordAuth && role === 'judge'
      ? 'judges_only'
      : leaderboardVisibility

  const canSeeLeaderboard =
    role === 'admin' ||
    visibilityForUi === 'public' ||
    (visibilityForUi === 'judges_only' && role === 'judge')

  const hideScoresFromUi = role === 'team'

  const visibilityButtons: { value: LeaderboardVisibility; label: string }[] = [
    { value: 'admin_only', label: 'Admin only' },
    { value: 'judges_only', label: 'Judges only' },
    { value: 'public', label: 'Public' },
  ]

  const first = ranked[0]
  const second = ranked[1]
  const third = ranked[2]

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Leaderboard
          </h1>
          <p className="mt-2 text-zinc-400">
            Rankings and judge feedback — visibility is controlled by admins.
          </p>
        </div>
        {isAdmin && (
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 to-zinc-950 p-5 shadow-[var(--shadow-soft)] sm:max-w-sm">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Leaderboard visibility
              </span>
              <p className="mt-1 text-xs text-zinc-500">
                Choose who can see rankings and judge notes.
              </p>
              <div className="relative mt-3">
                <select
                  value={leaderboardVisibility}
                  onChange={(e) =>
                    void setLeaderboardVisibility(
                      e.target.value as LeaderboardVisibility,
                    )
                  }
                  className="input-dark w-full cursor-pointer appearance-none rounded-xl py-3 pr-10 pl-4 text-sm font-medium"
                  aria-label="Leaderboard visibility"
                >
                  {visibilityButtons.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-800/80 px-2 py-1">
                  <Shield className="h-3 w-3 text-violet-400" />
                  Admin
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-800/80 px-2 py-1">
                  <Eye className="h-3 w-3 text-cyan-400" />
                  Judges
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-800/80 px-2 py-1">
                  <Trophy className="h-3 w-3 text-amber-400" />
                  Public
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => void announceWinners()}
            >
              <Trophy className="h-4 w-4" />
              Announce winners
            </Button>
          </div>
        )}
      </header>

      {!canSeeLeaderboard && !isAdmin && (
        <div className="surface-card rounded-2xl p-12 text-center shadow-[var(--shadow-soft)]">
          <EyeOff className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-100">
            {visibilityForUi === 'admin_only'
              ? 'Leaderboard is restricted to organizers'
              : 'Leaderboard is not public yet'}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {visibilityForUi === 'judges_only'
              ? 'Only judges and admins can view results right now.'
              : 'Check back after organizers publish results.'}
          </p>
        </div>
      )}

      {(canSeeLeaderboard || isAdmin) && (
        <>
          {winnerAnnouncedAt && (
            <div className="relative z-20 mb-2 rounded-xl border border-violet-500/30 bg-violet-900/20 px-4 py-3 text-sm text-violet-100">
              Winners announced — full results are available to those with access.
            </div>
          )}

          {first && (
            <div className="relative z-10 mt-6 mb-12 flex flex-col items-center gap-4 sm:flex-row sm:items-stretch sm:justify-center sm:gap-5">
              {[
                {
                  p: second,
                  label: 'Runner up',
                  sub: 'Silver',
                  icon: Medal,
                  iconClass: 'text-slate-200',
                  card: 'border-slate-400/35 bg-gradient-to-b from-slate-700/50 via-zinc-900 to-zinc-950 sm:order-1',
                  lift: '',
                },
                {
                  p: first,
                  label: 'Grand champion',
                  sub: 'Gold',
                  icon: Trophy,
                  iconClass: 'text-amber-300',
                  card: 'order-first border-amber-400/55 bg-gradient-to-b from-amber-950/90 via-zinc-900 to-zinc-950 shadow-[0_0_50px_rgba(251,191,36,0.2)] sm:order-2',
                  lift: 'sm:scale-[1.02]',
                },
                {
                  p: third,
                  label: 'Bronze',
                  sub: 'Third place',
                  icon: Medal,
                  iconClass: 'text-amber-700',
                  card: 'border-orange-700/40 bg-gradient-to-b from-orange-950/55 via-zinc-900 to-zinc-950 sm:order-3',
                  lift: '',
                },
              ].map(
                ({ p, label, sub, icon: Icon, iconClass, card, lift }) =>
                  p && (
                    <div
                      key={p.id}
                      className={clsx(
                        'relative w-full max-w-[340px] flex-1 overflow-hidden rounded-3xl border p-6 transition-transform',
                        card,
                        lift,
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={clsx('h-8 w-8', iconClass)} />
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                            {label}
                          </p>
                          <p className="text-xs text-zinc-500">{sub}</p>
                        </div>
                      </div>
                      <p className="mt-4 text-lg font-bold text-zinc-100">{p.title}</p>
                      <p className="text-sm text-zinc-400">{p.teamName}</p>
                      <p className="mt-4 text-3xl font-black tabular-nums text-gradient">
                        {hideScoresFromUi
                          ? '—'
                          : `${(p.score ?? 0).toFixed(1)} `}
                        {!hideScoresFromUi && (
                          <span className="text-lg font-semibold text-zinc-500">
                            pts
                          </span>
                        )}
                      </p>
                    </div>
                  ),
              )}
            </div>
          )}

          <div className="surface-card overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]">
            <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
              <thead className="bg-zinc-900/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {ranked.map((p, idx) => (
                  <Fragment key={p.id}>
                    <tr className="hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-medium text-zinc-500">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-100">
                        {p.title}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{p.teamName}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-violet-300">
                        {hideScoresFromUi ? '—' : (p.score ?? 0).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggle(p.id)}
                          className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300"
                          aria-expanded={!!expanded[p.id]}
                        >
                          Details
                          {expanded[p.id] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {expanded[p.id] && (
                      <tr className="bg-zinc-900/80">
                        <td colSpan={5} className="px-4 py-4">
                          {hideScoresFromUi ? (
                            <p className="text-sm text-zinc-400">
                              Rankings and placements are shown for your team; detailed
                              scores and judge comments are only visible to judges and
                              organizers.
                            </p>
                          ) : (
                            <>
                              <div className="flex flex-wrap gap-3">
                                {p.breakdown?.map((b) => (
                                  <Badge key={b.label} variant="default">
                                    {b.label}: {b.value}/10
                                  </Badge>
                                ))}
                              </div>
                              <div className="mt-4 space-y-2">
                                {p.judgeFeedback?.map((f) => (
                                  <div
                                    key={`${p.id}-${f.judge}`}
                                    className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2"
                                  >
                                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                      {f.judge} · {f.score} pts
                                    </p>
                                    <p className="mt-1 text-sm text-zinc-300">
                                      {f.comment}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {useApiBackend && awaitingRows.length > 0 && (
            <div className="surface-card mt-10 overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]">
              <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Not on the board yet
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Teams pending approval or approved without a submitted project — same
                  pool as the judge feed once they are approved and submit.
                </p>
              </div>
              <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                <thead className="bg-zinc-900/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {awaitingRows.map((r) => (
                    <tr key={r.teamId} className="text-zinc-400">
                      <td className="px-4 py-3 font-medium text-zinc-200">
                        {r.teamName}
                      </td>
                      <td className="px-4 py-3 capitalize">{r.teamStatus}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {r.reason === 'pending_approval'
                          ? 'Awaiting organizer approval'
                          : 'No project submitted yet'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
