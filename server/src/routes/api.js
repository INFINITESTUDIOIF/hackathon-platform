import { Router } from 'express'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import {
  User,
  Team,
  TeamMember,
  Project,
  HackathonEvent,
  AppSettings,
  Score,
} from '../models.js'
import {
  signToken,
  authMiddleware,
  requireAuth,
  isSubmissionLocked,
} from '../lib.js'

const router = Router()

async function getSettings() {
  let s = await AppSettings.findById('main')
  if (!s) {
    const ev = await HackathonEvent.findOne().sort({ createdAt: 1 })
    s = await AppSettings.create({
      _id: 'main',
      currentEventId: ev?._id ?? null,
      allowedEmails: [],
    })
  }
  return s
}

async function getCurrentEvent() {
  const s = await getSettings()
  if (!s.currentEventId) return null
  return HackathonEvent.findById(s.currentEventId)
}

/** Preferred event for this HTTP request (query ?eventId= or X-Hackathon-Event header), else settings.current. */
async function resolveEvent(req) {
  const raw = req.query?.eventId ?? req.headers['x-hackathon-event']
  if (raw && mongoose.isValidObjectId(String(raw))) {
    const ev = await HackathonEvent.findById(String(raw))
    if (ev) return ev
  }
  return getCurrentEvent()
}

let legacyTeamSyncDone = false
async function ensureLegacyTeamSync() {
  if (legacyTeamSyncDone) return
  legacyTeamSyncDone = true
  try {
    const users = await User.find({ teamId: { $ne: null } })
    for (const u of users) {
      const team = await Team.findById(u.teamId)
      if (!team) continue
      await TeamMember.updateOne(
        { userId: u._id, eventId: team.eventId },
        { $set: { teamId: team._id } },
        { upsert: true },
      )
      const ids = team.memberIds?.length ? [...team.memberIds.map((id) => id.toString())] : []
      if (!ids.includes(u._id.toString())) {
        team.memberIds = [...(team.memberIds || []), u._id]
        await team.save()
      } else if (!team.memberIds?.length) {
        team.memberIds = [u._id]
        await team.save()
      }
    }
  } catch (e) {
    console.error('Legacy team sync failed', e)
  }
}

function mapApiRole(role) {
  if (role === 'team') return 'participant'
  return role
}

function baseProfileFields(u) {
  if (!u) return null
  const pwd = Boolean(u.passwordHash && String(u.passwordHash).length > 0)
  return {
    id: u._id.toString(),
    email: u.email,
    username: u.username || null,
    full_name: u.fullName || null,
    role: mapApiRole(u.role),
    team_id: u.teamId ? u.teamId.toString() : null,
    approval_status: u.approvalStatus,
    google_verified: Boolean(u.googleVerified),
    password_set: pwd,
    needs_profile_setup: Boolean(
      u.role !== 'admin' &&
        (!u.username || (Boolean(u.googleVerified) && !pwd)),
    ),
  }
}

async function buildProfile(u, eventContextId) {
  await ensureLegacyTeamSync()
  const row = { ...baseProfileFields(u), team_id: null }
  if (!u) return null
  if (!eventContextId || !mongoose.isValidObjectId(eventContextId)) {
    if (u.teamId) row.team_id = u.teamId.toString()
    return row
  }
  const m = await TeamMember.findOne({ userId: u._id, eventId: eventContextId })
  if (m) row.team_id = m.teamId.toString()
  else if (u.teamId) {
    const t = await Team.findById(u.teamId)
    if (t && t.eventId.toString() === eventContextId) row.team_id = u.teamId.toString()
  }
  return row
}

async function defaultEventIdForProfile() {
  const s = await getSettings()
  return s.currentEventId ? s.currentEventId.toString() : null
}

function toProfile(u) {
  return baseProfileFields(u)
}

const placeholder =
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80'
const sampleVideo =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'

function mapProjectDoc(p, team) {
  const tech = p.techStack?.length ? p.techStack : ['—']
  const cat =
    p.categories?.length > 0 ? p.categories.join(', ') : p.category || 'General'
  return {
    id: p._id.toString(),
    title: p.title,
    tagline: p.tagline || '',
    description: p.description || '',
    cover: p.coverUrl || placeholder,
    videoPoster: p.coverUrl || placeholder,
    videoSrc: p.videoUrl || sampleVideo,
    github: p.githubUrl || '#',
    demo: p.demoUrl || '#',
    category: cat,
    categories: p.categories?.length ? p.categories : [p.category].filter(Boolean),
    tech,
    teamName: team?.name || 'Team',
    members: [{ name: team?.name || 'Team', avatar: placeholder, role: 'Team' }],
  }
}

router.post('/auth/register', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase()
    const password = String(req.body.password || '')
    const fullName = String(req.body.fullName || '').trim()
    const username = String(req.body.username || '')
      .trim()
      .toLowerCase()
      .replace(/^@+/g, '')
    if (!email.includes('@') || password.length < 6) {
      return res.status(400).json({ error: 'Valid email and password (6+ chars) required.' })
    }
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3–24 characters (letters, numbers, underscores).',
      })
    }
    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ error: 'This email is already registered.' })
    const nameTaken = await User.findOne({ username })
    if (nameTaken) return res.status(409).json({ error: 'That username is already taken.' })
    const settings = await getSettings()
    const onAllowList = settings.allowedEmails?.some((e) => e.toLowerCase() === email)
    const invitedEntry = settings.invitedJudges?.find(
      (j) => j.email.toLowerCase() === email,
    )
    const passwordHash = await bcrypt.hash(password, 10)
    const isFirst = (await User.countDocuments()) === 0
    const adminEmailEnv = (process.env.ADMIN_EMAIL || '').toLowerCase()
    let role = 'team'
    if (isFirst || email === adminEmailEnv) role = 'admin'
    else if (invitedEntry) role = 'judge'
    const user = await User.create({
      email,
      username,
      passwordHash,
      fullName,
      role,
      approvalStatus: role === 'admin' || onAllowList ? 'approved' : 'pending',
    })
    const token = signToken(user._id.toString())
    const eventId = await defaultEventIdForProfile()
    res.json({ token, user: await buildProfile(user, eventId) })
  } catch (e) {
    console.error(e)
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Email or username already in use.' })
    }
    res.status(500).json({ error: 'Registration failed.' })
  }
})

/** Returns whether an account exists (for forgot-password gating). */
router.post('/auth/check-email', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase()
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required.' })
    }
    const u = await User.findOne({ email }).select('_id').lean()
    res.json({ exists: Boolean(u) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Could not check email.' })
  }
})

/** After Google OAuth: set unique username + app password. */
router.post('/auth/complete-profile', authMiddleware, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'Not found' })
    const username = String(req.body.username || '')
      .trim()
      .toLowerCase()
      .replace(/^@+/g, '')
    const password = String(req.body.password || '')
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3–24 characters (letters, numbers, underscores).',
      })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'App password must be at least 6 characters.' })
    }
    const taken = await User.findOne({ username, _id: { $ne: user._id } })
    if (taken) return res.status(409).json({ error: 'That username is already taken.' })
    user.username = username
    user.passwordHash = await bcrypt.hash(password, 10)
    await user.save()
    const eventId = (req.query?.eventId || (await defaultEventIdForProfile())) ?? null
    res.json({ user: await buildProfile(user, eventId) })
  } catch (e) {
    console.error(e)
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Username already in use.' })
    }
    res.status(500).json({ error: 'Could not update profile.' })
  }
})

router.post('/auth/supabase-sync', async (req, res) => {
  try {
    const accessToken = String(req.body.access_token || '').trim()
    if (!accessToken) {
      return res.status(400).json({ error: 'access_token required.' })
    }
    const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
    const anonKey = process.env.SUPABASE_ANON_KEY || ''
    if (!supabaseUrl || !anonKey) {
      return res.status(503).json({
        error: 'Server missing SUPABASE_URL / SUPABASE_ANON_KEY for OAuth sync.',
      })
    }
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
    })
    if (!r.ok) {
      return res.status(401).json({ error: 'Invalid or expired Supabase session.' })
    }
    const body = await r.json()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'OAuth user has no email.' })
    }
    const fullName =
      String(body.user_metadata?.full_name || body.user_metadata?.name || '').trim() ||
      email.split('@')[0]
    const settings = await getSettings()
    const onAllowList = settings.allowedEmails?.some((e) => e.toLowerCase() === email)
    const invitedEntry = settings.invitedJudges?.find(
      (j) => j.email.toLowerCase() === email,
    )
    const adminEmailEnv = (process.env.ADMIN_EMAIL || '').toLowerCase()
    let user = await User.findOne({ email })
    if (!user) {
      const isFirst = (await User.countDocuments()) === 0
      let role = 'team'
      if (isFirst || email === adminEmailEnv) role = 'admin'
      else if (invitedEntry) role = 'judge'
      user = await User.create({
        email,
        passwordHash: '',
        fullName,
        role,
        approvalStatus: role === 'admin' || onAllowList ? 'approved' : 'pending',
        googleVerified: true,
      })
    } else {
      user.googleVerified = true
      if (fullName && !user.fullName) user.fullName = fullName
      await user.save()
    }
    const token = signToken(user._id.toString())
    const eventId = await defaultEventIdForProfile()
    res.json({ token, user: await buildProfile(user, eventId) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'OAuth sync failed.' })
  }
})

router.post('/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase()
    const password = String(req.body.password || '')
    const user = await User.findOne({ email })
    if (!user?.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' })
    const token = signToken(user._id.toString())
    const eventId = await defaultEventIdForProfile()
    res.json({ token, user: await buildProfile(user, eventId) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Login failed.' })
  }
})

router.get('/auth/me', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user) return res.status(404).json({ error: 'Not found' })
  const eventId =
    (req.query?.eventId && String(req.query.eventId)) ||
    (await defaultEventIdForProfile())
  res.json({ user: await buildProfile(user, eventId) })
})

/**
 * For Google-first accounts: set an app password (once).
 * Production-safe rule: only allowed when passwordHash is empty.
 */
router.post('/auth/set-password', authMiddleware, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'Not found' })
    if (user.passwordHash && String(user.passwordHash).length > 0) {
      return res.status(409).json({ error: 'Password already set.' })
    }
    const password = String(req.body.password || '')
    const fullName = String(req.body.fullName || '').trim()
    const username = String(req.body.username || '')
      .trim()
      .toLowerCase()
      .replace(/^@+/g, '')
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' })
    }
    if (username) {
      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        return res.status(400).json({
          error: 'Username must be 3–24 characters (letters, numbers, underscores).',
        })
      }
      const taken = await User.findOne({ username, _id: { $ne: user._id } })
      if (taken) return res.status(409).json({ error: 'That username is already taken.' })
      user.username = username
    }
    user.passwordHash = await bcrypt.hash(password, 10)
    if (fullName) user.fullName = fullName
    await user.save()
    const eventId =
      (req.query?.eventId && String(req.query.eventId)) ||
      (await defaultEventIdForProfile())
    res.json({ user: await buildProfile(user, eventId) })
  } catch (e) {
    console.error(e)
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Username already in use.' })
    }
    res.status(500).json({ error: 'Could not set password.' })
  }
})

router.post('/auth/google-profile', authMiddleware, requireAuth, async (req, res) => {
  try {
    const { email, name } = req.body || {}
    const e = String(email || '')
      .trim()
      .toLowerCase()
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'Not found' })
    if (e && e !== user.email) {
      return res.status(400).json({ error: 'Google account must match signup email.' })
    }
    user.googleVerified = true
    if (name && !user.fullName) user.fullName = String(name).trim()
    await user.save()
    const eventId =
      (req.query?.eventId && String(req.query.eventId)) ||
      (await defaultEventIdForProfile())
    res.json({ user: await buildProfile(user, eventId) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not verify.' })
  }
})

router.get('/settings', authMiddleware, async (req, res) => {
  const s = await getSettings()
  res.json({
    leaderboard_visibility: s.leaderboardVisibility,
    winner_announced_at: s.winnerAnnouncedAt ? s.winnerAnnouncedAt.toISOString() : null,
  })
})

router.patch('/settings', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user || user.role !== 'admin' || user.approvalStatus !== 'approved') {
    return res.status(403).json({ error: 'Admin only' })
  }
  const s = await getSettings()
  if (req.body.leaderboard_visibility)
    s.leaderboardVisibility = req.body.leaderboard_visibility
  if (req.body.winner_announced_at !== undefined) {
    s.winnerAnnouncedAt = req.body.winner_announced_at
      ? new Date(req.body.winner_announced_at)
      : null
  }
  await s.save()
  res.json({
    leaderboard_visibility: s.leaderboardVisibility,
    winner_announced_at: s.winnerAnnouncedAt ? s.winnerAnnouncedAt.toISOString() : null,
  })
})

function mapEventResponse(ev) {
  return {
    id: ev._id.toString(),
    name: ev.name,
    tagline: ev.tagline,
    description: ev.description,
    bannerDataUrl: ev.bannerDataUrl,
    submissionStart: ev.submissionStart,
    submissionEnd: ev.submissionEnd,
    judgingStart: ev.judgingStart,
    winnerAnnouncement: ev.winnerAnnouncement,
    autoLock: ev.autoLock,
    scoringMode: ev.scoringMode || 'rubric',
    rubric: ev.rubric,
    tracks: ev.tracks,
    lifecycleStatus: ev.lifecycleStatus || 'active',
  }
}

router.get('/events/current', async (_req, res) => {
  const ev = await getCurrentEvent()
  if (!ev) return res.json({ event: null })
  res.json({ event: mapEventResponse(ev) })
})

/** All hackathons for dashboards (any authenticated user). */
router.get('/events/catalog', authMiddleware, requireAuth, async (_req, res) => {
  const list = await HackathonEvent.find().sort({ createdAt: -1 }).lean()
  res.json({
    events: list.map((e) => ({
      id: e._id.toString(),
      name: e.name || 'Untitled',
      lifecycleStatus: e.lifecycleStatus || 'active',
      submissionEnd: e.submissionEnd || '',
      createdAt: e.createdAt ? e.createdAt.toISOString() : null,
    })),
  })
})

router.get('/events/:id', authMiddleware, requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid event id' })
  }
  const ev = await HackathonEvent.findById(req.params.id).lean()
  if (!ev) return res.status(404).json({ error: 'Not found' })
  res.json({ event: mapEventResponse(ev) })
})

/** Event detail: teams, projects, aggregated scores (for leaderboard UI). */
router.get('/events/:id/summary', authMiddleware, requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid event id' })
  }
  const ev = await HackathonEvent.findById(req.params.id).lean()
  if (!ev) return res.status(404).json({ error: 'Not found' })
  const [teams, projects] = await Promise.all([
    Team.find({ eventId: ev._id }).sort({ createdAt: -1 }).lean(),
    Project.find({ eventId: ev._id }).lean(),
  ])
  const teamMap = new Map(teams.map((t) => [t._id.toString(), t]))
  const approvedEntries = []
  for (const p of projects) {
    const t = teamMap.get(p.teamId.toString())
    if (!t || t.status !== 'approved') continue
    approvedEntries.push({ p, t })
  }
  const mappedProjects = approvedEntries.map(({ p, t }) => mapProjectDoc(p, t))
  const ids = approvedEntries.map(({ p }) => p._id)
  const scores = ids.length
    ? await Score.find({ projectId: { $in: ids } }).lean()
    : []
  const judgeIds = [...new Set(scores.map((s) => s.judgeId.toString()))]
  const judges = judgeIds.length ? await User.find({ _id: { $in: judgeIds } }).lean() : []
  const nameByJudge = new Map(
    judges.map((j) => [j._id.toString(), j.fullName || j.email || 'Judge']),
  )
  const byProject = new Map()
  for (const s of scores) {
    const pid = s.projectId.toString()
    const cur = byProject.get(pid) || { totals: [], feedback: [] }
    cur.totals.push(Number(s.total))
    cur.feedback.push({
      judge: nameByJudge.get(s.judgeId.toString()) || 'Judge',
      score: Math.round(Number(s.total) * 10) / 10,
      comment: s.comment || '',
    })
    byProject.set(pid, cur)
  }
  const scoresOut = {}
  for (const { p } of approvedEntries) {
    const pid = p._id.toString()
    const v = byProject.get(pid)
    const avg = v?.totals?.length
      ? v.totals.reduce((a, b) => a + b, 0) / v.totals.length
      : 0
    scoresOut[pid] = {
      total: Math.round(avg * 10) / 10,
      byJudge: v?.feedback || [],
    }
  }
  const teamSummaries = teams.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    status: t.status,
    memberCount: t.memberIds?.length || 0,
  }))
  res.json({
    event: mapEventResponse(ev),
    teams: teamSummaries,
    projects: mappedProjects,
    scores: scoresOut,
  })
})

router.patch('/events/by-id/:eventId', authMiddleware, requireAuth, async (req, res) => {
  const admin = await User.findById(req.userId)
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  if (!mongoose.isValidObjectId(req.params.eventId)) {
    return res.status(400).json({ error: 'Invalid event id' })
  }
  const ev = await HackathonEvent.findById(req.params.eventId)
  if (!ev) return res.status(404).json({ error: 'Not found' })
  const b = req.body || {}
  const fields = [
    'name',
    'tagline',
    'description',
    'bannerDataUrl',
    'submissionStart',
    'submissionEnd',
    'judgingStart',
    'winnerAnnouncement',
    'autoLock',
    'scoringMode',
    'rubric',
    'tracks',
    'lifecycleStatus',
  ]
  for (const f of fields) {
    if (b[f] !== undefined) ev[f] = b[f]
  }
  await ev.save()
  res.json({ event: mapEventResponse(ev) })
})

/** Single round-trip: profile, settings, catalog, active event, feed, scores. */
router.get('/bootstrap', authMiddleware, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'Not found' })
    const rawEv = req.query?.eventId
    const eventId =
      rawEv && mongoose.isValidObjectId(String(rawEv))
        ? String(rawEv)
        : await defaultEventIdForProfile()
    const [s, catalog, ev, profile] = await Promise.all([
      getSettings(),
      HackathonEvent.find().sort({ createdAt: -1 }).lean(),
      eventId ? HackathonEvent.findById(eventId) : null,
      buildProfile(user, eventId),
    ])
    let projects = []
    let scoresPayload = {}
    if (ev) {
      const projs = await Project.find({ eventId: ev._id }).lean()
      const teamIds = [...new Set(projs.map((p) => p.teamId.toString()))]
      const teams = await Team.find({ _id: { $in: teamIds } }).lean()
      const teamMap = new Map(teams.map((t) => [t._id.toString(), t]))
      for (const p of projs) {
        const t = teamMap.get(p.teamId.toString())
        if (!t || t.status !== 'approved') continue
        projects.push(mapProjectDoc(p, t))
      }
      const pids = projs
        .filter((p) => {
          const t = teamMap.get(p.teamId.toString())
          return t && t.status === 'approved'
        })
        .map((p) => p._id)
      if (pids.length) {
        const scores = await Score.find({ projectId: { $in: pids } }).lean()
        const judgeIds = [...new Set(scores.map((x) => x.judgeId.toString()))]
        const judges = judgeIds.length
          ? await User.find({ _id: { $in: judgeIds } }).lean()
          : []
        const nameByJudge = new Map(
          judges.map((j) => [j._id.toString(), j.fullName || j.email || 'Judge']),
        )
        const byProject = new Map()
        for (const s of scores) {
          const pid = s.projectId.toString()
          const cur = byProject.get(pid) || { totals: [], feedback: [] }
          cur.totals.push(Number(s.total))
          cur.feedback.push({
            judge: nameByJudge.get(s.judgeId.toString()) || 'Judge',
            score: Math.round(Number(s.total) * 10) / 10,
            comment: s.comment || '',
          })
          byProject.set(pid, cur)
        }
        for (const [pid, v] of byProject) {
          const avg = v.totals.length
            ? v.totals.reduce((a, b) => a + b, 0) / v.totals.length
            : 0
          scoresPayload[pid] = {
            total: Math.round(avg * 10) / 10,
            byJudge: v.feedback,
          }
        }
      }
    }
    let judgeScoreRows = []
    if (user.role === 'judge' && user.approvalStatus === 'approved') {
      judgeScoreRows = await Score.find({ judgeId: user._id }).lean()
    }
    res.json({
      user: profile,
      settings: {
        leaderboard_visibility: s.leaderboardVisibility,
        winner_announced_at: s.winnerAnnouncedAt ? s.winnerAnnouncedAt.toISOString() : null,
      },
      events: catalog.map((e) => ({
        id: e._id.toString(),
        name: e.name || 'Untitled',
        lifecycleStatus: e.lifecycleStatus || 'active',
        submissionEnd: e.submissionEnd || '',
        createdAt: e.createdAt ? e.createdAt.toISOString() : null,
      })),
      currentEventId: s.currentEventId?.toString() ?? null,
      event: ev ? mapEventResponse(ev) : null,
      projects,
      scores: scoresPayload,
      myJudgeScores: judgeScoreRows.map((r) => ({
        project_id: r.projectId.toString(),
        criterion_scores: r.criterionScores || {},
        comment: r.comment,
      })),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Bootstrap failed.' })
  }
})

/** List all hackathons (admin). */
router.get('/events', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const list = await HackathonEvent.find().sort({ createdAt: -1 }).lean()
  const s = await getSettings()
  const currentId = s.currentEventId?.toString() ?? null
  res.json({
    currentEventId: currentId,
    events: list.map((e) => ({
      id: e._id.toString(),
      name: e.name || 'Untitled',
      lifecycleStatus: e.lifecycleStatus || 'active',
      submissionEnd: e.submissionEnd || '',
      createdAt: e.createdAt ? e.createdAt.toISOString() : null,
      isCurrent: currentId === e._id.toString(),
    })),
  })
})

const defaultRubricTemplate = [
  { id: 'r1', name: 'Innovation', description: 'Novelty and creative problem-solving.', maxPoints: 10, weightPercent: 25 },
  { id: 'r2', name: 'Design', description: 'UX, UI, and polish.', maxPoints: 10, weightPercent: 25 },
  { id: 'r3', name: 'Impact', description: 'Usefulness and potential reach.', maxPoints: 10, weightPercent: 25 },
  { id: 'r4', name: 'Execution', description: 'Working demo and technical quality.', maxPoints: 10, weightPercent: 25 },
]

/** Create a new hackathon and optionally make it active. */
router.post('/events', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const b = req.body || {}
  const name = String(b.name || 'New hackathon').trim() || 'New hackathon'
  const setAsCurrent = b.setAsCurrent !== false
  const lifecycleStatus =
    ['upcoming', 'active', 'completed'].includes(String(b.lifecycleStatus || ''))
      ? b.lifecycleStatus
      : 'active'
  const ev = await HackathonEvent.create({
    name,
    tagline: '',
    description: '',
    bannerDataUrl: null,
    submissionStart: '',
    submissionEnd: '',
    judgingStart: '',
    winnerAnnouncement: '',
    autoLock: true,
    scoringMode: 'rubric',
    rubric: defaultRubricTemplate,
    tracks: [],
    lifecycleStatus,
  })
  if (setAsCurrent) {
    const s = await getSettings()
    s.currentEventId = ev._id
    await s.save()
  }
  res.status(201).json({ event: mapEventResponse(ev) })
})

/** Set which hackathon is active (feed, leaderboard, teams for this event). */
router.post('/events/:id/activate', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid event id' })
  }
  const ev = await HackathonEvent.findById(req.params.id)
  if (!ev) return res.status(404).json({ error: 'Event not found' })
  const s = await getSettings()
  s.currentEventId = ev._id
  await s.save()
  res.json({ event: mapEventResponse(ev) })
})

router.put('/events/current', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const s = await getSettings()
  let ev = await getCurrentEvent()
  if (!ev) {
    ev = await HackathonEvent.create({})
    s.currentEventId = ev._id
    await s.save()
  }
  const b = req.body || {}
  const fields = [
    'name',
    'tagline',
    'description',
    'bannerDataUrl',
    'submissionStart',
    'submissionEnd',
    'judgingStart',
    'winnerAnnouncement',
    'autoLock',
    'scoringMode',
    'rubric',
    'tracks',
    'lifecycleStatus',
  ]
  for (const f of fields) {
    if (b[f] !== undefined) ev[f] = b[f]
  }
  await ev.save()
  res.json({ event: mapEventResponse(ev) })
})

router.get('/projects', authMiddleware, requireAuth, async (req, res) => {
  const ev = await resolveEvent(req)
  if (!ev) return res.json({ projects: [] })
  const projects = await Project.find({ eventId: ev._id }).lean()
  const teamIds = [...new Set(projects.map((p) => p.teamId.toString()))]
  const teams = await Team.find({ _id: { $in: teamIds } }).lean()
  const teamMap = new Map(teams.map((t) => [t._id.toString(), t]))
  const out = []
  for (const p of projects) {
    const t = teamMap.get(p.teamId.toString())
    if (!t || t.status !== 'approved') continue
    out.push(mapProjectDoc(p, t))
  }
  res.json({ projects: out })
})

/** Same visibility as judge feed: all approved submissions. Team accounts see the full leaderboard, not only their row. */
router.get('/projects/all', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const ev = await resolveEvent(req)
  if (!ev) return res.json({ projects: [] })
  const projects = await Project.find({ eventId: ev._id }).lean()
  const teamIds = [...new Set(projects.map((p) => p.teamId.toString()))]
  const teams = await Team.find({ _id: { $in: teamIds } }).lean()
  const teamMap = new Map(teams.map((t) => [t._id.toString(), t]))
  const out = []
  for (const p of projects) {
    const t = teamMap.get(p.teamId.toString())
    if (!t || t.status !== 'approved') continue
    out.push(mapProjectDoc(p, t))
  }
  res.json({ projects: out })
})

/** Teams still awaiting approval or approved but with no project yet — shown below the ranked table on leaderboard. */
router.get('/leaderboard/awaiting', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const ev = await resolveEvent(req)
  if (!ev) return res.json({ rows: [] })
  const teams = await Team.find({ eventId: ev._id }).sort({ createdAt: -1 }).lean()
  const teamIds = teams.map((t) => t._id)
  const projects = await Project.find({ teamId: { $in: teamIds } }).lean()
  const teamHasProject = new Set(projects.map((p) => p.teamId.toString()))
  const rows = []
  for (const t of teams) {
    const tid = t._id.toString()
    const hasProj = teamHasProject.has(tid)
    if (t.status === 'pending' || !hasProj) {
      rows.push({
        teamId: tid,
        teamName: t.name,
        teamStatus: t.status,
        reason: t.status === 'pending' ? 'pending_approval' : 'no_submission',
      })
    }
  }
  res.json({ rows })
})

router.get('/projects/by-team/:teamId', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const tid = req.params.teamId
  if (user.teamId?.toString() !== tid && user.role !== 'admin' && user.role !== 'judge') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const ev = await resolveEvent(req)
  if (!ev) return res.json({ project: null })
  const p = await Project.findOne({ teamId: tid, eventId: ev._id }).lean()
  if (!p) return res.json({ project: null })
  const team = await Team.findById(p.teamId).lean()
  res.json({ project: mapProjectDoc(p, team) })
})

router.get('/projects/:id', authMiddleware, requireAuth, async (req, res) => {
  const p = await Project.findById(req.params.id).lean()
  if (!p) return res.status(404).json({ error: 'Not found' })
  const team = await Team.findById(p.teamId).lean()
  if (team?.status !== 'approved') {
    const user = req.userId ? await User.findById(req.userId) : null
    const canSee =
      user?.role === 'admin' ||
      user?.role === 'judge' ||
      user?.teamId?.toString() === p.teamId.toString()
    if (!canSee) return res.status(404).json({ error: 'Not found' })
  }
  res.json({ project: mapProjectDoc(p, team) })
})

router.post('/projects', authMiddleware, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user || user.role !== 'team') {
      return res.status(403).json({ error: 'Participant accounts only.' })
    }
    const ev = await resolveEvent(req)
    if (!ev) return res.status(400).json({ error: 'No active event.' })
    const tm = await TeamMember.findOne({ userId: user._id, eventId: ev._id })
    if (!tm) return res.status(400).json({ error: 'Create or join a team for this event first.' })
    const team = await Team.findById(tm.teamId)
    if (!team) return res.status(400).json({ error: 'Team not found.' })
    const settings = await getSettings()
    if (isSubmissionLocked(ev, settings)) {
      return res.status(403).json({ error: 'Submission period has ended.' })
    }
    const existing = await Project.findOne({ teamId: team._id, eventId: ev._id })
    if (existing) return res.status(409).json({ error: 'Project already exists. Use PATCH to update.' })
    const b = req.body
    const categories = Array.isArray(b.categories) ? b.categories.map(String) : []
    const category =
      categories.length > 0 ? categories[0] : String(b.category || 'General')
    const doc = await Project.create({
      teamId: team._id,
      eventId: ev._id,
      title: String(b.title || '').trim(),
      tagline: String(b.tagline || '').trim(),
      description: String(b.description || '').trim(),
      coverUrl: String(b.coverUrl || '').trim(),
      videoUrl: String(b.videoUrl || '').trim(),
      githubUrl: String(b.githubUrl || '').trim(),
      demoUrl: String(b.demoUrl || '').trim(),
      techStack: Array.isArray(b.techStack) ? b.techStack : [],
      category,
      categories: categories.length ? categories : [category],
    })
    res.status(201).json({ id: doc._id.toString(), project: mapProjectDoc(doc, team) })
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Project exists.' })
    console.error(e)
    res.status(500).json({ error: 'Create failed.' })
  }
})

router.patch('/projects/:id', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  const p = await Project.findById(req.params.id)
  if (!p) return res.status(404).json({ error: 'Not found' })
  const team = await Team.findById(p.teamId)
  const memberIds = team?.memberIds?.map((x) => x.toString()) ?? []
  const isTeamMember =
    memberIds.includes(user._id.toString()) ||
    user.teamId?.toString() === p.teamId.toString()
  if (!isTeamMember && user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const ev = await HackathonEvent.findById(p.eventId)
  const settings = await getSettings()
  if (isSubmissionLocked(ev, settings) && user.role !== 'admin') {
    return res.status(403).json({ error: 'Submission period has ended; updates are locked.' })
  }
  const b = req.body
  const fields = [
    'title',
    'tagline',
    'description',
    'coverUrl',
    'videoUrl',
    'githubUrl',
    'demoUrl',
    'techStack',
    'category',
  ]
  for (const f of fields) {
    if (b[f] !== undefined) {
      if (f === 'techStack' && Array.isArray(b[f])) p[f] = b[f]
      else if (f !== 'techStack') p[f] = typeof b[f] === 'string' ? b[f].trim() : b[f]
    }
  }
  if (Array.isArray(b.categories)) {
    p.categories = b.categories.map(String)
    if (p.categories.length) p.category = p.categories[0]
  }
  await p.save()
  const teamDoc = await Team.findById(p.teamId)
  res.json({ project: mapProjectDoc(p, teamDoc) })
})

router.post('/teams', authMiddleware, requireAuth, async (req, res) => {
  await ensureLegacyTeamSync()
  const user = await User.findById(req.userId)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'team') return res.status(403).json({ error: 'Participant accounts only.' })
  const bodyEv = req.body.eventId
  let ev = null
  if (bodyEv && mongoose.isValidObjectId(String(bodyEv))) {
    ev = await HackathonEvent.findById(String(bodyEv))
  }
  if (!ev) ev = await resolveEvent(req)
  if (!ev) return res.status(400).json({ error: 'Select a hackathon first (or ask an admin to set a default event).' })
  const dup = await TeamMember.findOne({ userId: user._id, eventId: ev._id })
  if (dup) return res.status(400).json({ error: 'You already belong to a team in this hackathon.' })
  const name = String(req.body.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Team name required.' })
  const team = await Team.create({
    name,
    createdBy: user._id,
    eventId: ev._id,
    status: 'pending',
    memberIds: [user._id],
  })
  await TeamMember.create({ userId: user._id, teamId: team._id, eventId: ev._id })
  user.teamId = team._id
  await user.save()
  res.status(201).json({ teamId: team._id.toString() })
})

router.post('/teams/:teamId/members', authMiddleware, requireAuth, async (req, res) => {
  await ensureLegacyTeamSync()
  const actor = await User.findById(req.userId)
  if (!actor) return res.status(401).json({ error: 'Unauthorized' })
  const team = await Team.findById(req.params.teamId)
  if (!team) return res.status(404).json({ error: 'Team not found' })
  const uid = actor._id.toString()
  const isLead =
    team.createdBy.toString() === uid ||
    team.memberIds?.[0]?.toString() === uid ||
    team.memberIds?.some((m) => m.toString() === uid)
  if (!isLead && actor.role !== 'admin') {
    return res.status(403).json({ error: 'Only a team member can invite; lead must be on the team.' })
  }
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase()
  if (!email.includes('@')) return res.status(400).json({ error: 'Valid email required' })
  const invitee = await User.findOne({ email })
  if (!invitee) return res.status(404).json({ error: 'No account with that email. They must sign up first.' })
  if (invitee.role !== 'team') {
    return res.status(400).json({ error: 'That account is not a participant.' })
  }
  if (invitee.approvalStatus !== 'approved') {
    return res.status(400).json({ error: 'That participant is not approved yet.' })
  }
  const other = await TeamMember.findOne({ userId: invitee._id, eventId: team.eventId })
  if (other && !other.teamId.equals(team._id)) {
    return res.status(400).json({ error: 'That user is already on another team in this hackathon.' })
  }
  const ids = team.memberIds?.map((x) => x.toString()) ?? []
  if (ids.includes(invitee._id.toString())) {
    return res.status(409).json({ error: 'Already on this team.' })
  }
  if (ids.length >= 4) return res.status(400).json({ error: 'Team is full (max 4).' })
  team.memberIds = [...(team.memberIds || []), invitee._id]
  await team.save()
  await TeamMember.updateOne(
    { userId: invitee._id, eventId: team.eventId },
    { $set: { teamId: team._id } },
    { upsert: true },
  )
  invitee.teamId = team._id
  await invitee.save()
  res.json({ ok: true, memberCount: team.memberIds.length })
})

router.get('/teams/mine', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).lean()
  if (!user) return res.json({ team: null })
  let eventId = req.query.eventId ? String(req.query.eventId) : null
  if (!eventId) eventId = await defaultEventIdForProfile()
  let team = null
  if (eventId && mongoose.isValidObjectId(eventId)) {
    const m = await TeamMember.findOne({ userId: user._id, eventId }).lean()
    if (m?.teamId) team = await Team.findById(m.teamId).lean()
  }
  if (!team && user.teamId) {
    const t = await Team.findById(user.teamId).lean()
    if (t && (!eventId || t.eventId.toString() === eventId)) team = t
  }
  if (!team) return res.json({ team: null })
  const creator = await User.findById(team.createdBy).select('email fullName').lean()
  const memberIdList =
    team.memberIds?.length > 0 ? team.memberIds : [team.createdBy]
  const members = await User.find({ _id: { $in: memberIdList } })
    .select('email fullName role')
    .sort({ email: 1 })
    .lean()
  res.json({
    team: {
      id: team._id.toString(),
      name: team.name,
      status: team.status,
      creatorEmail: creator?.email ?? null,
      creatorName: creator?.fullName ?? null,
      members: members.map((m) => ({
        email: m.email,
        fullName: m.fullName || '',
        role: mapApiRole(m.role),
      })),
    },
  })
})

router.get('/admin/teams', authMiddleware, requireAuth, async (req, res) => {
  const admin = await User.findById(req.userId)
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  let ev = null
  const qe = req.query.eventId
  if (qe && mongoose.isValidObjectId(String(qe))) {
    ev = await HackathonEvent.findById(String(qe))
  }
  if (!ev) ev = await getCurrentEvent()
  if (!ev) {
    return res.json({
      teams: [],
      stats: { totalTeams: 0, totalTeamRoleUsers: 0, usersWithTeams: 0 },
    })
  }
  const teams = await Team.find({ eventId: ev._id }).sort({ createdAt: -1 }).lean()
  const teamIds = teams.map((t) => t._id)
  const creatorIds = teams.map((t) => t.createdBy).filter(Boolean)
  const memberUserIds = [
    ...new Set(
      teams.flatMap((t) => {
        const ids = t.memberIds?.length ? t.memberIds : [t.createdBy]
        return ids.map((id) => id.toString())
      }),
    ),
  ]
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(id))
  const [users, projects, creators] = await Promise.all([
    User.find({
      $or: [{ teamId: { $in: teamIds } }, { _id: { $in: memberUserIds } }],
      role: 'team',
    }).lean(),
    Project.find({ teamId: { $in: teamIds } }).lean(),
    User.find({ _id: { $in: creatorIds } }).lean(),
  ])
  const creatorById = new Map(creators.map((c) => [c._id.toString(), c]))
  const projByTeam = new Map(projects.map((p) => [p.teamId.toString(), p]))
  const userById = new Map(users.map((u) => [u._id.toString(), u]))
  const out = teams.map((t) => {
    const tid = t._id.toString()
    const creator = creatorById.get(t.createdBy?.toString())
    const proj = projByTeam.get(tid)
    const mid = (t.memberIds?.length ? t.memberIds : [t.createdBy]).map((x) => x.toString())
    const mems = mid.map((id) => userById.get(id)).filter(Boolean)
    return {
      id: tid,
      name: t.name,
      status: t.status,
      creatorEmail: creator?.email ?? null,
      creatorName: creator?.fullName ?? null,
      projectTitle: proj?.title ?? '—',
      members: mems.map((m) => ({
        id: m._id.toString(),
        email: m.email,
        fullName: m.fullName || '',
        role: mapApiRole(m.role),
      })),
    }
  })
  const totalTeamRoleUsers = await User.countDocuments({ role: 'team' })
  const usersWithTeams = await User.countDocuments({ teamId: { $ne: null } })
  res.json({
    teams: out,
    stats: {
      totalTeams: teams.length,
      totalTeamRoleUsers,
      usersWithTeams,
    },
  })
})

router.get('/admin/pending', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const list = await User.find({
    approvalStatus: 'pending',
    role: { $in: ['team', 'judge'] },
  })
    .sort({ email: 1 })
    .lean()
  res.json({
    profiles: list.map((u) => toProfile(u)),
  })
})

router.post('/admin/approve/:userId', authMiddleware, requireAuth, async (req, res) => {
  const admin = await User.findById(req.userId)
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const u = await User.findById(req.params.userId)
  if (!u) return res.status(404).json({ error: 'Not found' })
  u.approvalStatus = 'approved'
  await u.save()
  if (u.teamId) {
    await Team.updateOne({ _id: u.teamId }, { status: 'approved' })
  }
  const eventId = await defaultEventIdForProfile()
  res.json({ ok: true, user: await buildProfile(u, eventId) })
})

/** Admin-only user detail (passwords are never returned — only whether one is set). */
router.get('/admin/users/:userId', authMiddleware, requireAuth, async (req, res) => {
  const admin = await User.findById(req.userId)
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({ error: 'Invalid user id' })
  }
  const u = await User.findById(req.params.userId).lean()
  if (!u) return res.status(404).json({ error: 'Not found' })
  const eventId = await defaultEventIdForProfile()
  const tm = eventId
    ? await TeamMember.findOne({ userId: u._id, eventId }).lean()
    : null
  res.json({
    user: {
      ...baseProfileFields(u),
      team_id: tm?.teamId?.toString() ?? (u.teamId ? u.teamId.toString() : null),
      createdAt: u.createdAt ? u.createdAt.toISOString() : null,
      updatedAt: u.updatedAt ? u.updatedAt.toISOString() : null,
      /** bcrypt only — show in UI as “configured / not set”, never the secret. */
      app_password_configured: Boolean(u.passwordHash && String(u.passwordHash).length > 0),
    },
  })
})

router.post('/admin/judge-invite', authMiddleware, requireAuth, async (req, res) => {
  const admin = await User.findById(req.userId)
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase()
  if (!email.includes('@')) return res.status(400).json({ error: 'Invalid email' })
  const s = await getSettings()
  const id = `inv-${Date.now()}`
  const exists = s.invitedJudges?.some((j) => j.email === email)
  if (!exists) {
    s.invitedJudges = [...(s.invitedJudges || []), { id, email, status: 'invited' }]
    await s.save()
  }
  const existing = await User.findOne({ email })
  if (existing && existing.role !== 'judge') {
    return res.status(409).json({
      error:
        'Email already belongs to a non-judge account. Delete that account first before assigning judge role.',
    })
  }
  res.json({ ok: true, invitedJudges: s.invitedJudges })
})

router.get('/admin/invited-judges', authMiddleware, requireAuth, async (req, res) => {
  const admin = await User.findById(req.userId)
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const s = await getSettings()
  res.json({ invitedJudges: s.invitedJudges || [] })
})

router.get('/admin/email-stats', authMiddleware, requireAuth, async (req, res) => {
  const admin = await User.findById(req.userId)
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const s = await getSettings()
  const allowed = s.allowedEmails || []
  const registered = await User.find({ email: { $in: allowed } }).select('email').lean()
  const regSet = new Set(registered.map((u) => u.email))
  const registeredEmails = allowed.filter((e) => regSet.has(e))
  const notRegistered = allowed.filter((e) => !regSet.has(e))
  const allUsers = await User.find()
    .select('email role approvalStatus')
    .sort({ email: 1 })
    .lean()
  res.json({
    totalAllowed: allowed.length,
    registeredCount: registeredEmails.length,
    notRegisteredCount: notRegistered.length,
    registeredEmails,
    notRegisteredEmails: notRegistered.slice(0, 100),
    allAccounts: allUsers.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      role: mapApiRole(u.role),
      approvalStatus: u.approvalStatus,
    })),
  })
})

router.get('/scores/map', authMiddleware, requireAuth, async (req, res) => {
  const ev = await resolveEvent(req)
  if (!ev) return res.json({ scores: {} })
  const eventProjects = await Project.find({ eventId: ev._id }).select('_id').lean()
  const eventProjectIds = eventProjects.map((p) => p._id)
  if (eventProjectIds.length === 0) return res.json({ scores: {} })
  const scores = await Score.find({ projectId: { $in: eventProjectIds } }).lean()
  const judgeIds = [...new Set(scores.map((s) => s.judgeId.toString()))]
  const judges = await User.find({ _id: { $in: judgeIds } }).lean()
  const nameByJudge = new Map(
    judges.map((j) => [
      j._id.toString(),
      j.fullName || j.email || 'Judge',
    ]),
  )
  const byProject = new Map()
  for (const s of scores) {
    const pid = s.projectId.toString()
    const cur = byProject.get(pid) || { totals: [], feedback: [] }
    cur.totals.push(Number(s.total))
    cur.feedback.push({
      judge: nameByJudge.get(s.judgeId.toString()) || 'Judge',
      score: Math.round(Number(s.total) * 10) / 10,
      comment: s.comment || '',
    })
    byProject.set(pid, cur)
  }
  const out = {}
  for (const [pid, v] of byProject) {
    const avg = v.totals.length
      ? v.totals.reduce((a, b) => a + b, 0) / v.totals.length
      : 0
    out[pid] = {
      total: Math.round(avg * 10) / 10,
      byJudge: v.feedback,
    }
  }
  res.json({ scores: out })
})

router.get('/scores/me', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user || (user.role !== 'judge' && user.role !== 'admin')) {
    return res.json({ scores: [] })
  }
  const rows = await Score.find({ judgeId: user._id }).lean()
  res.json({
    scores: rows.map((r) => ({
      project_id: r.projectId.toString(),
      criterion_scores: r.criterionScores || {},
      comment: r.comment,
    })),
  })
})

router.post('/scores/upsert', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user || (user.role !== 'judge' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Judges only' })
  }
  const projectId = req.body.projectId
  if (!mongoose.isValidObjectId(projectId)) {
    return res.status(400).json({ error: 'Invalid project' })
  }
  const criterionScores = req.body.criterionScores && typeof req.body.criterionScores === 'object'
    ? req.body.criterionScores
    : {}
  const comment = String(req.body.comment || '')
  const total = Number(req.body.total) || 0
  await Score.findOneAndUpdate(
    { projectId, judgeId: user._id },
    {
      $set: {
        criterionScores,
        comment,
        total,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  )
  res.json({ ok: true })
})

router.patch('/admin/invited-judges/:jid', authMiddleware, requireAuth, async (req, res) => {
  const admin = await User.findById(req.userId)
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const status = req.body.status
  if (status !== 'invited' && status !== 'accepted') {
    return res.status(400).json({ error: 'Invalid status' })
  }
  const s = await getSettings()
  const jid = req.params.jid
  let found = false
  s.invitedJudges = (s.invitedJudges || []).map((j) => {
    if (j.id === jid) {
      found = true
      return { id: j.id, email: j.email, status }
    }
    return j
  })
  if (!found) return res.status(404).json({ error: 'Not found' })
  await s.save()
  res.json({ invitedJudges: s.invitedJudges })
})

export default router
