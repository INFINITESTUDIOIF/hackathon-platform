import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: '' },
    fullName: { type: String, default: '' },
    role: {
      type: String,
      enum: ['admin', 'judge', 'team'],
      default: 'team',
    },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    googleVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
)

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'HackathonEvent', required: true },
  },
  { timestamps: true },
)

const projectSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'HackathonEvent', required: true },
    title: { type: String, required: true, trim: true },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    githubUrl: { type: String, default: '' },
    demoUrl: { type: String, default: '' },
    techStack: { type: [String], default: [] },
    category: { type: String, default: 'General' },
    categories: { type: [String], default: [] },
  },
  { timestamps: true },
)

projectSchema.index({ teamId: 1 }, { unique: true })

const rubricCriterionSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    description: String,
    maxPoints: Number,
    weightPercent: Number,
  },
  { _id: false },
)

const hackathonEventSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Spring Build 2026' },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    bannerDataUrl: { type: String, default: null },
    submissionStart: { type: String, default: '' },
    submissionEnd: { type: String, default: '' },
    judgingStart: { type: String, default: '' },
    winnerAnnouncement: { type: String, default: '' },
    autoLock: { type: Boolean, default: true },
    rubric: { type: [rubricCriterionSchema], default: [] },
    tracks: { type: [String], default: [] },
  },
  { timestamps: true },
)

const invitedJudgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    status: { type: String, enum: ['invited', 'accepted'], default: 'invited' },
  },
  { _id: false },
)

const adminEntrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
  },
  { _id: false },
)

const appSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'main' },
    leaderboardVisibility: {
      type: String,
      enum: ['admin_only', 'judges_only', 'public'],
      default: 'admin_only',
    },
    winnerAnnouncedAt: { type: Date, default: null },
    allowedEmails: { type: [String], default: [] },
    currentEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'HackathonEvent', default: null },
    invitedJudges: { type: [invitedJudgeSchema], default: [] },
    extraAdmins: { type: [adminEntrySchema], default: [] },
  },
)

const scoreSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    judgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    criterionScores: { type: Object, default: {} },
    comment: { type: String, default: '' },
    total: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

scoreSchema.index({ projectId: 1, judgeId: 1 }, { unique: true })

export const User = mongoose.model('User', userSchema)
export const Team = mongoose.model('Team', teamSchema)
export const Project = mongoose.model('Project', projectSchema)
export const HackathonEvent = mongoose.model('HackathonEvent', hackathonEventSchema)
export const AppSettings = mongoose.model('AppSettings', appSettingsSchema)
export const Score = mongoose.model('Score', scoreSchema)
