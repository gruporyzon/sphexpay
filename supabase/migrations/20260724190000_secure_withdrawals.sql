-- Saques atômicos e idempotentes. Execute via Supabase CLI ou SQL editor.
create table if not exists public.wallets (
  user_id uuid not null references auth.users(id) on delete cascade,
  currency text not null check (currency in ('BRL','USD','EUR')),
  available_balance_minor bigint not null default 0 check (available_balance_minor >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id,currency)
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  bank_name text not null,
  account_last_digits text not null check (account_last_digits ~ '^[0-9]{4}$'),
  currency text not null check (currency in ('BRL','USD','EUR')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.withdrawal_status as enum ('requested','processing','completed','rejected','cancelled','failed');

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id),
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  fee_amount_minor bigint not null default 0 check (fee_amount_minor >= 0),
  net_amount_minor bigint not null check (net_amount_minor > 0),
  currency text not null check (currency in ('BRL','USD','EUR')),
  status public.withdrawal_status not null default 'requested',
  destination_label text not null,
  destination_last_digits text not null,
  idempotency_key uuid not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,idempotency_key)
);
create index if not exists withdrawals_user_requested_idx on public.withdrawals(user_id,requested_at desc);
alter publication supabase_realtime add table public.withdrawals;

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  withdrawal_id uuid references public.withdrawals(id) on delete restrict,
  entry_type text not null check (entry_type in ('withdrawal')),
  direction text not null check (direction in ('debit')),
  description text not null,
  amount_minor bigint not null check (amount_minor > 0),
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  currency text not null check (currency in ('BRL','USD','EUR')),
  status public.withdrawal_status not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists financial_entries_withdrawal_idx on public.financial_entries(withdrawal_id);

create table if not exists public.account_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('withdrawal_requested','withdrawal_completed')),
  title text not null,
  body text not null,
  route text not null default '/app/saques',
  entity_id uuid references public.withdrawals(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists account_notifications_event_entity_idx on public.account_notifications(event_type,entity_id);

alter table public.wallets enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.withdrawals enable row level security;
alter table public.financial_entries enable row level security;
alter table public.account_notifications enable row level security;

create policy "wallets_select_own" on public.wallets for select using (auth.uid()=user_id);
create policy "bank_accounts_select_own" on public.bank_accounts for select using (auth.uid()=user_id);
create policy "withdrawals_select_own" on public.withdrawals for select using (auth.uid()=user_id);
create policy "financial_entries_select_own" on public.financial_entries for select using (auth.uid()=user_id);
create policy "account_notifications_select_own" on public.account_notifications for select using (auth.uid()=user_id);
create policy "account_notifications_update_read_own" on public.account_notifications for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
revoke update on public.account_notifications from authenticated;
grant update(read) on public.account_notifications to authenticated;

create or replace function public.format_minor_amount(p_amount bigint,p_currency text) returns text
language plpgsql immutable strict set search_path=public,pg_temp
as $$
declare v_value text:=to_char(p_amount::numeric/100,'FM999,999,999,999,990.00');
begin
  if p_currency='USD' then return 'US$ '||v_value; end if;
  v_value:=replace(replace(replace(v_value,',','@'),'.',','),'@','.');
  if p_currency='EUR' then return '€ '||v_value; end if;
  return 'R$ '||v_value;
end;
$$;

create or replace function public.request_withdrawal(
  p_amount_minor bigint,
  p_bank_account_id uuid,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_account public.bank_accounts%rowtype;
  v_wallet public.wallets%rowtype;
  v_withdrawal public.withdrawals%rowtype;
  v_existing public.withdrawals%rowtype;
  v_fee_minor bigint:=0;
begin
  if v_user_id is null then raise exception using errcode='P0001',message='AUTH_REQUIRED'; end if;
  if p_amount_minor is null or p_amount_minor<=0 then raise exception using errcode='P0001',message='INVALID_AMOUNT'; end if;
  if p_bank_account_id is null then raise exception using errcode='P0001',message='BANK_ACCOUNT_REQUIRED'; end if;
  if p_idempotency_key is null then raise exception using errcode='P0001',message='IDEMPOTENCY_REQUIRED'; end if;

  select * into v_existing from public.withdrawals where user_id=v_user_id and idempotency_key=p_idempotency_key;
  if found then
    return jsonb_build_object('duplicate',true,'withdrawal',to_jsonb(v_existing));
  end if;

  select * into v_account from public.bank_accounts where id=p_bank_account_id and user_id=v_user_id and active=true;
  if not found then raise exception using errcode='P0001',message='BANK_ACCOUNT_UNAVAILABLE'; end if;

  select * into v_wallet from public.wallets where user_id=v_user_id and currency=v_account.currency for update;
  if not found then raise exception using errcode='P0001',message='WALLET_UNAVAILABLE'; end if;
  if v_wallet.available_balance_minor<p_amount_minor then raise exception using errcode='P0001',message='INSUFFICIENT_BALANCE'; end if;

  insert into public.withdrawals(user_id,bank_account_id,gross_amount_minor,fee_amount_minor,net_amount_minor,currency,status,destination_label,destination_last_digits,idempotency_key)
  values(v_user_id,v_account.id,p_amount_minor,v_fee_minor,p_amount_minor-v_fee_minor,v_account.currency,'requested',v_account.label,v_account.account_last_digits,p_idempotency_key)
  returning * into v_withdrawal;

  update public.wallets set available_balance_minor=available_balance_minor-p_amount_minor,updated_at=now()
  where user_id=v_user_id and currency=v_account.currency returning * into v_wallet;

  insert into public.financial_entries(user_id,withdrawal_id,entry_type,direction,description,amount_minor,fee_minor,currency,status)
  values(v_user_id,v_withdrawal.id,'withdrawal','debit','Saque solicitado',p_amount_minor,v_fee_minor,v_account.currency,'requested');

  insert into public.account_notifications(user_id,event_type,title,body,route,entity_id)
  values(v_user_id,'withdrawal_requested','Saque solicitado com sucesso','Valor solicitado: '||public.format_minor_amount(p_amount_minor,v_account.currency),'/app/saques',v_withdrawal.id);

  return jsonb_build_object('duplicate',false,'withdrawal',to_jsonb(v_withdrawal),'available_balance_minor',v_wallet.available_balance_minor);
end;
$$;

revoke all on function public.request_withdrawal(bigint,uuid,uuid) from public;
grant execute on function public.request_withdrawal(bigint,uuid,uuid) to authenticated;

-- Status operacionais devem ser alterados somente por backend autorizado.
create or replace function public.complete_withdrawal(p_withdrawal_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_withdrawal public.withdrawals%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  update public.withdrawals set status='completed',processed_at=coalesce(processed_at,now()),completed_at=now(),updated_at=now()
  where id=p_withdrawal_id and status in ('requested','processing') returning * into v_withdrawal;
  if not found then return; end if;
  update public.financial_entries set status='completed',description='Saque concluído' where withdrawal_id=p_withdrawal_id;
  insert into public.account_notifications(user_id,event_type,title,body,route,entity_id)
  values(v_withdrawal.user_id,'withdrawal_completed','Saque realizado com sucesso','Valor enviado: '||public.format_minor_amount(v_withdrawal.net_amount_minor,v_withdrawal.currency),'/app/saques',v_withdrawal.id)
  on conflict (event_type,entity_id) do nothing;
end;
$$;
revoke all on function public.complete_withdrawal(uuid) from public,authenticated;
grant execute on function public.complete_withdrawal(uuid) to service_role;
