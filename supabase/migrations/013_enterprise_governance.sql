create table if not exists public.workspace_governance_policies (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  audit_retention_days integer not null default 365 check (audit_retention_days between 30 and 2555),
  require_production_approval boolean not null default true,
  allow_external_agent_actions boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('governance','membership','sharing','security','execution')),
  action text not null check (char_length(action) between 3 and 100),
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_audit_workspace_created_idx on public.organization_audit_events (workspace_id, created_at desc);
alter table public.workspace_governance_policies enable row level security;
alter table public.organization_audit_events enable row level security;
create policy "governance_policy_workspace_read" on public.workspace_governance_policies for select to authenticated using (exists (select 1 from public.workspaces w where w.id=workspace_id and (w.owner_id=(select auth.uid()) or exists (select 1 from public.workspace_members m where m.workspace_id=w.id and m.user_id=(select auth.uid()) and m.status='active'))));
create policy "organization_audit_owner_read" on public.organization_audit_events for select to authenticated using (exists (select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));

create or replace function public.prevent_organization_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$ begin raise exception 'Organization audit events are append-only'; end; $$;
create trigger organization_audit_events_immutable before update or delete on public.organization_audit_events for each row execute function public.prevent_organization_audit_mutation();

insert into public.workspace_governance_policies (workspace_id,updated_by) select id,owner_id from public.workspaces on conflict (workspace_id) do nothing;

create or replace function public.update_workspace_governance(requested_owner_id uuid, retention_days integer, production_approval boolean, external_actions boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare owned_workspace uuid;
begin
  select id into owned_workspace from public.workspaces where owner_id=requested_owner_id limit 1;
  if owned_workspace is null or retention_days not between 30 and 2555 then return false; end if;
  insert into public.workspace_governance_policies (workspace_id,audit_retention_days,require_production_approval,allow_external_agent_actions,updated_by,updated_at)
  values (owned_workspace,retention_days,production_approval,external_actions,requested_owner_id,now())
  on conflict (workspace_id) do update set audit_retention_days=excluded.audit_retention_days,require_production_approval=excluded.require_production_approval,allow_external_agent_actions=excluded.allow_external_agent_actions,updated_by=excluded.updated_by,updated_at=now();
  insert into public.organization_audit_events (workspace_id,actor_id,category,action,target_type,target_id,metadata) values (owned_workspace,requested_owner_id,'governance','policy.updated','workspace',owned_workspace::text,jsonb_build_object('audit_retention_days',retention_days,'require_production_approval',production_approval,'allow_external_agent_actions',external_actions));
  return true;
end;
$$;

revoke all on function public.update_workspace_governance(uuid,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.update_workspace_governance(uuid,integer,boolean,boolean) to service_role;
