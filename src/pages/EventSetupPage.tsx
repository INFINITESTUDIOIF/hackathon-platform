import { ArrowLeft, Plus, Upload } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  activateEventMongo,
  createHackathonEventMongo,
  fetchCurrentEventMongo,
  fetchEventsListMongo,
  saveCurrentEventMongo,
} from '../services/mongoApi'
import { RubricBuilder } from '../components/admin/RubricBuilder'
import { TrackManager } from '../components/admin/TrackManager'
import { Button } from '../components/ui/Button'
import type { EventSetup } from '../types/event'

export function EventSetupPage() {
  const navigate = useNavigate()
  const {
    eventSetup,
    setEventSetup,
    updateRubric,
    updateTracks,
    useApiBackend,
    refreshFeed,
  } = useApp()
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [eventRows, setEventRows] = useState<
    { id: string; name: string; isCurrent: boolean }[]
  >([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [newEventName, setNewEventName] = useState('')
  const [switching, setSwitching] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const e = eventSetup

  const reloadActiveEvent = async () => {
    const ev = await fetchCurrentEventMongo()
    if (ev) setEventSetup(ev)
  }

  useEffect(() => {
    if (!useApiBackend) return
    let cancelled = false
    setEventsLoading(true)
    void fetchEventsListMongo()
      .then((d) => {
        if (cancelled) return
        setEventRows(d.events.map((x) => ({ id: x.id, name: x.name, isCurrent: x.isCurrent })))
      })
      .catch(() => {
        if (!cancelled) setEventRows([])
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [useApiBackend])

  const eventOptions = useMemo(() => {
    const rows = [...eventRows]
    if (e.id && !rows.some((r) => r.id === e.id)) {
      rows.unshift({ id: e.id, name: e.name || 'Current', isCurrent: true })
    }
    return rows
  }, [eventRows, e.id, e.name])

  const setBannerFile = (file: File | null) => {
    if (!file) {
      setEventSetup((prev) => ({ ...prev, bannerDataUrl: null }))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setEventSetup((prev) => ({
        ...prev,
        bannerDataUrl: typeof reader.result === 'string' ? reader.result : null,
      }))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {switching && <FullScreenLoader label="Creating event…" />}
      {createSuccess && (
        <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm font-medium text-emerald-200">
          Event created successfully. Redirecting…
        </div>
      )}
      <Link
        to="/admin"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to admin
      </Link>

      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Event setup
        </h1>
        <p className="mt-2 text-zinc-400">
          Each hackathon is its own event — teams, projects, and leaderboard use the
          active event below.
        </p>

        {useApiBackend && (
          <div className="mt-6 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block min-w-[200px] flex-1 text-sm font-medium text-zinc-300">
                Active hackathon
                <select
                  className="input-dark mt-1.5 w-full"
                  disabled={eventsLoading || switching}
                  value={e.id ?? ''}
                  onChange={(ev) => {
                    const id = ev.target.value
                    if (!id || id === e.id) return
                    setSwitching(true)
                    void (async () => {
                      try {
                        await activateEventMongo(id)
                        await reloadActiveEvent()
                        const list = await fetchEventsListMongo()
                        setEventRows(
                          list.events.map((x) => ({
                            id: x.id,
                            name: x.name,
                            isCurrent: x.isCurrent,
                          })),
                        )
                        await refreshFeed()
                        setSaveMsg(null)
                      } finally {
                        setSwitching(false)
                      }
                    })()
                  }}
                >
                  {!eventOptions.length && (
                    <option value="">{eventsLoading ? 'Loading…' : 'No events yet'}</option>
                  )}
                  {eventOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                      {row.isCurrent ? ' (active)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newEventName}
                  onChange={(ev) => setNewEventName(ev.target.value)}
                  placeholder="Name for new hackathon"
                  className="input-dark min-w-[180px]"
                  disabled={switching}
                />
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  disabled={switching}
                  onClick={() => {
                    void (async () => {
                      setSwitching(true)
                      try {
                        await createHackathonEventMongo({
                          name: newEventName.trim() || 'New hackathon',
                          setAsCurrent: true,
                        })
                        setNewEventName('')
                        await reloadActiveEvent()
                        const list = await fetchEventsListMongo()
                        setEventRows(
                          list.events.map((x) => ({
                            id: x.id,
                            name: x.name,
                            isCurrent: x.isCurrent,
                          })),
                        )
                        await refreshFeed()
                        setCreateSuccess(true)
                        window.setTimeout(() => {
                          setCreateSuccess(false)
                          navigate('/admin')
                        }, 850)
                      } finally {
                        setSwitching(false)
                      }
                    })()
                  }}
                >
                  <Plus className="h-4 w-4" />
                  New hackathon
                </Button>
              </div>
            </div>
            {switching && (
              <p className="text-xs text-zinc-500">Switching event…</p>
            )}
          </div>
        )}
      </header>

      <div className="space-y-8">
        <section className="surface-card rounded-[var(--radius-lg)] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-100">Basics</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-300">
              Hackathon name
              <input
                value={e.name}
                onChange={(ev) =>
                  setEventSetup((p) => ({ ...p, name: ev.target.value }))
                }
                className="input-dark mt-1.5 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-300 sm:col-span-2">
              Tagline
              <input
                value={e.tagline}
                onChange={(ev) =>
                  setEventSetup((p) => ({ ...p, tagline: ev.target.value }))
                }
                className="input-dark mt-1.5 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-300 sm:col-span-2">
              Description
              <textarea
                value={e.description}
                onChange={(ev) =>
                  setEventSetup((p) => ({ ...p, description: ev.target.value }))
                }
                rows={4}
                className="input-dark mt-1.5 w-full resize-y"
              />
            </label>
          </div>
        </section>

        <section className="surface-card rounded-[var(--radius-lg)] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-100">Banner</h2>
          <p className="mt-1 text-sm text-zinc-400">Upload a wide image for the event hub.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
            <div className="aspect-[21/9] bg-zinc-900">
              {(e.bannerDataUrl || '').length > 0 ? (
                <img
                  src={e.bannerDataUrl!}
                  alt="Banner preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No banner yet — upload below
                </div>
              )}
            </div>
          </div>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(ev) => setBannerFile(ev.target.files?.[0] ?? null)}
            />
            <span className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700">
              <Upload className="h-4 w-4" />
              Upload banner
            </span>
          </label>
        </section>

        <section className="surface-card rounded-[var(--radius-lg)] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-100">Timeline</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(
              [
                ['submissionStart', 'Submission start'],
                ['submissionEnd', 'Submission end'],
                ['judgingStart', 'Judging start'],
                ['winnerAnnouncement', 'Winner announcement'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm font-medium text-zinc-300">
                {label}
                <input
                  type="date"
                  value={e[key]}
                  onChange={(ev) =>
                    setEventSetup((p) => ({
                      ...p,
                      [key]: ev.target.value,
                    }))
                  }
                  className="input-dark mt-1.5 w-full"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="surface-card rounded-[var(--radius-lg)] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Automatic lock</h2>
              <p className="text-sm text-zinc-400">
                Lock submissions when the submission window ends.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={e.autoLock}
              onClick={() =>
                setEventSetup((p) => ({ ...p, autoLock: !p.autoLock }))
              }
              className={`relative h-8 w-14 rounded-full transition-colors ${
                e.autoLock ? 'bg-violet-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  e.autoLock ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        <section className="surface-card rounded-[var(--radius-lg)] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-zinc-100">Scoring mode</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Choose primary judging style for this event.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                setEventSetup((p) => ({ ...p, scoringMode: 'rubric' }))
              }
              className={`rounded-xl px-4 py-3 text-sm font-medium ring-1 transition ${
                e.scoringMode === 'rubric'
                  ? 'bg-violet-600 text-white ring-violet-500'
                  : 'bg-zinc-800 text-zinc-200 ring-zinc-600 hover:bg-zinc-700'
              }`}
            >
              Rubric (sliders)
            </button>
            <button
              type="button"
              onClick={() => setEventSetup((p) => ({ ...p, scoringMode: 'stars' }))}
              className={`rounded-xl px-4 py-3 text-sm font-medium ring-1 transition ${
                e.scoringMode === 'stars'
                  ? 'bg-violet-600 text-white ring-violet-500'
                  : 'bg-zinc-800 text-zinc-200 ring-zinc-600 hover:bg-zinc-700'
              }`}
            >
              Star rating
            </button>
          </div>
        </section>

        <section className="surface-card rounded-[var(--radius-lg)] p-6 sm:p-8">
          <RubricBuilder
            rubric={e.rubric}
            onChange={(rubric) => updateRubric(rubric)}
          />
        </section>

        <section className="surface-card rounded-[var(--radius-lg)] p-6 sm:p-8">
          <TrackManager tracks={e.tracks} onChange={updateTracks} />
        </section>

        <div className="flex flex-col items-end gap-2 pb-8">
          {saveMsg && (
            <p className="text-sm text-emerald-400" role="status">
              {saveMsg}
            </p>
          )}
          <Button
            size="lg"
            type="button"
            disabled={saving}
            onClick={() => {
              setSaveMsg(null)
              if (useApiBackend) {
                setSaving(true)
                void saveCurrentEventMongo(eventSetup as EventSetup)
                  .then(() => setSaveMsg('Saved to database.'))
                  .then(() =>
                    window.setTimeout(() => {
                      navigate('/admin', { replace: true })
                    }, 900),
                  )
                  .catch(() => setSaveMsg('Could not save — check API connection.'))
                  .finally(() => setSaving(false))
              } else {
                setSaveMsg('Saved locally (connect VITE_API_URL to persist on server).')
              }
            }}
          >
            {saving ? 'Saving…' : 'Save event'}
          </Button>
        </div>
      </div>
    </div>
  )
}
