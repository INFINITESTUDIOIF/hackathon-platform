import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PROJECTS } from '../data/mock'
import { useApp } from '../context/AppContext'
import { ProjectCard } from '../components/feed/ProjectCard'
import { FeedSkeleton } from '../components/feed/FeedSkeleton'
import { EmptyState } from '../components/states/EmptyState'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

export function JudgeFeedPage() {
  const {
    judgedIds,
    feedError,
    setFeedError,
    feedProjects,
    refreshFeed,
    feedUsesDatabase,
  } = useApp()
  const [loading, setLoading] = useState(!feedUsesDatabase)

  const list = feedUsesDatabase ? feedProjects : PROJECTS

  useEffect(() => {
    if (feedUsesDatabase) {
      setLoading(false)
      return
    }
    const t = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(t)
  }, [feedUsesDatabase])

  if (feedError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <div className="surface-card rounded-2xl border border-amber-500/30 bg-amber-950/20 p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-100">
            We couldn&apos;t load the feed
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Check your connection and try again.
          </p>
          <Button className="mt-6" onClick={() => void refreshFeed().then(() => setFeedError(false))}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <div className="h-8 w-48 skeleton-shimmer rounded-lg bg-zinc-800" />
          <div className="mt-2 h-4 w-72 skeleton-shimmer rounded bg-zinc-800/60" />
        </header>
        <FeedSkeleton count={6} />
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={AlertTriangle}
          title="No projects yet"
          description="When approved teams submit, their cards will appear here."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Dashboard</h1>
          <p className="mt-2 max-w-xl text-zinc-400">
            Browse submissions and open any project to score.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">
            {judgedIds.size} / {list.length} judged
          </Badge>
          <Badge variant="muted">{list.length} projects</Badge>
          {!feedUsesDatabase && (
            <button
              type="button"
              onClick={() => setFeedError(true)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 underline decoration-dotted hover:text-zinc-300"
            >
              Simulate feed error
            </button>
          )}
        </div>
      </header>

      <div className="grid animate-fade-in gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <div key={p.id} className="animate-fade-in">
            <ProjectCard project={p} />
          </div>
        ))}
      </div>
    </div>
  )
}
