create table if not exists public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  content text not null check (char_length(content) between 3 and 1000),
  content_hash text not null,
  retention_days integer not null default 30 check (retention_days between 1 and 365),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_hash)
);

create table if not exists public.agent_memory_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid references public.agent_memories(id) on delete set null,
  action text not null check (action in ('remembered','deleted','expired')),
  content_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_memories_user_created_idx on public.agent_memories (user_id, created_at desc);
create index if not exists agent_memories_expiry_idx on public.agent_memories (expires_at);
create index if not exists agent_memory_events_user_idx on public.agent_memory_events (user_id, created_at desc);

alter table public.agent_memories enable row level security;
alter table public.agent_memory_events enable row level security;
create policy "agent_memories_select_own" on public.agent_memories for select to authenticated using (user_id = (select auth.uid()));
create policy "agent_memory_events_select_own" on public.agent_memory_events for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.purge_expired_agent_memories(batch_size integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare purged integer;
begin
  with expired as (
    select id, user_id, content_hash from public.agent_memories
    where expires_at <= now() order by expires_at limit least(greatest(batch_size, 1), 1000) for update skip locked
  ), logged as (
    insert into public.agent_memory_events (user_id, memory_id, action, content_hash)
    select user_id, id, 'expired', content_hash from expired
  ), removed as (
    delete from public.agent_memories m using expired e where m.id = e.id returning m.id
  ) select count(*) into purged from removed;
  return purged;
end;
$$;

revoke all on function public.purge_expired_agent_memories(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_agent_memories(integer) to service_role;
