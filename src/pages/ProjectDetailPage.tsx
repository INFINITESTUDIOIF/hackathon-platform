import { Code2, ExternalLink } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PROJECTS } from '../data/mock'
import { useApp } from '../context/AppContext'
import { VideoPreview } from '../components/feed/VideoPreview'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { buttonClass } from '../components/ui/buttonClass'
import { ScoringPanel } from '../components/scoring/ScoringPanel'
import { fetchProjectById } from '../services/supabaseApi'
import { fetchProjectByIdMongo } from '../services/mongoApi'
import { isParticipantRole } from '../data/mock'
import type { Project } from '../data/mock'

export function ProjectDetailPage() {
  const { id } = useParams()
  const { judgedIds, role, feedProjects, useApiBackend, feedUsesDatabase } = useApp()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(feedUsesDatabase)

  const home = role === 'admin'
    ? '/admin'
    : isParticipantRole(role)
      ? '/team'
      : '/judge/dashboard'

  useEffect(() => {
    if (!id) return
    const fromFeed = feedProjects.find((p) => p.id === id)
    if (fromFeed) {
      setProject(fromFeed)
      setLoading(false)
      return
    }
    if (!feedUsesDatabase) {
      setProject(PROJECTS.find((p) => p.id === id) ?? null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const fetcher = useApiBackend ? fetchProjectByIdMongo : fetchProjectById
    void fetcher(id).then((p) => {
      if (!cancelled) {
        setProject(p)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id, feedProjects, feedUsesDatabase, useApiBackend])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-zinc-400">
        Loading project…
      </div>
    )
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-zinc-100">Project not found</h1>
        <Link to={home} className="mt-4 text-violet-400 hover:underline">
          Back
        </Link>
      </div>
    )
  }

  const judged = judgedIds.has(project.id)
  const isJudge = role === 'judge'

  const detailBody = (
    <>
      <div className="relative aspect-[21/9] bg-zinc-900">
        <img
          src={project.cover}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="accent">{project.category}</Badge>
            <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {project.title}
            </h1>
            <p className="mt-2 max-w-2xl text-lg text-white/90">
              {project.tagline}
            </p>
          </div>
          {judged && isJudge && (
            <span className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg">
              Scored
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-3">
        <div className="flex flex-wrap gap-3 lg:col-span-2">
          <a
            href={project.github}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('secondary', 'md')}
          >
            <Code2 className="h-4 w-4" />
            GitHub
          </a>
          <a
            href={project.demo}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('secondary', 'md')}
          >
            <ExternalLink className="h-4 w-4" />
            Live demo
          </a>
        </div>
      </div>

      <div className="border-t border-zinc-800 px-6 pb-10 sm:px-10">
        <div className="max-w-none">
          <h2 className="text-lg font-semibold text-zinc-100">Overview</h2>
          <p className="mt-3 text-zinc-400 leading-relaxed">
            {project.description}
          </p>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-zinc-100">Pitch video</h2>
          <div className="mt-4 max-w-3xl">
            <VideoPreview
              poster={project.videoPoster}
              src={project.videoSrc}
              title={project.title}
            />
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-zinc-100">Tech stack</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.tech.map((t) => (
              <span
                key={t}
                className="inline-flex h-10 items-center rounded-xl bg-zinc-800/70 px-4 text-sm font-medium text-zinc-200 transition-all duration-200 hover:bg-zinc-700 hover:scale-[1.02] ring-1 ring-white/5"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-zinc-100">Team</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {project.members.map((m) => (
              <div
                key={m.name}
                className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg hover:shadow-[0_0_20px_rgba(124,58,237,0.22)] hover:border-white/20"
              >
                <div className="rounded-full p-[2px] bg-gradient-to-br from-violet-500/90 via-indigo-500/80 to-cyan-400/70 transition-all duration-300 group-hover:shadow-[0_0_18px_rgba(124,58,237,0.25)]">
                  <Avatar
                    src={m.avatar}
                    alt={m.name}
                    size="lg"
                    className="ring-0 shadow-none"
                  />
                </div>
                <div>
                  <p className="font-medium text-zinc-100">{m.name}</p>
                  <p className="text-sm text-zinc-500">{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )

  if (isJudge) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link
          to="/judge/feed"
          className="mb-6 inline-flex text-sm font-medium text-violet-400 hover:text-violet-300"
        >
          ← Back to feed
        </Link>
        <div className="grid gap-8 lg:grid-cols-[1fr_min(100%,400px)]">
          <article className="surface-card overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]">
            {detailBody}
          </article>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[var(--radius-lg)] border border-violet-500/25 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 shadow-[0_0_30px_rgba(124,58,237,0.18)]">
              <ScoringPanel
                project={project}
                totalProjects={feedProjects.length || PROJECTS.length}
              />
            </div>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="surface-card overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]">
        <Link
          to={home}
          className="inline-flex p-6 pb-0 text-sm font-medium text-violet-400 hover:text-violet-300 sm:px-10"
        >
          ← Back
        </Link>
        {detailBody}
      </div>
    </article>
  )
}
