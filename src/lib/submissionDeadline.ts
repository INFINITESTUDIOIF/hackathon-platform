import type { EventSetup } from '../types/event'

/** End of submission day in local time (date input is YYYY-MM-DD). */
export function isPastSubmissionEnd(setup: EventSetup): boolean {
  if (!setup.autoLock || !setup.submissionEnd) return false
  const [y, m, d] = setup.submissionEnd.split('-').map(Number)
  if (!y || !m || !d) return false
  const end = new Date(y, m - 1, d, 23, 59, 59, 999)
  return Date.now() > end.getTime()
}
