import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PROJECTS } from '../data/mock'
import type { Project } from '../data/mock'
import { VideoPreview } from '../components/feed/VideoPreview'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { buttonClass } from '../components/ui/buttonClass'
import { useApp } from '../context/AppContext'
import { fetchProjectForTeam } from '../services/supabaseApi'
import {
  fetchEventCatalogMongo,
  fetchMyTeamDetailMongo,
  fetchProjectForTeamMongo,
  setSelectedEventId,
  getSelectedEventId,
  type MyTeamDetail,
} from '../services/mongoApi'

/** Participant view — demo team or Supabase team project. */
export function TeamPage() {
  const { profile, supabaseMode, useApiBackend, eventSetup, refreshProfile } =
    useApp()
  const [project, setProject] = useState<Project | null>(null)
  const [myTeam, setMyTeam] = useState<MyTeamDetail | null>(null)
  const [eventCatalog, setEventCatalog] = useState<
    { id: string; name: string; lifecycleStatus: string }[]
  >([])

  useEffect(() => {
    if (!useApiBackend) return
    let cancelled = false
    void fetchEventCatalogMongo()
      .then((d) => {
        if (!cancelled) setEventCatalog(d.events ?? [])
      })
      .catch(() => {
        if (!cancelled) setEventCatalog([])
      })
    return () => {
      cancelled = true
    }
  }, [useApiBackend])

  useEffect(() => {
    if (useApiBackend && profile?.team_id) {
      let cancelled = false
      void fetchMyTeamDetailMongo().then((d) => {
        if (!cancelled) setMyTeam(d.team)
      })
      void fetchProjectForTeamMongo(profile.team_id).then((p) => {
        if (!cancelled) setProject(p)
      })
      return () => {
        cancelled = true
      }
    }
    if (supabaseMode && profile?.team_id) {
      let cancelled = false
      void fetchProjectForTeam(profile.team_id).then((p) => {
        if (!cancelled) setProject(p)
      })
      return () => {
        cancelled = true
      }
    }
    setProject(PROJECTS[0])
  }, [supabaseMode, useApiBackend, profile?.team_id])

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-zinc-100">No project yet</h1>
        <p className="mt-2 text-zinc-400">
          Submit your project so judges can review it.
        </p>
        <Link
          to="/team/submit"
          className={buttonClass('primary', 'md', 'mt-6 inline-flex')}
        >
          Submit project
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Dashboard</h1>
        {useApiBackend && eventCatalog.length > 0 && (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Hackathons
            </p>
            <label className="mt-2 block text-sm text-zinc-300">
              Context for teams & submissions
              <select
                className="input-dark mt-1.5 w-full"
                value={
                  getSelectedEventId() ??
                  eventCatalog[0]?.id ??
                  ''
                }
                onChange={(ev) => {
                  const v = ev.target.value
                  setSelectedEventId(v || null)
                  void refreshProfile()
                }}
              >
                {eventCatalog.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.lifecycleStatus})
                  </option>
                ))}
              </select>
            </label>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {eventCatalog.map((ev) => (
                <li key={ev.id}>
                  <Link
                    to={`/events/${ev.id}`}
                    className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-violet-500/50 hover:text-violet-300"
                  >
                    {ev.name} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Badge variant="accent" className="mt-4 inline-flex">
          Your team
        </Badge>
        {profile?.email && (
          <p className="mt-2 text-sm text-zinc-400">
            You are signed in as{' '}
            <span className="font-medium text-zinc-200">{profile.email}</span>
          </p>
        )}
        {useApiBackend && myTeam?.creatorEmail && (
          <p className="mt-1 text-sm text-zinc-400">
            Team created from{' '}
            <span className="font-medium text-emerald-400/90">{myTeam.creatorEmail}</span>
          </p>
        )}
        {(useApiBackend || supabaseMode) && eventSetup?.name && (
          <p className="mt-2 text-sm text-violet-300/90">
            Participating in <span className="font-semibold">{eventSetup.name}</span>
          </p>
        )}
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-100">
          {project.title}
        </h1>
        <p className="mt-2 text-lg text-zinc-400">{project.tagline}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={`/project/${project.id}`} className={buttonClass('secondary', 'md')}>
            View public detail page
          </Link>
          <Link to="/team/submit" className={buttonClass('primary', 'md')}>
            Update submission
          </Link>
        </div>
      </header>

      <div className="surface-card overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]">
        <div className="aspect-video bg-zinc-900">
          <img
            src={project.cover}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap gap-3">
            <a
              href={project.github}
              target="_blank"
              rel="noreferrer"
              className={buttonClass('secondary', 'md')}
            >
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

          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Pitch
            </h2>
            <div className="mt-4">
              <VideoPreview
                poster={project.videoPoster}
                src={project.videoSrc}
                title={project.title}
              />
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Team members
            </h2>
            {useApiBackend && myTeam && myTeam.members.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {myTeam.members.map((m) => (
                  <li
                    key={m.email}
                    className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-zinc-100">{m.email}</p>
                      <p className="text-sm text-zinc-500">
                        {m.fullName || '—'} · {m.role}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 flex flex-wrap gap-4">
                {project.members.map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <div className="rounded-full p-[2px] bg-gradient-to-br from-violet-500/90 via-indigo-500/80 to-cyan-400/70">
                      <Avatar
                        src={m.avatar}
                        alt={m.name}
                        size="md"
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
