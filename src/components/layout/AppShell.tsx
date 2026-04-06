import { Link, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BellRing,
  CalendarCog,
  Gavel,
  LayoutGrid,
  LogOut,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import clsx from 'clsx'
import { isParticipantRole } from '../../data/mock'
import { useApp } from '../../context/AppContext'
import { Badge } from '../ui/Badge'
import { FloatingAppFrame } from './FloatingAppFrame'
import { Button } from '../ui/Button'
import { mongoSetPassword } from '../../services/mongoApi'

const navJudge = [
  { to: '/judge/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { to: '/judge/feed', label: 'Projects', icon: BarChart3 },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
]

const navAdmin = [
  { to: '/admin', label: 'Dashboard', icon: Shield },
  { to: '/admin/event-setup', label: 'Event setup', icon: CalendarCog },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
]

const navTeam = [
  { to: '/team', label: 'Dashboard', icon: Users },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
]

function ConfettiBurst() {
  const pieces = Array.from({ length: 52 }, (_, i) => ({
    id: i,
    left: `${(i * 17 + 7) % 96}%`,
    delay: `${(i % 10) * 0.06}s`,
    bg: ['#a78bfa', '#f472b6', '#22d3ee', '#fbbf24', '#34d399', '#fb7185'][
      i % 6
    ],
  }))
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[85] overflow-hidden"
      aria-hidden
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="hackathon-confetti-piece"
          style={{
            left: p.left,
            top: '-8vh',
            animationDelay: p.delay,
            backgroundColor: p.bg,
          }}
        />
      ))}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    role,
    authenticated,
    logout,
    winnerAnnouncedAt,
    profile,
    useApiBackend,
    signInWithGoogle,
    refreshProfile,
  } = useApp()
  const [party, setParty] = useState(false)
  const [winnerToastOpen, setWinnerToastOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [lastWinnerAtSeen, setLastWinnerAtSeen] = useState<string | null>(null)
  const [setupPass, setSetupPass] = useState('')
  const [setupName, setSetupName] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)
  const [setupErr, setSetupErr] = useState<string | null>(null)

  useEffect(() => {
    const onAnnounce = () => {
      setParty(true)
      window.setTimeout(() => setParty(false), 2600)
      setWinnerToastOpen(true)
      window.setTimeout(() => setWinnerToastOpen(false), 3000)
    }
    window.addEventListener('hackathon:winners-announced', onAnnounce)
    return () =>
      window.removeEventListener('hackathon:winners-announced', onAnnounce)
  }, [])

  useEffect(() => {
    if (!winnerAnnouncedAt) return
    if (winnerAnnouncedAt === lastWinnerAtSeen) return
    setLastWinnerAtSeen(winnerAnnouncedAt)
    setWinnerToastOpen(true)
    window.setTimeout(() => setWinnerToastOpen(false), 3000)
  }, [winnerAnnouncedAt, lastWinnerAtSeen])

  const loc = useLocation()
  const isAuth = loc.pathname.startsWith('/auth')

  if (!authenticated || isAuth) {
    return <>{children}</>
  }

  const items =
    role === 'admin' ? navAdmin : isParticipantRole(role) ? navTeam : navJudge

  const needsSetup = useMemo(() => {
    if (!useApiBackend) return false
    if (!profile) return false
    return Boolean(profile.needs_profile_setup)
  }, [useApiBackend, profile])

  useEffect(() => {
    if (!needsSetup) {
      setSetupOpen(false)
      setSetupErr(null)
      setSetupBusy(false)
      return
    }
    setSetupOpen(true)
  }, [needsSetup])

  return (
    <FloatingAppFrame>
      <div className="flex min-h-0 min-h-full flex-col">
        <header className="sticky top-0 z-50 border-b border-white/[0.06] glass">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link
              to={
                role === 'admin'
                  ? '/admin'
                  : isParticipantRole(role)
                    ? '/team'
                    : '/judge/dashboard'
              }
              className="flex items-center gap-2 font-semibold tracking-tight text-zinc-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl gradient-accent text-white shadow-md shadow-violet-900/40">
                <Gavel className="h-4 w-4" aria-hidden />
              </span>
              <span className="hidden sm:inline">Jury</span>
            </Link>

            <nav className="hidden flex-1 items-center justify-center gap-0.5 sm:flex sm:gap-1">
              {items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-zinc-800/90 text-zinc-100 shadow-sm ring-1 ring-white/10'
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  <span className="hidden md:inline">{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <Badge variant="muted" className="hidden capitalize lg:inline-flex">
                {role ?? 'guest'}
              </Badge>
              <button
                type="button"
                className="rounded-lg p-2 text-zinc-400 transition-all duration-200 hover:bg-zinc-800 hover:text-zinc-100 hover:scale-105 active:scale-95"
                title="Sign out"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto">{children}</main>

        {party && <ConfettiBurst />}

        {winnerToastOpen && (
          <div className="fixed right-4 top-16 z-[90] w-[min(92vw,420px)]">
            <div className="hackathon-winner-banner relative overflow-hidden rounded-2xl border border-violet-400/35 bg-gradient-to-br from-violet-950/95 via-zinc-950/98 to-zinc-950 p-4 shadow-[0_0_44px_rgba(124,58,237,0.45)] backdrop-blur-md">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-500/25 blur-2xl" />
              <p className="flex items-center gap-2 pr-8 text-sm font-bold uppercase tracking-wider text-violet-200">
                <Sparkles className="h-4 w-4 text-amber-300" />
                Winners announced
              </p>
              <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-zinc-200">
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                Results are live on the leaderboard.
              </p>
            </div>
          </div>
        )}

        {setupOpen && needsSetup && (
          <div className="fixed inset-0 z-[95] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-[min(92vw,520px)] rounded-3xl border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(124,58,237,0.25)]">
              <p className="text-sm font-bold uppercase tracking-wider text-violet-200">
                Finish account setup
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                Choose a unique username and create your app password to finish signup.
              </p>

              <div className="mt-5 space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Username
                  <input
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    className="input-dark mt-2 w-full rounded-xl border-white/10 bg-zinc-950/70"
                    placeholder="your_handle"
                    autoComplete="username"
                    disabled={setupBusy}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  App password
                  <input
                    type="password"
                    value={setupPass}
                    onChange={(e) => setSetupPass(e.target.value)}
                    className="input-dark mt-2 w-full rounded-xl border-white/10 bg-zinc-950/70"
                    placeholder="••••••••"
                    disabled={setupBusy}
                  />
                </label>
                <Button
                  size="sm"
                  className="w-full rounded-xl"
                  disabled={
                    setupBusy ||
                    setupPass.length < 6 ||
                    !/^[a-z0-9_]{3,24}$/.test(setupName.trim().toLowerCase())
                  }
                  onClick={() => {
                    void (async () => {
                      setSetupErr(null)
                      setSetupBusy(true)
                      try {
                        await mongoSetPassword({
                          password: setupPass,
                          username: setupName.trim().toLowerCase(),
                        })
                        setSetupPass('')
                        setSetupName('')
                        await refreshProfile()
                      } catch (e) {
                        setSetupErr(
                          e instanceof Error ? e.message : 'Could not set password.',
                        )
                      } finally {
                        setSetupBusy(false)
                      }
                    })()
                  }}
                >
                  {setupBusy ? 'Saving…' : 'Save and continue'}
                </Button>
              </div>

              {profile?.google_verified === false && (
                <div className="mt-5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full rounded-xl"
                    disabled={setupBusy}
                    onClick={() => void signInWithGoogle()}
                  >
                    Link Google account
                  </Button>
                  <p className="mt-2 text-xs text-zinc-500">
                    Optional: link Google to the same email you used to sign in.
                  </p>
                </div>
              )}

              {setupErr && (
                <p
                  className="mt-4 rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-300"
                  role="alert"
                >
                  {setupErr}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Mobile bottom navigation (native-feel thumb zones) */}
        <nav className="sm:hidden border-t border-white/[0.06] bg-zinc-950/55 backdrop-blur-md">
          <div className="mx-auto grid max-w-7xl grid-cols-3 px-2 py-2">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'group flex flex-col items-center justify-center rounded-xl px-2 py-2 transition-all duration-200 ease-in-out',
                    isActive
                      ? 'bg-white/5 text-zinc-100 ring-1 ring-white/10 shadow-[0_0_20px_rgba(124,58,237,0.25)] is-active'
                      : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200',
                  )
                }
              >
                <Icon
                  className="h-5 w-5 opacity-95 transition-transform duration-200 group-[.is-active]:scale-110 group-[.is-active]:drop-shadow-[0_0_12px_rgba(124,58,237,0.35)] group-[.is-active]:text-violet-400"
                  aria-hidden
                />
                <span className="mt-1 text-[11px] font-medium leading-none">
                  {label}
                </span>
              </NavLink>
            ))}
          </div>
        </nav>

        <footer className="hidden border-t border-white/[0.06] bg-zinc-950/50 py-5 text-center text-xs text-zinc-500 sm:block">
          <p>Jury — hackathon judging. Built for clarity under pressure.</p>
        </footer>
      </div>
    </FloatingAppFrame>
  )
}
