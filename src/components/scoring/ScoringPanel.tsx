import { Heart, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useApp } from '../../context/AppContext'
import type { Project } from '../../data/mock'
import { Button } from '../ui/Button'
import { buttonClass } from '../ui/buttonClass'

type Props = {
  project: Project
  totalProjects: number
  onSubmit?: () => void
}

export function ScoringPanel({ project, totalProjects, onSubmit }: Props) {
  const {
    judgedIds,
    markJudged,
    scores,
    setCriterionScore,
    stars,
    setStars,
    likes,
    toggleLike,
    comments,
    setComment,
    eventSetup,
    supabaseMode,
    persistJudgeScore,
  } = useApp()

  const judgedCount = judgedIds.size
  const already = judgedIds.has(project.id)
  const starVal = stars[project.id] ?? 0

  const rubric = eventSetup.rubric

  const sliders = useMemo(
    () => {
      const localScores = scores[project.id] ?? {}
      return rubric.map((c) => ({
        key: c.id,
        label: c.name,
        max: c.maxPoints,
        value:
          localScores[c.id] ??
          Math.min(c.maxPoints, Math.round(c.maxPoints / 2)),
      }))
    },
    [rubric, scores, project.id],
  )

  const totalMax = useMemo(() => {
    return rubric.reduce((sum, c) => sum + c.maxPoints, 0)
  }, [rubric])

  const targetTotal = useMemo(() => {
    return sliders.reduce((sum, s) => sum + s.value, 0)
  }, [sliders])

  const [animatedTotal, setAnimatedTotal] = useState<number>(targetTotal)
  const animatedTotalRef = useRef(animatedTotal)
  useEffect(() => {
    animatedTotalRef.current = animatedTotal
  }, [animatedTotal])

  useEffect(() => {
    const from = animatedTotalRef.current
    const to = targetTotal
    const start = performance.now()
    const duration = 420

    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // Ease out for a premium feel
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (to - from) * eased
      setAnimatedTotal(Math.round(v))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [targetTotal])

  const totalNorm10 = Math.round((animatedTotal / Math.max(1, totalMax)) * 10)
  const totalTint =
    totalNorm10 <= 4
      ? {
          ring: 'ring-red-500/30',
          shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.25)]',
          trackFill: 'rgba(239,68,68,0.95)',
        }
      : totalNorm10 <= 7
        ? {
            ring: 'ring-amber-500/35',
            shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
            trackFill: 'rgba(245,158,11,0.95)',
          }
        : {
            ring: 'ring-violet-500/30',
            shadow: 'shadow-[0_0_22px_rgba(124,58,237,0.28)]',
            trackFill: 'rgba(124,58,237,0.95)',
          }

  const sliderFeedback = (value: number, max: number) => {
    const norm = Math.round((value / Math.max(1, max)) * 10)
    if (norm <= 4)
      return {
        wrapper:
          'ring-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.20)]',
        trackFill: 'rgba(239,68,68,0.95)',
      }
    if (norm <= 7)
      return {
        wrapper:
          'ring-amber-500/35 shadow-[0_0_20px_rgba(245,158,11,0.20)]',
        trackFill: 'rgba(245,158,11,0.95)',
      }
    return {
      wrapper:
        'ring-violet-500/30 shadow-[0_0_22px_rgba(124,58,237,0.25)]',
      trackFill: 'rgba(124,58,237,0.95)',
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 to-zinc-950 p-6 shadow-sm backdrop-blur-md">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Your progress
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
            {judgedCount}
            <span className="text-lg font-medium text-zinc-500">
              {' '}
              / {totalProjects}
            </span>
          </p>
          <p className="mt-1 text-sm text-zinc-400">projects scored</p>
        </div>
        <div className="min-w-[200px] flex-1 max-w-md">
          <div
            className="h-2.5 overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-valuenow={judgedCount}
            aria-valuemin={0}
            aria-valuemax={totalProjects}
          >
            <div
              className="h-full rounded-full gradient-accent transition-all duration-500"
              style={{
                width: `${Math.min(100, (judgedCount / totalProjects) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-right text-xs text-zinc-500">
            {Math.round((judgedCount / totalProjects) * 100)}% complete
          </p>
        </div>
      </div>

      {already && (
        <div
          className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200 backdrop-blur-md"
          role="status"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
            ✓
          </span>
          <div>
            <p className="font-semibold">Already submitted</p>
            <p className="text-emerald-300/90">
              You can adjust scores below; resubmitting updates your evaluation.
            </p>
          </div>
        </div>
      )}

      <div
        className={[
          'flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md transition-all duration-300 ease-in-out',
          totalTint.ring,
          totalTint.shadow,
        ].join(' ')}
      >
        <p className="text-sm font-medium text-zinc-300">Total rubric score</p>
        <p className="text-2xl font-bold tabular-nums text-zinc-100">
          {animatedTotal}
          <span className="ml-2 text-sm font-semibold text-zinc-500">
            / {totalMax}
          </span>
        </p>
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-semibold text-zinc-100">Rubric</h3>
        {sliders.map(({ key, label, value, max }) => (
          <div
            key={key}
            className={[
              'rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all duration-300 ease-in-out',
              sliderFeedback(value, max).wrapper,
            ].join(' ')}
          >
            <div className="mb-2 flex items-center justify-between text-sm">
              <label
                htmlFor={`crit-${project.id}-${key}`}
                className="font-medium text-zinc-300"
              >
                {label}
              </label>
              <span className="tabular-nums text-zinc-500">
                {value}/{max}
              </span>
            </div>
            <div className="flex h-10 w-full items-center px-0.5">
              <input
                id={`crit-${project.id}-${key}`}
                type="range"
                min={0}
                max={max}
                step={1}
                value={value}
                onChange={(e) =>
                  setCriterionScore(project.id, key, Number(e.target.value))
                }
                className="range-premium w-full cursor-pointer"
                style={
                  {
                    ['--pct' as const]: `${Math.round((value / Math.max(1, max)) * 100)}%`,
                    ['--track-fill' as const]:
                      sliderFeedback(value, max).trackFill,
                  } as unknown as CSSProperties
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-zinc-300">
          Overall stars <span className="text-zinc-500">(optional)</span>
        </p>
        <div className="flex gap-1" role="group" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(project.id, n)}
              className="rounded-lg p-1.5 text-amber-400 transition-all duration-200 hover:bg-amber-950/50 hover:scale-105 active:scale-95"
              aria-pressed={starVal >= n}
              aria-label={`${n} stars`}
            >
              <Star
                className="h-7 w-7"
                fill={starVal >= n ? 'currentColor' : 'none'}
                strokeWidth={starVal >= n ? 0 : 1.5}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => toggleLike(project.id)}
          className={buttonClass(
            likes.has(project.id) ? 'primary' : 'secondary',
            'md',
            'gap-2',
          )}
          aria-pressed={likes.has(project.id)}
        >
          <Heart
            className="h-5 w-5"
            fill={likes.has(project.id) ? 'currentColor' : 'none'}
          />
          {likes.has(project.id) ? 'Liked' : 'Like'}
        </button>
      </div>

      <div>
        <label
          htmlFor={`comment-${project.id}`}
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          Private note to organizers
        </label>
        <textarea
          id={`comment-${project.id}`}
          rows={4}
          value={comments[project.id] ?? ''}
          onChange={(e) => setComment(project.id, e.target.value)}
          placeholder="Concise, constructive feedback…"
          className="input-dark w-full resize-y"
        />
      </div>

      <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-6">
        <Button
          size="lg"
          className="min-w-[160px]"
          onClick={() => {
            const local = scores[project.id] ?? {}
            const crit: Record<string, number> = {}
            let total = 0
            for (const c of rubric) {
              const v =
                local[c.id] ??
                Math.min(c.maxPoints, Math.round(c.maxPoints / 2))
              crit[c.id] = v
              total += v
            }
            void (async () => {
              if (supabaseMode) {
                await persistJudgeScore(
                  project.id,
                  crit,
                  comments[project.id] ?? '',
                  total,
                )
              }
              markJudged(project.id)
              onSubmit?.()
            })()
          }}
        >
          {already ? 'Update scores' : 'Submit scores'}
        </Button>
        <p className="flex items-center text-xs text-zinc-500">
          {supabaseMode
            ? 'Submit saves your score and comment to the database.'
            : 'Sliders autosave locally in this demo. Submit locks in “judged” state.'}
        </p>
      </div>
    </div>
  )
}
