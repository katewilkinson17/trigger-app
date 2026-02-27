-- ─── Trigger App — initial schema ───────────────────────────────────────────
-- Run this in the Supabase SQL Editor (or via `supabase db push` with the CLI).
-- Supabase Auth handles the users table automatically; we just reference auth.users.

-- ─── tasks ────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  title            text not null,
  created_at       timestamptz default now() not null,
  completed_at     timestamptz,

  -- rating fields
  dread_score      smallint default 5 check (dread_score >= 0 and dread_score <= 10),
  urgency_score    smallint default 1 check (urgency_score >= 1 and urgency_score <= 3),
  time_estimate    text default '5to15'
                   check (time_estimate in ('under5','5to15','15to30','longer')),
  is_familiar      boolean default true,
  deadline         jsonb,           -- 'today' | 'tomorrow' | 'inAFewDays' | {"date":"YYYY-MM-DD"} | null

  -- smart layer (populated later)
  location_tag     text,
  recurrence_rule  text,
  photo_url        text,
  priority_score   float
);

alter table public.tasks enable row level security;

create policy "tasks: users see own rows"
  on public.tasks for select using (auth.uid() = user_id);

create policy "tasks: users insert own rows"
  on public.tasks for insert with check (auth.uid() = user_id);

create policy "tasks: users update own rows"
  on public.tasks for update using (auth.uid() = user_id);

create policy "tasks: users delete own rows"
  on public.tasks for delete using (auth.uid() = user_id);

-- Index for fast per-user, active-task queries
create index if not exists tasks_user_active
  on public.tasks (user_id, created_at desc)
  where completed_at is null;

-- ─── locations ────────────────────────────────────────────────────────────────
create table if not exists public.locations (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users(id) on delete cascade not null,
  name     text not null,
  category text default 'other'
           check (category in ('grocery','pharmacy','online','home','work','other'))
);

alter table public.locations enable row level security;

create policy "locations: users see own rows"
  on public.locations for select using (auth.uid() = user_id);

create policy "locations: users insert own rows"
  on public.locations for insert with check (auth.uid() = user_id);

create policy "locations: users update own rows"
  on public.locations for update using (auth.uid() = user_id);

create policy "locations: users delete own rows"
  on public.locations for delete using (auth.uid() = user_id);

-- ─── task_location ─────────────────────────────────────────────────────────────
create table if not exists public.task_location (
  task_id     uuid references public.tasks(id) on delete cascade not null,
  location_id uuid references public.locations(id) on delete cascade not null,
  primary key (task_id, location_id)
);

alter table public.task_location enable row level security;

-- Users access task_location only if they own the task
create policy "task_location: users see own rows"
  on public.task_location for select
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_id and tasks.user_id = auth.uid()
    )
  );

create policy "task_location: users insert own rows"
  on public.task_location for insert
  with check (
    exists (
      select 1 from public.tasks
      where tasks.id = task_id and tasks.user_id = auth.uid()
    )
  );

create policy "task_location: users delete own rows"
  on public.task_location for delete
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_id and tasks.user_id = auth.uid()
    )
  );

-- ─── Enable realtime on tasks ─────────────────────────────────────────────────
-- Run in Supabase dashboard: Database → Replication → toggle "tasks" table ON
-- (or uncomment if using Supabase CLI):
-- alter publication supabase_realtime add table public.tasks;
