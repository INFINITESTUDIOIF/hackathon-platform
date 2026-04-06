import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import { AppShell } from './components/layout/AppShell'
import { AuthPage } from './pages/AuthPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { JudgeFeedPage } from './pages/JudgeFeedPage'
import { JudgeDashboardPage } from './pages/JudgeDashboardPage'
import { ScoringPage } from './pages/ScoringPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { AdminPage } from './pages/AdminPage'
import { EventSetupPage } from './pages/EventSetupPage'
import { TeamPage } from './pages/TeamPage'
import { PendingApprovalPage } from './pages/PendingApprovalPage'
import { TeamRegisterPage } from './pages/TeamRegisterPage'
import { ProjectSubmitPage } from './pages/ProjectSubmitPage'

function RequireAuthOnly({ children }: { children: React.ReactNode }) {
  const { authenticated } = useApp()
  if (!authenticated) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function RequireApproved({ children }: { children: React.ReactNode }) {
  const {
    supabaseMode,
    useApiBackend,
    profile,
    profileLoading,
    authenticated,
    demoPasswordAuth,
  } = useApp()
  if (!authenticated) return <Navigate to="/auth" replace />

  if (useApiBackend) {
    if (profileLoading) {
      return (
        <div className="p-12 text-center text-sm text-zinc-400">
          Loading your profile…
        </div>
      )
    }
    if (!profile) return <Navigate to="/auth" replace />
    if (profile.role === 'admin') return <>{children}</>
    if (profile.role === 'team' && !profile.team_id) {
      return <Navigate to="/team/register" replace />
    }
    if (profile.approval_status !== 'approved') {
      return <Navigate to="/pending-approval" replace />
    }
    return <>{children}</>
  }

  if (!supabaseMode) return <>{children}</>
  if (demoPasswordAuth) return <>{children}</>
  if (profileLoading) {
    return (
      <div className="p-12 text-center text-sm text-zinc-400">Loading your profile…</div>
    )
  }
  if (!profile) return <Navigate to="/auth" replace />
  if (profile.role === 'admin') return <>{children}</>
  if (profile.role === 'team' && !profile.team_id) {
    return <Navigate to="/team/register" replace />
  }
  if (profile.approval_status !== 'approved') {
    return <Navigate to="/pending-approval" replace />
  }
  return <>{children}</>
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuthOnly>
      <RequireApproved>{children}</RequireApproved>
    </RequireAuthOnly>
  )
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { authenticated, role } = useApp()
  if (!authenticated) return <Navigate to="/auth" replace />
  if (role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireJudge({ children }: { children: React.ReactNode }) {
  const { authenticated, role } = useApp()
  if (!authenticated) return <Navigate to="/auth" replace />
  if (role !== 'judge') return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireTeam({ children }: { children: React.ReactNode }) {
  const { authenticated, role } = useApp()
  if (!authenticated) return <Navigate to="/auth" replace />
  if (role !== 'team') return <Navigate to="/" replace />
  return <>{children}</>
}

function HomeRedirect() {
  const {
    authenticated,
    role,
    supabaseMode,
    useApiBackend,
    profile,
    profileLoading,
    demoPasswordAuth,
  } = useApp()

  if (!authenticated) return <Navigate to="/auth" replace />

  if (useApiBackend) {
    if (profileLoading) {
      return (
        <div className="p-12 text-center text-sm text-zinc-400">Loading…</div>
      )
    }
    if (!profile) return <Navigate to="/auth" replace />
    if (profile.role === 'admin') return <Navigate to="/admin" replace />
    if (profile.role === 'team' && !profile.team_id) {
      return <Navigate to="/team/register" replace />
    }
    if (profile.approval_status !== 'approved') {
      return <Navigate to="/pending-approval" replace />
    }
    if (profile.role === 'team') return <Navigate to="/team" replace />
    return <Navigate to="/judge/feed" replace />
  }

  if (supabaseMode) {
    if (demoPasswordAuth) {
      if (role === 'admin') return <Navigate to="/admin" replace />
      if (role === 'team') return <Navigate to="/team" replace />
      return <Navigate to="/judge/feed" replace />
    }
    if (profileLoading) {
      return (
        <div className="p-12 text-center text-sm text-zinc-400">Loading…</div>
      )
    }
    if (!profile) return <Navigate to="/auth" replace />
    if (profile.role === 'admin') return <Navigate to="/admin" replace />
    if (profile.role === 'team' && !profile.team_id) {
      return <Navigate to="/team/register" replace />
    }
    if (profile.approval_status !== 'approved') {
      return <Navigate to="/pending-approval" replace />
    }
    if (profile.role === 'team') return <Navigate to="/team" replace />
    return <Navigate to="/judge/feed" replace />
  }

  if (role === 'admin') return <Navigate to="/admin" replace />
  if (role === 'team') return <Navigate to="/team" replace />
  return <Navigate to="/judge/feed" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route
        path="/pending-approval"
        element={
          <RequireAuthOnly>
            <PendingApprovalPage />
          </RequireAuthOnly>
        }
      />
      <Route
        path="/team/register"
        element={
          <RequireAuthOnly>
            <TeamRegisterPage />
          </RequireAuthOnly>
        }
      />
      <Route
        path="/judge/feed"
        element={
          <RequireAuth>
            <RequireJudge>
              <JudgeFeedPage />
            </RequireJudge>
          </RequireAuth>
        }
      />
      <Route
        path="/judge/dashboard"
        element={
          <RequireAuth>
            <RequireJudge>
              <JudgeDashboardPage />
            </RequireJudge>
          </RequireAuth>
        }
      />
      <Route
        path="/judge/score/:projectId"
        element={
          <RequireAuth>
            <RequireJudge>
              <ScoringPage />
            </RequireJudge>
          </RequireAuth>
        }
      />
      <Route
        path="/project/:id"
        element={
          <RequireAuth>
            <ProjectDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <RequireAuth>
            <LeaderboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/event-setup"
        element={
          <RequireAuth>
            <RequireAdmin>
              <EventSetupPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/team"
        element={
          <RequireAuth>
            <RequireTeam>
              <TeamPage />
            </RequireTeam>
          </RequireAuth>
        }
      />
      <Route
        path="/team/submit"
        element={
          <RequireAuth>
            <RequireTeam>
              <ProjectSubmitPage />
            </RequireTeam>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  )
}
