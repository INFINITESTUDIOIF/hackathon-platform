import clsx from 'clsx'

const PRESETS = ['AI/ML', 'Web Dev', 'App Dev', 'Blockchain', 'FinTech', 'Health', 'DevTools', 'General'] as const

type Props = {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

export function CategoryPicker({ value, onChange, disabled }: Props) {
  const toggle = (c: string) => {
    if (disabled) return
    const set = new Set(value)
    if (set.has(c)) set.delete(c)
    else set.add(c)
    onChange(Array.from(set))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-zinc-500">
        Multi-select — pick all tracks that fit your project.
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((c) => {
          const on = value.includes(c)
          return (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => toggle(c)}
              className={clsx(
                'rounded-xl px-3 py-2 text-sm font-medium ring-1 transition',
                on
                  ? 'bg-violet-600 text-white ring-violet-500'
                  : 'bg-zinc-800/80 text-zinc-300 ring-zinc-600 hover:bg-zinc-700',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              {c}
            </button>
          )
        })}
      </div>
      {value.length === 0 && (
        <p className="text-xs text-amber-400/90">Select at least one category.</p>
      )}
    </div>
  )
}
