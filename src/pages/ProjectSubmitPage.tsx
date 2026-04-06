import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { submitProjectForTeam } from '../services/supabaseApi'
import {
  fetchProjectForTeamMongo,
  submitProjectMongo,
  updateProjectMongo,
} from '../services/mongoApi'
import { CategoryPicker } from '../components/ui/CategoryPicker'
import { isPastSubmissionEnd } from '../lib/submissionDeadline'
import type { Project } from '../data/mock'

export function ProjectSubmitPage() {
  const navigate = useNavigate()
  const { profile, refreshFeed, useApiBackend, eventSetup } = useApp()
  const [existingId, setExistingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState<string[]>(['Web Dev'])
  const [coverUrl, setCoverUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [demoUrl, setDemoUrl] = useState('')
  const [techRaw, setTechRaw] = useState('React, TypeScript')
  const [coverFileName, setCoverFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!useApiBackend)

  const locked = isPastSubmissionEnd(eventSetup)

  useEffect(() => {
    if (!useApiBackend || !profile?.team_id) {
      setLoaded(true)
      return
    }
    let c = false
    void fetchProjectForTeamMongo(profile.team_id).then((p: Project | null) => {
      if (c || !p) {
        setLoaded(true)
        return
      }
      setExistingId(p.id)
      setTitle(p.title)
      setTagline(p.tagline)
      setDescription(p.description)
      const cats = p.categories?.length ? p.categories : [p.category]
      setCategories(cats.length ? cats : ['General'])
      setCoverUrl(p.cover.startsWith('http') ? p.cover : '')
      setVideoUrl(
        p.videoSrc && !p.videoSrc.includes('sample') ? p.videoSrc : '',
      )
      setGithubUrl(p.github !== '#' ? p.github : '')
      setDemoUrl(p.demo !== '#' ? p.demo : '')
      setTechRaw(p.tech.filter((t) => t !== '—').join(', '))
      setLoaded(true)
    })
    return () => {
      c = true
    }
  }, [useApiBackend, profile?.team_id])

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () =>
        resolve(typeof r.result === 'string' ? r.result : '')
      r.onerror = () => reject(new Error('Read failed'))
      r.readAsDataURL(file)
    })

  const onCoverFile = async (file: File | null) => {
    if (!file) {
      setCoverFileName(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Cover must be an image file.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be under 4 MB.')
      return
    }
    setError(null)
    setCoverFileName(file.name)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setCoverUrl(dataUrl)
    } catch {
      setError('Could not read image.')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!profile?.team_id) {
      setError('No team linked. Register your team first.')
      return
    }
    if (categories.length === 0) {
      setError('Pick at least one category.')
      return
    }
    if (locked && !existingId) {
      setError('The submission deadline has passed. You cannot create a new submission.')
      return
    }
    setBusy(true)
    try {
      const techStack = techRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const primaryCategory = categories[0] ?? 'General'

      if (useApiBackend) {
        if (existingId) {
          if (locked) {
            setError('Submission window is closed; updates are no longer accepted.')
            setBusy(false)
            return
          }
          await updateProjectMongo(existingId, {
            title: title.trim(),
            tagline: tagline.trim(),
            description: description.trim(),
            coverUrl: coverUrl.trim(),
            videoUrl: videoUrl.trim(),
            githubUrl: githubUrl.trim(),
            demoUrl: demoUrl.trim(),
            techStack,
            category: primaryCategory,
            categories,
          })
        } else {
          await submitProjectMongo({
            teamId: profile.team_id,
            title: title.trim(),
            tagline: tagline.trim(),
            description: description.trim(),
            coverUrl: coverUrl.trim(),
            videoUrl: videoUrl.trim(),
            githubUrl: githubUrl.trim(),
            demoUrl: demoUrl.trim(),
            techStack,
            category: primaryCategory,
            categories,
          })
        }
      } else {
        await submitProjectForTeam({
          teamId: profile.team_id,
          title: title.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          coverUrl: coverUrl.trim(),
          videoUrl: videoUrl.trim(),
          githubUrl: githubUrl.trim(),
          demoUrl: demoUrl.trim(),
          techStack,
          category: primaryCategory,
        })
      }
      await refreshFeed()
      navigate('/team', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-zinc-400">
        Loading your submission…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-[var(--radius-lg)] border border-white/10 bg-zinc-900/60 p-6 sm:p-10">
        <Rocket className="h-10 w-10 text-violet-400" />
        <h1 className="mt-4 text-2xl font-bold text-zinc-100">
          {existingId ? 'Update submission' : 'Submit project'}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          One project per team. Judges see this after your team is approved.
          {locked && existingId && (
            <span className="mt-2 block text-amber-300">
              The submission deadline has passed — you can view your project but
              cannot change it.
            </span>
          )}
        </p>
        <form onSubmit={submit} className="mt-8 grid gap-4">
          <label className="block text-sm font-medium text-zinc-300">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-dark mt-1.5 w-full"
              required
              disabled={locked && !!existingId}
            />
          </label>
          <label className="block text-sm font-medium text-zinc-300">
            Tagline
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="input-dark mt-1.5 w-full"
              disabled={locked && !!existingId}
            />
          </label>
          <label className="block text-sm font-medium text-zinc-300">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="input-dark mt-1.5 w-full resize-y"
              required
              disabled={locked && !!existingId}
            />
          </label>
          <div>
            <span className="block text-sm font-medium text-zinc-300">
              Categories
            </span>
            <div className="mt-2">
              <CategoryPicker
                value={categories}
                onChange={setCategories}
                disabled={locked && !!existingId}
              />
            </div>
          </div>
          <label className="block text-sm font-medium text-zinc-300">
            Cover image
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void onCoverFile(e.target.files?.[0] ?? null)}
              className="input-dark mt-1.5 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
              disabled={locked && !!existingId}
            />
            {coverFileName && (
              <p className="mt-1 text-xs text-zinc-500">{coverFileName}</p>
            )}
          </label>
          <label className="block text-sm font-medium text-zinc-300">
            Cover image URL (optional if you uploaded a file)
            <input
              value={coverUrl.startsWith('data:') ? '' : coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              className="input-dark mt-1.5 w-full"
              placeholder="https://…"
              disabled={(locked && !!existingId) || coverUrl.startsWith('data:')}
            />
          </label>
          <label className="block text-sm font-medium text-zinc-300">
            Video URL (file, YouTube, or Drive link)
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="input-dark mt-1.5 w-full"
              placeholder="https://…"
              disabled={locked && !!existingId}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-300">
              GitHub URL
              <input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="input-dark mt-1.5 w-full"
                disabled={locked && !!existingId}
              />
            </label>
            <label className="block text-sm font-medium text-zinc-300">
              Demo URL
              <input
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                className="input-dark mt-1.5 w-full"
                disabled={locked && !!existingId}
              />
            </label>
          </div>
          <p className="rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">What is a demo URL?</span>{' '}
            Link to your live app or hosted prototype (Vercel, Netlify, GitHub Pages,
            etc.) so judges can try the product without cloning the repo.
          </p>
          <label className="block text-sm font-medium text-zinc-300">
            Tech stack (comma-separated)
            <input
              value={techRaw}
              onChange={(e) => setTechRaw(e.target.value)}
              className="input-dark mt-1.5 w-full"
              disabled={locked && !!existingId}
            />
          </label>
          {coverUrl.startsWith('data:') && (
            <div className="overflow-hidden rounded-xl border border-zinc-700">
              <p className="bg-zinc-900 px-3 py-2 text-xs text-zinc-500">
                Preview
              </p>
              <img
                src={coverUrl}
                alt=""
                className="max-h-48 w-full object-cover"
              />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <Button
            size="lg"
            type="submit"
            disabled={busy || (locked && !!existingId) || categories.length === 0}
            className="w-full sm:w-auto"
          >
            {busy
              ? 'Saving…'
              : existingId
                ? 'Save updates'
                : 'Submit project'}
          </Button>
        </form>
      </div>
    </div>
  )
}
