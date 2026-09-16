-- Empty by construction: existing products are NOT automatically enrolled.
-- Publication is independent of product/checkout activation and never edits sales.
create table public.product_showcase_publications (
 product_id uuid primary key references public.products(id) on delete cascade,
 seller_id uuid not null references auth.users(id) on delete cascade,
 published_at timestamptz not null default now()
);
alter table public.product_showcase_publications enable row level security;
alter table public.product_showcase_publications force row level security;
revoke all on public.product_showcase_publications from public, anon, authenticated;
grant select on public.product_showcase_publications to authenticated;
grant all on public.product_showcase_publications to service_role;
create policy showcase_owner_read on public.product_showcase_publications
 for select to authenticated using (seller_id = auth.uid());

-- Paid revenue before fees, after discounts. No FX guesses, demo ledger or events.
create index payment_transactions_showcase_sales_idx
 on public.payment_transactions(user_id, product_id) include (amount_cents)
 where status = 'approved' and currency = 'BRL' and refunded_at is null and chargeback_at is null;

create function public.showcase_sales_cents(p_seller uuid, p_product uuid)
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
 select coalesce(sum(t.amount_cents), 0)::bigint from public.payment_transactions t
 where t.user_id = p_seller and t.product_id = p_product and t.status = 'approved'
 and t.currency = 'BRL' and t.refunded_at is null and t.chargeback_at is null;
$$;
revoke all on function public.showcase_sales_cents(uuid,uuid) from public, anon, authenticated;

create function public.list_my_showcase_products()
returns table (id uuid, name text, category text, image_url text, gross_sales_cents bigint,
 showcase_status text, showcase_published_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
 select p.id, p.name, coalesce(p.category,''), p.image_url,
 s.total,
 case when s.total < 100000 then 'locked' when pub.product_id is not null then 'published' else 'eligible' end,
 pub.published_at
 from public.products p
 cross join lateral (select public.showcase_sales_cents(p.seller_id,p.id) as total) s
 left join public.product_showcase_publications pub on pub.product_id=p.id and pub.seller_id=p.seller_id
 where p.seller_id=auth.uid() and p.deleted_at is null and p.status <> 'archived'
 order by p.id;
$$;

create function public.set_product_showcase_publication(p_product_id uuid, p_published boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare seller uuid := auth.uid();
begin
 if seller is null then raise exception using errcode='42501',message='SHOWCASE_AUTH_REQUIRED'; end if;
 if p_published is null then raise exception using errcode='22023',message='SHOWCASE_INVALID_ACTION'; end if;
 -- Serialize repeated publish/remove clicks and verify ownership server-side.
 perform 1 from public.products where id=p_product_id and seller_id=seller and deleted_at is null
 and (not p_published or status <> 'archived') for update;
 if not found then raise exception using errcode='42501',message='SHOWCASE_PRODUCT_UNAVAILABLE'; end if;
 if p_published then
  if public.showcase_sales_cents(seller,p_product_id) < 100000 then
   raise exception using errcode='23514',message='SHOWCASE_SALES_REQUIRED';
  end if;
  insert into public.product_showcase_publications(product_id,seller_id) values(p_product_id,seller)
  on conflict(product_id) do nothing;
 else
  delete from public.product_showcase_publications where product_id=p_product_id and seller_id=seller;
 end if;
end;
$$;
revoke all on function public.list_my_showcase_products(), public.set_product_showcase_publication(uuid,boolean) from public, anon;
grant execute on function public.list_my_showcase_products(), public.set_product_showcase_publication(uuid,boolean) to authenticated;
