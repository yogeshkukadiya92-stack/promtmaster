create table if not exists public.workspace_infrastructure_configs (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  residency_region text not null default 'in' check (residency_region in ('in','us','eu','apac')),
  provider text check (provider in ('openai','azure_openai','anthropic')),
  key_ciphertext text,key_iv text,key_auth_tag text,key_last_four text,key_rotated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,updated_at timestamptz not null default now(),
  check ((key_ciphertext is null and key_iv is null and key_auth_tag is null) or (key_ciphertext is not null and key_iv is not null and key_auth_tag is not null))
);
create table if not exists public.recovery_readiness_drills (
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
  initiated_by uuid references auth.users(id) on delete set null,status text not null check(status in ('ready','attention')),
  rpo_target_minutes integer not null check(rpo_target_minutes between 5 and 1440),rto_target_minutes integer not null check(rto_target_minutes between 5 and 2880),
  checks jsonb not null,verified_restore boolean not null default false,created_at timestamptz not null default now()
);
create index if not exists recovery_drills_workspace_created_idx on public.recovery_readiness_drills(workspace_id,created_at desc);
alter table public.workspace_infrastructure_configs enable row level security;alter table public.recovery_readiness_drills enable row level security;
create policy "infrastructure_owner_read" on public.workspace_infrastructure_configs for select to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy "recovery_drills_owner_read" on public.recovery_readiness_drills for select to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
