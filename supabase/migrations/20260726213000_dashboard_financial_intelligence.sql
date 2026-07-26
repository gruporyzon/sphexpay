-- Dashboard financeiro real e planejamento administrativo isolado.
-- Nenhuma venda ou taxa demonstrativa é inserida por esta migration.

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  buyer_name text,
  product_name text not null,
  payment_method text not null,
  status text not null check (status in ('approved','pending','declined','refunded','chargeback')),
  amount_cents bigint not null check (amount_cents >= 0),
  fee_cents bigint not null default 0 check (fee_cents >= 0 and fee_cents <= amount_cents),
  currency text not null check (currency in ('BRL','USD','EUR')),
  occurred_at timestamptz not null,
  persisted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists payment_transactions_user_time_idx
  on public.payment_transactions(user_id,occurred_at desc);

create table if not exists public.dashboard_scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Planejamento',
  currency text not null check (currency in ('BRL','USD','EUR')),
  today_revenue_cents bigint not null check (today_revenue_cents >= 0),
  today_approved_sales integer not null check (today_approved_sales >= 0),
  average_ticket_cents bigint not null check (average_ticket_cents >= 0),
  approval_rate numeric(6,5) not null check (approval_rate between 0 and 1),
  refund_rate numeric(6,5) not null check (refund_rate between 0 and 1),
  chargeback_rate numeric(6,5) not null check (chargeback_rate between 0 and 1),
  daily_growth_rate numeric(8,6) not null check (daily_growth_rate between -1 and 10),
  weekday_factors jsonb not null,
  hourly_distribution jsonb not null,
  seed integer not null default 1,
  updated_at timestamptz not null default now(),
  unique(owner_id,name)
);

create table if not exists public.dashboard_exchange_rates (
  base_currency text not null check (base_currency in ('BRL','USD','EUR')),
  quote_currency text not null check (quote_currency in ('BRL','USD','EUR')),
  rate numeric(20,10) not null check (rate > 0),
  source text not null check (length(trim(source)) > 0),
  fetched_at timestamptz not null,
  enabled boolean not null default true,
  updated_by uuid references auth.users(id),
  primary key(base_currency,quote_currency),
  check(base_currency <> quote_currency)
);

alter table public.payment_transactions enable row level security;
alter table public.dashboard_scenarios enable row level security;
alter table public.dashboard_exchange_rates enable row level security;

-- O papel administrativo real deste projeto fica em public.profiles.role.
-- Impede que o próprio usuário eleve sua coluna role usando a policy de perfil existente.
revoke update on public.profiles from authenticated;
grant update(full_name,phone,avatar_url,business_name,operation_type,person_type,category,estimated_volume,currency,language,theme,onboarding_complete,preferences,updated_at)
  on public.profiles to authenticated;

create or replace function public.is_dashboard_admin()
returns boolean language sql stable security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and lower(p.role)='admin'
  );
$$;
revoke all on function public.is_dashboard_admin() from public,anon;
grant execute on function public.is_dashboard_admin() to authenticated,service_role;

revoke all on public.payment_transactions,public.dashboard_scenarios,public.dashboard_exchange_rates from anon;
revoke insert,update,delete on public.payment_transactions from authenticated;
grant select on public.payment_transactions,public.dashboard_exchange_rates to authenticated;
grant select,insert,update,delete on public.dashboard_scenarios to authenticated;
grant insert,update,delete on public.dashboard_exchange_rates to authenticated;
grant all on public.payment_transactions,public.dashboard_scenarios,public.dashboard_exchange_rates to service_role;

drop policy if exists payment_transactions_own_read on public.payment_transactions;
create policy payment_transactions_own_read on public.payment_transactions
  for select to authenticated using (user_id=auth.uid());

drop policy if exists dashboard_exchange_rates_authenticated_read on public.dashboard_exchange_rates;
create policy dashboard_exchange_rates_authenticated_read on public.dashboard_exchange_rates
  for select to authenticated using (enabled);
drop policy if exists dashboard_exchange_rates_admin_write on public.dashboard_exchange_rates;
create policy dashboard_exchange_rates_admin_write on public.dashboard_exchange_rates
  for all to authenticated
  using (public.is_dashboard_admin())
  with check (public.is_dashboard_admin() and updated_by=auth.uid());

drop policy if exists dashboard_scenarios_admin_read on public.dashboard_scenarios;
create policy dashboard_scenarios_admin_read on public.dashboard_scenarios
  for select to authenticated
  using (owner_id=auth.uid() and public.is_dashboard_admin());
drop policy if exists dashboard_scenarios_admin_insert on public.dashboard_scenarios;
create policy dashboard_scenarios_admin_insert on public.dashboard_scenarios
  for insert to authenticated
  with check (owner_id=auth.uid() and public.is_dashboard_admin());
drop policy if exists dashboard_scenarios_admin_update on public.dashboard_scenarios;
create policy dashboard_scenarios_admin_update on public.dashboard_scenarios
  for update to authenticated
  using (owner_id=auth.uid() and public.is_dashboard_admin())
  with check (owner_id=auth.uid() and public.is_dashboard_admin());
drop policy if exists dashboard_scenarios_admin_delete on public.dashboard_scenarios;
create policy dashboard_scenarios_admin_delete on public.dashboard_scenarios
  for delete to authenticated
  using (owner_id=auth.uid() and public.is_dashboard_admin());

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='payment_transactions'
  ) then
    alter publication supabase_realtime add table public.payment_transactions;
  end if;
end $$;
