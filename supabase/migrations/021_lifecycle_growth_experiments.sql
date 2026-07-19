create table if not exists public.lifecycle_automations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  automation_key text not null check (automation_key in ('complete_first_test','publish_ready_asset')),
  enabled boolean not null default true,
  delay_hours integer not null check (delay_hours between 1 and 720),
  channel text not null default 'email' check (channel in ('email','in_app')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(workspace_id,automation_key)
);
create table if not exists public.lifecycle_deliveries (
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,asset_id uuid,automation_key text not null,
  channel text not null check(channel in ('email','in_app')),status text not null default 'queued' check(status in ('queued','sending','sent','failed','skipped')),
  scheduled_for timestamptz not null,idempotency_key text not null unique,attempt_count integer not null default 0,
  provider_message_id text,error_code text,sent_at timestamptz,created_at timestamptz not null default now()
);
create index if not exists lifecycle_deliveries_due_idx on public.lifecycle_deliveries(scheduled_for,id) where status='queued';
create index if not exists lifecycle_deliveries_workspace_created_idx on public.lifecycle_deliveries(workspace_id,created_at desc);

create table if not exists public.growth_experiments (
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check(char_length(name) between 3 and 100),surface text not null check(surface in ('creator_primary_cta')),
  status text not null default 'draft' check(status in ('draft','running','paused','completed')),
  primary_metric text not null default 'tested_activation' check(primary_metric in ('tested_activation')),
  allocation_percent integer not null default 100 check(allocation_percent between 1 and 100),
  variants jsonb not null check(jsonb_typeof(variants)='array' and jsonb_array_length(variants) between 2 and 4),
  created_by uuid references auth.users(id) on delete set null,started_at timestamptz,ended_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index if not exists one_running_experiment_per_surface_idx on public.growth_experiments(workspace_id,surface) where status='running';
create table if not exists public.growth_experiment_assignments (
  id bigint generated always as identity primary key,experiment_id uuid not null references public.growth_experiments(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
  variant_key text not null,first_exposed_at timestamptz not null default now(),unique(experiment_id,user_id)
);
create index if not exists experiment_assignments_workspace_time_idx on public.growth_experiment_assignments(workspace_id,first_exposed_at desc);

alter table public.lifecycle_automations enable row level security;alter table public.lifecycle_deliveries enable row level security;
alter table public.growth_experiments enable row level security;alter table public.growth_experiment_assignments enable row level security;
create policy "lifecycle_automations_owner_read" on public.lifecycle_automations for select to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy "lifecycle_deliveries_owner_read" on public.lifecycle_deliveries for select to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy "growth_experiments_owner_read" on public.growth_experiments for select to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy "growth_assignments_owner_read" on public.growth_experiment_assignments for select to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));

create or replace function public.materialize_lifecycle_deliveries(batch_size integer default 100) returns integer language plpgsql security definer set search_path='' as $$
declare inserted_count integer:=0; step_count integer:=0;
begin
  insert into public.lifecycle_deliveries(workspace_id,user_id,asset_id,automation_key,channel,scheduled_for,idempotency_key)
  select e.workspace_id,e.user_id,e.asset_id,'complete_first_test',a.channel,e.occurred_at+make_interval(hours=>a.delay_hours),'first-test:'||e.user_id||':'||e.asset_id
  from public.product_activation_events e join public.lifecycle_automations a on a.workspace_id=e.workspace_id and a.automation_key='complete_first_test' and a.enabled
  where e.event_name='asset_generated' and e.asset_id is not null and e.occurred_at<=now()-make_interval(hours=>a.delay_hours)
    and not exists(select 1 from public.product_activation_events n where n.workspace_id=e.workspace_id and n.user_id=e.user_id and n.asset_id=e.asset_id and n.event_name='asset_tested')
  order by e.occurred_at limit batch_size on conflict(idempotency_key) do nothing;get diagnostics step_count=row_count;inserted_count:=inserted_count+step_count;
  insert into public.lifecycle_deliveries(workspace_id,user_id,asset_id,automation_key,channel,scheduled_for,idempotency_key)
  select e.workspace_id,e.user_id,e.asset_id,'publish_ready_asset',a.channel,e.occurred_at+make_interval(hours=>a.delay_hours),'publish-ready:'||e.user_id||':'||e.asset_id
  from public.product_activation_events e join public.lifecycle_automations a on a.workspace_id=e.workspace_id and a.automation_key='publish_ready_asset' and a.enabled
  where e.event_name='asset_tested' and e.asset_id is not null and e.occurred_at<=now()-make_interval(hours=>a.delay_hours)
    and not exists(select 1 from public.product_activation_events n where n.workspace_id=e.workspace_id and n.user_id=e.user_id and n.asset_id=e.asset_id and n.event_name='asset_published')
  order by e.occurred_at limit batch_size on conflict(idempotency_key) do nothing;get diagnostics step_count=row_count;return inserted_count+step_count;
end;$$;
revoke all on function public.materialize_lifecycle_deliveries(integer) from public,anon,authenticated;grant execute on function public.materialize_lifecycle_deliveries(integer) to service_role;

create or replace function public.claim_lifecycle_delivery() returns setof public.lifecycle_deliveries language plpgsql security definer set search_path='' as $$
begin return query update public.lifecycle_deliveries set status='sending',attempt_count=attempt_count+1 where id=(select id from public.lifecycle_deliveries where status='queued' and channel='email' and scheduled_for<=now() order by scheduled_for for update skip locked limit 1) returning *;end;$$;
revoke all on function public.claim_lifecycle_delivery() from public,anon,authenticated;grant execute on function public.claim_lifecycle_delivery() to service_role;
