create extension if not exists pgcrypto;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('prompt', 'skill', 'agent')),
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '',
  source_intent text not null check (char_length(source_intent) between 5 and 500),
  content jsonb not null default '{}'::jsonb,
  current_version integer not null default 1 check (current_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assets_user_updated_idx
  on public.assets (user_id, updated_at desc);

create index if not exists assets_user_type_updated_idx
  on public.assets (user_id, type, updated_at desc);

alter table public.assets enable row level security;

create policy "assets_select_own" on public.assets
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "assets_insert_own" on public.assets
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "assets_update_own" on public.assets
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "assets_delete_own" on public.assets
  for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
