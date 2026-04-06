/**
 * Always treated as platform admin on Google sign-in (merged with VITE_ADMIN_EMAILS).
 * Example: your production organizer Gmail.
 */
export const BUILTIN_ADMIN_EMAILS = ['aevinite@gmail.com'] as const

/** Comma-separated list in VITE_ADMIN_EMAILS — additional admins on first Google signup */
export function getAdminEmails(): string[] {
  const raw = import.meta.env.VITE_ADMIN_EMAILS as string | undefined
  const fromEnv = raw
    ? raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : []
  const set = new Set<string>([...BUILTIN_ADMIN_EMAILS, ...fromEnv])
  return Array.from(set)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  return getAdminEmails().includes(e)
}
