import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import {
  User,
  Team,
  TeamMember,
  Project,
  HackathonEvent,
  AppSettings,
  Score,
} from './models.js'

/**
 * 50 addresses: infinite.content13011–13019, then infinite.content130110–130150
 * (matches requested pattern like infinite.content130110@gmail.com)
 */
function allowedGmails() {
  const out = []
  for (let n = 11; n <= 19; n++) {
    out.push(`infinite.content130${n}@gmail.com`)
  }
  for (let n = 110; n <= 150; n++) {
    out.push(`infinite.content130${n}@gmail.com`)
  }
  return out
}

const defaultRubric = [
  { id: 'r1', name: 'Innovation', description: 'Novelty and creative problem-solving.', maxPoints: 10, weightPercent: 25 },
  { id: 'r2', name: 'Design', description: 'UX, UI, and polish.', maxPoints: 10, weightPercent: 25 },
  { id: 'r3', name: 'Impact', description: 'Usefulness and potential reach.', maxPoints: 10, weightPercent: 25 },
  { id: 'r4', name: 'Execution', description: 'Working demo and technical quality.', maxPoints: 10, weightPercent: 25 },
]

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('Set MONGODB_URI')
    process.exit(1)
  }
  await mongoose.connect(uri)
  console.log('Connected. Seeding…')

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@jury.hackathon').toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  let event = await HackathonEvent.findOne().sort({ createdAt: 1 })
  if (!event) {
    event = await HackathonEvent.create({
      name: 'Spring Build 2026',
      tagline: 'Ship ideas that matter.',
      description: 'A weekend for builders — open tracks, fair judging, and live leaderboard.',
      bannerDataUrl: null,
      submissionStart: '2026-04-01',
      submissionEnd: '2026-04-30',
      judgingStart: '2026-04-02',
      winnerAnnouncement: '2026-04-03',
      autoLock: true,
      scoringMode: 'rubric',
      rubric: defaultRubric,
      tracks: ['FinTech', 'Healthcare', 'AI/ML', 'DevTools', 'Sustainability', 'Web Dev', 'App Dev', 'Blockchain'],
      lifecycleStatus: 'active',
    })
  }

  let settings = await AppSettings.findById('main')
  if (!settings) {
    settings = await AppSettings.create({
      _id: 'main',
      leaderboardVisibility: 'admin_only',
      winnerAnnouncedAt: null,
      allowedEmails: allowedGmails(),
      currentEventId: event._id,
      invitedJudges: [],
      extraAdmins: [],
    })
  } else {
    const merged = new Set([...(settings.allowedEmails || []), ...allowedGmails()])
    settings.allowedEmails = Array.from(merged).sort()
    if (!settings.currentEventId) settings.currentEventId = event._id
    await settings.save()
  }

  let admin = await User.findOne({ email: adminEmail })
  const hash = await bcrypt.hash(adminPassword, 10)
  if (!admin) {
    admin = await User.create({
      email: adminEmail,
      username: 'admin',
      passwordHash: hash,
      fullName: 'Organizer',
      role: 'admin',
      approvalStatus: 'approved',
    })
    console.log('Created admin:', adminEmail)
  } else {
    admin.passwordHash = hash
    admin.role = 'admin'
    admin.approvalStatus = 'approved'
    if (!admin.username) admin.username = 'admin'
    await admin.save()
    console.log('Updated admin:', adminEmail)
  }

  console.log('Allowed emails count:', settings.allowedEmails.length)
  console.log('Current event:', event.name, event._id.toString())

  await seedDemoAccounts(event)

  await mongoose.disconnect()
  console.log('Done.')
}

/** Shared password for seeded demo logins (change in production). */
const DEMO_PASS = 'DemoPass123!'

async function ensureUsername(email, hint) {
  const base = String(hint || email.split('@')[0] || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20) || 'user'
  let candidate = base
  let n = 0
  while (await User.findOne({ username: candidate })) {
    n += 1
    candidate = `${base.slice(0, 16)}_${n}`
  }
  return candidate
}

async function seedDemoAccounts(event) {
  const demoHash = await bcrypt.hash(DEMO_PASS, 10)
  const allowed = allowedGmails()

  // Create temporary-but-real team accounts for all allowed Gmail IDs
  // so full account list/testing is immediately available.
  for (const email of allowed) {
    const existing = await User.findOne({ email })
    if (!existing) {
      const username = await ensureUsername(email)
      await User.create({
        email,
        username,
        passwordHash: demoHash,
        fullName: email.split('@')[0],
        role: 'team',
        approvalStatus: 'approved',
      })
    } else if (!existing.username) {
      existing.username = await ensureUsername(email)
      await existing.save()
    }
  }

  const judgeEmail = (process.env.DEMO_JUDGE_EMAIL || 'judge.demo@hackathon.local').toLowerCase()
  let judge = await User.findOne({ email: judgeEmail })
  if (!judge) {
    judge = await User.create({
      email: judgeEmail,
      username: await ensureUsername(judgeEmail, 'demo_judge'),
      passwordHash: demoHash,
      fullName: 'Demo Judge',
      role: 'judge',
      approvalStatus: 'approved',
    })
    console.log('Demo judge:', judgeEmail, '/', DEMO_PASS)
  } else {
    judge.passwordHash = demoHash
    judge.role = 'judge'
    judge.approvalStatus = 'approved'
    judge.teamId = null
    if (!judge.username) judge.username = await ensureUsername(judgeEmail, 'demo_judge')
    await judge.save()
  }

  const leadEmail = 'infinite.content13011@gmail.com'
  let lead = await User.findOne({ email: leadEmail })
  if (!lead) return
  lead.passwordHash = demoHash
  lead.fullName = lead.fullName || 'Team Lead (demo)'
  lead.role = 'team'
  lead.approvalStatus = 'approved'
  if (!lead.username) lead.username = await ensureUsername(leadEmail, 'lead_demo')
  await lead.save()

  let team =
    (await Team.findOne({ createdBy: lead._id })) ||
    (lead.teamId ? await Team.findById(lead.teamId) : null)
  if (!team) {
    team = await Team.create({
      name: 'Demo Builders',
      createdBy: lead._id,
      eventId: event._id,
      status: 'approved',
      memberIds: [lead._id],
    })
    lead.teamId = team._id
    await lead.save()
    await TeamMember.updateOne(
      { userId: lead._id, eventId: event._id },
      { $set: { teamId: team._id } },
      { upsert: true },
    )
    console.log('Demo team + project seed')
  } else {
    if (!team.memberIds?.length) {
      team.memberIds = [lead._id]
      await team.save()
    }
    await TeamMember.updateOne(
      { userId: lead._id, eventId: event._id },
      { $set: { teamId: team._id } },
      { upsert: true },
    )
  }

  const mateEmail = 'infinite.content13012@gmail.com'
  let mate = await User.findOne({ email: mateEmail })
  if (mate) {
    mate.passwordHash = demoHash
    mate.fullName = mate.fullName || 'Teammate (demo)'
    mate.role = 'team'
    mate.approvalStatus = 'approved'
    if (!mate.username) mate.username = await ensureUsername(mateEmail, 'mate_demo')
    if (!mate.teamId) mate.teamId = team._id
    await mate.save()
    if (!team.memberIds?.some((id) => id.equals(mate._id))) {
      if ((team.memberIds?.length || 0) < 4) {
        team.memberIds = [...(team.memberIds || []), mate._id]
        await team.save()
      }
    }
    await TeamMember.updateOne(
      { userId: mate._id, eventId: event._id },
      { $set: { teamId: team._id } },
      { upsert: true },
    )
  }

  let proj = await Project.findOne({ teamId: team._id })
  if (!proj) {
    proj = await Project.create({
      teamId: team._id,
      eventId: event._id,
      title: 'TITLR',
      tagline: 'Demo submission — scores from judges appear on the leaderboard.',
      description: 'Seeded project so the feed and leaderboard show real DB data.',
      coverUrl: '',
      videoUrl: '',
      githubUrl: 'https://github.com',
      demoUrl: 'https://example.com',
      techStack: ['React', 'MongoDB', 'Express'],
      category: 'Web Dev',
      categories: ['Web Dev', 'AI/ML'],
    })
  }

  if (judge && proj) {
    await Score.findOneAndUpdate(
      { projectId: proj._id, judgeId: judge._id },
      {
        $set: {
          total: 8.7,
          comment: 'Seeded score — add more judges in the app for averages.',
          criterionScores: { r1: 9, r2: 8, r3: 9, r4: 9 },
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    )
  }

  const extraTeams = [
    [13, 'Code Crushers', 'MedAssist', 'Triage ideas for rural clinics.', 7.2],
    [14, 'Pixel Pioneers', 'ShopLocal', 'Hyperlocal storefronts in one app.', 6.5],
    [15, 'Byte Bandits', 'LearnLoop', 'Adaptive study paths for exams.', 8.1],
    [16, 'Stack Syndicate', 'GreenRoute', 'Lower-carbon commuting planner.', 5.9],
    [17, 'Logic Labs', 'SafePay', 'Fraud signals for small merchants.', 7.8],
    [18, 'Cloud Crew', 'EventHub', 'Campus events + RSVPs.', 6.2],
  ]

  // Match the “polished demo” leaderboard names so Admin/Judge/Leaderboard are identical in DB mode.
  const showcase = [
    [111, 'Vector Labs', 'SynthMarket — v24', 'Composable markets with clean UX.', 9.5],
    [112, 'Mint Collective', 'Ledgerly — v14', 'Real-time treasury for student orgs.', 9.3],
    [113, 'Vector Labs', 'SynthMarket — v18', 'Fast iterations, stable execution.', 9.3],
    [114, 'Studio 404', 'EchoNotes', 'Meeting notes that actually ship tasks.', 9.0],
  ]

  for (const [num, tname, ptitle, ptag, total] of [...extraTeams, ...showcase]) {
    const em = `infinite.content130${num}@gmail.com`
    let u = await User.findOne({ email: em })
    if (!u) {
      u = await User.create({
        email: em,
        username: await ensureUsername(em, `lead_${num}`),
        passwordHash: demoHash,
        fullName: `Lead ${num}`,
        role: 'team',
        approvalStatus: 'approved',
      })
    } else if (!u.username) {
      u.username = await ensureUsername(em, `lead_${num}`)
      await u.save()
    }
    let tm =
      (await Team.findOne({ createdBy: u._id })) ||
      (u.teamId ? await Team.findById(u.teamId) : null)
    if (!tm) {
      tm = await Team.create({
        name: tname,
        createdBy: u._id,
        eventId: event._id,
        status: 'approved',
        memberIds: [u._id],
      })
      u.teamId = tm._id
      await u.save()
      await TeamMember.updateOne(
        { userId: u._id, eventId: event._id },
        { $set: { teamId: tm._id } },
        { upsert: true },
      )
    } else if (tm.status !== 'approved') {
      tm.status = 'approved'
      await tm.save()
    }
    if (!tm.memberIds?.length) {
      tm.memberIds = [u._id]
      await tm.save()
    }
    await TeamMember.updateOne(
      { userId: u._id, eventId: event._id },
      { $set: { teamId: tm._id } },
      { upsert: true },
    )
    let pr = await Project.findOne({ teamId: tm._id })
    if (!pr) {
      pr = await Project.create({
        teamId: tm._id,
        eventId: event._id,
        title: ptitle,
        tagline: ptag,
        description: `Seeded submission for leaderboard variety (${tname}).`,
        coverUrl: '',
        videoUrl: '',
        githubUrl: 'https://github.com',
        demoUrl: 'https://example.com',
        techStack: ['React', 'Node'],
        category: 'Web Dev',
        categories: ['Web Dev'],
      })
    }
    if (judge && pr) {
      const t = Number(total)
      const rounded = Math.round(t * 10) / 10
      await Score.findOneAndUpdate(
        { projectId: pr._id, judgeId: judge._id },
        {
          $set: {
            total: rounded,
            comment: `Seeded demo score (${rounded}).`,
            criterionScores: {
              r1: Math.min(10, rounded + 0.5),
              r2: rounded,
              r3: Math.min(10, rounded + 0.3),
              r4: Math.max(0, rounded - 0.3),
            },
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      )
    }
  }

  const waitEmail = 'infinite.content13019@gmail.com'
  let waitUser = await User.findOne({ email: waitEmail })
  if (!waitUser) {
    waitUser = await User.create({
      email: waitEmail,
      passwordHash: demoHash,
      fullName: 'Waitlist Lead',
      role: 'team',
      approvalStatus: 'approved',
    })
  }
  let waitTeam =
    (await Team.findOne({ createdBy: waitUser._id })) ||
    (waitUser.teamId ? await Team.findById(waitUser.teamId) : null)
  if (!waitTeam) {
    waitTeam = await Team.create({
      name: 'Waitlist Warriors',
      createdBy: waitUser._id,
      eventId: event._id,
      status: 'pending',
    })
    waitUser.teamId = waitTeam._id
    await waitUser.save()
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
