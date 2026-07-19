-- Phase 5 completion: privacy-safe SLA telemetry and verified recovery manifests.
create table if not exists public.service_request_samples (
  id bigint generated always as identity primary key,
  route_name text not null check (char_length(route_name) between 1 and 120),
  method text not null check (method in ('GET','POST','PUT','PATCH','DELETE','OPTIONS')),
  status_code integer not null check (status_code between 100 and 599),
  duration_ms integer not null check (duration_ms between 0 and 300000),
  request_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists service_request_samples_created_idx on public.service_request_samples(created_at desc);
create index if not exists service_request_samples_error_created_idx on public.service_request_samples(created_at desc) where status_code >= 500;

create table if not exists public.recovery_manifests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  initiated_by uuid references auth.users(id) on delete set null,
  status text not null check (status in ('verified','failed')),
  snapshot_at timestamptz not null,
  manifest jsonb not null,
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  verification_checks jsonb not null,
  rpo_minutes integer not null check (rpo_minutes between 0 and 10080),
  rto_minutes integer not null check (rto_minutes between 1 and 2880),
  created_at timestamptz not null default now()
);
create index if not exists recovery_manifests_workspace_created_idx on public.recovery_manifests(workspace_id,created_at desc);

alter table public.service_request_samples enable row level security;
alter table public.recovery_manifests enable row level security;
create policy "recovery_manifests_owner_read" on public.recovery_manifests for select to authenticated
  using (exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));

-- Service-role maintenance functions; raw telemetry is never client-readable.
create or replace function public.purge_service_request_samples(retention_days integer default 30)
returns bigint language plpgsql security definer set search_path='' as $$
declare removed bigint;
begin
  if retention_days < 7 or retention_days > 90 then raise exception 'retention_days must be between 7 and 90'; end if;
  delete from public.service_request_samples where created_at < now() - make_interval(days => retention_days);
  get diagnostics removed = row_count;
  return removed;
end; $$;
revoke all on function public.purge_service_request_samples(integer) from public,anon,authenticated;
grant execute on function public.purge_service_request_samples(integer) to service_role;
