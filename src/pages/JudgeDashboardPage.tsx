import {
  CheckCircle2,
  Circle,
  Filter,
  LayoutGrid,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PROJECTS } from '../data/mock'
import { useApp } from '../context/AppContext'
import { Badge } from '../components/ui/Badge'
import { buttonClass } from '../components/ui/buttonClass'

type FilterTab = 'all' | 'unjudged' | 'judged'

export function JudgeDashboardPage() {
  const { judgedIds, feedProjects, feedUsesDatabase } = useApp()
  const list = feedUsesDatabase ? feedProjects : PROJECTS
  const [tab, setTab] = useState<FilterTab>('all')
  const [category, setCategory] = useState<string>('all')
  const [q, setQ] = useState('')

  const categories = useMemo(() => {
    const s = new Set<string>()
    for (const p of list) {
      s.add(p.category)
      const extra = (p as { categories?: string[] }).categories
      extra?.forEach((c) => s.add(c))
    }
    return ['all', ...Array.from(s)]
  }, [list])

  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (tab === 'judged' && !judgedIds.has(p.id)) return false
      if (tab === 'unjudged' && judgedIds.has(p.id)) return false
      if (category !== 'all') {
        const cats = (p as { categories?: string[] }).categories
        const primary = p.category
        const matchMulti =
          cats?.some((c) => c === category) || primary === category
        if (!matchMulti) return false
      }
      if (q.trim()) {
        const n = q.toLowerCase()
        if (
          !p.title.toLowerCase().includes(n) &&
          !p.teamName.toLowerCase().includes(n) &&
          !p.tagline.toLowerCase().includes(n)
        )
          return false
      }
      return true
    })
  }, [tab, category, q, judgedIds, list])

  const total = list.length
  const judged = judgedIds.size
  const pct = Math.round((judged / total) * 100)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Dashboard
          </h1>
          <p className="mt-1 text-zinc-400">
            Track progress, filter, and jump back into any project.
          </p>
        </div>
        <Link
          to="/judge/feed"
          className={buttonClass('primary', 'md', 'inline-flex shadow-md')}
        >
          <LayoutGrid className="h-4 w-4" />
          Open feed
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card lg:col-span-2 rounded-[var(--radius-lg)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Overall progress
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-100">
                {judged}{' '}
                <span className="text-lg font-medium text-zinc-500">
                  / {total}
                </span>
              </p>
            </div>
            <div className="relative h-28 w-28">
              <svg className="-rotate-90" viewBox="0 0 36 36" aria-hidden>
                <path
                  fill="none"
                  stroke="rgb(63 63 70)"
                  strokeWidth="3"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  fill="none"
                  stroke="url(#gradDash)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${pct}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <defs>
                  <linearGradient id="gradDash" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-zinc-100">
                {pct}%
              </span>
            </div>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full gradient-accent transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="surface-card rounded-[var(--radius-lg)] bg-gradient-to-br from-violet-950/40 to-zinc-950 p-6">
          <p className="text-sm font-medium text-zinc-300">Quick stats</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex justify-between">
              <span className="text-zinc-400">Remaining</span>
              <span className="font-semibold text-zinc-100">
                {total - judged}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-zinc-400">Categories</span>
              <span className="font-semibold text-zinc-100">
                {categories.length - 1}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'All'],
              ['unjudged', 'Not judged'],
              ['judged', 'Judged'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={buttonClass(
                tab === id ? 'primary' : 'secondary',
                'sm',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <Filter className="h-4 w-4" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-dark rounded-xl px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All categories' : c}
                </option>
              ))}
            </select>
          </label>
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects…"
              className="input-dark w-full py-2 pl-9 pr-3"
            />
          </div>
        </div>
      </div>

      <div className="surface-card mt-6 overflow-hidden rounded-[var(--radius-lg)]">
        <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
          <thead className="bg-zinc-900/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((p) => {
              const done = judgedIds.has(p.id)
              return (
                <tr key={p.id} className="hover:bg-zinc-800/40">
                  <td className="px-4 py-3">
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" /> Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-zinc-500">
                        <Circle className="h-4 w-4" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    {p.title}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{p.teamName}</td>
                  <td className="px-4 py-3">
                    <Badge variant="accent">{p.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/project/${p.id}`}
                      className="font-medium text-violet-400 hover:text-violet-300"
                    >
                      Score
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-zinc-500">
            No projects match your filters.
          </p>
        )}
      </div>
    </div>
  )
}
