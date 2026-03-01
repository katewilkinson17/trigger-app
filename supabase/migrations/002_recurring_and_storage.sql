-- ─── Trigger App — migration 002 ────────────────────────────────────────────
-- Run in the Supabase SQL Editor after 001_initial.sql

-- ─── Delayed visibility for recurring tasks ────────────────────────────────────
-- show_after: if set, the task is hidden until this date (buffer before due date)
alter table public.tasks
  add column if not exists show_after timestamptz;

create index if not exists tasks_show_after
  on public.tasks (user_id, show_after)
  where show_after is not null;

-- ─── Supabase Storage bucket for bill photos ──────────────────────────────────
-- Creates the task-photos bucket as a public bucket.
-- Public = photo URLs are readable by anyone with the URL (required for <img> tags).
insert into storage.buckets (id, name, public)
  values ('task-photos', 'task-photos', true)
  on conflict (id) do nothing;

-- Users can upload to their own folder (userId/filename)
create policy "task-photos: users upload own files"
  on storage.objects for insert
  with check (
    bucket_id = 'task-photos'
    and auth.uid()::text = split_part(name, '/', 1)
  );

-- Anyone can read (needed so <img src="..."> works without auth header)
create policy "task-photos: public read"
  on storage.objects for select
  using (bucket_id = 'task-photos');

-- Users can delete their own files
create policy "task-photos: users delete own files"
  on storage.objects for delete
  using (
    bucket_id = 'task-photos'
    and auth.uid()::text = split_part(name, '/', 1)
  );
