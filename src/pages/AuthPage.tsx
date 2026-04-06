import { Code2, Eye, EyeOff, LockKeyhole, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonClass'
import { supabase } from '../lib/supabase'
import { mongoCheckEmailExists, mongoRegister } from '../services/mongoApi'
import { useToast } from '../context/ToastContext'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'

/** Official multi-color Google G (brand colors). */
function GoogleColorLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function AuthPage() {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const {
    loginWithPassword,
    signInWithGoogle,
    supabaseMode,
    useApiBackend,
  } = useApp()

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotMsg(null)
    const em = forgotEmail.trim().toLowerCase()
    if (!em.includes('@')) {
      setForgotMsg('Enter a valid email.')
      return
    }
    setForgotBusy(true)
    try {
      if (useApiBackend) {
        const exists = await mongoCheckEmailExists(em)
        if (!exists) {
          setForgotMsg('No account exists for that email.')
          return
        }
      }
      if (supabase && supabaseMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(em, {
          redirectTo: `${window.location.origin}/auth`,
        })
        if (error) {
          setForgotMsg(error.message || 'Could not send reset email.')
          return
        }
        setForgotMsg('If an account exists, check your email for a reset link.')
        return
      }
      if (useApiBackend) {
        setForgotMsg(
          'Add Supabase to your project to send reset emails, or contact an organizer.',
        )
        return
      }
      setForgotMsg('Password reset is not available in this mode.')
    } finally {
      setForgotBusy(false)
    }
  }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [signupStep, setSignupStep] = useState<1 | 2>(1)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [username, setUsername] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMsg, setForgotMsg] = useState<string | null>(null)
  const [forgotBusy, setForgotBusy] = useState(false)

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const ok = await loginWithPassword(email, password)
      if (ok) {
        pushToast('Signed in successfully.')
        navigate('/')
        return
      }
    } finally {
      setSubmitting(false)
    }
    if (supabaseMode && !useApiBackend && supabase) {
      try {
        const { error: authErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (authErr) {
          setError(authErr.message || 'Invalid email or password. Try again.')
          return
        }
        pushToast('Signed in successfully.')
        navigate('/')
      } finally {
        setSubmitting(false)
      }
      return
    }
    setError('Invalid email or password. Try again.')
  }

  const oauthGoogle = () => {
    if (supabaseMode) {
      void (async () => {
        setError(null)
        setSubmitting(true)
        try {
          await signInWithGoogle()
        } catch (err) {
          setSubmitting(false)
          setError(
            err instanceof Error
              ? err.message
              : 'Google sign-in failed. Please try again.',
          )
        }
      })()
      return
    }
    setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use Google sign-in.')
  }

  const submitSignupStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSignupStep(2)
  }

  const completeSignupApi = async () => {
    setError(null)
    setSubmitting(true)
    try {
      if (!fullName.trim()) {
        setError('Please enter your name.')
        setSubmitting(false)
        return
      }
      const u = username.trim().toLowerCase().replace(/^@+/g, '')
      if (!/^[a-z0-9_]{3,24}$/.test(u)) {
        setError('Username: 3–24 characters, letters, numbers, underscores only.')
        setSubmitting(false)
        return
      }
      await mongoRegister(email.trim(), password, fullName.trim(), u)
      pushToast('Account created. Welcome!')
      window.setTimeout(() => {
        window.location.assign('/')
      }, 700)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed.'
      if (/already registered|already|in use/i.test(msg)) {
        setError('This email or username is already registered. Please sign in.')
      } else {
        setError(msg)
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="purple-auth-bg min-h-dvh p-4 sm:p-8">
      {submitting && <FullScreenLoader label="Just a moment…" />}
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-7xl overflow-hidden rounded-[34px] purple-auth-panel lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden overflow-hidden border-r border-white/10 p-8 lg:block xl:p-12">
          <img
            src="https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1600&q=80"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700/40 via-[#090b1f]/85 to-black/95" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-600/25 text-violet-200 backdrop-blur-md">
                <Sparkles className="h-7 w-7" />
              </div>
              <h1 className="mt-6 max-w-md text-5xl font-black uppercase leading-[0.95] tracking-tight text-white">
                Access
                <br />
                System
              </h1>
              <p className="mt-4 text-sm uppercase tracking-[0.22em] text-violet-200/80">
                Initialize secure session
              </p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">Live hackathon hub</p>
                <p className="text-xs text-zinc-300">
                  Teams, judges, and organizers in one flow
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">Fair scoring</p>
                <p className="text-xs text-zinc-300">Rubric, feed, and leaderboard</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-10 sm:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-md">
            <h2 className="text-4xl font-black uppercase tracking-wide text-zinc-100">
              {mode === 'login' ? 'Login' : 'Sign Up'}
            </h2>
            <p className="mt-2 text-sm uppercase tracking-[0.16em] text-zinc-400">
              {useApiBackend
                ? 'Secure access via MongoDB API'
                : supabaseMode
                  ? 'Email, password, or Google'
                  : 'Enter your account credentials'}
            </p>

            <div className="mt-8 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.02] p-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setSignupStep(1)
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  mode === 'login'
                    ? 'gradient-accent text-white shadow-[0_0_18px_rgba(124,58,237,0.35)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setError(null)
                  setSignupStep(1)
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  mode === 'signup'
                    ? 'gradient-accent text-white shadow-[0_0_18px_rgba(124,58,237,0.35)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sign Up
              </button>
            </div>

            {mode === 'signup' && useApiBackend ? (
              <div className="mt-8 space-y-5">
                {supabaseMode && (
                  <Button
                    size="lg"
                    type="button"
                    className="w-full rounded-xl text-base font-semibold uppercase tracking-wider"
                    onClick={() => void oauthGoogle()}
                  >
                    <GoogleColorLogo className="h-5 w-5" />
                    Sign up with Google
                  </Button>
                )}
                {signupStep === 1 ? (
                  <form onSubmit={submitSignupStep1} className="space-y-4">
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Email
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        className="input-dark mt-2 w-full rounded-xl border-white/10 bg-zinc-950/70"
                        placeholder="you@gmail.com"
                      />
                    </label>
                    <label className="relative block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Password
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        className="input-dark mt-2 w-full rounded-xl border-white/10 bg-zinc-950/70 pr-11"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-2 top-[1.85rem] rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        onClick={() => setShowPass((s) => !s)}
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                      >
                        {showPass ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </label>
                    <label className="relative block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Confirm password
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        className="input-dark mt-2 w-full rounded-xl border-white/10 bg-zinc-950/70 pr-11"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-2 top-[1.85rem] rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        onClick={() => setShowConfirm((s) => !s)}
                        aria-label={
                          showConfirm ? 'Hide confirm password' : 'Show confirm password'
                        }
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </label>
                    {error && (
                      <p
                        className="rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-300"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                    <Button size="lg" type="submit" className="w-full rounded-xl">
                      Next — profile & verification
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-500">
                      Step 2 of 2 · Choose a unique username and display name.
                    </p>
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Username
                      <input
                        value={username}
                        onChange={(e) =>
                          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                        }
                        className="input-dark mt-2 w-full rounded-xl border-white/10 bg-zinc-950/70"
                        placeholder="your_handle"
                        autoComplete="username"
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Display name
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="input-dark mt-2 w-full rounded-xl border-white/10 bg-zinc-950/70"
                        placeholder="Rishi"
                      />
                    </label>
                    {error && (
                      <p
                        className="rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-300"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                    <Button
                      size="lg"
                      type="button"
                      className="w-full rounded-xl"
                      disabled={submitting}
                      onClick={() => void completeSignupApi()}
                    >
                      {submitting ? 'Creating account…' : 'Create account'}
                    </Button>
                    <button
                      type="button"
                      className="w-full text-center text-sm text-violet-400 hover:text-violet-300"
                      onClick={() => {
                        setSignupStep(1)
                        setError(null)
                      }}
                    >
                      ← Back
                    </button>
                  </div>
                )}
              </div>
            ) : mode === 'signup' && supabaseMode ? (
              <div className="mt-8 space-y-4">
                <Button
                  size="lg"
                  type="button"
                  className="w-full rounded-xl text-base font-semibold uppercase tracking-wider"
                  onClick={() => void oauthGoogle()}
                >
                  <GoogleColorLogo className="h-5 w-5" />
                  Sign up with Google
                </Button>
                {error && (
                  <p
                    className="rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-300"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
              </div>
            ) : (
              <>
                <form
                  onSubmit={(e) => void submitLogin(e)}
                  className="mt-8 space-y-4"
                >
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Email Address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="input-dark mt-2 w-full rounded-xl border-white/10 bg-zinc-950/70"
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="relative block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Password
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className="input-dark mt-2 w-full rounded-xl border-white/10 bg-zinc-950/70 pr-11"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-2 top-[1.85rem] rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                      onClick={() => setShowPass((s) => !s)}
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </label>
                  {error && (
                    <p
                      className="rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-300"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-xs font-medium text-violet-400 hover:text-violet-300"
                    onClick={() => {
                      setForgotOpen(true)
                      setForgotEmail(email.trim())
                      setForgotMsg(null)
                    }}
                  >
                    Forgot password?
                  </button>
                  <Button
                    size="lg"
                    className="mt-1 w-full rounded-xl text-base font-semibold uppercase tracking-wider"
                    type="submit"
                    disabled={submitting}
                  >
                    <LockKeyhole className="h-5 w-5" />
                    {submitting ? 'Signing in…' : 'Authorize Login'}
                  </Button>
                </form>

                {supabaseMode && mode === 'login' && (
                  <>
                    <div className="relative py-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10" />
                      </div>
                      <div className="relative flex justify-center text-[11px] uppercase tracking-[0.2em]">
                        <span className="bg-[#0a0c18] px-3 text-zinc-500">
                          Or sign in with Google
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void oauthGoogle()}
                      className={buttonClass('secondary', 'lg', 'w-full gap-3 rounded-xl')}
                    >
                      <GoogleColorLogo className="h-5 w-5" />
                      Google
                    </button>
                  </>
                )}

                {!supabaseMode && !useApiBackend && (
                  <>
                    <div className="relative py-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10" />
                      </div>
                      <div className="relative flex justify-center text-[11px] uppercase tracking-[0.2em]">
                        <span className="bg-[#0a0c18] px-3 text-zinc-500">
                          Or continue via
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={oauthGoogle}
                      className={buttonClass('secondary', 'lg', 'w-full gap-2 rounded-xl')}
                    >
                      <GoogleColorLogo className="h-5 w-5" />
                      Google
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setError('GitHub OAuth: enable in Supabase or use Google.')
                      }
                      className={buttonClass('secondary', 'lg', 'mt-3 w-full rounded-xl')}
                    >
                      <Code2 className="h-5 w-5" />
                      GitHub
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {forgotOpen && (
        <div
          className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
          aria-labelledby="forgot-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-xl">
            <h3 id="forgot-title" className="text-lg font-semibold text-zinc-100">
              Forgot password
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              We only send a reset if this email is already registered.
            </p>
            <form onSubmit={(e) => void submitForgot(e)} className="mt-4 space-y-3">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="input-dark w-full"
                placeholder="you@example.com"
                required
              />
              {forgotMsg && (
                <p
                  className={`text-sm ${/No account|not available|not configured/i.test(forgotMsg) ? 'text-amber-300' : 'text-emerald-300'}`}
                >
                  {forgotMsg}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={forgotBusy} className="flex-1">
                  {forgotBusy ? 'Sending…' : 'Send reset'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setForgotOpen(false)
                    setForgotMsg(null)
                  }}
                >
                  Close
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
