create table if not exists public.agent_worker_instances (
  worker_name text primary key,
  status text not null default 'online' check (status in ('online','draining','offline')),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  jobs_completed bigint not null default 0 check (jobs_completed >= 0),
  jobs_failed bigint not null default 0 check (jobs_failed >= 0),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists agent_workers_last_seen_idx on public.agent_worker_instances (last_seen_at desc);
alter table public.agent_worker_instances enable row level security;

create or replace function public.heartbeat_agent_worker(requested_worker_name text, requested_status text, completed_delta integer default 0, failed_delta integer default 0, requested_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if char_length(requested_worker_name) not between 3 and 100 or requested_status not in ('online','draining','offline') then raise exception 'Invalid worker heartbeat'; end if;
  insert into public.agent_worker_instances (worker_name,status,last_seen_at,jobs_completed,jobs_failed,metadata)
  values (requested_worker_name,requested_status,now(),greatest(completed_delta,0),greatest(failed_delta,0),requested_metadata)
  on conflict (worker_name) do update set status=excluded.status,last_seen_at=now(),jobs_completed=public.agent_worker_instances.jobs_completed+greatest(completed_delta,0),jobs_failed=public.agent_worker_instances.jobs_failed+greatest(failed_delta,0),metadata=excluded.metadata;
end;
$$;

create or replace function public.get_agent_operations(owner_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare queued_count integer; processing_count integer; waiting_count integer; failed_count integer; completed_count integer; fallback_count integer; active_workers integer; stale_workers integer; oldest_wait integer; recommended integer; alerts jsonb;
begin
  select
    count(*) filter (where j.status='queued'), count(*) filter (where j.status='processing'), count(*) filter (where j.status='waiting_for_approval'),
    count(*) filter (where j.status='failed' and j.updated_at >= now()-interval '24 hours'), count(*) filter (where j.status='completed' and j.updated_at >= now()-interval '24 hours'),
    coalesce(extract(epoch from now()-(min(j.created_at) filter (where j.status='queued')))::integer,0)
  into queued_count,processing_count,waiting_count,failed_count,completed_count,oldest_wait
  from public.agent_jobs j join public.agent_runs r on r.id=j.run_id where r.user_id=owner_id;
  select count(*) into fallback_count from public.agent_execution_verifications v join public.agent_runs r on r.id=v.run_id where r.user_id=owner_id and v.engine='deterministic' and v.created_at>=now()-interval '24 hours';
  select count(*) filter (where status='online' and last_seen_at>=now()-interval '45 seconds'), count(*) filter (where status<>'offline' and last_seen_at<now()-interval '45 seconds') into active_workers,stale_workers from public.agent_worker_instances;
  recommended := greatest(1,least(20,ceil(queued_count/5.0)::integer));
  select coalesce(jsonb_agg(message),'[]'::jsonb) into alerts from (values
    (case when active_workers=0 then 'No active execution worker detected' end),
    (case when stale_workers>0 then stale_workers||' worker heartbeat is stale' end),
    (case when oldest_wait>120 then 'Oldest queued run has waited more than two minutes' end),
    (case when failed_count>=3 then 'Elevated execution failures in the last 24 hours' end)
  ) as candidates(message) where message is not null;
  return jsonb_build_object('queueDepth',queued_count,'processing',processing_count,'waitingApproval',waiting_count,'failed24h',failed_count,'completed24h',completed_count,'fallbackVerifications24h',fallback_count,'activeWorkers',active_workers,'staleWorkers',stale_workers,'oldestQueuedSeconds',oldest_wait,'recommendedWorkers',recommended,'alerts',alerts,'sampledAt',now());
end;
$$;

revoke all on function public.heartbeat_agent_worker(text,text,integer,integer,jsonb) from public,anon,authenticated;
revoke all on function public.get_agent_operations(uuid) from public,anon,authenticated;
grant execute on function public.heartbeat_agent_worker(text,text,integer,integer,jsonb) to service_role;
grant execute on function public.get_agent_operations(uuid) to service_role;
