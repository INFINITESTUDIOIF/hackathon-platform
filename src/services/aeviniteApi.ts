import { supabase } from '../lib/supabase'

export type ProfileRole = 'user' | 'judge' | 'admin' | 'main_admin'

export type Profile = {
  id: string
  email: string | null
  username: string | null
  role: ProfileRole
  is_approved: boolean
  onboarding_complete: boolean
  avatar_url: string | null
  created_at: string
}

export type EventStatus =
  | 'upcoming'
  | 'registration_open'
  | 'ongoing'
  | 'submission_closed'
  | 'judging'
  | 'completed'

export type EventRow = {
  id: string
  title: string
  description: string
  banner_url: string | null
  rules: string
  status: EventStatus
  registration_deadline: string
  submission_deadline: string
  result_announcement_time: string
  min_team_size: number
  max_team_size: number
  topics: string[]
  judging_categories: { name: string; weight: number }[]
  is_result_public: boolean
  created_by: string
  created_at: string
  total_participants: number
}

export type TeamType = 'solo' | 'duo' | 'trio' | 'squad'
export type TeamStatus = 'forming' | 'formed' | 'registered'

export type TeamRow = {
  id: string
  event_id: string
  name: string
  leader_id: string
  team_type: TeamType
  selected_topic: string | null
  status: TeamStatus
  created_at: string
}

export type InviteStatus = 'pending' | 'accepted' | 'declined'

export type TeamMemberRow = {
  id: string
  team_id: string
  event_id: string
  user_id: string
  invite_status: InviteStatus
  joined_at: string | null
}

export type ProjectRow = {
  id: string
  team_id: string
  event_id: string
  github_url: string | null
  video_url: string | null
  description: string | null
  comment_for_judges: string | null
  submitted_at: string | null
  last_updated_at: string | null
}

export type JudgmentRow = {
  id: string
  project_id: string
  judge_id: string
  event_id: string
  scores: Record<string, number>
  total_score: number
  judged_at: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function fetchMyProfile(userId: string) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('profiles')
    .select('id,email,username,role,is_approved,onboarding_complete,avatar_url,created_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const d = data as unknown as Partial<Profile> & { username?: string | null; onboarding_complete?: boolean }
  // Backward-compatible fallback if column isn't present / is null.
  const onboarding_complete = Boolean(
    (d.onboarding_complete ?? null) ?? (d.username ? true : false),
  )
  return { ...(data as Profile), onboarding_complete } as Profile
}

export async function createUserProfile(payload: {
  id: string
  email: string | null
  username: string
  role: 'user'
}) {
  const sb = requireSupabase()
  const baseRow = {
    id: payload.id,
    email: payload.email,
    username: payload.username,
    role: payload.role,
    is_approved: false,
  }
  const { error } = await sb.from('profiles').insert({
    ...baseRow,
    onboarding_complete: false,
  })
  if (!error) return
  // Backward compatibility: if DB wasn't migrated yet, retry without onboarding_complete.
  if (String(error.message).toLowerCase().includes('onboarding_complete')) {
    const { error: e2 } = await sb.from('profiles').insert(baseRow)
    if (e2) throw e2
    return
  }
  throw error
}

export async function updateMyProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'username' | 'avatar_url' | 'onboarding_complete'>>,
) {
  const sb = requireSupabase()
  const { error } = await sb.from('profiles').update(patch).eq('id', userId)
  if (!error) return
  // Backward compatibility: retry without onboarding_complete if column doesn't exist.
  if (
    'onboarding_complete' in patch &&
    String(error.message).toLowerCase().includes('onboarding_complete')
  ) {
    const { onboarding_complete: _oc, ...rest } = patch
    const { error: e2 } = await sb.from('profiles').update(rest).eq('id', userId)
    if (e2) throw e2
    return
  }
  throw error
}

export async function fetchEvents() {
  const sb = requireSupabase()
  try {
    const { data, error } = await sb
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.warn('fetchEvents error:', error)
      return []
    }
    return (data ?? []) as EventRow[]
  } catch (e) {
    console.error('fetchEvents exception:', e)
    return []
  }
}

export async function fetchEvent(eventId: string) {
  const sb = requireSupabase()
  const { data, error } = await sb.from('events').select('*').eq('id', eventId).single()
  if (error) throw error
  return data as EventRow
}

export async function fetchMyTeamForEvent(eventId: string, userId: string) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('team_members')
    .select('team_id,invite_status,teams:team_id(*)')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const team = (data as unknown as { teams: TeamRow | null }).teams
  return team ?? null
}

export async function fetchMyMembershipForEvent(eventId: string, userId: string) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('team_members')
    .select('id,team_id,event_id,user_id,invite_status,joined_at,teams:team_id(*)')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as TeamMemberRow & { teams: TeamRow | null }
  return { member: row as TeamMemberRow, team: row.teams }
}

export async function fetchTeamMembers(teamId: string) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at' as never, { ascending: true } as never)
  // `created_at` doesn't exist on table; order fallback if PostgREST rejects.
  if (error && !String(error.message).toLowerCase().includes('created_at')) throw error
  if (error) {
    const { data: d2, error: e2 } = await sb
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
    if (e2) throw e2
    return (d2 ?? []) as TeamMemberRow[]
  }
  return (data ?? []) as TeamMemberRow[]
}

export async function searchApprovedUsersForEvent(eventId: string, q: string) {
  const sb = requireSupabase()
  const query = q.trim().toLowerCase()
  if (!query) return [] as Profile[]

  // We filter "already registered in event" client-side by joining team_members.
  const { data, error } = await sb
    .from('profiles')
    .select('id,email,username,role,is_approved,avatar_url,created_at')
    .eq('role', 'user')
    .eq('is_approved', true)
    .ilike('username', `%${query}%`)
    .limit(20)
  if (error) throw error

  const candidates = (data ?? []) as Profile[]
  if (candidates.length === 0) return []

  const { data: regs, error: re } = await sb
    .from('team_members')
    .select('user_id')
    .eq('event_id', eventId)
    .in(
      'user_id',
      candidates.map((c) => c.id),
    )
  if (re) throw re
  const registered = new Set((regs ?? []).map((r) => (r as { user_id: string }).user_id))

  return candidates.map((c) => ({
    ...c,
    // Attach a hint flag (not persisted) used by UI to grey out.
    is_approved: c.is_approved,
    role: c.role,
    username: c.username,
    email: c.email,
    avatar_url: c.avatar_url,
    created_at: c.created_at,
    id: c.id,
    ...(registered.has(c.id) ? ({ __unavailable_reason: 'already_registered' } as never) : {}),
  })) as Profile[]
}

export async function createTeamWithInvites(payload: {
  event_id: string
  leader_id: string
  name: string
  team_type: TeamType
  member_ids: string[] // must include leader too
}) {
  const sb = requireSupabase()

  const { data: team, error: te } = await sb
    .from('teams')
    .insert({
      event_id: payload.event_id,
      leader_id: payload.leader_id,
      name: payload.name.trim(),
      team_type: payload.team_type,
      status: 'forming',
    })
    .select('*')
    .single()
  if (te) throw te

  const members = payload.member_ids.map((id) => ({
    team_id: (team as TeamRow).id,
    event_id: payload.event_id,
    user_id: id,
    invite_status: id === payload.leader_id ? 'accepted' : 'pending',
    joined_at: id === payload.leader_id ? new Date().toISOString() : null,
  }))

  const { error: me } = await sb.from('team_members').insert(members)
  if (me) throw me

  return team as TeamRow
}

export async function respondToInvite(payload: {
  team_id: string
  user_id: string
  invite_status: Exclude<InviteStatus, 'pending'>
}) {
  const sb = requireSupabase()
  const { error } = await sb
    .from('team_members')
    .update({
      invite_status: payload.invite_status,
      joined_at: payload.invite_status === 'accepted' ? new Date().toISOString() : null,
    })
    .eq('team_id', payload.team_id)
    .eq('user_id', payload.user_id)
  if (error) throw error
}

export async function setTeamTopic(payload: { team_id: string; selected_topic: string }) {
  const sb = requireSupabase()
  const { error } = await sb
    .from('teams')
    .update({ selected_topic: payload.selected_topic })
    .eq('id', payload.team_id)
  if (error) throw error
}

export async function upsertProject(payload: {
  event_id: string
  team_id: string
  github_url: string
  video_url: string
  description?: string
}) {
  const sb = requireSupabase()
  const { data: existing, error: e0 } = await sb
    .from('projects')
    .select('id,submitted_at')
    .eq('team_id', payload.team_id)
    .maybeSingle()
  if (e0) throw e0

  const now = new Date().toISOString()
  if (!existing) {
    const { data, error } = await sb
      .from('projects')
      .insert({
        event_id: payload.event_id,
        team_id: payload.team_id,
        github_url: payload.github_url,
        video_url: payload.video_url,
        description: payload.description ?? null,
        submitted_at: now,
        last_updated_at: now,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as ProjectRow
  }

  const { data, error } = await sb
    .from('projects')
    .update({
      github_url: payload.github_url,
      video_url: payload.video_url,
      description: payload.description ?? null,
      last_updated_at: now,
      submitted_at: existing.submitted_at ?? now,
    })
    .eq('id', (existing as { id: string }).id)
    .select('*')
    .single()
  if (error) throw error
  return data as ProjectRow
}

export async function updateProjectComment(payload: {
  team_id: string
  comment_for_judges: string | null
}) {
  const sb = requireSupabase()
  const { error } = await sb
    .from('projects')
    .update({ comment_for_judges: payload.comment_for_judges })
    .eq('team_id', payload.team_id)
  if (error) throw error
}

export async function fetchMyProjects(userId: string) {
  const sb = requireSupabase()
  try {
    // First get team IDs where user is a member
    const { data: teams, error: te } = await sb
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .eq('invite_status', 'accepted')
    
    if (te) {
      console.warn('fetchMyProjects teams error:', te)
      return []
    }
    
    const ids = (teams ?? []).map(t => t.team_id)
    if (ids.length === 0) return []

    const { data, error } = await sb
      .from('projects')
      .select('*, events:event_id(title, status, is_result_public), teams:team_id(name)')
      .in('team_id', ids)
      .order('submitted_at', { ascending: false })
    
    if (error) {
      console.warn('fetchMyProjects projects error:', error)
      return []
    }
    
    return (data ?? []) as Array<ProjectRow & { events: { title: string; status: EventStatus; is_result_public: boolean }; teams: { name: string } }>
  } catch (e) {
    console.error('fetchMyProjects exception:', e)
    return []
  }
}

export async function fetchSubmittedProjectsForJudge(eventId: string) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('projects')
    .select(
      'id,team_id,event_id,github_url,video_url,comment_for_judges,submitted_at,teams:team_id(id,name)',
    )
    .eq('event_id', eventId)
    .not('submitted_at', 'is', null)
  if (error) throw error
  // Supabase may return the joined relation as an array; normalize to a single object.
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      team_id: string
      event_id: string
      github_url: string | null
      video_url: string | null
      comment_for_judges: string | null
      submitted_at: string | null
      teams: { id: string; name: string } | { id: string; name: string }[] | null
    }
    const t = Array.isArray(r.teams) ? r.teams[0] ?? null : r.teams
    return { ...r, teams: t }
  }) as Array<
    Pick<
      ProjectRow,
      | 'id'
      | 'team_id'
      | 'event_id'
      | 'github_url'
      | 'video_url'
      | 'comment_for_judges'
      | 'submitted_at'
    > & { teams: { id: string; name: string } | null }
  >
}

export async function upsertJudgment(payload: {
  event_id: string
  project_id: string
  judge_id: string
  scores: Record<string, number>
}) {
  const sb = requireSupabase()
  const total = Object.values(payload.scores).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  const { error } = await sb.from('judgments').upsert(
    {
      event_id: payload.event_id,
      project_id: payload.project_id,
      judge_id: payload.judge_id,
      scores: payload.scores,
      total_score: total,
      judged_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,judge_id' },
  )
  if (error) throw error
}

export async function fetchMyJudgmentsMap(judgeId: string, eventId?: string) {
  const sb = requireSupabase()
  let q = sb.from('judgments').select('project_id,scores,total_score,event_id').eq('judge_id', judgeId)
  if (eventId) q = q.eq('event_id', eventId)
  const { data, error } = await q
  if (error) throw error
  const m = new Map<string, { scores: Record<string, number>; total_score: number }>()
  for (const row of data ?? []) {
    const r = row as { project_id: string; scores: Record<string, number>; total_score: number }
    m.set(r.project_id, { scores: r.scores ?? {}, total_score: Number(r.total_score ?? 0) })
  }
  return m
}

export async function fetchEventLeaderboard(eventId: string) {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('get_event_leaderboard', { p_event_id: eventId })
  if (error) throw error
  return (data ?? []) as Array<{
    team_id: string
    team_name: string
    project_id: string
    avg_score: number
    rank: number
  }>
}

// ----------------- Admin -----------------
export async function adminFetchAllUsers() {
  const sb = requireSupabase()
  try {
    const { data, error } = await sb
      .from('profiles')
      .select('id,email,username,role,is_approved,created_at')
      .order('created_at', { ascending: false })
    if (error) {
      console.warn('adminFetchAllUsers error:', error)
      return []
    }
    return (data ?? []) as Array<Profile>
  } catch (e) {
    console.error('adminFetchAllUsers exception:', e)
    return []
  }
}

export async function adminFetchAllJudges() {
  const sb = requireSupabase()
  try {
    const { data, error } = await sb
      .from('profiles')
      .select('id,email,username,role,is_approved,created_at')
      .eq('role', 'judge')
      .order('created_at', { ascending: false })
    if (error) {
      console.warn('adminFetchAllJudges error:', error)
      return []
    }
    return (data ?? []) as Array<Profile>
  } catch (e) {
    console.error('adminFetchAllJudges exception:', e)
    return []
  }
}

export async function adminRemoveJudge(judgeId: string) {
  const sb = requireSupabase()
  try {
    const { error } = await sb.auth.admin.deleteUser(judgeId)
    if (error) {
      // If auth delete fails (e.g. not main admin / service role not allowed), 
      // we still try to delete the profile row if RLS allows.
      const { error: e2 } = await sb.from('profiles').delete().eq('id', judgeId)
      if (e2) throw e2
    }
  } catch (e) {
    console.error('adminRemoveJudge error:', e)
    throw e
  }
}

export async function adminFetchGlobalStats() {
  const sb = requireSupabase()
  
  // Use maybeSingle or wrap in try-catch to avoid breaking the whole dashboard if one table is restricted
  const getCount = async (table: string, filter?: (query: any) => any) => {
    try {
      let query = sb.from(table).select('*', { count: 'exact', head: true })
      if (filter) query = filter(query)
      const { count, error } = await query
      if (error) {
        console.warn(`Error fetching count for ${table}:`, error)
        return 0
      }
      return count ?? 0
    } catch (e) {
      console.warn(`Exception fetching count for ${table}:`, e)
      return 0
    }
  }

  const [
    usersCount,
    pendingCount,
    eventsCount,
    teamsCount,
    projectsCount,
    judgmentsCount,
  ] = await Promise.all([
    getCount('profiles'),
    getCount('profiles', q => q.eq('is_approved', false).eq('role', 'user')),
    getCount('events'),
    getCount('teams'),
    getCount('projects'),
    getCount('judgments'),
  ])

  return {
    totalUsers: usersCount,
    pendingUsers: pendingCount,
    totalEvents: eventsCount,
    totalTeams: teamsCount,
    totalProjects: projectsCount,
    totalJudgments: judgmentsCount,
  }
}

export async function adminFetchAllTeams() {
  const sb = requireSupabase()
  try {
    const { data, error } = await sb
      .from('teams')
      .select('*, events:event_id(title), profiles:leader_id(username,email)')
      .order('created_at', { ascending: false })
    if (error) {
      console.warn('adminFetchAllTeams error:', error)
      return []
    }
    return (data ?? []) as Array<TeamRow & { events: { title: string }; profiles: { username: string; email: string } }>
  } catch (e) {
    console.error('adminFetchAllTeams exception:', e)
    return []
  }
}

export async function adminApproveUser(userId: string, approved: boolean) {
  const sb = requireSupabase()
  const { error } = await sb.from('profiles').update({ is_approved: approved }).eq('id', userId)
  if (error) throw error
}

export async function fetchJudgeStats(judgeId: string) {
  const sb = requireSupabase()
  try {
    const { data: judgments, error: je } = await sb
      .from('judgments')
      .select('project_id, event_id')
      .eq('judge_id', judgeId)
    
    if (je) {
      console.warn('fetchJudgeStats judgments error:', je)
      return { completedCount: 0, pendingCount: 0 }
    }

    const { data: projects, error: pe } = await sb
      .from('projects')
      .select('id, event_id, events!inner(status)')
      .neq('submitted_at', null)
      .in('events.status', ['ongoing', 'submission_closed', 'judging'])
    
    if (pe) {
      console.warn('fetchJudgeStats projects error:', pe)
      return { completedCount: judgments?.length ?? 0, pendingCount: 0 }
    }

    const completedIds = new Set((judgments ?? []).map(j => j.project_id))
    const totalProjects = (projects ?? []).length
    const completedCount = (projects ?? []).filter(p => completedIds.has(p.id)).length
    const pendingCount = totalProjects - completedCount

    return { completedCount, pendingCount }
  } catch (e) {
    console.error('fetchJudgeStats exception:', e)
    return { completedCount: 0, pendingCount: 0 }
  }
}

export async function adminUpdateEvent(
  eventId: string,
  patch: Partial<Pick<EventRow, 'status' | 'is_result_public' | 'registration_deadline' | 'submission_deadline' | 'result_announcement_time' | 'topics' | 'judging_categories' | 'title' | 'description' | 'rules'>>,
) {
  const sb = requireSupabase()
  const { error } = await sb.from('events').update(patch).eq('id', eventId)
  if (error) throw error
}

export async function adminFetchEventStats(eventId: string) {
  const sb = requireSupabase()
  const [{ data: teams, error: te }, { data: projects, error: pe }, { data: judgments, error: je }] =
    await Promise.all([
      sb.from('teams').select('id,status').eq('event_id', eventId),
      sb.from('projects').select('id,submitted_at').eq('event_id', eventId),
      sb.from('judgments').select('id,project_id').eq('event_id', eventId),
    ])
  if (te) throw te
  if (pe) throw pe
  if (je) throw je
  const teamRows = (teams ?? []) as Array<{ id: string; status: TeamStatus }>
  const forming = teamRows.filter((t) => t.status === 'forming').length
  const formed = teamRows.filter((t) => t.status === 'formed').length
  const registered = teamRows.filter((t) => t.status === 'registered').length
  const submitted = (projects ?? []).filter((p) => (p as { submitted_at: string | null }).submitted_at).length
  const totalProjects = (projects ?? []).length
  const totalJudgments = (judgments ?? []).length
  return { forming, formed, registered, totalTeams: teamRows.length, submitted, totalProjects, totalJudgments }
}

export async function adminFetchEventTeams(eventId: string) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('teams')
    .select('*, profiles:leader_id(username,email), team_members(user_id, profiles:user_id(username,email))')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Array<TeamRow & { profiles: { username: string; email: string }; team_members: Array<{ user_id: string; profiles: { username: string; email: string } }> }>
}

export async function adminFetchEventProjects(eventId: string) {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('projects')
    .select('*, teams:team_id(name), judgments(id, total_score, judge_id)')
    .eq('event_id', eventId)
  if (error) throw error
  return (data ?? []) as Array<ProjectRow & { teams: { name: string }; judgments: Array<{ id: string; total_score: number; judge_id: string }> }>
}

