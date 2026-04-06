import { Router } from 'express'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import {
  User,
  Team,
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

function toProfile(u) {
  if (!u) return null
  return {
    id: u._id.toString(),
    email: u.email,
    full_name: u.fullName || null,
    role: u.role,
    team_id: u.teamId ? u.teamId.toString() : null,
    approval_status: u.approvalStatus,
  }
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
    if (!email.includes('@') || password.length < 6) {
      return res.status(400).json({ error: 'Valid email and password (6+ chars) required.' })
    }
    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ error: 'Email already registered.' })
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
      passwordHash,
      fullName,
      role,
      approvalStatus: role === 'admin' || onAllowList ? 'approved' : 'pending',
    })
    const token = signToken(user._id.toString())
    res.json({ token, user: toProfile(user) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Registration failed.' })
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
    res.json({ token, user: toProfile(user) })
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
    res.json({ token, user: toProfile(user) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Login failed.' })
  }
})

router.get('/auth/me', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user) return res.status(404).json({ error: 'Not found' })
  res.json({ user: toProfile(user) })
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
    res.json({ user: toProfile(user) })
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

router.get('/events/current', async (_req, res) => {
  const ev = await getCurrentEvent()
  if (!ev) return res.json({ event: null })
  res.json({
    event: {
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
      rubric: ev.rubric,
      tracks: ev.tracks,
    },
  })
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
    'rubric',
    'tracks',
  ]
  for (const f of fields) {
    if (b[f] !== undefined) ev[f] = b[f]
  }
  await ev.save()
  res.json({
    event: {
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
      rubric: ev.rubric,
      tracks: ev.tracks,
    },
  })
})

router.get('/projects', authMiddleware, requireAuth, async (req, res) => {
  const projects = await Project.find().lean()
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
  const projects = await Project.find().lean()
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
  const ev = await getCurrentEvent()
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
  const p = await Project.findOne({ teamId: tid }).lean()
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
    if (!user?.teamId) return res.status(400).json({ error: 'Create a team first.' })
    const team = await Team.findById(user.teamId)
    if (!team) return res.status(400).json({ error: 'Team not found.' })
    const ev = await getCurrentEvent()
    if (!ev) return res.status(400).json({ error: 'No active event.' })
    const settings = await getSettings()
    if (isSubmissionLocked(ev, settings)) {
      return res.status(403).json({ error: 'Submission period has ended.' })
    }
    const existing = await Project.findOne({ teamId: user.teamId })
    if (existing) return res.status(409).json({ error: 'Project already exists. Use PATCH to update.' })
    const b = req.body
    const categories = Array.isArray(b.categories) ? b.categories.map(String) : []
    const category =
      categories.length > 0 ? categories[0] : String(b.category || 'General')
    const doc = await Project.create({
      teamId: user.teamId,
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
  if (user.teamId?.toString() !== p.teamId.toString() && user.role !== 'admin') {
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
  const team = await Team.findById(p.teamId)
  res.json({ project: mapProjectDoc(p, team) })
})

router.post('/teams', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.teamId) return res.status(400).json({ error: 'Already in a team.' })
  const ev = await getCurrentEvent()
  if (!ev) return res.status(400).json({ error: 'No active event.' })
  const name = String(req.body.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Team name required.' })
  const team = await Team.create({
    name,
    createdBy: user._id,
    eventId: ev._id,
    status: 'pending',
  })
  user.teamId = team._id
  await user.save()
  res.status(201).json({ teamId: team._id.toString() })
})

router.get('/teams/mine', authMiddleware, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).lean()
  if (!user?.teamId) return res.json({ team: null })
  const team = await Team.findById(user.teamId).lean()
  if (!team) return res.json({ team: null })
  const creator = await User.findById(team.createdBy).select('email fullName').lean()
  const members = await User.find({ teamId: user.teamId })
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
        role: m.role,
      })),
    },
  })
})

router.get('/admin/teams', authMiddleware, requireAuth, async (req, res) => {
  const admin = await User.findById(req.userId)
  if (!admin || admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const teams = await Team.find().sort({ createdAt: -1 }).lean()
  const teamIds = teams.map((t) => t._id)
  const creatorIds = teams.map((t) => t.createdBy).filter(Boolean)
  const [users, projects, creators] = await Promise.all([
    User.find({ teamId: { $in: teamIds } }).lean(),
    Project.find({ teamId: { $in: teamIds } }).lean(),
    User.find({ _id: { $in: creatorIds } }).lean(),
  ])
  const creatorById = new Map(creators.map((c) => [c._id.toString(), c]))
  const projByTeam = new Map(projects.map((p) => [p.teamId.toString(), p]))
  const usersByTeam = new Map()
  for (const u of users) {
    const tid = u.teamId?.toString()
    if (!tid) continue
    const arr = usersByTeam.get(tid) ?? []
    arr.push(u)
    usersByTeam.set(tid, arr)
  }
  const out = teams.map((t) => {
    const tid = t._id.toString()
    const creator = creatorById.get(t.createdBy?.toString())
    const proj = projByTeam.get(tid)
    const mems = usersByTeam.get(tid) ?? []
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
        role: m.role,
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
  res.json({ ok: true, user: toProfile(u) })
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
  if (existing && existing.role === 'team') {
    existing.role = 'judge'
    existing.approvalStatus = 'pending'
    await existing.save()
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
      email: u.email,
      role: u.role,
      approvalStatus: u.approvalStatus,
    })),
  })
})

router.get('/scores/map', authMiddleware, requireAuth, async (req, res) => {
  const scores = await Score.find().lean()
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
