export function FullScreenLoader({
  label = 'Just a moment…',
}: {
  label?: string
}) {
  return (
    <div
      className="fixed inset-0 z-[999] grid place-items-center bg-black/65 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="w-[min(92vw,420px)] rounded-3xl border border-white/10 bg-zinc-950/70 p-6 shadow-[0_0_40px_rgba(124,58,237,0.25)]">
        <div className="mx-auto h-12 w-20 hackathon-infinity-loader" aria-hidden />
        <p className="mt-4 text-center text-sm font-semibold text-zinc-200">
          {label}
        </p>
        <p className="mt-1 text-center text-xs text-zinc-500">
          We’re finishing your request…
        </p>
      </div>
    </div>
  )
}

