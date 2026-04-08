import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { FloatingAppFrame } from './FloatingAppFrame'
import { LayoutDashboard, ShieldCheck, UserCircle, LogOut, Trophy, CheckCircle2, FileText } from 'lucide-react'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, profile, signOut } = useApp()
  const loc = useLocation()
  const isAuth = loc.pathname.startsWith('/auth')
  const isOnboarding = loc.pathname.startsWith('/onboarding')

  if (!session || isAuth || isOnboarding) return <>{children}</>

  const isMainAdmin = profile?.role === 'main_admin'
  const currentRole = profile?.role ?? '—'

  const getActivePanel = () => {
    if (loc.pathname.startsWith('/admin')) return 'admin'
    if (loc.pathname.startsWith('/judge')) return 'judge'
    if (loc.pathname.startsWith('/dashboard')) return 'user'
    return 'none'
  }

  const activePanel = getActivePanel()

  const home =
    profile?.role === 'admin' || profile?.role === 'main_admin'
      ? '/admin'
      : profile?.role === 'judge'
        ? '/judge'
        : '/dashboard'

  return (
    <FloatingAppFrame>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Main Admin Panel Switcher Slider (Top) */}
        {isMainAdmin && (
          <div className="flex-none flex h-16 w-full items-center justify-center border-b border-white/10 bg-[#090b1f]/80 backdrop-blur-xl px-6 z-[60]">
            <div className="relative flex w-full max-w-md items-center gap-1 rounded-2xl bg-white/[0.03] p-1 border border-white/5">
              {/* Sliding indicator */}
              <div 
                className="absolute h-[calc(100%-8px)] rounded-xl gradient-accent shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all duration-500 ease-out"
                style={{
                  width: 'calc(33.33% - 4px)',
                  left: activePanel === 'admin' ? '4px' : activePanel === 'judge' ? '33.33%' : activePanel === 'user' ? '66.66%' : '4px',
                  opacity: activePanel === 'none' ? 0 : 1
                }}
              />
              
              <Link
                to="/admin"
                className={`relative z-10 flex flex-1 items-center justify-center gap-2 py-2 text-[11px] font-black uppercase tracking-wider transition-colors duration-300 ${activePanel === 'admin' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
              <Link
                to="/judge"
                className={`relative z-10 flex flex-1 items-center justify-center gap-2 py-2 text-[11px] font-black uppercase tracking-wider transition-colors duration-300 ${activePanel === 'judge' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Trophy className="h-3.5 w-3.5" />
                Judge
              </Link>
              <Link
                to="/dashboard"
                className={`relative z-10 flex flex-1 items-center justify-center gap-2 py-2 text-[11px] font-black uppercase tracking-wider transition-colors duration-300 ${activePanel === 'user' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <UserCircle className="h-3.5 w-3.5" />
                User
              </Link>
            </div>
            
            {/* User Profile Summary in Top Bar */}
            <div className="absolute right-6 flex items-center gap-4">
              <div className="hidden flex-col items-end sm:flex">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">Main Admin</span>
                <span className="text-[11px] font-bold text-zinc-300">{profile?.email}</span>
              </div>
              <button 
                onClick={() => void signOut()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
          {/* Left Sidebar for Navigation */}
          <aside className="w-full lg:w-72 sidebar-glass flex flex-col shrink-0 overflow-hidden">
            <div className="p-8">
              <Link
                to={home}
                className="flex items-center gap-3.5 font-black tracking-tighter text-white text-2xl group"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl gradient-accent text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] group-hover:scale-110 transition-transform duration-300">
                  A
                </span>
                <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">AEVINITE</span>
              </Link>
            </div>

            <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto custom-scrollbar">
              <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 mt-2">Primary Controls</p>
              
              {/* Context-aware primary links */}
              {profile?.role === 'admin' && (
                <Link 
                  to="/admin" 
                  className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold text-[13px] ${loc.pathname.startsWith('/admin') ? 'nav-link-active' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'}`}
                >
                  <ShieldCheck className={`w-5 h-5 ${loc.pathname.startsWith('/admin') ? 'text-violet-400' : ''}`} />
                  Admin Dashboard
                </Link>
              )}

              {isMainAdmin && (
                <Link 
                  to={activePanel === 'admin' ? '/admin' : activePanel === 'judge' ? '/judge' : '/dashboard'}
                  className="relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold text-[13px] nav-link-active"
                >
                  <LayoutDashboard className="w-5 h-5 text-violet-400" />
                  {activePanel === 'admin' ? 'Admin View' : activePanel === 'judge' ? 'Judge View' : 'User View'}
                </Link>
              )}

              {profile?.role === 'judge' && !isMainAdmin && (
                <Link 
                  to="/judge" 
                  className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold text-[13px] ${loc.pathname.startsWith('/judge') ? 'nav-link-active' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'}`}
                >
                  <ShieldCheck className={`w-5 h-5 ${loc.pathname.startsWith('/judge') ? 'text-violet-400' : ''}`} />
                  Judge Panel
                </Link>
              )}

              {profile?.role === 'user' && !isMainAdmin && (
                <>
                  <Link 
                    to="/dashboard" 
                    className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold text-[13px] ${loc.pathname === '/dashboard' ? 'nav-link-active' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'}`}
                  >
                    <LayoutDashboard className={`w-5 h-5 ${loc.pathname === '/dashboard' ? 'text-violet-400' : ''}`} />
                    User Dashboard
                  </Link>
                  <Link 
                    to="/dashboard?tab=completed" 
                    className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold text-[13px] ${loc.search.includes('tab=completed') ? 'nav-link-active' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'}`}
                  >
                    <Trophy className={`w-5 h-5 ${loc.search.includes('tab=completed') ? 'text-violet-400' : ''}`} />
                    Hackathon Results
                  </Link>
                </>
              )}

              <div className="pt-8">
                <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Quick Links</p>
                <Link to="/" className="flex items-center gap-3.5 px-4 py-3 rounded-2xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] transition-all font-bold text-[13px]">
                  <FileText className="w-5 h-5" />
                  Guidelines
                </Link>
                <Link to="/" className="flex items-center gap-3.5 px-4 py-3 rounded-2xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] transition-all font-bold text-[13px]">
                  <CheckCircle2 className="w-5 h-5" />
                  Support
                </Link>
              </div>
            </nav>

            <div className="p-6 mt-auto">
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-[24px] p-4 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl gradient-accent p-[1px]">
                    <div className="w-full h-full rounded-2xl bg-zinc-900 flex items-center justify-center text-sm font-black text-white">
                      {profile?.username?.substring(0, 2).toUpperCase() ?? profile?.email?.substring(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-white truncate">@{profile?.username ?? 'user'}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">{currentRole.replace('_', ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={() => void signOut()}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-800/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 border border-white/[0.05] transition-all duration-300 font-bold text-[12px]"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </aside>

          <main className="flex-1 overflow-auto bg-[#050508]/50 relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(139,92,246,0.08),transparent_50%)] pointer-events-none" />
            <div className="relative z-10">{children}</div>
          </main>
        </div>
      </div>
    </FloatingAppFrame>
  )
}

