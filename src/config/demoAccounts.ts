/** Shown in Admin when API mode is on — matches `server/src/seed.js` defaults. */
export const SEEDED_DEMO_LOGINS = [
  {
    label: 'Organizer (admin)',
    email: 'admin@jury.hackathon',
    password: 'admin123',
    note: 'Override with ADMIN_EMAIL / ADMIN_PASSWORD in server .env',
  },
  {
    label: 'Demo judge',
    email: 'judge.demo@hackathon.local',
    password: 'DemoPass123!',
    note: 'Override with DEMO_JUDGE_EMAIL in server .env',
  },
  {
    label: 'Demo team (lead)',
    email: 'infinite.content13011@gmail.com',
    password: 'DemoPass123!',
    note: 'Same password for infinite.content13012 teammate after seed',
  },
] as const
