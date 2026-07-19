alter table public.agent_runs add column if not exists manual_retry_count integer not null default 0 check (manual_retry_count between 0 and 3);

create or replace function public.recover_stale_agent_jobs(lease_seconds integer default 60)
returns integer language plpgsql security definer set search_path = '' as $$
declare stale public.agent_jobs; recovered_count integer := 0; next_sequence integer;
begin
  if lease_seconds < 15 or lease_seconds > 3600 then raise exception 'Invalid lease timeout'; end if;
  for stale in
    select * from public.agent_jobs where status = 'processing' and locked_at < now() - make_interval(secs => lease_seconds)
    order by locked_at limit 20 for update skip locked
  loop
    select coalesce(max(sequence),0)+1 into next_sequence from public.agent_run_events where run_id = stale.run_id;
    if stale.attempt < 3 then
      update public.agent_jobs set status = 'queued', available_at = now(), locked_at = null, locked_by = null, last_error = 'Worker lease expired', updated_at = now() where id = stale.id;
      insert into public.agent_run_checkpoints (run_id, step_key, state) values (stale.run_id, 'worker_recovered', jsonb_build_object('expired_worker', stale.locked_by, 'attempt', stale.attempt))
      on conflict (run_id, step_key) do update set state = excluded.state, created_at = now();
      insert into public.agent_run_events (run_id, sequence, event_type, tone, message) values (stale.run_id, next_sequence, 'worker_lease_recovered', 'warning', 'Stale worker lease recovered');
    else
      update public.agent_jobs set status = 'failed', last_error = 'Worker lease expired after maximum attempts', updated_at = now() where id = stale.id;
      update public.agent_runs set status = 'failed', finished_at = now(), updated_at = now() where id = stale.run_id and status = 'running';
      insert into public.agent_run_events (run_id, sequence, event_type, tone, message) values (stale.run_id, next_sequence, 'worker_lease_failed', 'danger', 'Run failed after repeated worker lease expiry');
    end if;
    recovered_count := recovered_count + 1;
  end loop;
  return recovered_count;
end;
$$;

create or replace function public.retry_agent_run(owner_id uuid, requested_run_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_run public.agent_runs; next_sequence integer;
begin
  select * into current_run from public.agent_runs where id = requested_run_id and user_id = owner_id for update;
  if current_run.id is null or current_run.status not in ('failed','cancelled') or current_run.manual_retry_count >= 3 then return false; end if;
  if not exists (select 1 from public.agent_jobs where run_id = requested_run_id) then return false; end if;
  update public.agent_runs set status = 'running', finished_at = null, manual_retry_count = manual_retry_count + 1, updated_at = now() where id = requested_run_id;
  update public.agent_jobs set status = 'queued', attempt = 0, available_at = now(), locked_at = null, locked_by = null, last_error = null, updated_at = now() where run_id = requested_run_id;
  select coalesce(max(sequence),0)+1 into next_sequence from public.agent_run_events where run_id = requested_run_id;
  insert into public.agent_run_events (run_id, sequence, event_type, tone, message, details) values (requested_run_id, next_sequence, 'manual_retry_started', 'live', 'Manual retry queued from the latest checkpoint', jsonb_build_object('retry', current_run.manual_retry_count + 1, 'max_retries', 3));
  return true;
end;
$$;

revoke all on function public.recover_stale_agent_jobs(integer) from public, anon, authenticated;
revoke all on function public.retry_agent_run(uuid,uuid) from public, anon, authenticated;
grant execute on function public.recover_stale_agent_jobs(integer) to service_role;
grant execute on function public.retry_agent_run(uuid,uuid) to service_role;
