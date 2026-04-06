import jwt from 'jsonwebtoken'

export function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '30d' })
}

export function authMiddleware(req, res, next) {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) {
    req.userId = null
    return next()
  }
  try {
    const p = jwt.verify(h.slice(7), process.env.JWT_SECRET)
    req.userId = p.sub
  } catch {
    req.userId = null
  }
  next()
}

export function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

export function endOfDayUtc(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const d = new Date(`${dateStr}T23:59:59.999Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isSubmissionLocked(event, settings) {
  if (!event?.autoLock) return false
  const end = endOfDayUtc(event.submissionEnd)
  if (!end) return false
  return Date.now() > end.getTime()
}
