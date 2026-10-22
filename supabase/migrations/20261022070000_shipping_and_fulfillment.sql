-- Produtos físicos: fretes do vendedor, endereço e frete escolhidos no checkout e controle de
-- entrega (encomendas) com código de rastreio. O valor do frete entra no total cobrado pela
-- Stripe como um item separado; o servidor recalcula tudo e nunca confia no navegador.

create table if not exists public.shipping_rates (
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 2 and 80),
 carrier text check (carrier is null or char_length(carrier)<=80),
 price_cents bigint not null check (price_cents between 0 and 10000000),
 min_order_cents bigint not null default 0 check (min_order_cents between 0 and 99999999),
 delivery_days_min integer check (delivery_days_min is null or delivery_days_min between 0 and 120),
 delivery_days_max integer check (delivery_days_max is null or delivery_days_max between 0 and 120),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint shipping_rates_days_order check (delivery_days_min is null or delivery_days_max is null or delivery_days_min<=delivery_days_max)
);
create index if not exists shipping_rates_seller_idx on public.shipping_rates(seller_id,created_at desc);
alter table public.shipping_rates enable row level security;
alter table public.shipping_rates force row level security;
revoke all on public.shipping_rates from anon,authenticated;
grant select,insert,update,delete on public.shipping_rates to authenticated;
drop policy if exists shipping_rates_own_select on public.shipping_rates;
drop policy if exists shipping_rates_own_insert on public.shipping_rates;
drop policy if exists shipping_rates_own_update on public.shipping_rates;
drop policy if exists shipping_rates_own_delete on public.shipping_rates;
create policy shipping_rates_own_select on public.shipping_rates for select to authenticated using (seller_id=(select auth.uid()));
create policy shipping_rates_own_insert on public.shipping_rates for insert to authenticated with check (seller_id=(select auth.uid()));
create policy shipping_rates_own_update on public.shipping_rates for update to authenticated using (seller_id=(select auth.uid())) with check (seller_id=(select auth.uid()));
create policy shipping_rates_own_delete on public.shipping_rates for delete to authenticated using (seller_id=(select auth.uid()));

alter table public.stripe_checkout_orders add column if not exists shipping_rate_id uuid references public.shipping_rates(id) on delete set null;
alter table public.stripe_checkout_orders add column if not exists shipping_cents bigint not null default 0;
alter table public.stripe_checkout_orders add column if not exists shipping_address jsonb;
alter table public.stripe_checkout_orders add column if not exists fulfillment_status text;
alter table public.stripe_checkout_orders add column if not exists tracking_code text;
alter table public.stripe_checkout_orders add column if not exists shipped_at timestamptz;
alter table public.stripe_checkout_orders add column if not exists delivered_at timestamptz;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='stripe_checkout_orders_shipping_check') then
  alter table public.stripe_checkout_orders add constraint stripe_checkout_orders_shipping_check check (shipping_cents>=0 and shipping_cents<amount_cents);
 end if;
 if not exists(select 1 from pg_constraint where conname='stripe_checkout_orders_fulfillment_check') then
  alter table public.stripe_checkout_orders add constraint stripe_checkout_orders_fulfillment_check
   check (fulfillment_status is null or fulfillment_status in ('pending','preparing','shipped','delivered','returned'));
 end if;
end $$;

-- Fretes disponíveis no checkout público: só para produto físico publicado, só os ativos.
create or replace function public.get_checkout_shipping_rates(p_checkout_id uuid)
returns table(id uuid,name text,carrier text,price_cents bigint,min_order_cents bigint,delivery_days_min integer,delivery_days_max integer)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.id,r.name,r.carrier,r.price_cents,r.min_order_cents,r.delivery_days_min,r.delivery_days_max
 from public.product_checkouts c
 join public.products p on p.id=c.product_id and p.seller_id=c.seller_id and p.product_type='physical' and p.deleted_at is null
 join public.shipping_rates r on r.seller_id=c.seller_id and r.active
 where c.id=p_checkout_id and c.status='published' and c.deleted_at is null
 order by r.price_cents,r.name
 limit 20
$$;

-- Encomendas: pedidos pagos com endereço de entrega, só do próprio vendedor e de contas live.
create or replace function public.my_shipments()
returns table(order_id uuid,buyer_name text,buyer_email text,product_name text,amount_cents bigint,shipping_cents bigint,currency text,order_status text,shipping_address jsonb,shipping_rate_name text,fulfillment_status text,tracking_code text,shipped_at timestamptz,delivered_at timestamptz,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return query
 select o.id,o.buyer_name,lower(o.buyer_email),o.product_name,o.amount_cents,o.shipping_cents,o.currency,o.status,o.shipping_address,r.name,
  coalesce(o.fulfillment_status,'pending'),o.tracking_code,o.shipped_at,o.delivered_at,o.created_at
 from public.stripe_checkout_orders o
 join public.stripe_connected_accounts a on a.stripe_account_id=o.stripe_account_id and a.user_id=o.seller_id and a.stripe_mode='live'
 left join public.shipping_rates r on r.id=o.shipping_rate_id
 where o.seller_id=auth.uid() and o.shipping_address is not null and o.status in ('approved','refunded')
 order by o.created_at desc
 limit 2000;
end $$;

create or replace function public.update_shipment(p_order_id uuid,p_status text,p_tracking_code text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare tracking text:=nullif(trim(coalesce(p_tracking_code,'')),'');
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if p_status not in ('pending','preparing','shipped','delivered','returned') then raise exception 'INVALID_STATUS';end if;
 if tracking is not null and (char_length(tracking)>80 or tracking !~ '^[A-Za-z0-9 ._/-]+$') then raise exception 'INVALID_TRACKING';end if;
 update public.stripe_checkout_orders set fulfillment_status=p_status,tracking_code=tracking,
  shipped_at=case when p_status in ('shipped','delivered') then coalesce(shipped_at,now()) else shipped_at end,
  delivered_at=case when p_status='delivered' then coalesce(delivered_at,now()) else null end,updated_at=now()
 where id=p_order_id and seller_id=auth.uid() and shipping_address is not null and status='approved';
 if not found then raise exception 'ORDER_NOT_FOUND';end if;
end $$;

revoke all on function public.get_checkout_shipping_rates(uuid) from public;
grant execute on function public.get_checkout_shipping_rates(uuid) to anon,authenticated;
revoke all on function public.my_shipments() from public,anon;
revoke all on function public.update_shipment(uuid,text,text) from public,anon;
grant execute on function public.my_shipments() to authenticated;
grant execute on function public.update_shipment(uuid,text,text) to authenticated;
