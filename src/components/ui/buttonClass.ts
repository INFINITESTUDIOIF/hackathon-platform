import clsx from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return clsx(
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-in-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
    'hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-45',
    size === 'sm' && 'rounded-lg px-3 py-1.5 text-sm',
    size === 'md' && 'rounded-xl px-4 py-2.5 text-sm',
    size === 'lg' && 'rounded-xl px-5 py-3 text-base',
    variant === 'primary' &&
      'gradient-accent text-[#E5E7EB] shadow-md shadow-violet-900/40 hover:brightness-105 hover:shadow-lg hover:shadow-[0_0_20px_rgba(124,58,237,0.35)] active:scale-95',
    variant === 'secondary' &&
      'bg-[#0B1220] text-[#E5E7EB] ring-1 ring-[#2563EB]/35 shadow-sm hover:bg-[#0F1C37] hover:ring-[#2563EB]/60 hover:shadow-[0_0_20px_rgba(124,58,237,0.25)] active:scale-95',
    variant === 'ghost' &&
      'bg-transparent text-[#9CA3AF] hover:bg-zinc-800/80 hover:text-[#E5E7EB] hover:shadow-[0_0_20px_rgba(124,58,237,0.18)] active:scale-95',
    variant === 'danger' &&
      'bg-red-600 text-white hover:bg-red-700 hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] active:scale-95',
    className,
  )
}

