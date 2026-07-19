create table if not exists public.product_activation_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in ('intent_submitted','asset_generated','asset_saved','asset_tested','asset_published')),
  session_id uuid not null,
  asset_id uuid,
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties)='object'),
  idempotency_key uuid not null unique,
  occurred_at timestamptz not null default now()
);
create index if not exists activation_events_workspace_time_idx on public.product_activation_events(workspace_id,occurred_at desc);
create index if not exists activation_events_workspace_name_time_idx on public.product_activation_events(workspace_id,event_name,occurred_at desc);
create index if not exists activation_events_user_time_idx on public.product_activation_events(user_id,occurred_at desc);
alter table public.product_activation_events enable row level security;
create policy "activation_owner_read" on public.product_activation_events for select to authenticated
  using (exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
