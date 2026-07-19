create table if not exists public.agent_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  agent_title text not null check (char_length(agent_title) between 3 and 100),
  mission text not null check (char_length(mission) between 12 and 500),
  permissions jsonb not null check (permissions @> '{"external":false}'::jsonb),
  cadence text not null check (cadence in ('daily','weekly')),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_schedules_due_idx on public.agent_schedules (next_run_at, created_at) where active = true;
create index if not exists agent_schedules_user_idx on public.agent_schedules (user_id, created_at desc);

alter table public.agent_schedules enable row level security;
create policy "agent_schedules_select_own" on public.agent_schedules for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.materialize_due_agent_schedules(batch_size integer default 20)
returns integer language plpgsql security definer set search_path = '' as $$
declare schedule public.agent_schedules; created_run_id uuid; occurrence_key text; created_count integer := 0; interval_step interval;
begin
  if batch_size < 1 or batch_size > 100 then raise exception 'Invalid batch size'; end if;
  for schedule in select * from public.agent_schedules where active = true and next_run_at <= now() order by next_run_at limit batch_size for update skip locked
  loop
    occurrence_key := 'schedule:' || schedule.id::text || ':' || extract(epoch from schedule.next_run_at)::bigint::text;
    insert into public.agent_runs (user_id, agent_id, agent_title, mission, permissions, status, idempotency_key)
    values (schedule.user_id, schedule.agent_id, schedule.agent_title, schedule.mission, schedule.permissions, 'running', occurrence_key)
    on conflict (user_id, idempotency_key) do nothing returning id into created_run_id;
    if created_run_id is not null then
      insert into public.agent_run_events (run_id, sequence, event_type, tone, message, details) values
        (created_run_id, 1, 'schedule_triggered', 'live', 'Scheduled run triggered', jsonb_build_object('schedule_id', schedule.id, 'cadence', schedule.cadence));
      insert into public.agent_jobs (run_id) values (created_run_id) on conflict (run_id) do nothing;
      created_count := created_count + 1;
    end if;
    interval_step := case when schedule.cadence = 'daily' then interval '1 day' else interval '7 days' end;
    update public.agent_schedules set last_run_at = schedule.next_run_at, next_run_at = greatest(schedule.next_run_at + interval_step, now() + interval_step), updated_at = now() where id = schedule.id;
    created_run_id := null;
  end loop;
  return created_count;
end;
$$;

revoke all on function public.materialize_due_agent_schedules(integer) from public, anon, authenticated;
grant execute on function public.materialize_due_agent_schedules(integer) to service_role;
