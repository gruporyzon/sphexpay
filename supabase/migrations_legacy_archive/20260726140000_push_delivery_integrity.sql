drop index if exists public.push_subscriptions_endpoint_unique_idx;
create unique index if not exists push_subscriptions_user_endpoint_unique_idx
  on public.push_subscriptions(user_id, endpoint);

alter table public.push_delivery_log
  add column if not exists http_status integer,
  add column if not exists error_code text;

create index if not exists push_delivery_log_event_user_idx
  on public.push_delivery_log(user_id, event_id, attempted_at desc);
