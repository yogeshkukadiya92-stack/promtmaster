create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'active')),
  invite_token_hash text,
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, invited_email)
);

create table if not exists public.asset_shares (
  asset_id uuid not null references public.assets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  access_level text not null check (access_level in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (asset_id, workspace_id)
);

create table if not exists public.workspace_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 3 and 240),
  created_at timestamptz not null default now()
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id, workspace_id);
create index if not exists workspace_members_email_idx on public.workspace_members (invited_email, status);
create unique index if not exists workspace_members_invite_token_idx on public.workspace_members (invite_token_hash) where invite_token_hash is not null;
create index if not exists asset_shares_workspace_idx on public.asset_shares (workspace_id, created_at desc);
create index if not exists workspace_activity_workspace_idx on public.workspace_activity (workspace_id, created_at desc);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.asset_shares enable row level security;
alter table public.workspace_activity enable row level security;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspaces w where w.id = target_workspace and w.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.workspace_members wm where wm.workspace_id = target_workspace and wm.user_id = (select auth.uid()) and wm.status = 'active'
  );
$$;

create or replace function public.can_edit_workspace(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspaces w where w.id = target_workspace and w.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.workspace_members wm where wm.workspace_id = target_workspace and wm.user_id = (select auth.uid()) and wm.status = 'active' and wm.role in ('owner', 'editor')
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.can_edit_workspace(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.can_edit_workspace(uuid) to authenticated;

create policy "workspaces_visible_to_members" on public.workspaces for select to authenticated
using ((select public.is_workspace_member(id)));

create policy "workspaces_owner_manage" on public.workspaces for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "members_visible_to_workspace" on public.workspace_members for select to authenticated
using ((select public.is_workspace_member(workspace_id)));

create policy "members_owner_manage" on public.workspace_members for all to authenticated
using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())))
with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

create policy "shares_visible_to_workspace" on public.asset_shares for select to authenticated
using ((select public.is_workspace_member(workspace_id)));

create policy "shares_editor_manage" on public.asset_shares for all to authenticated
using ((select public.can_edit_workspace(workspace_id)))
with check ((select public.can_edit_workspace(workspace_id)));

create policy "activity_visible_to_workspace" on public.workspace_activity for select to authenticated
using ((select public.is_workspace_member(workspace_id)));

create policy "activity_editor_insert" on public.workspace_activity for insert to authenticated
with check (actor_id = (select auth.uid()) and (select public.can_edit_workspace(workspace_id)));
