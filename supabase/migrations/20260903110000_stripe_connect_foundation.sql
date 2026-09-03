-- Stripe Connect foundation. IDs are safe references; credentials remain server-side only.
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
  constraint stripe_connected_accounts_user_id_key unique (user_id),
  constraint stripe_connected_accounts_stripe_account_id_key unique (stripe_account_id),
  constraint stripe_connected_accounts_account_id_format check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$')
);

create index if not exists stripe_connected_accounts_onboarding_status_idx on public.stripe_connected_accounts (stripe_onboarding_status);
alter table public.stripe_connected_accounts enable row level security;
alter table public.stripe_connected_accounts force row level security;

create policy "stripe_connections_select_own" on public.stripe_connected_accounts for select to authenticated using (auth.uid() = user_id);
revoke all on table public.stripe_connected_accounts from anon, authenticated;
grant select on table public.stripe_connected_accounts to authenticated;
grant all on table public.stripe_connected_accounts to service_role;
