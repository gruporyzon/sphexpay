-- Environment-aware rows preserve account IDs, order FKs, flags and old reservations.
-- Existing rows are UNCLASSIFIED. Never infer mode from an acct_ prefix or today's key.
begin;

-- Bootstrap only the Connect dependencies, not the separate checkout/ledger schema.
-- Supabase prerequisites: auth.users, auth.uid(), anon/authenticated/service_role.
-- Definitions match the foundation and Connect portion of stripe_payments.
create table if not exists public.stripe_connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_account_id text not null,
  stripe_account_type text not null default 'express' check (stripe_account_type in ('express')),
  stripe_onboarding_status text not null default 'pending' check (stripe_onboarding_status in ('pending','in_review','requirements_due','enabled')),
  stripe_details_submitted boolean not null default false,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  stripe_requirements_currently_due text[] not null default '{}',
  stripe_requirements_eventually_due text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_connected_accounts_stripe_account_id_key unique (stripe_account_id),
  constraint stripe_connected_accounts_account_id_format check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$')
);

alter table public.stripe_connected_accounts
 add column if not exists stripe_capabilities jsonb not null default '{}';

create table if not exists public.stripe_account_requests (
 user_id uuid not null references auth.users(id),
 parameters jsonb not null,
 created_at timestamptz not null default now()
);

alter table public.stripe_connected_accounts
 add column if not exists stripe_mode text not null default 'legacy'
 check (stripe_mode in ('legacy','test','live'));
alter table public.stripe_account_requests
 add column if not exists stripe_mode text not null default 'legacy'
 check (stripe_mode in ('legacy','test','live'));

-- Remove only global user-only uniqueness (including differently named legacy keys).
-- No CASCADE: an unexpected dependent FK aborts the transaction rather than being lost.
-- Account-ID uniqueness, id PKs, composite keys and their dependent FKs remain intact.
do $$
declare t regclass; k record; user_attribute smallint;
begin
 foreach t in array array['public.stripe_connected_accounts'::regclass,'public.stripe_account_requests'::regclass] loop
  select attnum into user_attribute from pg_attribute where attrelid=t and attname='user_id' and not attisdropped;
  for k in select conname from pg_constraint
   where conrelid=t and contype in ('p','u') and conkey=array[user_attribute]
  loop execute format('alter table %s drop constraint %I',t,k.conname);end loop;
  for k in select indexrelid::regclass as index_name from pg_index
   where indrelid=t and indisunique and indnkeyatts=1 and indkey[0]=user_attribute
   and indpred is null and indexprs is null
  loop execute format('drop index %s',k.index_name);end loop;
 end loop;
end $$;
create unique index if not exists stripe_connected_accounts_user_mode_key
 on public.stripe_connected_accounts(user_id,stripe_mode);
create unique index if not exists stripe_connected_accounts_stripe_account_id_key
 on public.stripe_connected_accounts(stripe_account_id);
create index if not exists stripe_connected_accounts_onboarding_status_idx
 on public.stripe_connected_accounts(stripe_onboarding_status);
do $$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.stripe_account_requests'::regclass and contype='p') then
  alter table public.stripe_account_requests add constraint stripe_account_requests_pkey primary key(user_id,stripe_mode);
 end if;
end $$;
-- Also supplies ON CONFLICT inference if a custom installation uses a surrogate PK.
create unique index if not exists stripe_account_requests_user_mode_key
 on public.stripe_account_requests(user_id,stripe_mode);

-- A missing payments migration may also leave reservation RLS/grants absent.
alter table public.stripe_connected_accounts enable row level security;
alter table public.stripe_connected_accounts force row level security;
alter table public.stripe_account_requests enable row level security;
alter table public.stripe_account_requests force row level security;
do $$
begin
 if not exists(select 1 from pg_policy where polrelid='public.stripe_connected_accounts'::regclass and polname='stripe_connections_select_own') then
  create policy stripe_connections_select_own on public.stripe_connected_accounts
   for select to authenticated using (auth.uid() = user_id);
 end if;
end $$;
revoke all on table public.stripe_connected_accounts from public,anon,authenticated;
grant select on table public.stripe_connected_accounts to authenticated;
grant all on table public.stripe_connected_accounts to service_role;
revoke all on table public.stripe_account_requests from public,anon,authenticated;
grant all on table public.stripe_account_requests to service_role;

create or replace function public.stripe_connection_identity_guard() returns trigger language plpgsql as $$
begin
 if new.user_id is distinct from old.user_id or new.stripe_account_id is distinct from old.stripe_account_id
 or (new.stripe_mode is distinct from old.stripe_mode and old.stripe_mode<>'legacy') then
  raise exception 'CONNECT_IDENTITY_IMMUTABLE';
 end if;
 -- legacy -> test/live requires an explicit privileged UPDATE after verification.
 -- RLS continues to deny all frontend writes. Unique(user,mode) prevents replacement.
 return new;
end $$;

-- Replacing a function alone does not install its missing trigger.
create or replace trigger stripe_connection_identity_guard
 before update on public.stripe_connected_accounts
 for each row execute function public.stripe_connection_identity_guard();
alter table public.stripe_connected_accounts enable trigger stripe_connection_identity_guard;

-- Fail closed for old deployments; keep the old signature without reusing old requests.
create or replace function public.reserve_stripe_account(p_user_id uuid,p_parameters jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 raise exception 'CONNECT_MODE_REQUIRED';
end $$;

create or replace function public.reserve_stripe_account_for_mode(p_user_id uuid,p_mode text,p_parameters jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.stripe_account_requests%rowtype;
begin
 if p_mode is null or p_mode not in ('test','live') then raise exception 'CONNECT_MODE_REQUIRED';end if;
 -- Never create a second potentially-Live account while the legacy identity is unknown.
 if p_mode='live' and (
  exists(select 1 from public.stripe_connected_accounts where user_id=p_user_id and stripe_mode='legacy')
  or exists(select 1 from public.stripe_account_requests where user_id=p_user_id and stripe_mode='legacy')
 ) then raise exception 'CONNECT_LEGACY_CLASSIFICATION_REQUIRED';end if;
 insert into public.stripe_account_requests(user_id,stripe_mode,parameters)
 values(p_user_id,p_mode,p_parameters) on conflict(user_id,stripe_mode) do nothing;
 select * into r from public.stripe_account_requests where user_id=p_user_id and stripe_mode=p_mode for update;
 if r.created_at < now()-interval '23 hours' then raise exception 'CONNECT_RECONCILIATION_REQUIRED';end if;
 return r.parameters;
end $$;
revoke all on function public.reserve_stripe_account(uuid,jsonb),public.reserve_stripe_account_for_mode(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_stripe_account(uuid,jsonb),public.reserve_stripe_account_for_mode(uuid,text,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
