alter table public.push_subscriptions
  add column if not exists last_error text,
  add column if not exists last_success_at timestamptz;

create unique index if not exists push_subscriptions_endpoint_unique_idx
  on public.push_subscriptions(endpoint);

create index if not exists push_subscriptions_active_user_idx
  on public.push_subscriptions(user_id, enabled, last_seen_at desc);
