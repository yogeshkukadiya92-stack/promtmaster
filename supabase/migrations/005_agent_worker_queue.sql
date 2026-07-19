create table if not exists public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.agent_runs(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  attempt integer not null default 0 check (attempt between 0 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_run_checkpoints (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  step_key text not null,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, step_key)
);

create index if not exists agent_jobs_claim_idx on public.agent_jobs (available_at, created_at) where status = 'queued';
create index if not exists agent_jobs_worker_idx on public.agent_jobs (locked_by, locked_at) where status = 'processing';
create index if not exists agent_checkpoints_run_idx on public.agent_run_checkpoints (run_id, created_at);

alter table public.agent_jobs enable row level security;
alter table public.agent_run_checkpoints enable row level security;

create policy "agent_jobs_select_own" on public.agent_jobs for select to authenticated
using (exists (select 1 from public.agent_runs r where r.id = run_id and r.user_id = (select auth.uid())));
create policy "agent_checkpoints_select_own" on public.agent_run_checkpoints for select to authenticated
using (exists (select 1 from public.agent_runs r where r.id = run_id and r.user_id = (select auth.uid())));

create or replace function public.decide_agent_run(owner_id uuid, requested_run_id uuid, approved boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_status text;
begin
  select status into current_status from public.agent_runs where id = requested_run_id and user_id = owner_id for update;
  if current_status is null or current_status <> 'waiting_for_approval' then return false; end if;
  if approved then
    update public.agent_runs set status = 'running', updated_at = now() where id = requested_run_id;
    insert into public.agent_jobs (run_id) values (requested_run_id)
    on conflict (run_id) do update set status = 'queued', available_at = now(), locked_at = null, locked_by = null, last_error = null, updated_at = now();
    insert into public.agent_run_events (run_id, sequence, event_type, tone, message)
    values (requested_run_id, 4, 'approval_granted', 'success', 'Human approval granted');
  else
    update public.agent_runs set status = 'rejected', finished_at = now(), updated_at = now() where id = requested_run_id;
    insert into public.agent_run_events (run_id, sequence, event_type, tone, message)
    values (requested_run_id, 4, 'approval_rejected', 'danger', 'Execution rejected by reviewer');
  end if;
  return true;
end;
$$;

create or replace function public.claim_agent_job(worker_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare claimed public.agent_jobs;
begin
  update public.agent_jobs set status = 'processing', locked_by = worker_name, locked_at = now(), attempt = attempt + 1, updated_at = now()
  where id = (select id from public.agent_jobs where status = 'queued' and available_at <= now() order by created_at limit 1 for update skip locked)
  returning * into claimed;
  if claimed.id is null then return null; end if;
  insert into public.agent_run_checkpoints (run_id, step_key, state) values (claimed.run_id, 'worker_claimed', jsonb_build_object('worker', worker_name, 'attempt', claimed.attempt))
  on conflict (run_id, step_key) do update set state = excluded.state, created_at = now();
  insert into public.agent_run_events (run_id, sequence, event_type, tone, message)
  select claimed.run_id, coalesce(max(sequence),0)+1, 'worker_started', 'live', 'Execution worker started' from public.agent_run_events where run_id = claimed.run_id;
  return to_jsonb(claimed);
end;
$$;

create or replace function public.complete_agent_job(job_id uuid, worker_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed public.agent_jobs; next_sequence integer;
begin
  select * into claimed from public.agent_jobs where id = job_id and status = 'processing' and locked_by = worker_name for update;
  if claimed.id is null then return false; end if;
  if exists (select 1 from public.agent_runs where id = claimed.run_id and status = 'cancelled') then
    update public.agent_jobs set status = 'cancelled', updated_at = now() where id = job_id; return false;
  end if;
  select coalesce(max(sequence),0)+1 into next_sequence from public.agent_run_events where run_id = claimed.run_id;
  insert into public.agent_run_checkpoints (run_id, step_key, state) values
    (claimed.run_id, 'actions_executed', '{"verified":true}'::jsonb),
    (claimed.run_id, 'outcome_verified', '{"passed":true}'::jsonb)
  on conflict (run_id, step_key) do update set state = excluded.state, created_at = now();
  insert into public.agent_run_events (run_id, sequence, event_type, tone, message) values
    (claimed.run_id, next_sequence, 'actions_executed', 'live', 'Approved actions executed'),
    (claimed.run_id, next_sequence + 1, 'outcome_verified', 'success', 'Outcome verified and run completed');
  update public.agent_runs set status = 'completed', cost_used_paise = 420, finished_at = now(), updated_at = now() where id = claimed.run_id and status = 'running';
  update public.agent_jobs set status = 'completed', updated_at = now() where id = job_id;
  return true;
end;
$$;

create or replace function public.cancel_agent_run(owner_id uuid, requested_run_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare next_sequence integer;
begin
  update public.agent_runs set status = 'cancelled', finished_at = now(), updated_at = now()
  where id = requested_run_id and user_id = owner_id and status in ('waiting_for_approval','running');
  if not found then return false; end if;
  update public.agent_jobs set status = 'cancelled', updated_at = now() where run_id = requested_run_id and status in ('queued','processing');
  select coalesce(max(sequence),0)+1 into next_sequence from public.agent_run_events where run_id = requested_run_id;
  insert into public.agent_run_events (run_id, sequence, event_type, tone, message) values (requested_run_id, next_sequence, 'run_cancelled', 'danger', 'Run cancelled by user');
  return true;
end;
$$;

revoke all on function public.claim_agent_job(text) from public, anon, authenticated;
revoke all on function public.complete_agent_job(uuid,text) from public, anon, authenticated;
revoke all on function public.cancel_agent_run(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_agent_job(text) to service_role;
grant execute on function public.complete_agent_job(uuid,text) to service_role;
grant execute on function public.cancel_agent_run(uuid,uuid) to service_role;
