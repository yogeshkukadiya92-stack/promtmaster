create table if not exists public.workspace_launch_controls (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  rollout_mode text not null default 'internal' check (rollout_mode in ('internal','beta','public')),
  launch_paused boolean not null default false,
  beta_capacity integer not null default 100 check (beta_capacity between 1 and 10000),
  activation_target_percent numeric(5,2) not null default 35 check (activation_target_percent between 1 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.launch_access_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash)=64),
  cohort_name text not null default 'Founding beta' check (char_length(cohort_name) between 2 and 80),
  status text not null default 'active' check (status in ('active','redeemed','revoked')),
  created_by uuid references auth.users(id) on delete set null,
  redeemed_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists launch_tokens_workspace_status_idx on public.launch_access_tokens(workspace_id,status,created_at desc);
create index if not exists launch_tokens_active_expiry_idx on public.launch_access_tokens(expires_at) where status='active';
alter table public.workspace_launch_controls enable row level security;
alter table public.launch_access_tokens enable row level security;
create policy "launch_controls_owner_read" on public.workspace_launch_controls for select to authenticated
  using (exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy "launch_tokens_owner_read" on public.launch_access_tokens for select to authenticated
  using (exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
