create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  asset_id text not null,
  title text not null,
  creator text not null,
  amount integer not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  status text not null default 'paid' check (status in ('paid', 'refunded', 'disputed')),
  purchased_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, asset_id)
);

create index if not exists purchases_user_purchased_idx
  on public.purchases (user_id, purchased_at desc);

create index if not exists purchases_asset_status_idx
  on public.purchases (asset_id, status);

create index if not exists payment_events_processed_idx
  on public.payment_events (processed_at desc);

alter table public.payment_events enable row level security;
alter table public.purchases enable row level security;

create policy "purchases_select_own" on public.purchases
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function public.process_stripe_checkout(event_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout jsonb := event_payload #> '{data,object}';
  inserted_event uuid;
  buyer_id uuid;
begin
  if event_payload->>'type' not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then
    return false;
  end if;

  if checkout->>'payment_status' <> 'paid' then
    return false;
  end if;

  buyer_id := coalesce(nullif(checkout #>> '{metadata,user_id}', ''), nullif(checkout->>'client_reference_id', ''))::uuid;

  insert into public.payment_events (stripe_event_id, event_type, payload)
  values (event_payload->>'id', event_payload->>'type', event_payload)
  on conflict (stripe_event_id) do nothing
  returning id into inserted_event;

  if inserted_event is null then
    return false;
  end if;

  insert into public.purchases (
    user_id, stripe_session_id, stripe_payment_intent_id, asset_id,
    title, creator, amount, currency, status, purchased_at
  ) values (
    buyer_id,
    checkout->>'id',
    nullif(checkout->>'payment_intent', ''),
    checkout #>> '{metadata,asset_id}',
    checkout #>> '{metadata,title}',
    checkout #>> '{metadata,creator}',
    (checkout->>'amount_total')::integer,
    lower(checkout->>'currency'),
    'paid',
    to_timestamp((checkout->>'created')::double precision)
  )
  on conflict (user_id, asset_id) do update set
    stripe_session_id = excluded.stripe_session_id,
    stripe_payment_intent_id = excluded.stripe_payment_intent_id,
    amount = excluded.amount,
    currency = excluded.currency,
    status = 'paid',
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.process_stripe_checkout(jsonb) from public;
revoke all on function public.process_stripe_checkout(jsonb) from anon;
revoke all on function public.process_stripe_checkout(jsonb) from authenticated;
grant execute on function public.process_stripe_checkout(jsonb) to service_role;
