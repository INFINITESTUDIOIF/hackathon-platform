import { Link, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import type { Project } from '../data/mock'
import { useApp } from '../context/AppContext'
import { fetchEventSummaryMongo } from '../services/mongoApi'
import { buttonClass } from '../components/ui/buttonClass'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'

function podiumGrid(projects: (Project & { score?: number })[]) {
  const ranked = [...projects].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const first = ranked[0]
  const second = ranked[1]
  const third = ranked[2]
  if (!first) return null
  const card =
    'relative w-full overflow-hidden rounded-3xl border p-5 shadow-[var(--shadow-soft)] bg-zinc-900/80'
  return (
    <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-3 sm:items-end sm:gap-4">
      <div className="sm:col-start-1 sm:row-start-2 sm:self-end">
        {second ? (
          <div className={`${card} border-slate-500/40`}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">2nd</p>
            <p className="mt-2 font-semibold text-zinc-100">{second.title}</p>
            <p className="text-sm text-zinc-500">{second.teamName}</p>
            <p className="mt-3 text-2xl font-black tabular-nums text-slate-200">
              {(second.score ?? 0).toFixed(1)}
            </p>
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>
      <div className="sm:col-start-2 sm:row-start-1 sm:self-end">
        <div className={`${card} border-amber-400/50 ring-1 ring-amber-400/25`}>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">1st</p>
          <p className="mt-2 text-lg font-semibold text-zinc-50">{first.title}</p>
          <p className="text-sm text-zinc-400">{first.teamName}</p>
          <p className="mt-3 text-3xl font-black tabular-nums text-gradient">
            {(first.score ?? 0).toFixed(1)}
          </p>
        </div>
      </div>
      <div className="sm:col-start-3 sm:row-start-2 sm:self-end">
        {third ? (
          <div className={`${card} border-orange-700/45`}>
            <p className="text-xs font-bold uppercase tracking-wider text-orange-300/90">3rd</p>
            <p className="mt-2 font-semibold text-zinc-100">{third.title}</p>
            <p className="text-sm text-zinc-500">{third.teamName}</p>
            <p className="mt-3 text-2xl font-black tabular-nums text-orange-200/90">
              {(third.score ?? 0).toFixed(1)}
            </p>
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>
    </div>
  )
}

export function EventDetailPage() {
  const { id } = useParams()
  const { role } = useApp()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [eventName, setEventName] = useState('')
  const [description, setDescription] = useState('')
  const [teams, setTeams] = useState<
    { id: string; name: string; status: string; memberCount: number }[]
  >([])
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    void fetchEventSummaryMongo(id)
      .then((data) => {
        if (cancelled) return
        const ev = data.event as Record<string, unknown>
        setEventName(String(ev.name ?? 'Event'))
        setDescription(String(ev.description ?? ''))
        setTeams(data.teams ?? [])
        const sm = data.scores ?? {}
        const merged = (data.projects ?? []).map((p) => {
          const agg = sm[p.id]
          return {
            ...p,
            score: agg?.total ?? 0,
            judgeFeedback: agg?.byJudge?.length
              ? agg.byJudge.map((j) => ({
                  judge: j.judge,
                  score: j.score,
                  comment: j.comment,
                }))
              : p.judgeFeedback,
          }
        })
        setProjects(merged)
        setErr(null)
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const home =
    role === 'admin' ? '/admin' : role === 'judge' ? '/judge/dashboard' : '/team'

  const rankedForPodium = useMemo(() => projects, [projects])

  if (!id) {
    return (
      <div className="p-8 text-center text-zinc-400">
        Missing event id. <Link to={home} className="text-violet-400 underline">Back</Link>
      </div>
    )
  }

  if (loading) {
    return <FullScreenLoader label="Loading event…" />
  }

  if (err) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-red-300">{err}</p>
        <Link to={home} className={buttonClass('secondary', 'md', 'mt-6 inline-flex')}>
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to={home}
        className="text-sm font-medium text-violet-400 hover:text-violet-300"
      >
        ← Dashboard
      </Link>
      <header className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">{eventName}</h1>
        {description ? (
          <p className="mt-3 max-w-3xl text-zinc-400">{description}</p>
        ) : null}
      </header>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-200">Leaderboard</h2>
        <p className="mt-1 text-sm text-zinc-500">Rankings from stored judge scores for this event.</p>
        {podiumGrid(rankedForPodium)}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-zinc-200">Teams</h2>
        <ul className="mt-3 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-950/40">
          {teams.length === 0 ? (
            <li className="px-4 py-6 text-sm text-zinc-500">No teams registered yet.</li>
          ) : (
            teams.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium text-zinc-200">{t.name}</span>
                <span className="text-xs text-zinc-500 capitalize">
                  {t.status} · {t.memberCount} member(s)
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-200">Projects</h2>
        <ul className="mt-3 space-y-2">
          {projects.length === 0 ? (
            <li className="text-sm text-zinc-500">No approved submissions yet.</li>
          ) : (
            projects.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/project/${p.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-violet-500/40"
                >
                  <span className="font-medium text-zinc-100">{p.title}</span>
                  <span className="mt-1 block text-sm text-zinc-500">{p.teamName}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}
