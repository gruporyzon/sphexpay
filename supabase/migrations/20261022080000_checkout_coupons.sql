-- Cupons valendo de verdade no checkout: o pedido guarda o cupom e o desconto calculados pelo
-- servidor, e o uso do cupom só é contado quando o pagamento é aprovado.
alter table public.stripe_checkout_orders add column if not exists coupon_id uuid references public.product_coupons(id) on delete set null;
alter table public.stripe_checkout_orders add column if not exists discount_cents bigint not null default 0;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='stripe_checkout_orders_discount_check') then
  alter table public.stripe_checkout_orders add constraint stripe_checkout_orders_discount_check check (discount_cents>=0);
 end if;
end $$;
create index if not exists stripe_checkout_orders_coupon_idx on public.stripe_checkout_orders(coupon_id,buyer_email) where coupon_id is not null;

create or replace function public.count_coupon_use() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.coupon_id is not null and new.status='approved' and old.status is distinct from 'approved' and old.status<>'refunded' then
  update public.product_coupons set uses_count=uses_count+1,updated_at=now() where id=new.coupon_id;
 end if;
 return new;
end $$;
revoke all on function public.count_coupon_use() from public,anon,authenticated;
drop trigger if exists stripe_checkout_orders_count_coupon on public.stripe_checkout_orders;
create trigger stripe_checkout_orders_count_coupon after update of status on public.stripe_checkout_orders
 for each row execute function public.count_coupon_use();
