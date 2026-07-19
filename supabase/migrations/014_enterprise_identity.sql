alter table public.workspace_members drop constraint if exists workspace_members_status_check;
alter table public.workspace_members add constraint workspace_members_status_check check (status in ('pending','active','suspended'));

create table if not exists public.workspace_identity_configs (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  sso_enabled boolean not null default false,
  verified_domain text,
  saml_metadata_url text,
  scim_enabled boolean not null default false,
  scim_token_hash text,
  scim_token_last_four text,
  token_rotated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (verified_domain is null or verified_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  check (saml_metadata_url is null or saml_metadata_url ~ '^https://')
);

create table if not exists public.scim_directory_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text not null,
  email text not null,
  display_name text,
  role text not null default 'viewer' check (role in ('editor','viewer')),
  active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id,external_id), unique (workspace_id,email)
);

create index if not exists scim_users_workspace_active_idx on public.scim_directory_users (workspace_id,active,email);
create unique index if not exists identity_scim_token_hash_idx on public.workspace_identity_configs (scim_token_hash) where scim_token_hash is not null;
alter table public.workspace_identity_configs enable row level security;
alter table public.scim_directory_users enable row level security;
create policy "identity_config_owner_read" on public.workspace_identity_configs for select to authenticated using (exists (select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy "scim_directory_owner_read" on public.scim_directory_users for select to authenticated using (exists (select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
