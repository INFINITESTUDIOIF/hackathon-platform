# AEVINITE — Hackathon Management Platform

Role-based web app with three isolated panels:
- **User (Participant)**: `/dashboard`
- **Judge**: `/judge`
- **Admin / Main Admin**: `/admin`

Backend: **Supabase (Postgres + Auth + RLS)**.

## Setup

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` in Supabase SQL editor.
3. Enable Google OAuth in Supabase Auth (optional).
4. Create `.env` from `.env.example` and fill:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_MAIN_ADMIN_EMAILS` (comma-separated) to bootstrap the first `main_admin` on first login.

## Run

```bash
npm install
npm run dev
```

## Key rules implemented

- **Google OAuth + Email/Password** sign-in.
- **Onboarding required**: username + platform password (required even for Google users).
- **Admin approval gate**: participants see “Waiting for admin approval” until approved.
- **One email = one role** enforced via `profiles.email` unique.
- **Team rules** enforced in DB:
  - One team per user per event.
  - Team locks automatically when all invites accept.
- **Deadline rules** enforced in RLS:
  - Registration blocked after `registration_deadline`.
  - Submission edits blocked after `submission_deadline`.
- **Judge access locked** until after submission deadline.
