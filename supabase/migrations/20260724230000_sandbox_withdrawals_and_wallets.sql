alter table public.wallets add column if not exists is_test_balance boolean not null default false;
alter table public.bank_accounts add column if not exists account_type text not null default 'checking', add column if not exists agency text, add column if not exists is_test boolean not null default false;

create or replace function public.ensure_test_withdrawal_setup()
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid(); v_number text; v_last text; v_wallet public.wallets%rowtype; v_account public.bank_accounts%rowtype;
begin
  if v_user is null then raise exception using message='AUTH_REQUIRED'; end if;
  select * into v_wallet from public.wallets where user_id=v_user order by currency limit 1;
  if not found then
    insert into public.wallets(user_id,currency,available_balance_minor,is_test_balance)
    values(v_user,'BRL',1000000,true) returning * into v_wallet;
  end if;
  select * into v_account from public.bank_accounts where user_id=v_user and is_test=true and active=true order by created_at limit 1;
  if not found then
    v_number:=substr(regexp_replace(md5(v_user::text),'[^0-9]','','g')||'84721',1,5);
    v_last:=right(v_number,4);
    insert into public.bank_accounts(user_id,label,bank_name,account_last_digits,currency,active,account_type,agency,is_test)
    values(v_user,'Conta de teste SphexPay','Ambiente sandbox',v_last,v_wallet.currency,true,'Conta corrente de teste','0001',true)
    returning * into v_account;
  end if;
  return jsonb_build_object('wallet',to_jsonb(v_wallet),'account',to_jsonb(v_account));
end;
$$;
revoke all on function public.ensure_test_withdrawal_setup() from public;
grant execute on function public.ensure_test_withdrawal_setup() to authenticated;

drop policy if exists "wallets_update_own" on public.wallets;
drop policy if exists "bank_accounts_insert_own" on public.bank_accounts;
drop policy if exists "bank_accounts_update_own" on public.bank_accounts;
revoke insert,update,delete on public.wallets from authenticated;
revoke insert,update,delete on public.bank_accounts from authenticated;
