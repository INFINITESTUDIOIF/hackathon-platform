export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="surface-card overflow-hidden rounded-[var(--radius-lg)]"
        >
          <div className="aspect-[16/10] skeleton-shimmer bg-zinc-800" />
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <div className="h-5 w-3/4 skeleton-shimmer rounded-lg bg-zinc-800" />
              <div className="h-4 w-full skeleton-shimmer rounded bg-zinc-800/60" />
              <div className="h-4 w-5/6 skeleton-shimmer rounded bg-zinc-800/60" />
            </div>
            <div className="aspect-video skeleton-shimmer rounded-xl bg-zinc-800" />
            <div className="flex gap-2">
              <div className="h-6 w-14 rounded-lg bg-zinc-800" />
              <div className="h-6 w-16 rounded-lg bg-zinc-800" />
              <div className="h-6 w-20 rounded-lg bg-zinc-800" />
            </div>
            <div className="flex items-center gap-3 border-t border-zinc-800 pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className="h-8 w-8 rounded-full bg-zinc-700 ring-2 ring-zinc-900"
                  />
                ))}
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-zinc-800" />
                <div className="h-3 w-16 rounded bg-zinc-800/80" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
