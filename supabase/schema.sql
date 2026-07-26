-- Execute in the Supabase SQL editor. Never expose service_role keys in the frontend.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
create policy "avatars_public_read" on storage.objects for select using (bucket_id='avatars');
create policy "avatars_insert_own" on storage.objects for insert with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatars_update_own" on storage.objects for update using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatars_delete_own" on storage.objects for delete using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_name text,
  platform text,
  browser text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  last_error text,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions_select_own" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_subscriptions_update_own" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions for delete using (auth.uid() = user_id);

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
create policy "push_delivery_log_select_own" on public.push_delivery_log for select using (auth.uid() = user_id);
