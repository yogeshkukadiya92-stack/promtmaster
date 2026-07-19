alter table public.agent_runs drop constraint if exists agent_runs_status_check;
alter table public.agent_runs add constraint agent_runs_status_check check (status in ('waiting_for_approval','waiting_for_tool_approval','running','completed','rejected','failed','cancelled'));
alter table public.agent_jobs drop constraint if exists agent_jobs_status_check;
alter table public.agent_jobs add constraint agent_jobs_status_check check (status in ('queued','processing','waiting_for_approval','completed','failed','cancelled'));

create table if not exists public.agent_action_approvals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  tool_name text not null,
  risk_level text not null check (risk_level in ('write','external')),
  input jsonb not null,
  input_hash text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  unique (run_id, tool_name, input_hash)
);

create table if not exists public.workspace_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  content text not null check (char_length(content) between 3 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists action_approvals_pending_idx on public.agent_action_approvals (run_id, requested_at) where status = 'pending';
create index if not exists workspace_notes_user_idx on public.workspace_notes (user_id, created_at desc);

alter table public.agent_action_approvals enable row level security;
alter table public.workspace_notes enable row level security;
create policy "action_approvals_select_own" on public.agent_action_approvals for select to authenticated using (exists (select 1 from public.agent_runs r where r.id = run_id and r.user_id = (select auth.uid())));
create policy "workspace_notes_select_own" on public.workspace_notes for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.request_agent_action_approval(requested_job_id uuid, worker_name text, requested_tool_name text, requested_risk_level text, requested_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare claimed public.agent_jobs; approval public.agent_action_approvals; hashed_input text; next_sequence integer;
begin
  select * into claimed from public.agent_jobs where id = requested_job_id and status = 'processing' and locked_by = worker_name for update;
  if claimed.id is null then return jsonb_build_object('status','unavailable'); end if;
  hashed_input := encode(public.digest(convert_to(requested_input::text, 'UTF8'), 'sha256'), 'hex');
  select * into approval from public.agent_action_approvals where run_id = claimed.run_id and tool_name = requested_tool_name and input_hash = hashed_input;
  if approval.status = 'approved' then return jsonb_build_object('status','approved','id',approval.id); end if;
  if approval.status = 'rejected' then return jsonb_build_object('status','rejected','id',approval.id); end if;
  if approval.id is null then
    insert into public.agent_action_approvals (run_id, job_id, tool_name, risk_level, input, input_hash)
    values (claimed.run_id, claimed.id, requested_tool_name, requested_risk_level, requested_input, hashed_input) returning * into approval;
    select coalesce(max(sequence),0)+1 into next_sequence from public.agent_run_events where run_id = claimed.run_id;
    insert into public.agent_run_events (run_id, sequence, event_type, tone, message, details) values (claimed.run_id, next_sequence, 'tool_approval_requested', 'warning', requested_tool_name || ' requires scoped approval', jsonb_build_object('approval_id', approval.id, 'tool', requested_tool_name));
  end if;
  update public.agent_jobs set status = 'waiting_for_approval', locked_at = null, locked_by = null, updated_at = now() where id = claimed.id;
  update public.agent_runs set status = 'waiting_for_tool_approval', updated_at = now() where id = claimed.run_id and status = 'running';
  return jsonb_build_object('status','pending','id',approval.id);
end;
$$;

create or replace function public.decide_agent_action(owner_id uuid, approval_id uuid, approved boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare approval public.agent_action_approvals; next_sequence integer;
begin
  select a.* into approval from public.agent_action_approvals a join public.agent_runs r on r.id = a.run_id where a.id = approval_id and r.user_id = owner_id and a.status = 'pending' for update of a;
  if approval.id is null then return false; end if;
  update public.agent_action_approvals set status = case when approved then 'approved' else 'rejected' end, decided_at = now(), decided_by = owner_id where id = approval.id;
  select coalesce(max(sequence),0)+1 into next_sequence from public.agent_run_events where run_id = approval.run_id;
  if approved then
    update public.agent_runs set status = 'running', updated_at = now() where id = approval.run_id and status = 'waiting_for_tool_approval';
    update public.agent_jobs set status = 'queued', available_at = now(), updated_at = now() where id = approval.job_id and status = 'waiting_for_approval';
    insert into public.agent_run_events (run_id, sequence, event_type, tone, message) values (approval.run_id, next_sequence, 'tool_approval_granted', 'success', approval.tool_name || ' approved');
  else
    update public.agent_runs set status = 'rejected', finished_at = now(), updated_at = now() where id = approval.run_id;
    update public.agent_jobs set status = 'cancelled', updated_at = now() where id = approval.job_id;
    insert into public.agent_run_events (run_id, sequence, event_type, tone, message) values (approval.run_id, next_sequence, 'tool_approval_rejected', 'danger', approval.tool_name || ' rejected');
  end if;
  return true;
end;
$$;

revoke all on function public.request_agent_action_approval(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.decide_agent_action(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.request_agent_action_approval(uuid,text,text,text,jsonb) to service_role;
grant execute on function public.decide_agent_action(uuid,uuid,boolean) to service_role;

create or replace function public.cancel_agent_run(owner_id uuid, requested_run_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare next_sequence integer;
begin
  update public.agent_runs set status = 'cancelled', finished_at = now(), updated_at = now()
  where id = requested_run_id and user_id = owner_id and status in ('waiting_for_approval','waiting_for_tool_approval','running');
  if not found then return false; end if;
  update public.agent_jobs set status = 'cancelled', updated_at = now() where run_id = requested_run_id and status in ('queued','processing','waiting_for_approval');
  update public.agent_action_approvals set status = 'rejected', decided_at = now(), decided_by = owner_id where run_id = requested_run_id and status = 'pending';
  select coalesce(max(sequence),0)+1 into next_sequence from public.agent_run_events where run_id = requested_run_id;
  insert into public.agent_run_events (run_id, sequence, event_type, tone, message) values (requested_run_id, next_sequence, 'run_cancelled', 'danger', 'Run cancelled by user');
  return true;
end;
$$;
