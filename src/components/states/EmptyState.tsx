import type { LucideIcon } from 'lucide-react'
import { Button } from '../ui/Button'

type Props = {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-950/80 text-violet-400 ring-1 ring-violet-500/20">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
