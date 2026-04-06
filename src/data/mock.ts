export type Role = 'admin' | 'judge' | 'team' | 'participant'

export function isParticipantRole(r: Role | string | null | undefined): boolean {
  return r === 'team' || r === 'participant'
}

export type Project = {
  id: string
  title: string
  tagline: string
  description: string
  cover: string
  videoPoster: string
  videoSrc: string
  github: string
  demo: string
  category: string
  /** When set (API mode), used for multi-category filtering and display. */
  categories?: string[]
  tech: string[]
  teamName: string
  members: { name: string; avatar: string; role: string }[]
  score?: number
  breakdown?: { label: string; value: number }[]
  judgeFeedback?: { judge: string; score: number; comment: string }[]
}

const avatars = (i: number) =>
  `https://i.pravatar.cc/96?img=${(i % 70) + 1}`

/** Distinct hero images per project (demo catalog — swap for DB media later). */
const COVER_POOL = [
  'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&q=85',
  'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&q=85',
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&q=85',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=85',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=85',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=85',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=85',
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&q=85',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&q=85',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=85',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=85',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=85',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=85',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&q=85',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&q=85',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=85',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=85',
  'https://images.unsplash.com/photo-1525186402429-4bd6b0c4ce7e?w=1200&q=85',
  'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=1200&q=85',
  'https://images.unsplash.com/photo-1504386106331-3e4e71712b38?w=1200&q=85',
  'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&q=85',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=85',
  'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1200&q=85',
  'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&q=85',
] as const

const coverForIndex = (i: number) =>
  COVER_POOL[(i * 11) % COVER_POOL.length]!

const sampleVideo =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'

const baseProjects: Omit<Project, 'score' | 'breakdown'>[] = [
  {
    id: 'p1',
    title: 'NeuralChef',
    tagline: 'AI meal plans from your pantry — zero waste.',
    description:
      'NeuralChef uses multimodal models to scan pantry photos and output personalized recipes with nutrition targets. Built for scale with edge inference.',
    cover: coverForIndex(0),
    videoPoster: coverForIndex(0),
    videoSrc: sampleVideo,
    github: 'https://github.com',
    demo: 'https://example.com',
    category: 'AI/ML',
    tech: ['PyTorch', 'Next.js', 'FastAPI', 'Postgres'],
    teamName: 'Byte & Spice',
    members: [
      { name: 'Ava Chen', avatar: avatars(1), role: 'ML' },
      { name: 'Marcus Lee', avatar: avatars(2), role: 'Full-stack' },
      { name: 'Sam Rivera', avatar: avatars(3), role: 'Design' },
    ],
  },
  {
    id: 'p2',
    title: 'Ledgerly',
    tagline: 'Real-time treasury for student orgs.',
    description:
      'Ledgerly gives treasurers a live view of cash flow with policy-aware approvals and SOC2-minded audit trails.',
    cover: coverForIndex(1),
    videoPoster: coverForIndex(1),
    videoSrc: sampleVideo,
    github: 'https://github.com',
    demo: 'https://example.com',
    category: 'FinTech',
    tech: ['Rust', 'React', 'Stripe', 'Snowflake'],
    teamName: 'Mint Collective',
    members: [
      { name: 'Jordan Kim', avatar: avatars(4), role: 'Backend' },
      { name: 'Priya N.', avatar: avatars(5), role: 'Product' },
    ],
  },
  {
    id: 'p3',
    title: 'PulseGrid',
    tagline: 'Carbon-aware Kubernetes scheduling.',
    description:
      'PulseGrid routes workloads to regions with cleaner energy mix while respecting SLOs — demo shows live grid intensity.',
    cover: coverForIndex(2),
    videoPoster: coverForIndex(2),
    videoSrc: sampleVideo,
    github: 'https://github.com',
    demo: 'https://example.com',
    category: 'DevTools',
    tech: ['Go', 'K8s', 'Prometheus', 'gRPC'],
    teamName: 'GreenOps',
    members: [
      { name: 'Eli Ward', avatar: avatars(6), role: 'Infra' },
      { name: 'Noah Patel', avatar: avatars(7), role: 'SRE' },
      { name: 'Riley Fox', avatar: avatars(8), role: 'UX' },
    ],
  },
  {
    id: 'p4',
    title: 'EchoNotes',
    tagline: 'Meeting notes that actually ship tasks.',
    description:
      'EchoNotes transcribes, extracts action items, and opens PR drafts — tuned for noisy conference rooms.',
    cover: coverForIndex(3),
    videoPoster: coverForIndex(3),
    videoSrc: sampleVideo,
    github: 'https://github.com',
    demo: 'https://example.com',
    category: 'Productivity',
    tech: ['Whisper', 'Electron', 'Supabase'],
    teamName: 'Studio 404',
    members: [{ name: 'Mia Torres', avatar: avatars(9), role: 'Founder' }],
  },
  {
    id: 'p5',
    title: 'AtlasCare',
    tagline: 'Triage copilot for rural clinics.',
    description:
      'AtlasCare prioritizes intake with explainable risk scores and offline-first sync for low-bandwidth sites.',
    cover: coverForIndex(4),
    videoPoster: coverForIndex(4),
    videoSrc: sampleVideo,
    github: 'https://github.com',
    demo: 'https://example.com',
    category: 'Health',
    tech: ['TensorFlow', 'Flutter', 'FHIR'],
    teamName: 'Helix',
    members: [
      { name: 'Dr. Omar H.', avatar: avatars(10), role: 'Clinical' },
      { name: 'Lina S.', avatar: avatars(11), role: 'Engineering' },
    ],
  },
  {
    id: 'p6',
    title: 'SynthMarket',
    tagline: 'Composable storefronts for digital goods.',
    description:
      'SynthMarket lets creators bundle NFTs, SaaS, and courses with one checkout and unified analytics.',
    cover: coverForIndex(5),
    videoPoster: coverForIndex(5),
    videoSrc: sampleVideo,
    github: 'https://github.com',
    demo: 'https://example.com',
    category: 'Web3',
    tech: ['Solidity', 'Next.js', 'The Graph'],
    teamName: 'Vector Labs',
    members: [
      { name: 'Chris V.', avatar: avatars(12), role: 'Smart contracts' },
      { name: 'Yuki T.', avatar: avatars(13), role: 'Frontend' },
    ],
  },
]

export function expandProjects(total: number): Project[] {
  const out: Project[] = []
  for (let i = 0; i < total; i++) {
    const b = baseProjects[i % baseProjects.length]
    const suffix = i >= baseProjects.length ? ` — v${i + 1}` : ''
    const img = coverForIndex(i)
    out.push({
      ...b,
      id: `p-${i + 1}`,
      title: b.title + suffix,
      cover: img,
      videoPoster: img,
    })
  }
  return out.map((p, idx) => {
    const innovation = 7 + (idx % 4)
    const design = 6 + ((idx + 1) % 5)
    const impact = 8 + (idx % 3)
    const execution = 7 + ((idx + 2) % 4)
    const avg = (innovation + design + impact + execution) / 4
    return {
      ...p,
      score: Math.round(avg * 10) / 10,
      breakdown: [
        { label: 'Innovation', value: innovation },
        { label: 'Design', value: design },
        { label: 'Impact', value: impact },
        { label: 'Execution', value: execution },
      ],
      judgeFeedback: [
        {
          judge: 'Alex Morgan',
          score: Math.min(100, Math.round(avg * 10 + 1.8)),
          comment: 'Strong execution and clear value proposition.',
        },
        {
          judge: 'Casey Wu',
          score: Math.min(100, Math.round(avg * 10 - 1.2)),
          comment: 'Great technical depth; storytelling can be sharper.',
        },
      ],
    }
  })
}

export const PROJECTS = expandProjects(30)

export const HACKATHON = {
  name: 'Spring Build 2026',
  start: '2026-04-01',
  end: '2026-04-03',
  banner:
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1600&q=80',
}

export const JUDGES = [
  { id: 'j1', name: 'Alex Morgan', email: 'alex@org.dev' },
  { id: 'j2', name: 'Casey Wu', email: 'casey@org.dev' },
]

export const TEAMS = PROJECTS.slice(0, 12).map((p) => ({
  id: p.id,
  name: p.teamName,
  project: p.title,
  status: 'submitted' as const,
}))
