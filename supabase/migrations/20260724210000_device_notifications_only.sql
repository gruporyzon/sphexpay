alter table public.push_subscriptions
  add column if not exists device_name text,
  add column if not exists platform text,
  add column if not exists browser text,
  add column if not exists enabled boolean not null default true,
  add column if not exists last_seen_at timestamptz not null default now();

create table if not exists public.push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  event_id text not null,
  status text not null check (status in ('sending','delivered','failed')),
  attempted_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (subscription_id,event_id)
);

create index if not exists push_delivery_log_user_id_idx on public.push_delivery_log(user_id);
alter table public.push_delivery_log enable row level security;

drop policy if exists "push_delivery_log_select_own" on public.push_delivery_log;
create policy "push_delivery_log_select_own"
on public.push_delivery_log for select
using (auth.uid() = user_id);
