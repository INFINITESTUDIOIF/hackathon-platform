import { Plus, Trash2 } from 'lucide-react'
import type { RubricCriterion } from '../../types/event'
import { Button } from '../ui/Button'

type Props = {
  rubric: RubricCriterion[]
  onChange: (rubric: RubricCriterion[]) => void
}

export function RubricBuilder({ rubric, onChange }: Props) {
  const update = (id: string, patch: Partial<RubricCriterion>) => {
    onChange(
      rubric.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )
  }

  const remove = (id: string) => {
    if (rubric.length <= 1) return
    onChange(rubric.filter((r) => r.id !== id))
  }

  const add = () => {
    onChange([
      ...rubric,
      {
        id: `r-${Date.now()}`,
        name: 'New criterion',
        description: '',
        maxPoints: 10,
        weightPercent: Math.max(
          0,
          Math.round(100 / (rubric.length + 1)),
        ),
      },
    ])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">Rubric builder</h3>
          <p className="text-sm text-zinc-400">
            Criteria name, description, max points, and weight %.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          <Plus className="h-4 w-4" />
          Add criterion
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Max pts</th>
              <th className="px-4 py-3">Weight %</th>
              <th className="px-4 py-3 text-right"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rubric.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2 align-top">
                  <input
                    value={row.name}
                    onChange={(e) => update(row.id, { name: e.target.value })}
                    className="input-dark w-full min-w-[120px]"
                  />
                </td>
                <td className="px-4 py-2 align-top">
                  <input
                    value={row.description}
                    onChange={(e) =>
                      update(row.id, { description: e.target.value })
                    }
                    className="input-dark w-full min-w-[180px]"
                  />
                </td>
                <td className="px-4 py-2 align-top">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={row.maxPoints}
                    onChange={(e) =>
                      update(row.id, {
                        maxPoints: Number(e.target.value) || 1,
                      })
                    }
                    className="input-dark w-20"
                  />
                </td>
                <td className="px-4 py-2 align-top">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={row.weightPercent}
                    onChange={(e) =>
                      update(row.id, {
                        weightPercent: Number(e.target.value) || 0,
                      })
                    }
                    className="input-dark w-20"
                  />
                </td>
                <td className="px-4 py-2 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => remove(row.id)}
                    className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                    aria-label="Remove criterion"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
