import type { Project } from '../data/mock'
import type { LeaderboardVisibility, ProfileRow } from './supabaseApi'
import type { EventSetup, InvitedJudge } from '../types/event'
import { API_URL } from '../config/api'

const TOKEN_KEY = 'hackathon_token'

export function getApiToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setApiToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const t = getApiToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  }
  if (t) headers.Authorization = `Bearer ${t}`
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return data as T
}

export async function mongoLogin(email: string, password: string) {
  const data = await apiFetch<{ token: string; user: ProfileRow }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  )
  setApiToken(data.token)
  return data.user
}

export async function mongoRegister(
  email: string,
  password: string,
  fullName: string,
) {
  const data = await apiFetch<{ token: string; user: ProfileRow }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    },
  )
  setApiToken(data.token)
  return data.user
}

/** After Google OAuth (Supabase session), create/update Mongo user and store API JWT. */
export async function mongoSupabaseOAuthSync(accessToken: string) {
  const data = await apiFetch<{ token: string; user: ProfileRow }>(
    '/api/auth/supabase-sync',
    {
      method: 'POST',
      body: JSON.stringify({ access_token: accessToken }),
    },
  )
  setApiToken(data.token)
  return data.user
}

export async function mongoSetPassword(payload: {
  password: string
  fullName?: string
}) {
  const data = await apiFetch<{ user: ProfileRow }>('/api/auth/set-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.user
}

export async function mongoGoogleProfileSync(body: {
  email: string
  name?: string
}) {
  return apiFetch<{ user: ProfileRow }>('/api/auth/google-profile', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function mongoFetchMe(): Promise<ProfileRow | null> {
  try {
    const data = await apiFetch<{ user: ProfileRow }>('/api/auth/me')
    return data.user
  } catch {
    return null
  }
}

export async function fetchAppSettingsMongo(): Promise<{
  id: number
  leaderboard_visibility: LeaderboardVisibility
  winner_announced_at: string | null
} | null> {
  try {
    const data = await apiFetch<{
      leaderboard_visibility: LeaderboardVisibility
      winner_announced_at: string | null
    }>('/api/settings')
    return {
      id: 1,
      leaderboard_visibility: data.leaderboard_visibility,
      winner_announced_at: data.winner_announced_at,
    }
  } catch {
    return null
  }
}

export async function updateAppSettingsMongo(patch: {
  leaderboard_visibility?: LeaderboardVisibility
  winner_announced_at?: string | null
}) {
  await apiFetch('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function fetchCurrentEventMongo(): Promise<EventSetup | null> {
  try {
    const data = await apiFetch<{ event: Record<string, unknown> | null }>(
      '/api/events/current',
    )
    const e = data.event
    if (!e) return null
    return {
      name: String(e.name ?? ''),
      tagline: String(e.tagline ?? ''),
      description: String(e.description ?? ''),
      bannerDataUrl: (e.bannerDataUrl as string | null) ?? null,
      submissionStart: String(e.submissionStart ?? ''),
      submissionEnd: String(e.submissionEnd ?? ''),
      judgingStart: String(e.judgingStart ?? ''),
      winnerAnnouncement: String(e.winnerAnnouncement ?? ''),
      autoLock: Boolean(e.autoLock),
      scoringMode: (e.scoringMode as EventSetup['scoringMode']) ?? 'rubric',
      rubric: Array.isArray(e.rubric) ? (e.rubric as EventSetup['rubric']) : [],
      tracks: Array.isArray(e.tracks) ? (e.tracks as string[]) : [],
    }
  } catch {
    return null
  }
}

export async function saveCurrentEventMongo(setup: EventSetup) {
  await apiFetch('/api/events/current', {
    method: 'PUT',
    body: JSON.stringify(setup),
  })
}

export async function fetchFeedProjectsMongo(): Promise<Project[]> {
  const data = await apiFetch<{ projects: Project[] }>('/api/projects')
  return data.projects ?? []
}

export async function fetchAllProjectsLeaderboardMongo(): Promise<Project[]> {
  const data = await apiFetch<{ projects: Project[] }>('/api/projects/all')
  return data.projects ?? []
}

export type LeaderboardAwaitingRow = {
  teamId: string
  teamName: string
  teamStatus: string
  reason: 'pending_approval' | 'no_submission'
}

export async function fetchLeaderboardAwaitingMongo(): Promise<
  LeaderboardAwaitingRow[]
> {
  const data = await apiFetch<{ rows: LeaderboardAwaitingRow[] }>(
    '/api/leaderboard/awaiting',
  )
  return data.rows ?? []
}

export async function fetchProjectForTeamMongo(
  teamId: string,
): Promise<Project | null> {
  const data = await apiFetch<{ project: Project | null }>(
    `/api/projects/by-team/${teamId}`,
  )
  return data.project
}

export async function fetchProjectByIdMongo(id: string): Promise<Project | null> {
  const data = await apiFetch<{ project: Project }>(`/api/projects/${id}`)
  return data.project ?? null
}

export async function submitProjectMongo(payload: {
  teamId: string
  title: string
  tagline: string
  description: string
  coverUrl: string
  videoUrl: string
  githubUrl: string
  demoUrl: string
  techStack: string[]
  category: string
  categories?: string[]
}) {
  const { teamId: _t, ...body } = payload
  const data = await apiFetch<{ id: string }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return data.id
}

export async function updateProjectMongo(
  projectId: string,
  payload: Record<string, unknown>,
) {
  await apiFetch(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function createTeamMongo(name: string): Promise<string> {
  const data = await apiFetch<{ teamId: string }>('/api/teams', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return data.teamId
}

export async function approveProfileMongo(userId: string) {
  await apiFetch(`/api/admin/approve/${userId}`, { method: 'POST' })
}

export async function fetchPendingProfilesMongo(): Promise<ProfileRow[]> {
  const data = await apiFetch<{ profiles: ProfileRow[] }>(
    '/api/admin/pending',
  )
  return data.profiles ?? []
}

export async function promoteEmailToJudgeMongo(email: string) {
  await apiFetch('/api/admin/judge-invite', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function fetchInvitedJudgesMongo(): Promise<InvitedJudge[]> {
  const data = await apiFetch<{ invitedJudges: InvitedJudge[] }>(
    '/api/admin/invited-judges',
  )
  return data.invitedJudges ?? []
}

export async function updateInvitedJudgeStatusMongo(
  id: string,
  status: InvitedJudge['status'],
) {
  const data = await apiFetch<{ invitedJudges: InvitedJudge[] }>(
    `/api/admin/invited-judges/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  )
  return data.invitedJudges ?? []
}

export type AdminTeamRow = {
  id: string
  name: string
  status: string
  creatorEmail: string | null
  creatorName: string | null
  projectTitle: string
  members: {
    id: string
    email: string
    fullName: string
    role: string
  }[]
}

export async function fetchAdminTeamsMongo() {
  return apiFetch<{
    teams: AdminTeamRow[]
    stats: {
      totalTeams: number
      totalTeamRoleUsers: number
      usersWithTeams: number
    }
  }>('/api/admin/teams')
}

export type MyTeamDetail = {
  id: string
  name: string
  status: string
  creatorEmail: string | null
  creatorName: string | null
  members: { email: string; fullName: string; role: string }[]
}

export async function fetchMyTeamDetailMongo() {
  return apiFetch<{ team: MyTeamDetail | null }>('/api/teams/mine')
}

export async function fetchEmailStatsMongo() {
  return apiFetch<{
    totalAllowed: number
    registeredCount: number
    notRegisteredCount: number
    registeredEmails: string[]
    notRegisteredEmails: string[]
    allAccounts?: { email: string; role: string; approvalStatus: string }[]
  }>('/api/admin/email-stats')
}

export async function fetchScoresMapMongo() {
  const data = await apiFetch<{
    scores: Record<
      string,
      { total: number; byJudge: { judge: string; score: number; comment: string }[] }
    >
  }>('/api/scores/map')
  const m = new Map<
    string,
    { total: number; byJudge: { judge: string; score: number; comment: string }[] }
  >()
  for (const [k, v] of Object.entries(data.scores ?? {})) {
    m.set(k, v)
  }
  return m
}

export async function upsertJudgeScoreMongo(payload: {
  projectId: string
  judgeId: string
  criterionScores: Record<string, number>
  comment: string
  total: number
}) {
  await apiFetch('/api/scores/upsert', {
    method: 'POST',
    body: JSON.stringify({
      projectId: payload.projectId,
      criterionScores: payload.criterionScores,
      comment: payload.comment,
      total: payload.total,
    }),
  })
}

export async function fetchMyScoresForJudgeMongo(_judgeId: string) {
  const data = await apiFetch<{
    scores: {
      project_id: string
      criterion_scores: Record<string, number>
      comment: string | null
    }[]
  }>('/api/scores/me')
  return (data.scores ?? []).map((r) => ({
    project_id: r.project_id,
    criterion_scores: r.criterion_scores || {},
    comment: r.comment,
  }))
}
