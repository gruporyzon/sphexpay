-- Afiliados de verdade: o pedido do checkout guarda o afiliado do link (?ref=AFF-...) e a
-- comissão calculada pelo servidor no momento da compra. A comissão só é devida em vendas
-- aprovadas (reembolso e contestação zeram). O pagamento ao afiliado é feito pelo vendedor
-- fora da SphexPay: aqui ele só registra que pagou. O afiliado não recebe acesso ao painel.

alter table public.stripe_checkout_orders add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null;
alter table public.stripe_checkout_orders add column if not exists affiliate_commission_cents bigint;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='stripe_checkout_orders_affiliate_commission_check') then
  alter table public.stripe_checkout_orders add constraint stripe_checkout_orders_affiliate_commission_check
   check (affiliate_commission_cents is null or (affiliate_commission_cents>=0 and affiliate_commission_cents<=amount_cents));
 end if;
end $$;
create index if not exists stripe_checkout_orders_affiliate_idx on public.stripe_checkout_orders(seller_id,affiliate_id) where affiliate_id is not null;

create table if not exists public.affiliate_commission_payments (
 order_id uuid primary key references public.stripe_checkout_orders(id) on delete cascade,
 merchant_id uuid not null references auth.users(id) on delete cascade,
 paid_at timestamptz not null default now()
);
alter table public.affiliate_commission_payments enable row level security;
alter table public.affiliate_commission_payments force row level security;
revoke all on public.affiliate_commission_payments from anon,authenticated;
grant select on public.affiliate_commission_payments to authenticated;
drop policy if exists affiliate_commission_payments_own_read on public.affiliate_commission_payments;
create policy affiliate_commission_payments_own_read on public.affiliate_commission_payments for select to authenticated using (merchant_id=(select auth.uid()));

-- Vendas com afiliado do próprio vendedor, só em contas live.
create or replace function public.my_affiliate_sales(p_start timestamptz,p_end timestamptz)
returns table(order_id uuid,affiliate_id uuid,affiliate_name text,affiliate_public_id text,buyer_name text,product_name text,payment_method text,status text,amount_cents bigint,currency text,commission_cents bigint,commission_paid_at timestamptz,occurred_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 -- Uma linha por pedido: em assinatura, a comissão vale para a primeira cobrança.
 return query
 select * from (
  select distinct on (o.id) o.id,o.affiliate_id,a.name,a.public_id,o.buyer_name,o.product_name,t.payment_method,t.status,t.amount_cents,t.currency,
   case when t.status='approved' then coalesce(o.affiliate_commission_cents,0) else 0 end::bigint,p.paid_at,t.occurred_at
  from public.payment_transactions t
  join public.stripe_checkout_orders o on o.id::text=t.metadata->>'order_id' and o.seller_id=t.user_id
  join public.affiliates a on a.id=o.affiliate_id and a.merchant_id=o.seller_id
  left join public.affiliate_commission_payments p on p.order_id=o.id
  where t.user_id=auth.uid() and t.provider='stripe' and o.affiliate_id is not null
  order by o.id,t.occurred_at asc
 ) first_sale
 where first_sale.occurred_at>=p_start and first_sale.occurred_at<=p_end
 order by first_sale.occurred_at desc
 limit 5000;
end $$;

-- Marca (ou desmarca) comissões como pagas ao afiliado. Só pedidos aprovados do próprio vendedor.
create or replace function public.set_affiliate_commission_paid(p_order_ids uuid[],p_paid boolean)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare changed integer;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if p_order_ids is null or cardinality(p_order_ids)=0 or cardinality(p_order_ids)>500 then raise exception 'INVALID_ORDERS';end if;
 if p_paid then
  insert into public.affiliate_commission_payments(order_id,merchant_id)
  select o.id,o.seller_id from public.stripe_checkout_orders o
  where o.id=any(p_order_ids) and o.seller_id=auth.uid() and o.affiliate_id is not null and o.status='approved'
  on conflict(order_id) do nothing;
 else
  delete from public.affiliate_commission_payments where order_id=any(p_order_ids) and merchant_id=auth.uid();
 end if;
 get diagnostics changed=row_count;
 return changed;
end $$;

revoke all on function public.my_affiliate_sales(timestamptz,timestamptz) from public,anon;
revoke all on function public.set_affiliate_commission_paid(uuid[],boolean) from public,anon;
grant execute on function public.my_affiliate_sales(timestamptz,timestamptz) to authenticated;
grant execute on function public.set_affiliate_commission_paid(uuid[],boolean) to authenticated;
