create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  agent_title text not null check (char_length(agent_title) between 3 and 100),
  mission text not null check (char_length(mission) between 12 and 500),
  permissions jsonb not null default '{"web":false,"workspace":false,"external":false}'::jsonb,
  status text not null default 'waiting_for_approval' check (status in ('waiting_for_approval','running','completed','rejected','failed','cancelled')),
  idempotency_key text not null,
  token_budget integer not null default 100000 check (token_budget between 1000 and 1000000),
  cost_budget_paise integer not null default 4000 check (cost_budget_paise between 0 and 1000000),
  cost_used_paise integer not null default 0 check (cost_used_paise >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.agent_run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type text not null,
  tone text not null check (tone in ('live','success','warning','danger')),
  message text not null check (char_length(message) between 3 and 240),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, sequence)
);

create index if not exists agent_runs_user_started_idx on public.agent_runs (user_id, started_at desc);
create index if not exists agent_runs_active_idx on public.agent_runs (user_id, updated_at desc) where status in ('waiting_for_approval','running');
create index if not exists agent_run_events_run_sequence_idx on public.agent_run_events (run_id, sequence);

alter table public.agent_runs enable row level security;
alter table public.agent_run_events enable row level security;

create policy "agent_runs_select_own" on public.agent_runs for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "agent_run_events_select_own" on public.agent_run_events for select to authenticated
using (exists (select 1 from public.agent_runs r where r.id = run_id and r.user_id = (select auth.uid())));

create or replace function public.create_agent_run(
  owner_id uuid, requested_agent_id text, requested_agent_title text, requested_mission text,
  requested_permissions jsonb, requested_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare created_run_id uuid;
begin
  insert into public.agent_runs (user_id, agent_id, agent_title, mission, permissions, idempotency_key)
  values (owner_id, requested_agent_id, requested_agent_title, requested_mission, requested_permissions, requested_idempotency_key)
  on conflict (user_id, idempotency_key) do update set updated_at = public.agent_runs.updated_at
  returning id into created_run_id;

  insert into public.agent_run_events (run_id, sequence, event_type, tone, message) values
    (created_run_id, 1, 'request_understood', 'success', 'Request understood'),
    (created_run_id, 2, 'plan_created', 'success', 'Execution plan prepared'),
    (created_run_id, 3, 'approval_requested', 'warning', 'Human approval requested')
  on conflict (run_id, sequence) do nothing;
  return created_run_id;
end;
$$;

create or replace function public.decide_agent_run(owner_id uuid, requested_run_id uuid, approved boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_status text;
begin
  select status into current_status from public.agent_runs
  where id = requested_run_id and user_id = owner_id for update;
  if current_status is null then return false; end if;
  if current_status <> 'waiting_for_approval' then return false; end if;

  update public.agent_runs set
    status = case when approved then 'completed' else 'rejected' end,
    cost_used_paise = case when approved then 420 else 0 end,
    finished_at = now(), updated_at = now()
  where id = requested_run_id and user_id = owner_id;

  if approved then
    insert into public.agent_run_events (run_id, sequence, event_type, tone, message) values
      (requested_run_id, 4, 'approval_granted', 'success', 'Human approval granted'),
      (requested_run_id, 5, 'actions_executed', 'live', 'Approved actions executed'),
      (requested_run_id, 6, 'outcome_verified', 'success', 'Outcome verified and run completed');
  else
    insert into public.agent_run_events (run_id, sequence, event_type, tone, message)
    values (requested_run_id, 4, 'approval_rejected', 'danger', 'Execution rejected by reviewer');
  end if;
  return true;
end;
$$;

revoke all on function public.create_agent_run(uuid,text,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.decide_agent_run(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.create_agent_run(uuid,text,text,text,jsonb,text) to service_role;
grant execute on function public.decide_agent_run(uuid,uuid,boolean) to service_role;
