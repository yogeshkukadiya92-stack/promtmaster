create table if not exists public.agent_execution_plans (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.agent_runs(id) on delete cascade,
  summary text not null check (char_length(summary) between 3 and 240),
  success_criteria jsonb not null default '[]'::jsonb,
  calls jsonb not null default '[]'::jsonb,
  engine text not null,
  fallback_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_execution_verifications (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  passed boolean not null,
  summary text not null check (char_length(summary) between 3 and 240),
  checks jsonb not null default '[]'::jsonb,
  engine text not null,
  fallback_reason text,
  created_at timestamptz not null default now()
);

create index if not exists agent_verifications_run_created_idx on public.agent_execution_verifications (run_id, created_at desc);
alter table public.agent_execution_plans enable row level security;
alter table public.agent_execution_verifications enable row level security;
create policy "agent_execution_plans_select_own" on public.agent_execution_plans for select to authenticated using (exists (select 1 from public.agent_runs r where r.id = run_id and r.user_id = (select auth.uid())));
create policy "agent_execution_verifications_select_own" on public.agent_execution_verifications for select to authenticated using (exists (select 1 from public.agent_runs r where r.id = run_id and r.user_id = (select auth.uid())));

create or replace function public.complete_agent_job(job_id uuid, worker_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed public.agent_jobs; next_sequence integer; verification public.agent_execution_verifications;
begin
  select * into claimed from public.agent_jobs where id = job_id and status = 'processing' and locked_by = worker_name for update;
  if claimed.id is null then return false; end if;
  if exists (select 1 from public.agent_runs where id = claimed.run_id and status = 'cancelled') then update public.agent_jobs set status = 'cancelled', updated_at = now() where id = job_id; return false; end if;
  select * into verification from public.agent_execution_verifications where run_id = claimed.run_id order by created_at desc limit 1;
  if verification.id is null or not verification.passed then raise exception 'A passed execution verification is required'; end if;
  select coalesce(max(sequence),0)+1 into next_sequence from public.agent_run_events where run_id = claimed.run_id;
  insert into public.agent_run_checkpoints (run_id, step_key, state) values
    (claimed.run_id, 'actions_executed', jsonb_build_object('verified',true)),
    (claimed.run_id, 'outcome_verified', jsonb_build_object('passed',verification.passed,'engine',verification.engine,'verification_id',verification.id))
  on conflict (run_id, step_key) do update set state = excluded.state, created_at = now();
  insert into public.agent_run_events (run_id, sequence, event_type, tone, message, details) values
    (claimed.run_id, next_sequence, 'actions_executed', 'live', 'Approved actions executed', jsonb_build_object('plan_enforced',true)),
    (claimed.run_id, next_sequence + 1, 'outcome_verified', 'success', left(verification.summary,240), jsonb_build_object('engine',verification.engine,'checks',verification.checks));
  update public.agent_runs set status = 'completed', cost_used_paise = 420, finished_at = now(), updated_at = now() where id = claimed.run_id and status = 'running';
  update public.agent_jobs set status = 'completed', updated_at = now() where id = job_id;
  return true;
end;
$$;

revoke all on function public.complete_agent_job(uuid,text) from public, anon, authenticated;
grant execute on function public.complete_agent_job(uuid,text) to service_role;
