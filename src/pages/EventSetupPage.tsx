import { ArrowLeft, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { saveCurrentEventMongo } from '../services/mongoApi'
import { RubricBuilder } from '../components/admin/RubricBuilder'
import { TrackManager } from '../components/admin/TrackManager'
import { Button } from '../components/ui/Button'

export function EventSetupPage() {
  const { eventSetup, setEventSetup, updateRubric, updateTracks, useApiBackend } =
    useApp()
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const e = eventSetup

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
          Hackathon details, timeline, rubric, and tracks.
        </p>
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
                void saveCurrentEventMongo(eventSetup)
                  .then(() => setSaveMsg('Event saved to database.'))
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
