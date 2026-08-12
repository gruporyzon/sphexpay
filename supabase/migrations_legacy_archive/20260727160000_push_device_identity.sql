create extension if not exists pgcrypto;

alter table public.push_subscriptions
  add column if not exists device_id uuid,
  add column if not exists automatic_name text,
  add column if not exists endpoint_hash text,
  add column if not exists operating_system text,
  add column if not exists display_mode text,
  add column if not exists locale text,
  add column if not exists timezone text,
  add column if not exists last_failure_at timestamptz,
  add column if not exists failure_count integer not null default 0;

update public.push_subscriptions
set device_id=coalesce(device_id,gen_random_uuid()),
    automatic_name=coalesce(nullif(automatic_name,''),nullif(device_name,''),'Dispositivo'),
    endpoint_hash=coalesce(endpoint_hash,encode(digest(endpoint,'sha256'),'hex')),
    operating_system=coalesce(nullif(operating_system,''),nullif(platform,''),'Outro'),
    display_mode=coalesce(nullif(display_mode,''),'browser'),
    locale=coalesce(nullif(locale,''),'pt-BR'),
    timezone=coalesce(nullif(timezone,''),'UTC'),
    failure_count=coalesce(failure_count,0)
where device_id is null
   or endpoint_hash is null
   or automatic_name is null
   or operating_system is null
   or display_mode is null
   or locale is null
   or timezone is null;

alter table public.push_subscriptions
  alter column device_id set not null,
  alter column endpoint_hash set not null;

create unique index if not exists push_subscriptions_endpoint_hash_unique_idx
  on public.push_subscriptions(endpoint_hash);

create unique index if not exists push_subscriptions_user_device_unique_idx
  on public.push_subscriptions(user_id,device_id);

create index if not exists push_subscriptions_user_enabled_seen_idx
  on public.push_subscriptions(user_id,enabled,last_seen_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
  on public.push_subscriptions for select to authenticated
  using (auth.uid()=user_id);

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own
  on public.push_subscriptions for update to authenticated
  using (auth.uid()=user_id)
  with check (auth.uid()=user_id);

revoke all on public.push_subscriptions from anon,authenticated;
grant select (
  id,user_id,device_id,device_name,automatic_name,browser,operating_system,
  platform,display_mode,locale,timezone,enabled,last_seen_at,last_success_at,
  last_failure_at,failure_count,created_at,updated_at
) on public.push_subscriptions to authenticated;
grant update (device_name,enabled,updated_at) on public.push_subscriptions to authenticated;
grant select,insert,update,delete on public.push_subscriptions to service_role;
