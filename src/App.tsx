import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import { AppShell } from './components/layout/AppShell'
import { AuthPage } from './pages/AuthPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { PendingApprovalPage } from './pages/PendingApprovalPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { UserDashboardPage } from './pages/UserDashboardPage'
import { UserEventPage } from './pages/UserEventPage'
import { JudgeHomePage } from './pages/JudgeHomePage'
import { JudgeEventPage } from './pages/JudgeEventPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminEventPage } from './pages/AdminEventPage'

function RequireAuthOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useApp()
  if (loading) return null
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuthOnly>
      {children}
    </RequireAuthOnly>
  )
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile, loading, profileReady } = useApp()
  if (loading || !profileReady) return null
  // Admins should NOT be redirected to onboarding if profile is missing, 
  // they are handled by the email-based detection in AppContext.
  if (!profile) return <Navigate to="/auth" replace />
  if (profile.role !== 'admin' && profile.role !== 'main_admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function RequireJudge({ children }: { children: React.ReactNode }) {
  const { profile, loading, profileReady } = useApp()
  if (loading || !profileReady) return null
  if (!profile) return <Navigate to="/onboarding" replace />
  if (profile.role !== 'judge' && profile.role !== 'main_admin')
    return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireUser({ children }: { children: React.ReactNode }) {
  const { profile, loading, profileReady } = useApp()
  if (loading || !profileReady) return null
  if (!profile) return <Navigate to="/onboarding" replace />
  if (profile.role !== 'user' && profile.role !== 'main_admin')
    return <Navigate to="/" replace />
  if (profile.role === 'user' && !profile.is_approved)
    return <Navigate to="/pending-approval" replace />
  if (profile.role === 'user' && !profile.onboarding_complete)
    return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function HomeRedirect() {
  const { session, profile, loading, profileReady } = useApp()
  if (loading || !profileReady) return null
  if (!session) return <Navigate to="/auth" replace />
  
  // If no profile yet, but it's a main admin email, AppContext will have synthesized it.
  // If still no profile, it's a missing normal user profile -> onboarding.
  if (!profile) return <Navigate to="/onboarding" replace />

  // Admins bypass onboarding complete check
  if (profile.role === 'admin' || profile.role === 'main_admin')
    return <Navigate to="/admin" replace />
    
  if (profile.role === 'judge') return <Navigate to="/judge" replace />
  
  if (!profile.onboarding_complete) return <Navigate to="/onboarding" replace />
  if (!profile.is_approved) return <Navigate to="/pending-approval" replace />
  return <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuthOnly>
            <OnboardingPage />
          </RequireAuthOnly>
        }
      />
      <Route
        path="/pending-approval"
        element={
          <RequireAuthOnly>
            <PendingApprovalPage />
          </RequireAuthOnly>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <RequireUser>
              <UserDashboardPage />
            </RequireUser>
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/events/:eventId"
        element={
          <RequireAuth>
            <RequireUser>
              <UserEventPage />
            </RequireUser>
          </RequireAuth>
        }
      />
      <Route
        path="/judge"
        element={
          <RequireAuth>
            <RequireJudge>
              <JudgeHomePage />
            </RequireJudge>
          </RequireAuth>
        }
      />
      <Route
        path="/judge/events/:eventId"
        element={
          <RequireAuth>
            <RequireJudge>
              <JudgeEventPage />
            </RequireJudge>
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/events/:eventId"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminEventPage />
            </RequireAdmin>
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
