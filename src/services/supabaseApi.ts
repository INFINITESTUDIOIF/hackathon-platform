import { supabase } from '../lib/supabase'
import type { Project } from '../data/mock'

export type LeaderboardVisibility = 'admin_only' | 'judges_only' | 'public'

export type ProfileRow = {
  id: string
  email: string | null
  username?: string | null
  full_name: string | null
  role: 'admin' | 'judge' | 'team' | 'participant'
  team_id: string | null
  approval_status: 'pending' | 'approved' | 'rejected'
  /** API mode only (Mongo users). */
  google_verified?: boolean
  /** API mode only (Mongo users). */
  password_set?: boolean
  /** API mode: Google OAuth users must finish username + app password. */
  needs_profile_setup?: boolean
}

type ProjectRow = {
  id: string
  team_id: string
  title: string
  tagline: string | null
  description: string | null
  cover_url: string | null
  video_url: string | null
  github_url: string | null
  demo_url: string | null
  tech_stack: string[] | null
  category: string | null
}

type TeamRow = {
  id: string
  name: string
  status: string
}

const placeholder = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80'
const sampleVideo =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'

export function mapDbProjectToFeed(p: ProjectRow, team: TeamRow): Project {
  const tech = p.tech_stack?.length ? p.tech_stack : ['—']
  return {
    id: p.id,
    title: p.title,
    tagline: p.tagline || '',
    description: p.description || '',
    cover: p.cover_url || placeholder,
    videoPoster: p.cover_url || placeholder,
    videoSrc: p.video_url || sampleVideo,
    github: p.github_url || '#',
    demo: p.demo_url || '#',
    category: p.category || 'General',
    tech,
    teamName: team.name,
    members: [{ name: team.name, avatar: placeholder, role: 'Team' }],
  }
}

export async function fetchProfile(userId: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data as ProfileRow | null
}

export async function insertProfile(row: Omit<ProfileRow, 'updated_at'>) {
  if (!supabase) return
  const { error } = await supabase.from('profiles').insert({
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    team_id: row.team_id,
    approval_status: row.approval_status,
  })
  if (error) throw error
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<ProfileRow, 'team_id' | 'approval_status' | 'role' | 'full_name'>>,
) {
  if (!supabase) return
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw error
}

export async function fetchPendingProfiles() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('approval_status', 'pending')
    .in('role', ['team', 'judge'])
    .order('email')
  if (error) throw error
  return (data ?? []) as ProfileRow[]
}

export async function fetchAppSettings() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data as {
    id: number
    leaderboard_visibility: LeaderboardVisibility
    winner_announced_at: string | null
  } | null
}

export async function updateAppSettings(patch: {
  leaderboard_visibility?: LeaderboardVisibility
  winner_announced_at?: string | null
}) {
  if (!supabase) return
  const { error } = await supabase.from('app_settings').update(patch).eq('id', 1)
  if (error) throw error
}

export async function insertRolePromotion(email: string) {
  if (!supabase) return
  const { error } = await supabase
    .from('role_promotions')
    .upsert({ email: email.trim().toLowerCase(), desired_role: 'judge' })
  if (error) throw error
}

/** Admin invites judge: promotion row + update existing profile if any */
export async function promoteEmailToJudgeByAdmin(email: string) {
  const e = email.trim().toLowerCase()
  if (!supabase || !e) return
  await insertRolePromotion(e)
  await supabase
    .from('profiles')
    .update({ role: 'judge', approval_status: 'pending' })
    .ilike('email', e)
}

export async function createTeam(name: string, userId: string) {
  if (!supabase) return null
  const { data: team, error: tErr } = await supabase
    .from('teams')
    .insert({ name: name.trim(), created_by: userId, status: 'pending' })
    .select('id')
    .single()
  if (tErr) throw tErr
  const { error: pErr } = await supabase
    .from('profiles')
    .update({ team_id: team.id })
    .eq('id', userId)
  if (pErr) throw pErr
  return team.id as string
}

export async function submitProjectForTeam(payload: {
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
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('projects')
    .insert({
      team_id: payload.teamId,
      title: payload.title,
      tagline: payload.tagline,
      description: payload.description,
      cover_url: payload.coverUrl || null,
      video_url: payload.videoUrl || null,
      github_url: payload.githubUrl || null,
      demo_url: payload.demoUrl || null,
      tech_stack: payload.techStack,
      category: payload.category,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function fetchProjectForTeam(teamId: string): Promise<Project | null> {
  if (!supabase) return null
  const { data: p, error } = await supabase
    .from('projects')
    .select('*')
    .eq('team_id', teamId)
    .maybeSingle()
  if (error) throw error
  if (!p) return null
  const row = p as ProjectRow
  const { data: t, error: te } = await supabase
    .from('teams')
    .select('id,name,status')
    .eq('id', teamId)
    .maybeSingle()
  if (te) throw te
  if (!t) return null
  return mapDbProjectToFeed(row, t as TeamRow)
}

export async function fetchProjectById(projectId: string): Promise<Project | null> {
  if (!supabase) return null
  const { data: p, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()
  if (error) throw error
  if (!p) return null
  const row = p as ProjectRow
  const { data: t, error: te } = await supabase
    .from('teams')
    .select('id,name,status')
    .eq('id', row.team_id)
    .maybeSingle()
  if (te) throw te
  if (!t) return null
  return mapDbProjectToFeed(row, t as TeamRow)
}

export async function fetchFeedProjects(): Promise<Project[]> {
  if (!supabase) return []
  const { data: projects, error } = await supabase.from('projects').select('*')
  if (error) throw error
  const rows = (projects ?? []) as ProjectRow[]
  if (rows.length === 0) return []
  const teamIds = [...new Set(rows.map((r) => r.team_id))]
  const { data: teams, error: te } = await supabase
    .from('teams')
    .select('id,name,status')
    .in('id', teamIds)
  if (te) throw te
  const teamMap = new Map((teams as TeamRow[]).map((t) => [t.id, t]))
  return rows
    .map((p) => {
      const t = teamMap.get(p.team_id)
      if (!t || t.status !== 'approved') return null
      return mapDbProjectToFeed(p, t)
    })
    .filter(Boolean) as Project[]
}

export async function fetchAllProjectsForLeaderboard(): Promise<Project[]> {
  if (!supabase) return []
  const { data: projects, error } = await supabase.from('projects').select('*')
  if (error) throw error
  const rows = (projects ?? []) as ProjectRow[]
  if (rows.length === 0) return []
  const teamIds = [...new Set(rows.map((r) => r.team_id))]
  const { data: teams, error: te } = await supabase
    .from('teams')
    .select('id,name,status')
    .in('id', teamIds)
  if (te) throw te
  const teamMap = new Map((teams as TeamRow[]).map((t) => [t.id, t]))
  return rows
    .map((p) => {
      const t = teamMap.get(p.team_id)
      if (!t) return null
      return mapDbProjectToFeed(p, t)
    })
    .filter(Boolean) as Project[]
}

export async function fetchScoresMap() {
  if (!supabase) return new Map<string, { total: number; byJudge: { judge: string; score: number; comment: string }[] }>()
  const { data: scores, error } = await supabase.from('scores').select('project_id, judge_id, total, comment')
  if (error) throw error
  const { data: profs, error: pe } = await supabase.from('profiles').select('id, email, full_name')
  if (pe) throw pe
  const nameByJudge = new Map<string, string>()
  for (const pr of profs ?? []) {
    const label = (pr as { full_name: string | null; email: string | null }).full_name
      || (pr as { email: string | null }).email
      || 'Judge'
    nameByJudge.set((pr as { id: string }).id, label)
  }
  const byProject = new Map<string, { totals: number[]; feedback: { judge: string; score: number; comment: string }[] }>()
  for (const s of scores ?? []) {
    const row = s as { project_id: string; judge_id: string; total: number; comment: string | null }
    const cur = byProject.get(row.project_id) ?? { totals: [], feedback: [] }
    cur.totals.push(Number(row.total))
    cur.feedback.push({
      judge: nameByJudge.get(row.judge_id) || 'Judge',
      score: Math.round(Number(row.total) * 10) / 10,
      comment: row.comment || '',
    })
    byProject.set(row.project_id, cur)
  }
  const out = new Map<string, { total: number; byJudge: { judge: string; score: number; comment: string }[] }>()
  for (const [pid, v] of byProject) {
    const avg = v.totals.length ? v.totals.reduce((a, b) => a + b, 0) / v.totals.length : 0
    out.set(pid, { total: Math.round(avg * 10) / 10, byJudge: v.feedback })
  }
  return out
}

export async function upsertJudgeScore(payload: {
  projectId: string
  judgeId: string
  criterionScores: Record<string, number>
  comment: string
  total: number
}) {
  if (!supabase) return
  const { error } = await supabase.from('scores').upsert(
    {
      project_id: payload.projectId,
      judge_id: payload.judgeId,
      criterion_scores: payload.criterionScores,
      comment: payload.comment,
      total: payload.total,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,judge_id' },
  )
  if (error) throw error
}

export async function fetchMyScoresForJudge(judgeId: string) {
  if (!supabase) return [] as { project_id: string; criterion_scores: Record<string, number>; comment: string | null }[]
  const { data, error } = await supabase
    .from('scores')
    .select('project_id, criterion_scores, comment')
    .eq('judge_id', judgeId)
  if (error) throw error
  return (data ?? []) as { project_id: string; criterion_scores: Record<string, number>; comment: string | null }[]
}

export async function approveProfileAndTeam(profile: ProfileRow) {
  if (!supabase) return
  await supabase
    .from('profiles')
    .update({ approval_status: 'approved' })
    .eq('id', profile.id)
  if (profile.team_id) {
    await supabase.from('teams').update({ status: 'approved' }).eq('id', profile.team_id)
  }
}
