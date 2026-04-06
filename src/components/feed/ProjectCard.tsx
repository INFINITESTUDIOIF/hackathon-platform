import { Code2, ExternalLink, MoreHorizontal, Scale } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useRef } from 'react'
import type { Project } from '../../data/mock'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { buttonClass } from '../ui/buttonClass'

type Props = {
  project: Project
}

export function ProjectCard({ project }: Props) {
  const { judgedIds, role } = useApp()
  const judged = judgedIds.has(project.id)
  const hoverVideoRef = useRef<HTMLVideoElement>(null)

  return (
    <article
      className={clsx(
        'group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-zinc-900/70 shadow-[var(--shadow-soft)] transition-all duration-300',
        'hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-[0_0_20px_rgba(124,58,237,0.16)] hover:shadow-[var(--shadow-elevated)]',
        judged && 'opacity-[0.92]',
      )}
    >
      {judged && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full bg-emerald-500/95 px-2.5 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-sm">
          <span aria-hidden>✓</span> Judged
        </div>
      )}

      <Link
        to={`/project/${project.id}`}
        className="relative block aspect-[16/10] overflow-hidden bg-zinc-900"
        onMouseEnter={() => {
          const el = hoverVideoRef.current
          if (!el) return
          el.currentTime = 0
          void el.play()
        }}
        onMouseLeave={() => {
          const el = hoverVideoRef.current
          if (!el) return
          el.pause()
          el.currentTime = 0
        }}
      >
        <img
          src={project.cover}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] group-hover:opacity-0"
          loading="lazy"
        />
        <video
          ref={hoverVideoRef}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100"
          poster={project.videoPoster}
          muted
          loop
          playsInline
          preload="none"
        >
          <source src={project.videoSrc} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent opacity-80" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <Badge variant="accent">{project.category}</Badge>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <Link to={`/project/${project.id}`}>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100 transition hover:text-violet-400">
              {project.title}
            </h2>
          </Link>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-400">
            {project.tagline}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {project.tech.map((t) => (
            <span
              key={t}
              className="inline-flex h-10 items-center rounded-xl bg-zinc-800/70 px-4 text-sm font-medium text-zinc-300 transition-all duration-200 hover:bg-zinc-700 hover:scale-[1.02] ring-1 ring-white/5"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex -space-x-2">
              {project.members.slice(0, 4).map((m) => (
                <Avatar key={m.name} src={m.avatar} alt="" size="sm" />
              ))}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-200">
                {project.teamName}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {project.members.length} members
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 max-sm:opacity-100">
            <a
              href={project.github}
              target="_blank"
              rel="noreferrer"
              className={clsx(
                buttonClass('secondary', 'sm'),
                'hidden sm:inline-flex',
              )}
            >
              <Code2 className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
          {role === 'judge' && (
            <Link
              to={`/project/${project.id}`}
              className={buttonClass('primary', 'sm', 'flex-1 sm:flex-none')}
            >
              <Scale className="h-4 w-4" />
              Score
            </Link>
          )}
          <a
            href={project.github}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('secondary', 'sm')}
          >
            <Code2 className="h-4 w-4" />
            GitHub
          </a>
          <a
            href={project.demo}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('secondary', 'sm')}
          >
            <ExternalLink className="h-4 w-4" />
            Live demo
          </a>
          <Link
            to={`/project/${project.id}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-400 transition-all duration-200 hover:bg-zinc-700 hover:text-zinc-100 hover:scale-105"
            aria-label="More details"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}
