-- AEVINITE Hackathon Platform — Supabase schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query → Run)
-- After run: configure Authentication → URL Configuration with your local and deployed URLs.

-- Extensions
create extension if not exists "pgcrypto";

-- Keep RLS helper functions accessible
grant usage on schema public to anon, authenticated;

-- Clean start (optional): uncomment to wipe everything
-- drop schema public cascade;
-- create schema public;

-- ENUMS
do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_role') then
    create type public.profile_role as enum ('user', 'judge', 'admin', 'main_admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'event_status') then
    create type public.event_status as enum (
      'upcoming',
      'registration_open',
      'ongoing',
      'submission_closed',
      'judging',
      'completed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'team_type') then
    create type public.team_type as enum ('solo', 'duo', 'trio', 'squad');
  end if;

  if not exists (select 1 from pg_type where typname = 'team_status') then
    create type public.team_status as enum ('forming', 'formed', 'registered');
  end if;

  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('pending', 'accepted', 'declined');
  end if;
end $$;

-- PROFILES (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  username text unique,
  role public.profile_role not null default 'user',
  is_approved boolean not null default false,
  onboarding_complete boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Ensure is_approved exists even if profiles was created by an older schema
alter table public.profiles
  add column if not exists is_approved boolean not null default false;

alter table public.profiles
  add column if not exists onboarding_complete boolean not null default false;

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_is_approved on public.profiles (is_approved);

-- Ensure role cannot be changed by non-admins via RLS check
alter table public.profiles
  alter column role set default 'user';

-- ---------- AUTO-PROFILE CREATION (CRITICAL) ----------
-- Always create a matching `public.profiles` row on auth signup.
-- Also: hard-bypass main admin for aevinite@gmail.com.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, role, is_approved, onboarding_complete)
  values (
    new.id,
    lower(new.email),
    case when lower(new.email) = 'aevinite@gmail.com' then 'aevinite' else null end,
    case when lower(new.email) = 'aevinite@gmail.com' then 'main_admin' else 'user' end,
    case when lower(new.email) = 'aevinite@gmail.com' then true else false end,
    case when lower(new.email) = 'aevinite@gmail.com' then true else false end
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- EVENTS (hackathons)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  banner_url text,
  rules text not null,
  status public.event_status not null default 'upcoming',
  registration_deadline timestamptz not null,
  submission_deadline timestamptz not null,
  result_announcement_time timestamptz not null,
  max_team_size int not null check (max_team_size between 1 and 4),
  min_team_size int not null default 1 check (min_team_size between 1 and 4),
  topics text[] not null default '{}',
  judging_categories jsonb not null default '[]'::jsonb,
  is_result_public boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  total_participants int not null default 0
);

create index if not exists idx_events_status on public.events (status);
create index if not exists idx_events_created_by on public.events (created_by);

-- TEAMS
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  leader_id uuid not null references public.profiles (id) on delete restrict,
  team_type public.team_type not null,
  selected_topic text,
  status public.team_status not null default 'forming',
  created_at timestamptz not null default now()
);

create index if not exists idx_teams_event on public.teams (event_id);
create index if not exists idx_teams_leader on public.teams (leader_id);

-- TEAM MEMBERS
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invite_status public.invite_status not null default 'pending',
  joined_at timestamptz
);

-- Backward-compat migration: older databases may have `team_members` without `event_id`.
-- Do the migration defensively so the script never fails mid-run.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_members'
      and column_name = 'event_id'
  ) then
    alter table public.team_members add column event_id uuid;
  end if;

  -- Backfill (safe even if already filled)
  update public.team_members tm
  set event_id = t.event_id
  from public.teams t
  where tm.team_id = t.id
    and tm.event_id is null;

  -- Enforce NOT NULL (only after backfill)
  alter table public.team_members alter column event_id set not null;
exception
  when undefined_column then
    -- If something raced/failed earlier, retry once by adding the column then backfilling.
    alter table public.team_members add column if not exists event_id uuid;
    update public.team_members tm
    set event_id = t.event_id
    from public.teams t
    where tm.team_id = t.id
      and tm.event_id is null;
    alter table public.team_members alter column event_id set not null;
end $$;

-- Add FK if missing
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_members_event_id_fkey'
  ) then
    alter table public.team_members
      add constraint team_members_event_id_fkey
      foreign key (event_id) references public.events (id) on delete cascade;
  end if;
end $$;

create unique index if not exists idx_team_members_team_user
  on public.team_members (team_id, user_id);

-- At most one team per user per event
create unique index if not exists idx_team_members_event_user_unique
  on public.team_members (event_id, user_id);

-- PROJECTS
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  github_url text,
  video_url text,
  description text,
  comment_for_judges text,
  submitted_at timestamptz,
  last_updated_at timestamptz
);

create unique index if not exists idx_projects_team_unique
  on public.projects (team_id);

create index if not exists idx_projects_event on public.projects (event_id);

-- JUDGMENTS
create table if not exists public.judgments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  judge_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  total_score numeric not null default 0,
  judged_at timestamptz not null default now(),
  unique (project_id, judge_id)
);

create index if not exists idx_judgments_event on public.judgments (event_id);
create index if not exists idx_judgments_judge on public.judgments (judge_id);

-- EVENT MILESTONES
create table if not exists public.event_milestones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null,
  milestone_time timestamptz not null,
  "order" int not null
);

create index if not exists idx_event_milestones_event on public.event_milestones (event_id);

-- NOTIFICATIONS (simple in-app notifications)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, read_at);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.judgments enable row level security;
alter table public.event_milestones enable row level security;
alter table public.notifications enable row level security;

-- Helper: is admin / main_admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'main_admin')
  );
$$;

-- Helper: is main_admin
create or replace function public.is_main_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'main_admin'
  );
$$;

-- Helper: is judge
create or replace function public.is_judge()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'judge'
  );
$$;

-- Helper: approved participant (role=user and is_approved=true)
create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'user'
      and p.is_approved = true
  );
$$;

-- PROFILES POLICIES
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;

create policy profiles_select_self_or_admin
  on public.profiles
  for select
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_self
  on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Users cannot self-escalate role / approval. They may set username and flip onboarding_complete to true.
    and role = (select role from public.profiles where id = auth.uid())
    and is_approved = (select is_approved from public.profiles where id = auth.uid())
    and (
      onboarding_complete = (select onboarding_complete from public.profiles where id = auth.uid())
      or onboarding_complete = true
    )
  );

create policy profiles_admin_update
  on public.profiles
  for update
  using (public.is_admin());

-- Inserts are done via the auth.users trigger (security definer), not by clients.
create policy profiles_insert_self
  on public.profiles
  for insert
  with check (id = auth.uid());

-- EVENTS POLICIES
create policy events_select_all_authenticated
  on public.events
  for select
  to authenticated
  using (true);

create policy events_admin_write
  on public.events
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- TEAMS POLICIES
create policy teams_select_for_participants_and_admins
  on public.teams
  for select
  using (
    public.is_admin()
    or leader_id = auth.uid()
    or exists (
      select 1
      from public.team_members tm
      where tm.team_id = teams.id
        and tm.user_id = auth.uid()
    )
  );

create policy teams_insert_leader
  on public.teams
  for insert
  with check (
    leader_id = auth.uid()
    and public.is_approved_user()
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and now() <= e.registration_deadline
    )
  );

create policy teams_update_leader_or_admin_forming
  on public.teams
  for update
  using (
    public.is_admin()
    or (leader_id = auth.uid() and status = 'forming')
  );

-- TEAM MEMBERS POLICIES
create policy team_members_select_own_teams
  on public.team_members
  for select
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1
      from public.teams t
      where t.id = team_members.team_id
        and t.leader_id = auth.uid()
    )
  );

create policy team_members_insert_by_leader
  on public.team_members
  for insert
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id
        and t.leader_id = auth.uid()
        and t.status = 'forming'
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = user_id
        and p.is_approved = true
        and p.role = 'user'
    )
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and now() <= e.registration_deadline
    )
  );

create policy team_members_update_self_or_leader
  on public.team_members
  for update
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id
        and t.leader_id = auth.uid()
    )
  );

-- PROJECTS POLICIES
create policy projects_select_visible
  on public.projects
  for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.teams t
      where t.id = projects.team_id
        and (
          t.leader_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            where tm.team_id = t.id
              and tm.user_id = auth.uid()
          )
        )
    )
    or (
      public.is_judge()
      and exists (
        select 1
        from public.events e
        where e.id = projects.event_id
          and now() >= e.submission_deadline
          and e.status in ('judging', 'completed')
      )
    )
  );

create policy projects_insert_team
  on public.projects
  for insert
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id
        and (
          t.leader_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            where tm.team_id = t.id
              and tm.user_id = auth.uid()
          )
        )
        and t.status = 'registered'
    )
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and now() <= e.submission_deadline
    )
  );

create policy projects_update_team
  on public.projects
  for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.teams t
      where t.id = projects.team_id
        and (
          t.leader_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            where tm.team_id = t.id
              and tm.user_id = auth.uid()
          )
        )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.events e
      where e.id = projects.event_id
        and now() <= e.submission_deadline
    )
  );

-- JUDGMENTS POLICIES
create policy judgments_select_visible
  on public.judgments
  for select
  using (
    public.is_admin()
    or judge_id = auth.uid()
  );

create policy judgments_insert_judge
  on public.judgments
  for insert
  with check (
    judge_id = auth.uid()
    and public.is_judge()
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and now() >= e.submission_deadline
        and now() <= e.result_announcement_time
        and e.status in ('judging', 'completed')
    )
  );

create policy judgments_update_judge
  on public.judgments
  for update
  using (
    judge_id = auth.uid()
    and public.is_judge()
  )
  with check (
    judge_id = auth.uid()
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and now() >= e.submission_deadline
        and now() <= e.result_announcement_time
        and e.status in ('judging', 'completed')
    )
  );

-- EVENT MILESTONES POLICIES
create policy event_milestones_select_all
  on public.event_milestones
  for select
  to authenticated
  using (true);

create policy event_milestones_admin_write
  on public.event_milestones
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- NOTIFICATIONS POLICIES
create policy notifications_select_own
  on public.notifications
  for select
  using (user_id = auth.uid() or public.is_admin());

create policy notifications_insert_system
  on public.notifications
  for insert
  with check (true);

create policy notifications_update_own
  on public.notifications
  for update
  using (user_id = auth.uid());

-- Keep team_members.event_id in sync with teams.event_id
create or replace function public.set_team_member_event_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id
  from public.teams
  where id = new.team_id;

  if v_event_id is null then
    raise exception 'Team % has no event_id; cannot derive event_id for team_members', new.team_id;
  end if;

  new.event_id := v_event_id;
  return new;
end;
$$;

drop trigger if exists trg_team_members_set_event_id on public.team_members;

create trigger trg_team_members_set_event_id
  before insert or update of team_id
  on public.team_members
  for each row
  execute function public.set_team_member_event_id();

-- ---------- TEAM STATUS AUTOMATION ----------
-- If all members accepted, set team status to formed then registered (locks team).
create or replace function public.recompute_team_status(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
  v_total int;
  v_accepted int;
  v_declined int;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found then return; end if;

  -- Don't auto-mutate locked teams
  if v_team.status = 'registered' then
    return;
  end if;

  select
    count(*)::int,
    sum(case when invite_status = 'accepted' then 1 else 0 end)::int,
    sum(case when invite_status = 'declined' then 1 else 0 end)::int
  into v_total, v_accepted, v_declined
  from public.team_members
  where team_id = p_team_id;

  -- Solo teams should register immediately once leader row exists
  if v_team.team_type = 'solo' and v_total = 1 and v_accepted = 1 then
    update public.teams set status = 'registered' where id = p_team_id;
    return;
  end if;

  -- If someone declined, keep forming (leader may replace)
  if v_declined > 0 then
    update public.teams set status = 'forming' where id = p_team_id;
    return;
  end if;

  if v_total > 0 and v_total = v_accepted then
    update public.teams set status = 'registered' where id = p_team_id;
  else
    update public.teams set status = 'forming' where id = p_team_id;
  end if;
end;
$$;

create or replace function public.on_team_members_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_team_status(coalesce(new.team_id, old.team_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_team_members_status on public.team_members;
create trigger trg_team_members_status
  after insert or update of invite_status or delete
  on public.team_members
  for each row
  execute function public.on_team_members_changed();

-- Update timestamps on project changes
create or replace function public.touch_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.last_updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch
  before update
  on public.projects
  for each row
  execute function public.touch_project();

-- ---------- LEADERBOARD (SECURITY DEFINER) ----------
-- Users can only read leaderboard after admin makes it public.
create or replace function public.get_event_leaderboard(p_event_id uuid)
returns table (
  team_id uuid,
  team_name text,
  project_id uuid,
  avg_score numeric,
  rank int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_public boolean;
begin
  select e.is_result_public into v_public
  from public.events e
  where e.id = p_event_id;

  if not coalesce(v_public, false) and not public.is_admin() then
    raise exception 'Leaderboard is not public';
  end if;

  return query
  with pj as (
    select
      p.id as project_id,
      p.team_id,
      t.name as team_name,
      avg(j.total_score)::numeric as avg_score
    from public.projects p
    join public.teams t on t.id = p.team_id
    left join public.judgments j on j.project_id = p.id
    where p.event_id = p_event_id
      and p.submitted_at is not null
    group by p.id, p.team_id, t.name
  )
  select
    pj.team_id,
    pj.team_name,
    pj.project_id,
    coalesce(pj.avg_score, 0) as avg_score,
    dense_rank() over (order by coalesce(pj.avg_score, 0) desc) as rank
  from pj
  order by rank asc, pj.team_name asc;
end;
$$;

revoke all on function public.get_event_leaderboard(uuid) from public;
grant execute on function public.get_event_leaderboard(uuid) to authenticated;


