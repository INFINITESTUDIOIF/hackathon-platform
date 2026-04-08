import { Eye, EyeOff, LockKeyhole, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonClass'
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
  const { signInWithGoogle, signInWithPassword, supabaseMode } =
    useApp()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signupSent, setSignupSent] = useState(false)

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithPassword(email, password)
      pushToast('Signed in successfully.')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        setSubmitting(false)
        return
      }
      
      // Store email and password to autofill after Google verification returns.
      localStorage.setItem('aevinite:signup_password', password)
      localStorage.setItem('aevinite:signup_email', email.trim().toLowerCase())
      
      // Instead of traditional email signup, redirect to Google for verification as requested.
      // This ensures the email is a valid Google account.
      await signInWithGoogle({ next: '/onboarding' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.')
      setSubmitting(false)
    }
  }

  const oauthGoogle = () => {
    if (!supabaseMode) {
      setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use Google sign-in.')
      return
    }
    void (async () => {
      setError(null)
      setSubmitting(true)
      try {
        await signInWithGoogle({ next: '/' })
      } catch (err) {
        setSubmitting(false)
        setError(
          err instanceof Error ? err.message : 'Google sign-in failed. Please try again.',
        )
      }
    })()
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
                AEVINITE
                <br />
                Access
              </h1>
              <p className="mt-4 text-sm uppercase tracking-[0.22em] text-violet-200/80">
                Role-based hackathon platform
              </p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">User · Judge · Admin</p>
                <p className="text-xs text-zinc-300">Isolated panels, shared backend</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">Approval gated</p>
                <p className="text-xs text-zinc-300">Participants wait for admin approval</p>
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
              {supabaseMode ? 'Email, password, or Google' : 'Configure Supabase to continue'}
            </p>

            <div className="mt-8 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.02] p-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setSignupSent(false)
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
                  setSignupSent(false)
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

            {mode === 'signup' ? (
              <div className="mt-8 space-y-4">
                <Button
                  size="lg"
                  type="button"
                  className="w-full rounded-xl text-base font-semibold uppercase tracking-wider"
                  onClick={oauthGoogle}
                >
                  <GoogleColorLogo className="h-5 w-5" />
                  Continue with Google
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase tracking-[0.2em]">
                    <span className="bg-[#0a0c18] px-3 text-zinc-500">Or with email</span>
                  </div>
                </div>

                {signupSent ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-300">
                    <p className="font-semibold text-zinc-100">Verify your email</p>
                    <p className="mt-1 text-zinc-400">
                      We sent a verification link to{' '}
                      <span className="text-zinc-200">{email.trim()}</span>. After you
                      verify, you’ll be redirected to finish your username + password setup.
                    </p>
                    <button
                      type="button"
                      className="mt-3 text-sm font-medium text-violet-400 hover:text-violet-300"
                      onClick={() => {
                        setSignupSent(false)
                        setPassword('')
                        setError(null)
                      }}
                    >
                      Use a different email
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitSignup} className="space-y-4">
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
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    <Button
                      size="lg"
                      type="submit"
                      className="w-full rounded-xl"
                      disabled={submitting}
                    >
                      Create account
                    </Button>
                  </form>
                )}
              </div>
            ) : (
              <>
                <form onSubmit={submitLogin} className="mt-8 space-y-4">
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
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

                {supabaseMode && (
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
                      onClick={oauthGoogle}
                      className={buttonClass('secondary', 'lg', 'w-full gap-3 rounded-xl')}
                    >
                      <GoogleColorLogo className="h-5 w-5" />
                      Google
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

