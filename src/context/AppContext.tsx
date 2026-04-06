/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Role } from '../data/mock'
import { PROJECTS } from '../data/mock'
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  JUDGE_LOGIN_PASSWORD,
  TEAM_EMAIL,
  TEAM_LOGIN_PASSWORD,
} from '../config/auth'
import type {
  AdminUser,
  EventSetup,
  InvitedJudge,
  RubricCriterion,
} from '../types/event'
import { defaultEventSetup } from '../types/event'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { isAdminEmail } from '../lib/adminEmails'
import { apiMode as useApiBackend } from '../config/api'
import type { LeaderboardVisibility, ProfileRow } from '../services/supabaseApi'
import {
  fetchAppSettings,
  fetchFeedProjects,
  fetchMyScoresForJudge,
  fetchProfile,
  insertProfile,
  promoteEmailToJudgeByAdmin,
  updateAppSettings,
  updateProfile,
  upsertJudgeScore,
} from '../services/supabaseApi'
import {
  fetchAppSettingsMongo,
  fetchCurrentEventMongo,
  fetchFeedProjectsMongo,
  fetchInvitedJudgesMongo,
  fetchMyScoresForJudgeMongo,
  getApiToken,
  mongoFetchMe,
  mongoLogin,
  promoteEmailToJudgeMongo,
  setApiToken,
  updateAppSettingsMongo,
  updateInvitedJudgeStatusMongo,
  upsertJudgeScoreMongo,
} from '../services/mongoApi'

type AppState = {
  supabaseMode: boolean
  /** Data + auth via Mongo API (`VITE_API_URL`). */
  useApiBackend: boolean
  /** Feed / leaderboard project list comes from server, not mock. */
  feedUsesDatabase: boolean
  authSession: Session | null
  profile: ProfileRow | null
  profileLoading: boolean
  role: Role | null
  setRole: (r: Role | null) => void
  authenticated: boolean
  setAuthenticated: (v: boolean) => void
  loginWithPassword: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  judgedIds: Set<string>
  markJudged: (projectId: string) => void
  scores: Record<string, Record<string, number>>
  setCriterionScore: (
    projectId: string,
    criterionKey: string,
    value: number,
  ) => void
  stars: Record<string, number>
  setStars: (projectId: string, n: number) => void
  likes: Set<string>
  toggleLike: (projectId: string) => void
  comments: Record<string, string>
  setComment: (projectId: string, text: string) => void
  leaderboardVisibility: LeaderboardVisibility
  setLeaderboardVisibility: (v: LeaderboardVisibility) => Promise<void>
  /** @deprecated use leaderboardVisibility */
  leaderboardPublic: boolean
  setLeaderboardPublic: (v: boolean) => void
  feedError: boolean
  setFeedError: (v: boolean) => void
  feedProjects: typeof PROJECTS
  refreshFeed: () => Promise<void>
  eventSetup: EventSetup
  setEventSetup: (u: EventSetup | ((prev: EventSetup) => EventSetup)) => void
  updateRubric: (rubric: RubricCriterion[]) => void
  updateTracks: (tracks: string[]) => void
  admins: AdminUser[]
  addAdminByEmail: (email: string) => boolean
  invitedJudges: InvitedJudge[]
  inviteJudgeByEmail: (email: string) => Promise<boolean>
  setJudgeStatus: (id: string, status: InvitedJudge['status']) => Promise<void>
  winnerAnnouncedAt: string | null
  announceWinners: () => Promise<void>
  persistJudgeScore: (
    projectId: string,
    criterionScores: Record<string, number>,
    comment: string,
    total: number,
  ) => Promise<void>
  refreshAppSettings: () => Promise<void>
  refreshProfile: () => Promise<void>
  /** Demo judge/team/admin login via config passwords while Supabase is configured (no JWT). */
  demoPasswordAuth: boolean
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const supabaseMode = isSupabaseConfigured

  const [authSession, setAuthSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [profileLoading, setProfileLoading] = useState(
    () => supabaseMode || useApiBackend,
  )

  const [role, setRole] = useState<Role | null>(null)
  const [localAuthenticated, setLocalAuthenticated] = useState(false)
  const [demoPasswordAuth, setDemoPasswordAuth] = useState(false)
  /** Synced immediately on demo login so async Supabase init never wipes role. */
  const demoPasswordAuthRef = useRef(false)

  const [judgedIds, setJudgedIds] = useState<Set<string>>(() =>
    supabaseMode || useApiBackend ? new Set() : new Set(['p-1', 'p-3']),
  )
  const [scores, setScores] = useState<Record<string, Record<string, number>>>(
    {},
  )
  const [stars, setStarsState] = useState<Record<string, number>>({})
  const [likes, setLikes] = useState<Set<string>>(() => new Set())
  const [comments, setComments] = useState<Record<string, string>>({})
  const [leaderboardVisibility, setLeaderboardVisibilityState] =
    useState<LeaderboardVisibility>('admin_only')
  const [feedError, setFeedError] = useState(false)
  const [eventSetup, setEventSetup] = useState<EventSetup>(defaultEventSetup())
  const [winnerAnnouncedAt, setWinnerAnnouncedAt] = useState<string | null>(
    null,
  )
  const [feedProjects, setFeedProjects] = useState<typeof PROJECTS>(PROJECTS)

  const [admins, setAdmins] = useState<AdminUser[]>([
    { id: 'adm-1', email: ADMIN_EMAIL },
  ])

  const [invitedJudges, setInvitedJudges] = useState<InvitedJudge[]>([
    {
      id: 'inv-1',
      email: 'judge@demo.com',
      status: 'accepted',
    },
  ])

  const feedUsesDatabase =
    useApiBackend || (supabaseMode && !demoPasswordAuth)

  const authenticated = useApiBackend
    ? Boolean(getApiToken())
    : supabaseMode
      ? !!authSession || demoPasswordAuth
      : localAuthenticated

  const refreshFeed = useCallback(async () => {
    if (demoPasswordAuth && !useApiBackend) {
      setFeedProjects(PROJECTS)
      return
    }
    if (useApiBackend) {
      try {
        const list = await fetchFeedProjectsMongo()
        setFeedProjects(list.length ? list : [])
        setFeedError(false)
      } catch {
        setFeedError(true)
      }
      return
    }
    if (!supabaseMode || !supabase) {
      setFeedProjects(PROJECTS)
      return
    }
    try {
      const list = await fetchFeedProjects()
      setFeedProjects(list.length ? list : [])
      setFeedError(false)
    } catch {
      setFeedError(true)
    }
  }, [supabaseMode, demoPasswordAuth, useApiBackend])

  useEffect(() => {
    if (!supabaseMode && !useApiBackend) {
      setFeedProjects(PROJECTS)
      setProfileLoading(false)
    }
  }, [supabaseMode, useApiBackend])

  const refreshAppSettings = useCallback(async () => {
    if (useApiBackend) {
      const s = await fetchAppSettingsMongo()
      if (s?.leaderboard_visibility)
        setLeaderboardVisibilityState(s.leaderboard_visibility)
      setWinnerAnnouncedAt(s?.winner_announced_at ?? null)
      return
    }
    if (!supabaseMode || !supabase) return
    const s = await fetchAppSettings()
    if (s?.leaderboard_visibility)
      setLeaderboardVisibilityState(s.leaderboard_visibility)
    setWinnerAnnouncedAt(s?.winner_announced_at ?? null)
  }, [supabaseMode, useApiBackend])

  useEffect(() => {
    if (!useApiBackend) return
    let cancelled = false
    setProfileLoading(true)
    const run = async () => {
      const token = getApiToken()
      if (!token) {
        setProfile(null)
        setRole(null)
        setJudgedIds(new Set())
        setScores({})
        setComments({})
        if (!cancelled) setProfileLoading(false)
        return
      }
      const u = await mongoFetchMe()
      if (cancelled) return
      if (!u) {
        setApiToken(null)
        setProfile(null)
        setRole(null)
        setJudgedIds(new Set())
        setScores({})
        setComments({})
        setProfileLoading(false)
        return
      }
      setProfile(u)
      setRole(u.role)
      if (u.role === 'judge' && u.approval_status === 'approved') {
        const scoreRows = await fetchMyScoresForJudgeMongo(u.id)
        const nextJudged = new Set<string>()
        const nextScores: Record<string, Record<string, number>> = {}
        const nextComments: Record<string, string> = {}
        for (const r of scoreRows) {
          nextJudged.add(r.project_id)
          nextScores[r.project_id] = r.criterion_scores || {}
          if (r.comment) nextComments[r.project_id] = r.comment
        }
        setJudgedIds(nextJudged)
        setScores((prev) => ({ ...nextScores, ...prev }))
        setComments((prev) => ({ ...nextComments, ...prev }))
      } else {
        setJudgedIds(new Set())
        setScores({})
        setComments({})
      }
      await refreshFeed()
      await refreshAppSettings()
      try {
        const ev = await fetchCurrentEventMongo()
        if (ev && !cancelled) setEventSetup(ev)
      } catch {
        /* keep default */
      }
      if (u.role === 'admin') {
        try {
          const judges = await fetchInvitedJudgesMongo()
          if (!cancelled && judges.length) setInvitedJudges(judges)
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setProfileLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [useApiBackend, refreshFeed, refreshAppSettings])

  const ensureProfile = useCallback(
    async (user: NonNullable<Session['user']>) => {
      if (!supabase) return
      const email = user.email ?? ''
      const fullName =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        null
      let row = await fetchProfile(user.id)
      if (!row) {
        const admin = isAdminEmail(email)
        await insertProfile({
          id: user.id,
          email,
          full_name: fullName,
          role: admin ? 'admin' : 'team',
          team_id: null,
          approval_status: admin ? 'approved' : 'pending',
        })
        row = await fetchProfile(user.id)
      } else if (isAdminEmail(email) && row.role !== 'admin') {
        await updateProfile(user.id, {
          role: 'admin',
          approval_status: 'approved',
        })
        row = await fetchProfile(user.id)
      }
      setProfile(row)
      if (row) {
        setRole(row.role)
        if (row.role === 'judge' && row.approval_status === 'approved') {
          const scoreRows = await fetchMyScoresForJudge(user.id)
          const nextJudged = new Set<string>()
          const nextScores: Record<string, Record<string, number>> = {}
          const nextComments: Record<string, string> = {}
          for (const r of scoreRows) {
            nextJudged.add(r.project_id)
            nextScores[r.project_id] = r.criterion_scores || {}
            if (r.comment) nextComments[r.project_id] = r.comment
          }
          setJudgedIds(nextJudged)
          setScores((prev) => ({ ...nextScores, ...prev }))
          setComments((prev) => ({ ...nextComments, ...prev }))
        }
      }
      await refreshFeed()
      await refreshAppSettings()
    },
    [refreshFeed, refreshAppSettings],
  )

  const refreshProfile = useCallback(async () => {
    if (useApiBackend) {
      setProfileLoading(true)
      const u = await mongoFetchMe()
      setProfile(u)
      setRole(u?.role ?? null)
      if (u?.role === 'judge' && u.approval_status === 'approved') {
        const scoreRows = await fetchMyScoresForJudgeMongo(u.id)
        const nextJudged = new Set<string>()
        const nextScores: Record<string, Record<string, number>> = {}
        const nextComments: Record<string, string> = {}
        for (const r of scoreRows) {
          nextJudged.add(r.project_id)
          nextScores[r.project_id] = r.criterion_scores || {}
          if (r.comment) nextComments[r.project_id] = r.comment
        }
        setJudgedIds(nextJudged)
        setScores((prev) => ({ ...nextScores, ...prev }))
        setComments((prev) => ({ ...nextComments, ...prev }))
      }
      await refreshFeed()
      await refreshAppSettings()
      setProfileLoading(false)
      return
    }
    if (!supabase || !authSession?.user) return
    setProfileLoading(true)
    await ensureProfile(authSession.user)
    setProfileLoading(false)
  }, [
    useApiBackend,
    authSession,
    ensureProfile,
    refreshFeed,
    refreshAppSettings,
  ])

  useEffect(() => {
    if (useApiBackend || !supabaseMode || !supabase) return
    const client = supabase

    let cancelled = false
    setProfileLoading(true)

    const init = async () => {
      const {
        data: { session },
      } = await client.auth.getSession()
      if (cancelled) return
      setAuthSession(session)
      if (session?.user) {
        demoPasswordAuthRef.current = false
        setDemoPasswordAuth(false)
        await ensureProfile(session.user)
      } else if (!demoPasswordAuthRef.current) {
        setProfile(null)
        setRole(null)
      } else {
        setProfile(null)
        setProfileLoading(false)
        return
      }
      if (!cancelled) setProfileLoading(false)
    }

    void init()

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_evt, session) => {
      setAuthSession(session)
      if (session?.user) {
        demoPasswordAuthRef.current = false
        setDemoPasswordAuth(false)
        setProfileLoading(true)
        void ensureProfile(session.user).finally(() => setProfileLoading(false))
      } else if (!demoPasswordAuthRef.current) {
        setProfile(null)
        setRole(null)
        setJudgedIds(new Set())
        setScores({})
        setComments({})
      } else {
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabaseMode, useApiBackend, ensureProfile])

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      if (useApiBackend) {
        try {
          const u = await mongoLogin(email, password)
          setProfile(u)
          setRole(u.role)
          demoPasswordAuthRef.current = false
          setDemoPasswordAuth(false)
          if (u.role === 'judge' && u.approval_status === 'approved') {
            const scoreRows = await fetchMyScoresForJudgeMongo(u.id)
            const nextJudged = new Set<string>()
            const nextScores: Record<string, Record<string, number>> = {}
            const nextComments: Record<string, string> = {}
            for (const r of scoreRows) {
              nextJudged.add(r.project_id)
              nextScores[r.project_id] = r.criterion_scores || {}
              if (r.comment) nextComments[r.project_id] = r.comment
            }
            setJudgedIds(nextJudged)
            setScores((prev) => ({ ...nextScores, ...prev }))
            setComments((prev) => ({ ...nextComments, ...prev }))
          } else {
            setJudgedIds(new Set())
            setScores({})
            setComments({})
          }
          await refreshFeed()
          await refreshAppSettings()
          try {
            const ev = await fetchCurrentEventMongo()
            if (ev) setEventSetup(ev)
          } catch {
            /* ignore */
          }
          if (u.role === 'admin') {
            try {
              const judges = await fetchInvitedJudgesMongo()
              if (judges.length) setInvitedJudges(judges)
            } catch {
              /* ignore */
            }
          }
          return true
        } catch {
          return false
        }
      }
      const e = email.trim().toLowerCase()
      if (e === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
        setRole('admin')
        if (supabaseMode) {
          demoPasswordAuthRef.current = true
          setDemoPasswordAuth(true)
          setFeedProjects(PROJECTS)
        } else {
          setLocalAuthenticated(true)
        }
        return true
      }
      const inv = invitedJudges.find(
        (j) => j.email.toLowerCase() === e && j.status === 'accepted',
      )
      if (inv && password === JUDGE_LOGIN_PASSWORD) {
        setRole('judge')
        if (supabaseMode) {
          demoPasswordAuthRef.current = true
          setDemoPasswordAuth(true)
          setFeedProjects(PROJECTS)
          setJudgedIds(new Set(['p-1', 'p-3']))
        } else {
          setLocalAuthenticated(true)
        }
        return true
      }

      if (e === TEAM_EMAIL.toLowerCase() && password === TEAM_LOGIN_PASSWORD) {
        setRole('team')
        if (supabaseMode) {
          demoPasswordAuthRef.current = true
          setDemoPasswordAuth(true)
          setFeedProjects(PROJECTS)
        } else {
          setLocalAuthenticated(true)
        }
        return true
      }
      return false
    },
    [supabaseMode, invitedJudges, useApiBackend, refreshFeed, refreshAppSettings],
  )

  const logout = useCallback(async () => {
    demoPasswordAuthRef.current = false
    if (useApiBackend) setApiToken(null)
    if (supabase) await supabase.auth.signOut()
    setLocalAuthenticated(false)
    setDemoPasswordAuth(false)
    setRole(null)
    setProfile(null)
    setAuthSession(null)
    setFeedProjects(PROJECTS)
  }, [useApiBackend])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }, [])

  const markJudged = useCallback((projectId: string) => {
    setJudgedIds((prev) => new Set(prev).add(projectId))
  }, [])

  const setCriterionScore = useCallback(
    (projectId: string, criterionKey: string, value: number) => {
      setScores((prev) => ({
        ...prev,
        [projectId]: { ...prev[projectId], [criterionKey]: value },
      }))
    },
    [],
  )

  const setStars = useCallback((projectId: string, n: number) => {
    setStarsState((prev) => ({ ...prev, [projectId]: n }))
  }, [])

  const toggleLike = useCallback((projectId: string) => {
    setLikes((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }, [])

  const setComment = useCallback((projectId: string, text: string) => {
    setComments((prev) => ({ ...prev, [projectId]: text }))
  }, [])

  const setLeaderboardVisibility = useCallback(
    async (v: LeaderboardVisibility) => {
      setLeaderboardVisibilityState(v)
      if (useApiBackend) {
        try {
          await updateAppSettingsMongo({ leaderboard_visibility: v })
        } catch {
          /* offline */
        }
        return
      }
      if (supabaseMode && supabase && authSession) {
        try {
          await updateAppSettings({ leaderboard_visibility: v })
        } catch {
          /* no JWT (demo password admin) — local state only */
        }
      }
    },
    [supabaseMode, authSession, useApiBackend],
  )

  const setLeaderboardPublic = useCallback(
    async (v: boolean) => {
      await setLeaderboardVisibility(v ? 'public' : 'judges_only')
    },
    [setLeaderboardVisibility],
  )

  const updateRubric = useCallback((rubric: RubricCriterion[]) => {
    setEventSetup((prev) => ({ ...prev, rubric }))
  }, [])

  const updateTracks = useCallback((tracks: string[]) => {
    setEventSetup((prev) => ({ ...prev, tracks }))
  }, [])

  const addAdminByEmail = useCallback((email: string) => {
    const e = email.trim().toLowerCase()
    if (!e || !e.includes('@')) return false
    setAdmins((prev) => {
      if (prev.some((a) => a.email.toLowerCase() === e)) return prev
      return [...prev, { id: `adm-${Date.now()}`, email: e }]
    })
    return true
  }, [])

  const inviteJudgeByEmail = useCallback(
    async (email: string) => {
      const e = email.trim().toLowerCase()
      if (!e || !e.includes('@')) return false
      if (useApiBackend) {
        try {
          await promoteEmailToJudgeMongo(e)
          const list = await fetchInvitedJudgesMongo()
          setInvitedJudges(list)
          return true
        } catch {
          return false
        }
      }
      if (supabaseMode) {
        try {
          await promoteEmailToJudgeByAdmin(e)
          return true
        } catch {
          return false
        }
      }
      setInvitedJudges((prev) => {
        if (prev.some((j) => j.email.toLowerCase() === e)) return prev
        return [
          ...prev,
          { id: `inv-${Date.now()}`, email: e, status: 'invited' as const },
        ]
      })
      return true
    },
    [useApiBackend, supabaseMode],
  )

  const setJudgeStatus = useCallback(
    async (id: string, status: InvitedJudge['status']) => {
      if (useApiBackend) {
        try {
          const list = await updateInvitedJudgeStatusMongo(id, status)
          setInvitedJudges(list)
        } catch {
          /* ignore */
        }
        return
      }
      setInvitedJudges((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status } : j)),
      )
    },
    [useApiBackend],
  )

  const announceWinners = useCallback(async () => {
    const at = new Date().toISOString()
    setWinnerAnnouncedAt(at)
    setLeaderboardVisibilityState('public')
    if (useApiBackend) {
      try {
        await updateAppSettingsMongo({
          winner_announced_at: at,
          leaderboard_visibility: 'public',
        })
      } catch {
        /* local UI still updates */
      }
      window.dispatchEvent(new Event('hackathon:winners-announced'))
      return
    }
    if (supabaseMode && supabase && authSession) {
      try {
        await updateAppSettings({
          winner_announced_at: at,
          leaderboard_visibility: 'public',
        })
      } catch {
        /* demo-password admin has no JWT; UI still updates locally */
      }
    }
    window.dispatchEvent(new Event('hackathon:winners-announced'))
  }, [supabaseMode, authSession, useApiBackend])

  const persistJudgeScore = useCallback(
    async (
      projectId: string,
      criterionScores: Record<string, number>,
      comment: string,
      total: number,
    ) => {
      if (useApiBackend) {
        const judgeId = profile?.id
        if (!judgeId) return
        await upsertJudgeScoreMongo({
          projectId,
          judgeId,
          criterionScores,
          comment,
          total,
        })
        return
      }
      if (!supabase || !authSession?.user) return
      await upsertJudgeScore({
        projectId,
        judgeId: authSession.user.id,
        criterionScores,
        comment,
        total,
      })
    },
    [authSession, useApiBackend, profile?.id],
  )

  const value = useMemo(
    () => ({
      supabaseMode,
      useApiBackend,
      feedUsesDatabase,
      authSession,
      profile,
      profileLoading,
      role,
      setRole,
      authenticated,
      setAuthenticated: setLocalAuthenticated,
      loginWithPassword,
      logout,
      signInWithGoogle,
      judgedIds,
      markJudged,
      scores,
      setCriterionScore,
      stars,
      setStars,
      likes,
      toggleLike,
      comments,
      setComment,
      leaderboardVisibility,
      setLeaderboardVisibility,
      leaderboardPublic: leaderboardVisibility === 'public',
      setLeaderboardPublic,
      feedError,
      setFeedError,
      feedProjects,
      refreshFeed,
      eventSetup,
      setEventSetup,
      updateRubric,
      updateTracks,
      admins,
      addAdminByEmail,
      invitedJudges,
      inviteJudgeByEmail,
      setJudgeStatus,
      winnerAnnouncedAt,
      announceWinners,
      persistJudgeScore,
      refreshAppSettings,
      refreshProfile,
      demoPasswordAuth,
    }),
    [
      supabaseMode,
      useApiBackend,
      feedUsesDatabase,
      authSession,
      profile,
      profileLoading,
      role,
      authenticated,
      loginWithPassword,
      logout,
      signInWithGoogle,
      judgedIds,
      markJudged,
      scores,
      setCriterionScore,
      stars,
      setStars,
      likes,
      toggleLike,
      comments,
      setComment,
      leaderboardVisibility,
      setLeaderboardVisibility,
      setLeaderboardPublic,
      feedError,
      feedProjects,
      refreshFeed,
      eventSetup,
      updateRubric,
      updateTracks,
      admins,
      addAdminByEmail,
      invitedJudges,
      inviteJudgeByEmail,
      setJudgeStatus,
      winnerAnnouncedAt,
      announceWinners,
      persistJudgeScore,
      refreshAppSettings,
      refreshProfile,
      demoPasswordAuth,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp requires AppProvider')
  return v
}
