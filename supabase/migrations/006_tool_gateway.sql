create table if not exists public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  tool_name text not null,
  risk_level text not null check (risk_level in ('read','write','external')),
  status text not null check (status in ('completed','blocked','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists agent_tool_calls_run_created_idx on public.agent_tool_calls (run_id, created_at);
create index if not exists agent_tool_calls_job_idx on public.agent_tool_calls (job_id);

alter table public.agent_tool_calls enable row level security;
create policy "agent_tool_calls_select_own" on public.agent_tool_calls for select to authenticated
using (exists (select 1 from public.agent_runs r where r.id = run_id and r.user_id = (select auth.uid())));

create or replace function public.record_agent_tool_call(
  requested_job_id uuid, worker_name text, requested_tool_name text, requested_risk_level text,
  requested_status text, requested_input jsonb, requested_output jsonb,
  requested_error_code text, requested_duration_ms integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed public.agent_jobs; next_sequence integer;
begin
  select * into claimed from public.agent_jobs where id = requested_job_id and status = 'processing' and locked_by = worker_name for update;
  if claimed.id is null then return false; end if;
  insert into public.agent_tool_calls (run_id, job_id, tool_name, risk_level, status, input, output, error_code, duration_ms)
  values (claimed.run_id, claimed.id, requested_tool_name, requested_risk_level, requested_status, requested_input, requested_output, requested_error_code, requested_duration_ms);
  select coalesce(max(sequence),0)+1 into next_sequence from public.agent_run_events where run_id = claimed.run_id;
  insert into public.agent_run_events (run_id, sequence, event_type, tone, message, details) values (
    claimed.run_id, next_sequence, 'tool_call_' || requested_status,
    case when requested_status = 'completed' then 'live' when requested_status = 'blocked' then 'warning' else 'danger' end,
    requested_tool_name || ' · ' || requested_status,
    jsonb_build_object('tool', requested_tool_name, 'duration_ms', requested_duration_ms, 'error_code', requested_error_code)
  );
  return true;
end;
$$;

revoke all on function public.record_agent_tool_call(uuid,text,text,text,text,jsonb,jsonb,text,integer) from public, anon, authenticated;
grant execute on function public.record_agent_tool_call(uuid,text,text,text,text,jsonb,jsonb,text,integer) to service_role;

create or replace function public.fail_agent_job(requested_job_id uuid, worker_name text, failure_message text)
returns text language plpgsql security definer set search_path = '' as $$
declare claimed public.agent_jobs; next_sequence integer; next_status text;
begin
  select * into claimed from public.agent_jobs where id = requested_job_id and status = 'processing' and locked_by = worker_name for update;
  if claimed.id is null then return 'ignored'; end if;
  select coalesce(max(sequence),0)+1 into next_sequence from public.agent_run_events where run_id = claimed.run_id;
  if claimed.attempt < 3 then
    update public.agent_jobs set status = 'queued', available_at = now() + make_interval(secs => (5 * power(2, claimed.attempt - 1))::integer), locked_at = null, locked_by = null, last_error = left(failure_message, 500), updated_at = now() where id = claimed.id;
    insert into public.agent_run_events (run_id, sequence, event_type, tone, message, details) values (claimed.run_id, next_sequence, 'job_retry_scheduled', 'warning', 'Worker retry scheduled', jsonb_build_object('attempt', claimed.attempt, 'max_attempts', 3));
    next_status := 'queued';
  else
    update public.agent_jobs set status = 'failed', last_error = left(failure_message, 500), updated_at = now() where id = claimed.id;
    update public.agent_runs set status = 'failed', finished_at = now(), updated_at = now() where id = claimed.run_id and status = 'running';
    insert into public.agent_run_events (run_id, sequence, event_type, tone, message, details) values (claimed.run_id, next_sequence, 'run_failed', 'danger', 'Run failed after maximum retries', jsonb_build_object('attempts', claimed.attempt));
    next_status := 'failed';
  end if;
  return next_status;
end;
$$;

revoke all on function public.fail_agent_job(uuid,text,text) from public, anon, authenticated;
grant execute on function public.fail_agent_job(uuid,text,text) to service_role;
