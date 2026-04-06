import { Play } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import clsx from 'clsx'

type Props = {
  poster: string
  src: string
  title: string
  lazy?: boolean
  className?: string
}

export function VideoPreview({
  poster,
  src,
  title,
  lazy = true,
  className,
}: Props) {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const play = useCallback(() => {
    setPlaying(true)
    void videoRef.current?.play()
  }, [])

  return (
    <div
      className={clsx(
        'group relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900 ring-1 ring-white/[0.06]',
        'transition-all duration-300 ease-in-out',
        'hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(124,58,237,0.35)]',
        className,
      )}
    >
      {!playing && (
        <button
          type="button"
          onClick={play}
          className="absolute inset-0 z-10 flex items-center justify-center"
          aria-label={`Play video: ${title}`}
        >
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100"
            loading={lazy ? 'lazy' : 'eager'}
          />
          {/* Bottom-to-top overlay for readability */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-transparent opacity-40"
            aria-hidden
          />

          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/95 via-indigo-600/90 to-cyan-400/70 text-white shadow-[0_0_25px_rgba(124,58,237,0.35)] ring-4 ring-white/10 transition-all duration-300 group-hover:scale-105 group-hover:animate-pulse">
            <Play className="ml-0.5 h-7 w-7" fill="currentColor" />
          </span>

          <span className="absolute bottom-3 left-3 z-20 rounded-xl bg-black/35 px-3 py-1.5 text-xs font-semibold text-[#E5E7EB] ring-1 ring-white/10 backdrop-blur-md">
            Watch Demo (2 min)
          </span>
        </button>
      )}
      <video
        ref={videoRef}
        className={clsx(
          'h-full w-full object-cover',
          !playing && 'pointer-events-none opacity-0',
        )}
        poster={poster}
        controls={playing}
        preload={lazy ? 'none' : 'metadata'}
        playsInline
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  )
}
