-- Hackathon judging platform — run this in Supabase SQL Editor (Dashboard → SQL → New query → Run)
-- After run: Authentication → URL Configuration → add Site URL and Redirect URLs:
--   http://localhost:5173/**
--   https://YOUR_DOMAIN.com/**

-- Extensions
create extension if not exists "pgcrypto";

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'team' check (role in ('admin', 'judge', 'team')),
  team_id uuid references public.teams (id) on delete set null,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_team on public.profiles (team_id);
create index if not exists idx_profiles_approval on public.profiles (approval_status);

-- Optional: promote user to judge by email before they sign up
create table if not exists public.role_promotions (
  email text primary key,
  desired_role text not null check (desired_role in ('judge')),
  created_at timestamptz default now()
);

-- Projects (one per team recommended in app)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null,
  tagline text default '',
  description text default '',
  cover_url text,
  video_url text,
  github_url text,
  demo_url text,
  tech_stack text[] default '{}',
  category text default 'General',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_projects_team on public.projects (team_id);
create unique index if not exists one_project_per_team on public.projects (team_id);

-- Judge scores
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  judge_id uuid not null references auth.users (id) on delete cascade,
  criterion_scores jsonb not null default '{}',
  comment text default '',
  total numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, judge_id)
);

create index if not exists idx_scores_project on public.scores (project_id);

-- Singleton app settings
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  leaderboard_visibility text not null default 'admin_only'
    check (leaderboard_visibility in ('admin_only', 'judges_only', 'public')),
  winner_announced_at timestamptz
);

insert into public.app_settings (id, leaderboard_visibility)
values (1, 'admin_only')
on conflict (id) do nothing;

-- ---------- RLS (adjust tighten later) ----------
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.scores enable row level security;
alter table public.role_promotions enable row level security;
alter table public.app_settings enable row level security;

-- Helper: is admin
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
  );
$$;

-- Helper: is approved judge
create or replace function public.is_judge()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'judge' and p.approval_status = 'approved'
  );
$$;

-- Profiles: users read/update self; admins read all
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_update on public.profiles
  for update using (public.is_admin());

create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

-- Teams
create policy teams_select on public.teams
  for select using (
    public.is_admin()
    or created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.team_id = teams.id)
    or (status = 'approved' and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'judge' and pr.approval_status = 'approved'))
  );

create policy teams_insert_authenticated on public.teams
  for insert to authenticated with check (created_by = auth.uid());

create policy teams_admin_update on public.teams
  for update using (public.is_admin());

-- Projects: approved team projects visible to judges; team sees own; admin sees all
create policy projects_select on public.projects
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.teams t
      where t.id = projects.team_id
        and (
          t.created_by = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.team_id = t.id)
        )
    )
    or exists (
      select 1 from public.teams t
      where t.id = projects.team_id and t.status = 'approved'
        and exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid() and pr.role = 'judge' and pr.approval_status = 'approved'
        )
    )
  );

create policy projects_insert_team on public.projects
  for insert to authenticated with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id and (t.created_by = auth.uid() or exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.team_id = t.id
      ))
    )
  );

create policy projects_update_team on public.projects
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.teams t
      where t.id = projects.team_id and (t.created_by = auth.uid() or exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.team_id = t.id
      ))
    )
  );

-- Scores
create policy scores_select on public.scores
  for select using (
    public.is_admin()
    or judge_id = auth.uid()
    or public.is_judge()
    or exists (
      select 1 from public.projects prj
      join public.teams t on t.id = prj.team_id
      where prj.id = scores.project_id
        and (
          t.created_by = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.team_id = t.id)
        )
    )
  );

create policy scores_insert on public.scores
  for insert with check (judge_id = auth.uid());

create policy scores_update on public.scores
  for update using (judge_id = auth.uid()) with check (judge_id = auth.uid());

create policy scores_delete on public.scores
  for delete using (public.is_admin() or judge_id = auth.uid());

-- Role promotions: admin only
create policy role_promotions_admin on public.role_promotions
  for all using (public.is_admin()) with check (public.is_admin());

-- role_promotions: users can read row matching their profile email (bootstrap judge role)
create policy role_promotions_read_own on public.role_promotions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.email is not null
        and lower(p.email) = lower(role_promotions.email)
    )
  );

-- App settings: everyone authenticated can read; only admin updates
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

create policy app_settings_update_admin on public.app_settings
  for update using (public.is_admin());

create policy app_settings_insert_admin on public.app_settings
  for insert with check (public.is_admin());

-- If this email was pre-registered as judge, upgrade role before insert completes
create or replace function public.profile_set_role_from_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'admin' then
    return new;
  end if;
  if exists (
    select 1 from public.role_promotions r
    where lower(r.email) = lower(new.email)
  ) then
    new.role := 'judge';
    new.approval_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_promotion on public.profiles;
create trigger trg_profile_promotion
  before insert on public.profiles
  for each row
  execute function public.profile_set_role_from_promotion();
