/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'

type ToastItem = { id: string; message: string }

type ToastCtx = {
  pushToast: (message: string, durationMs?: number) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const remove = useCallback((id: string) => {
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
    setItems((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const pushToast = useCallback(
    (message: string, durationMs = 3000) => {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `t-${Date.now()}`
      setItems((prev) => [...prev, { id, message }])
      const t = setTimeout(() => remove(id), durationMs)
      timers.current.set(id, t)
    },
    [remove],
  )

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t)
    }
  }, [])

  return (
    <Ctx.Provider value={{ pushToast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-20 left-1/2 z-[100] flex w-[min(92vw,400px)] -translate-x-1/2 flex-col gap-2 sm:bottom-8"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-950/95 px-4 py-3 text-sm text-zinc-100 shadow-lg shadow-black/40 backdrop-blur"
          >
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Dismiss notification"
              onClick={() => remove(t.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast requires ToastProvider')
  return v
}
