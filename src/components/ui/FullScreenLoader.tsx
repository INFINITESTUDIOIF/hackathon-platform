export function FullScreenLoader({
  label = 'Just a moment…',
}: {
  label?: string
}) {
  return (
    <div
      className="fixed inset-0 z-[999] grid place-items-center bg-[#050508]/90 backdrop-blur-xl animate-in fade-in duration-300"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center">
        <div className="relative w-24 h-24 mb-8">
          {/* Animated rings */}
          <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-violet-500 animate-spin" />
          <div className="absolute inset-4 rounded-full border-2 border-indigo-500/20" />
          <div className="absolute inset-4 rounded-full border-b-2 border-indigo-500 animate-spin-reverse" />
          
          {/* Central Glow */}
          <div className="absolute inset-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 blur-md opacity-50 animate-pulse" />
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">
            {label}
          </h3>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 animate-pulse">
            Processing Data Stream
          </p>
        </div>
      </div>
    </div>
  )
}

