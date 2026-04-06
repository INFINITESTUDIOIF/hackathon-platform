import type { ReactNode } from 'react'

/**
 * Outer “page behind” + inner floating app shell with curved edges and elevation.
 */
export function FloatingAppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="app-outer min-h-dvh p-3 sm:p-4 md:p-5">
      <div className="app-float-inner relative mx-auto flex min-h-[calc(100dvh-24px)] max-w-[1800px] flex-col overflow-hidden rounded-[24px] border border-white/[0.06] bg-zinc-950 shadow-[0_28px_100px_-20px_rgba(0,0,0,0.75),0_0_0_1px_rgba(139,92,246,0.06)] sm:rounded-[28px] md:min-h-[calc(100dvh-40px)]">
        <div
          className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-br from-violet-950/40 via-transparent to-indigo-950/20 sm:rounded-[28px]"
          aria-hidden
        />
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
