import clsx from 'clsx'

type Props = {
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'success' | 'muted'
  className?: string
}

export function Badge({ children, variant = 'default', className }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-zinc-800 text-zinc-200',
        variant === 'accent' &&
          'bg-violet-950/80 text-violet-200 ring-1 ring-inset ring-violet-500/25',
        variant === 'success' &&
          'bg-emerald-950/80 text-emerald-300 ring-1 ring-inset ring-emerald-500/25',
        variant === 'muted' && 'bg-zinc-900 text-zinc-500',
        className,
      )}
    >
      {children}
    </span>
  )
}
