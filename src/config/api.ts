const raw = import.meta.env.VITE_API_URL as string | undefined

export const API_URL = raw?.replace(/\/$/, '') ?? ''

/** When set, all hackathon data uses the MongoDB-backed API (server/). */
export const apiMode = Boolean(API_URL)
