-- Operacao financeira real: catalogo, snapshots, historico e outbox.
-- Nao insere produtos, compradores ou transacoes.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  description text not null default '',
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'BRL' check (currency in ('BRL','USD','EUR')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_seller_active_idx on public.products(seller_id,active);

alter table public.payment_transactions add column if not exists provider text;
alter table public.payment_transactions add column if not exists external_transaction_id text;
alter table public.payment_transactions add column if not exists product_id uuid references public.products(id);
alter table public.payment_transactions add column if not exists product_name_snapshot text;
alter table public.payment_transactions add column if not exists product_price_cents_snapshot bigint;
alter table public.payment_transactions add column if not exists gross_amount_cents bigint;
alter table public.payment_transactions add column if not exists discount_cents bigint not null default 0;
alter table public.payment_transactions add column if not exists net_amount_cents bigint;
alter table public.payment_transactions add column if not exists commission_cents bigint not null default 0;
alter table public.payment_transactions add column if not exists customer_display_name text;
alter table public.payment_transactions add column if not exists updated_at timestamptz not null default now();

update public.payment_transactions
set external_transaction_id=coalesce(external_transaction_id,transaction_id),
    product_name_snapshot=coalesce(product_name_snapshot,product_name),
    product_price_cents_snapshot=coalesce(product_price_cents_snapshot,amount_cents),
    gross_amount_cents=coalesce(gross_amount_cents,amount_cents),
    net_amount_cents=coalesce(net_amount_cents,greatest(0,amount_cents-fee_cents)),
    customer_display_name=coalesce(customer_display_name,customer_name)
where external_transaction_id is null
   or product_name_snapshot is null
   or product_price_cents_snapshot is null
   or gross_amount_cents is null
   or net_amount_cents is null;

create unique index if not exists payment_transactions_provider_external_idx
  on public.payment_transactions(provider,external_transaction_id)
  where provider is not null and external_transaction_id is not null;
create index if not exists payment_transactions_product_idx
  on public.payment_transactions(product_id);
create index if not exists payment_transactions_user_updated_idx
  on public.payment_transactions(user_id,updated_at desc);

create table if not exists public.payment_transaction_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  provider text not null,
  external_transaction_id text not null,
  transaction_id uuid references public.payment_transactions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  previous_status text,
  status text not null check (status in ('approved','pending','declined','refunded','chargeback')),
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_transaction_events_transaction_idx
  on public.payment_transaction_events(transaction_id,created_at);

create table if not exists public.financial_event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  transaction_id uuid not null references public.payment_transactions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','processed','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists financial_event_outbox_status_idx
  on public.financial_event_outbox(status,created_at);

alter table public.products enable row level security;
alter table public.payment_transaction_events enable row level security;
alter table public.financial_event_outbox enable row level security;

revoke all on public.products,public.payment_transaction_events,public.financial_event_outbox from anon;
revoke insert,update,delete on public.payment_transactions,public.payment_transaction_events,public.financial_event_outbox from authenticated;
grant select,insert,update,delete on public.products to authenticated;
grant select on public.payment_transaction_events,public.financial_event_outbox to authenticated;
grant all on public.products,public.payment_transaction_events,public.financial_event_outbox to service_role;

drop policy if exists products_own_read on public.products;
create policy products_own_read on public.products for select to authenticated
  using (seller_id=auth.uid());
drop policy if exists products_own_insert on public.products;
create policy products_own_insert on public.products for insert to authenticated
  with check (seller_id=auth.uid());
drop policy if exists products_own_update on public.products;
create policy products_own_update on public.products for update to authenticated
  using (seller_id=auth.uid()) with check (seller_id=auth.uid());
drop policy if exists products_own_delete on public.products;
create policy products_own_delete on public.products for delete to authenticated
  using (seller_id=auth.uid());

drop policy if exists payment_transaction_events_own_read on public.payment_transaction_events;
create policy payment_transaction_events_own_read on public.payment_transaction_events
  for select to authenticated using (user_id=auth.uid());
drop policy if exists financial_event_outbox_own_read on public.financial_event_outbox;
create policy financial_event_outbox_own_read on public.financial_event_outbox
  for select to authenticated using (user_id=auth.uid());

create or replace function public.process_payment_event(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_provider text:=nullif(trim(input->>'provider'),'');
  v_event_id text:=nullif(trim(input->>'eventId'),'');
  v_external_id text:=nullif(trim(input->>'externalTransactionId'),'');
  v_event_type text:=nullif(trim(input->>'eventType'),'');
  v_status text:=nullif(trim(input->>'status'),'');
  v_product_id uuid;
  v_seller_id uuid;
  v_product public.products%rowtype;
  v_transaction public.payment_transactions%rowtype;
  v_previous_status text;
  v_occurred_at timestamptz:=coalesce(nullif(input->>'occurredAt','')::timestamptz,now());
  v_gross bigint:=coalesce((input->'amounts'->>'grossCents')::bigint,0);
  v_discount bigint:=coalesce((input->'amounts'->>'discountCents')::bigint,0);
  v_fee bigint:=coalesce((input->'amounts'->>'feeCents')::bigint,0);
  v_commission bigint:=coalesce((input->'amounts'->>'commissionCents')::bigint,0);
  v_final bigint:=coalesce((input->'amounts'->>'finalCents')::bigint,v_gross-v_discount);
  v_currency text:=upper(coalesce(input->>'currency',''));
  v_first_approval boolean:=false;
  v_outbox_type text;
begin
  if v_provider is null or v_event_id is null or v_external_id is null or v_event_type is null then
    raise exception using errcode='22023',message='INVALID_PAYMENT_EVENT';
  end if;
  if v_status not in ('approved','pending','declined','refunded','chargeback') then
    raise exception using errcode='22023',message='INVALID_PAYMENT_STATUS';
  end if;
  if exists(select 1 from public.payment_transaction_events where event_id=v_event_id) then
    select * into v_transaction from public.payment_transactions
      where provider=v_provider and external_transaction_id=v_external_id;
    return jsonb_build_object('duplicate',true,'transactionId',v_transaction.id,'approvedNow',false);
  end if;

  v_product_id:=(input->>'productId')::uuid;
  v_seller_id:=(input->>'sellerId')::uuid;
  select * into v_product from public.products where id=v_product_id and seller_id=v_seller_id and active;
  if not found then raise exception using errcode='22023',message='PRODUCT_NOT_AVAILABLE'; end if;
  if v_currency='' then v_currency:=v_product.currency; end if;
  if v_currency not in ('BRL','USD','EUR') or v_currency<>v_product.currency then
    raise exception using errcode='22023',message='INVALID_PAYMENT_CURRENCY';
  end if;
  if least(v_gross,v_discount,v_fee,v_commission,v_final)<0 or v_discount>v_gross or v_final<>v_gross-v_discount or v_fee>v_final then
    raise exception using errcode='22023',message='INVALID_PAYMENT_AMOUNTS';
  end if;

  select * into v_transaction from public.payment_transactions
    where provider=v_provider and external_transaction_id=v_external_id for update;
  if found then
    v_previous_status:=v_transaction.status;
    if v_transaction.user_id<>v_seller_id or v_transaction.product_id<>v_product_id then
      raise exception using errcode='22023',message='PAYMENT_IDENTITY_MISMATCH';
    end if;
    update public.payment_transactions set
      status=v_status,
      payment_method=coalesce(nullif(trim(input->>'paymentMethod'),''),payment_method),
      fee_cents=v_fee,
      net_amount_cents=greatest(0,v_final-v_fee),
      commission_cents=v_commission,
      customer_display_name=coalesce(nullif(trim(input->'customer'->>'displayName'),''),customer_display_name),
      customer_name=coalesce(nullif(trim(input->'customer'->>'displayName'),''),customer_name),
      approved_at=case when v_status='approved' then coalesce(approved_at,v_occurred_at) else approved_at end,
      refunded_at=case when v_status='refunded' then coalesce(refunded_at,v_occurred_at) else refunded_at end,
      chargeback_at=case when v_status='chargeback' then coalesce(chargeback_at,v_occurred_at) else chargeback_at end,
      updated_at=now(),
      metadata=metadata||coalesce(input->'rawMetadata','{}'::jsonb)
    where id=v_transaction.id returning * into v_transaction;
  else
    v_previous_status:=null;
    insert into public.payment_transactions(
      transaction_id,provider,external_transaction_id,user_id,product_id,
      product_name,product_name_snapshot,product_price_cents_snapshot,
      payment_method,status,amount_cents,gross_amount_cents,discount_cents,fee_cents,
      net_amount_cents,commission_cents,currency,customer_name,customer_display_name,
      occurred_at,approved_at,refunded_at,chargeback_at,updated_at,metadata
    ) values (
      v_provider||':'||v_external_id,v_provider,v_external_id,v_seller_id,v_product.id,
      v_product.name,v_product.name,v_product.price_cents,
      coalesce(nullif(trim(input->>'paymentMethod'),''),'unknown'),v_status,v_final,v_gross,v_discount,v_fee,
      greatest(0,v_final-v_fee),v_commission,v_currency,
      nullif(trim(input->'customer'->>'displayName'),''),nullif(trim(input->'customer'->>'displayName'),''),
      v_occurred_at,
      case when v_status='approved' then v_occurred_at end,
      case when v_status='refunded' then v_occurred_at end,
      case when v_status='chargeback' then v_occurred_at end,
      now(),coalesce(input->'rawMetadata','{}'::jsonb)
    ) returning * into v_transaction;
  end if;

  v_first_approval:=v_status='approved' and v_previous_status is distinct from 'approved'
    and not exists(select 1 from public.payment_transaction_events
      where transaction_id=v_transaction.id and status='approved');

  insert into public.payment_transaction_events(
    event_id,provider,external_transaction_id,transaction_id,user_id,event_type,
    previous_status,status,occurred_at,metadata
  ) values (
    v_event_id,v_provider,v_external_id,v_transaction.id,v_seller_id,v_event_type,
    v_previous_status,v_status,v_occurred_at,coalesce(input->'rawMetadata','{}'::jsonb)
  );

  v_outbox_type:=case
    when v_first_approval then 'sale_approved'
    when v_status='refunded' and v_previous_status is distinct from 'refunded' then 'refund_done'
    when v_status='chargeback' and v_previous_status is distinct from 'chargeback' then 'chargeback_received'
    else null
  end;
  if v_outbox_type is not null then
    insert into public.financial_event_outbox(event_id,transaction_id,user_id,event_type,payload)
    values (
      v_event_id||':'||v_outbox_type,v_transaction.id,v_seller_id,v_outbox_type,
      jsonb_build_object(
        'transactionId',v_transaction.transaction_id,'productId',v_product.id,
        'productName',v_transaction.product_name_snapshot,'currency',v_currency,
        'commissionCents',v_commission,'amountCents',v_final,
        'route','/app/transacoes/'||v_transaction.transaction_id
      )
    ) on conflict(event_id) do nothing;
  end if;

  return jsonb_build_object(
    'duplicate',false,'transactionId',v_transaction.id,
    'publicTransactionId',v_transaction.transaction_id,
    'productName',v_transaction.product_name_snapshot,
    'approvedNow',v_first_approval,'outboxEventType',v_outbox_type
  );
end;
$$;
revoke all on function public.process_payment_event(jsonb) from public,anon,authenticated;
grant execute on function public.process_payment_event(jsonb) to service_role;

create or replace function public.dashboard_eligible_revenue()
returns bigint
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select coalesce(sum(amount_cents),0)::bigint
  from public.payment_transactions
  where user_id=auth.uid() and status='approved';
$$;
revoke all on function public.dashboard_eligible_revenue() from public,anon;
grant execute on function public.dashboard_eligible_revenue() to authenticated,service_role;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='payment_transactions'
  ) then
    alter publication supabase_realtime add table public.payment_transactions;
  end if;
end $$;
