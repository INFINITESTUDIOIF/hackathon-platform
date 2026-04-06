import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/Button'

type Props = {
  tracks: string[]
  onChange: (tracks: string[]) => void
}

export function TrackManager({ tracks, onChange }: Props) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const t = draft.trim()
    if (!t || tracks.some((x) => x.toLowerCase() === t.toLowerCase())) return
    onChange([...tracks, t])
    setDraft('')
  }

  const remove = (tag: string) => {
    onChange(tracks.filter((x) => x !== tag))
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-zinc-100">Track manager</h3>
        <p className="text-sm text-zinc-400">
          Add or remove tracks (e.g. FinTech, Healthcare).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tracks.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-950/50 px-3 py-1 text-sm text-violet-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="rounded p-0.5 hover:bg-violet-900/80 hover:text-white"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="New track name"
          className="input-dark min-w-[200px] max-w-md flex-1"
        />
        <Button type="button" variant="secondary" size="md" onClick={add}>
          <Plus className="h-4 w-4" />
          Add track
        </Button>
      </div>
    </div>
  )
}
