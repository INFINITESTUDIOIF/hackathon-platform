export type RubricCriterion = {
  id: string
  name: string
  description: string
  maxPoints: number
  weightPercent: number
}

export type InvitedJudge = {
  id: string
  email: string
  status: 'invited' | 'accepted'
}

export type AdminUser = {
  id: string
  email: string
}

export type EventSetup = {
  name: string
  tagline: string
  description: string
  bannerDataUrl: string | null
  submissionStart: string
  submissionEnd: string
  judgingStart: string
  winnerAnnouncement: string
  autoLock: boolean
  scoringMode: 'rubric' | 'stars'
  rubric: RubricCriterion[]
  tracks: string[]
}

export const defaultEventSetup = (): EventSetup => ({
  name: 'Spring Build 2026',
  tagline: 'Ship ideas that matter.',
  description:
    'A weekend for builders — open tracks, fair judging, and live leaderboard.',
  bannerDataUrl: null,
  submissionStart: '2026-04-01',
  submissionEnd: '2026-04-02',
  judgingStart: '2026-04-02',
  winnerAnnouncement: '2026-04-03',
  autoLock: true,
  scoringMode: 'rubric',
  rubric: [
    {
      id: 'r1',
      name: 'Innovation',
      description: 'Novelty and creative problem-solving.',
      maxPoints: 10,
      weightPercent: 25,
    },
    {
      id: 'r2',
      name: 'Design',
      description: 'UX, UI, and polish.',
      maxPoints: 10,
      weightPercent: 25,
    },
    {
      id: 'r3',
      name: 'Impact',
      description: 'Usefulness and potential reach.',
      maxPoints: 10,
      weightPercent: 25,
    },
    {
      id: 'r4',
      name: 'Execution',
      description: 'Working demo and technical quality.',
      maxPoints: 10,
      weightPercent: 25,
    },
  ],
  tracks: ['FinTech', 'Healthcare', 'AI/ML', 'DevTools', 'Sustainability'],
})
