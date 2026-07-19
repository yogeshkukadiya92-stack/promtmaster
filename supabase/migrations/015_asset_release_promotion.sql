create table if not exists public.asset_releases (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  environment text not null default 'staging' check (environment in ('staging','production')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  previous_release_id uuid references public.asset_releases(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists asset_releases_workspace_requested_idx on public.asset_releases (workspace_id,requested_at desc);
create index if not exists asset_releases_asset_requested_idx on public.asset_releases (asset_id,requested_at desc);
create unique index if not exists asset_one_active_production_idx on public.asset_releases (asset_id) where environment='production' and status='approved';
create unique index if not exists asset_one_pending_release_idx on public.asset_releases (asset_id) where status='pending';
alter table public.asset_releases enable row level security;
create policy "asset_releases_workspace_read" on public.asset_releases for select to authenticated using (exists (select 1 from public.workspaces w where w.id=workspace_id and (w.owner_id=(select auth.uid()) or exists (select 1 from public.workspace_members m where m.workspace_id=w.id and m.user_id=(select auth.uid()) and m.status='active'))));

create or replace function public.request_asset_promotion(requested_user_id uuid, requested_asset_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare owned_asset public.assets; owned_workspace uuid; release_id uuid;
begin
  select * into owned_asset from public.assets where id=requested_asset_id and user_id=requested_user_id;
  select id into owned_workspace from public.workspaces where owner_id=requested_user_id limit 1;
  if owned_asset.id is null or owned_workspace is null then return null; end if;
  insert into public.asset_releases(asset_id,workspace_id,version,snapshot,requested_by) values(owned_asset.id,owned_workspace,owned_asset.current_version,owned_asset.content,requested_user_id) returning id into release_id;
  insert into public.organization_audit_events(workspace_id,actor_id,category,action,target_type,target_id,metadata) values(owned_workspace,requested_user_id,'governance','release.requested','asset_release',release_id::text,jsonb_build_object('asset_id',owned_asset.id,'version',owned_asset.current_version));
  return release_id;
end; $$;

create or replace function public.decide_asset_promotion(requested_owner_id uuid, requested_release_id uuid, approved boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare release public.asset_releases; previous_id uuid;
begin
  select ar.* into release from public.asset_releases ar join public.workspaces w on w.id=ar.workspace_id where ar.id=requested_release_id and w.owner_id=requested_owner_id and ar.status='pending' for update of ar;
  if release.id is null then return false; end if;
  if approved then
    select id into previous_id from public.asset_releases where asset_id=release.asset_id and environment='production' and status='approved' for update;
    update public.asset_releases set status='superseded',decided_at=now(),decided_by=requested_owner_id where id=previous_id;
    update public.asset_releases set environment='production',status='approved',previous_release_id=previous_id,decided_at=now(),decided_by=requested_owner_id where id=release.id;
  else update public.asset_releases set status='rejected',decided_at=now(),decided_by=requested_owner_id where id=release.id; end if;
  insert into public.organization_audit_events(workspace_id,actor_id,category,action,target_type,target_id,metadata) values(release.workspace_id,requested_owner_id,'governance',case when approved then 'release.promoted' else 'release.rejected' end,'asset_release',release.id::text,jsonb_build_object('asset_id',release.asset_id,'version',release.version,'previous_release_id',previous_id));
  return true;
end; $$;

create or replace function public.rollback_asset_release(requested_owner_id uuid, target_release_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare target public.asset_releases; current_id uuid;
begin
  select ar.* into target from public.asset_releases ar join public.workspaces w on w.id=ar.workspace_id where ar.id=target_release_id and w.owner_id=requested_owner_id and ar.status='superseded' for update of ar;
  if target.id is null then return false; end if;
  select id into current_id from public.asset_releases where asset_id=target.asset_id and environment='production' and status='approved' for update;
  if current_id is null then return false; end if;
  update public.asset_releases set status='superseded',decided_at=now(),decided_by=requested_owner_id where id=current_id;
  update public.asset_releases set environment='production',status='approved',previous_release_id=current_id,decided_at=now(),decided_by=requested_owner_id where id=target.id;
  insert into public.organization_audit_events(workspace_id,actor_id,category,action,target_type,target_id,metadata) values(target.workspace_id,requested_owner_id,'governance','release.rolled_back','asset_release',target.id::text,jsonb_build_object('asset_id',target.asset_id,'restored_version',target.version,'replaced_release_id',current_id));
  return true;
end; $$;
revoke all on function public.request_asset_promotion(uuid,uuid) from public,anon,authenticated;
revoke all on function public.decide_asset_promotion(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.rollback_asset_release(uuid,uuid) from public,anon,authenticated;
grant execute on function public.request_asset_promotion(uuid,uuid) to service_role;
grant execute on function public.decide_asset_promotion(uuid,uuid,boolean) to service_role;
grant execute on function public.rollback_asset_release(uuid,uuid) to service_role;
