-- Products V2 avançado: entidades com integridade própria. Não habilita integrações externas.
alter table public.product_delivery_settings add column if not exists secret_digest text;
alter table public.product_delivery_settings add column if not exists last_test_at timestamptz;
alter table public.product_delivery_settings add column if not exists last_test_status text check(last_test_status in ('success','failed','unavailable'));

create table if not exists public.product_tracking_integrations(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider in ('meta','google_ads','ga4','tiktok','kwai','custom')),identifier text not null,token_digest text,
 events text[] not null default array['PageView','ViewContent','InitiateCheckout','AddPaymentInfo','Purchase','Refund'],enabled boolean not null default false,
 purchase_on_pix text not null default 'paid' check(purchase_on_pix in ('generated','paid')),purchase_on_boleto text not null default 'paid' check(purchase_on_boleto in ('generated','paid')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(product_id,provider,identifier)
);
create table if not exists public.product_tracking_dedup(
 id bigint generated always as identity primary key,seller_id uuid not null references auth.users(id) on delete cascade,product_id uuid not null references public.products(id) on delete cascade,
 integration_id uuid not null references public.product_tracking_integrations(id) on delete cascade,event_name text not null,order_id text not null,created_at timestamptz not null default now(),
 unique(integration_id,event_name,order_id)
);
create table if not exists public.product_order_bumps(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 bump_product_id uuid not null references public.products(id) on delete restrict,bump_offer_id uuid not null references public.product_offers(id) on delete restrict,checkout_id uuid,
 name text not null check(length(trim(name)) between 2 and 160),title text not null,description text not null default '',cta text not null default 'Adicionar à compra',image_url text,badge text,
 discount_type text check(discount_type in ('percentage','fixed')),discount_value bigint check(discount_value>=0),preselected boolean not null default false,
 position integer not null default 0,status text not null default 'draft' check(status in ('draft','active','paused','archived')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 constraint product_order_bump_no_self check(product_id<>bump_product_id),constraint product_order_bump_percentage check(discount_type<>'percentage' or discount_value<=10000)
);
create index if not exists product_order_bumps_order_idx on public.product_order_bumps(product_id,position) where deleted_at is null;

create table if not exists public.product_funnel_settings(
 id uuid primary key default gen_random_uuid(),product_id uuid not null unique references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 thank_you_type text not null default 'sphex' check(thank_you_type in ('sphex','external','custom')),thank_you_url text,email_timing text not null default 'payment' check(email_timing in ('payment','funnel_end')),updated_at timestamptz not null default now()
);
create table if not exists public.product_funnel_steps(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 offer_product_id uuid not null references public.products(id) on delete restrict,offer_id uuid not null references public.product_offers(id) on delete restrict,
 step_type text not null check(step_type in ('upsell','downsell')),name text not null,headline text not null,description text not null default '',video_url text,image_url text,
 accept_cta text not null default 'Sim, quero esta oferta',decline_cta text not null default 'Não, obrigado',accept_destination uuid references public.product_funnel_steps(id) on delete set null,decline_destination uuid references public.product_funnel_steps(id) on delete set null,
 position integer not null default 0,status text not null default 'draft' check(status in ('draft','active','paused','archived')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 constraint product_funnel_no_self check(product_id<>offer_product_id)
);

create table if not exists public.product_coupons(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 code text not null,discount_type text not null check(discount_type in ('percentage','fixed')),discount_value bigint not null check(discount_value>0),offer_ids uuid[] not null default '{}',
 starts_at timestamptz,expires_at timestamptz,total_limit integer check(total_limit>0),per_customer_limit integer check(per_customer_limit>0),uses_count integer not null default 0 check(uses_count>=0),
 first_purchase_only boolean not null default false,minimum_cents bigint check(minimum_cents>=0),allowed_methods text[] not null default '{}',allow_subscription boolean not null default true,
 status text not null default 'active' check(status in ('active','paused','archived')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 constraint product_coupon_percentage check(discount_type<>'percentage' or discount_value<=10000),constraint product_coupon_dates check(expires_at is null or starts_at is null or expires_at>starts_at)
);
create unique index if not exists product_coupons_code_uidx on public.product_coupons(product_id,upper(code)) where deleted_at is null;

create table if not exists public.product_coproducers(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 email text not null,display_name text,share_basis_points integer not null check(share_basis_points between 1 and 10000),starts_at timestamptz,expires_at timestamptz,
 permissions text[] not null default '{}',status text not null default 'pending' check(status in ('pending','accepted','declined','expired','removed')),
 invite_token_digest text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),constraint product_coproducer_dates check(expires_at is null or starts_at is null or expires_at>starts_at)
);
create unique index if not exists product_coproducers_email_uidx on public.product_coproducers(product_id,lower(email)) where status not in ('removed','declined','expired');

create table if not exists public.product_affiliate_settings(
 id uuid primary key default gen_random_uuid(),product_id uuid not null unique references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 enabled boolean not null default false,approval_mode text not null default 'manual' check(approval_mode in ('automatic','manual')),commission_type text not null default 'percentage' check(commission_type in ('percentage','fixed')),
 commission_value bigint not null default 0 check(commission_value>=0),attribution text not null default 'last_click' check(attribution in ('last_click','first_click')),cookie_days integer not null default 30 check(cookie_days between 1 and 365),
 commission_order_bump boolean not null default false,commission_upsell boolean not null default false,public_marketplace boolean not null default false,hide_buyer_data boolean not null default true,block_self_referral boolean not null default true,
 description text not null default '',support_email text,terms text not null default '',materials jsonb not null default '[]',updated_at timestamptz not null default now(),constraint product_affiliate_percentage check(commission_type<>'percentage' or commission_value<=10000)
);
create table if not exists public.product_affiliates(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 affiliate_user_id uuid references auth.users(id) on delete set null,email text not null,invite_code text not null unique,status text not null default 'pending' check(status in ('pending','active','paused','declined','removed')),
 joined_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.product_links(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,offer_id uuid references public.product_offers(id) on delete set null,
 name text not null,slug text not null,link_type text not null check(link_type in ('checkout','sales_page','offer','affiliate','recovery','campaign')),base_url text not null,
 tracking jsonb not null default '{}'::jsonb,status text not null default 'active' check(status in ('active','paused','archived')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz
);
create unique index if not exists product_links_slug_uidx on public.product_links(seller_id,lower(slug)) where deleted_at is null;

-- As referências comerciais devem pertencer ao mesmo merchant, ainda que IDs sejam forjados no cliente.
create or replace function public.product_commercial_reference_guard() returns trigger language plpgsql set search_path=public as $$declare n jsonb:=to_jsonb(new);begin
 if not exists(select 1 from public.products p where p.id=(n->>'product_id')::uuid and p.seller_id=(n->>'seller_id')::uuid) then raise exception using errcode='23514',message='PRODUCT_OWNERSHIP_MISMATCH';end if;
 if tg_table_name='product_order_bumps' and (not exists(select 1 from public.products p where p.id=(n->>'bump_product_id')::uuid and p.seller_id=(n->>'seller_id')::uuid) or not exists(select 1 from public.product_offers o where o.id=(n->>'bump_offer_id')::uuid and o.product_id=(n->>'bump_product_id')::uuid and o.seller_id=(n->>'seller_id')::uuid and o.deleted_at is null)) then raise exception using errcode='23514',message='ORDER_BUMP_REFERENCE_MISMATCH';end if;
 if tg_table_name='product_funnel_steps' and (not exists(select 1 from public.products p where p.id=(n->>'offer_product_id')::uuid and p.seller_id=(n->>'seller_id')::uuid) or not exists(select 1 from public.product_offers o where o.id=(n->>'offer_id')::uuid and o.product_id=(n->>'offer_product_id')::uuid and o.seller_id=(n->>'seller_id')::uuid and o.deleted_at is null)) then raise exception using errcode='23514',message='FUNNEL_REFERENCE_MISMATCH';end if;
 if tg_table_name='product_links' and nullif(n->>'offer_id','') is not null and not exists(select 1 from public.product_offers o where o.id=(n->>'offer_id')::uuid and o.product_id=(n->>'product_id')::uuid and o.seller_id=(n->>'seller_id')::uuid and o.deleted_at is null) then raise exception using errcode='23514',message='LINK_OFFER_MISMATCH';end if;
 if tg_table_name='product_coupons' and exists(select 1 from jsonb_array_elements_text(coalesce(n->'offer_ids','[]'::jsonb)) ids(oid) where not exists(select 1 from public.product_offers o where o.id=ids.oid::uuid and o.product_id=(n->>'product_id')::uuid and o.seller_id=(n->>'seller_id')::uuid and o.deleted_at is null)) then raise exception using errcode='23514',message='COUPON_OFFER_MISMATCH';end if;
 return new;
end $$;
do $$declare t text;begin foreach t in array array['product_order_bumps','product_funnel_steps','product_links','product_coupons'] loop execute format('drop trigger if exists product_commercial_reference_guard on public.%I',t);execute format('create trigger product_commercial_reference_guard before insert or update on public.%I for each row execute function public.product_commercial_reference_guard()',t);end loop;end $$;

do $$ declare t text; begin
 foreach t in array array['product_tracking_integrations','product_tracking_dedup','product_order_bumps','product_funnel_settings','product_funnel_steps','product_coupons','product_coproducers','product_affiliate_settings','product_affiliates','product_links'] loop
  execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);execute format('revoke all on public.%I from anon',t);execute format('grant select,insert,update,delete on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);
  execute format('drop policy if exists %I on public.%I',t||'_own_select',t);execute format('drop policy if exists %I on public.%I',t||'_own_insert',t);execute format('drop policy if exists %I on public.%I',t||'_own_update',t);execute format('drop policy if exists %I on public.%I',t||'_own_delete',t);
  execute format('create policy %I on public.%I for select to authenticated using(seller_id=auth.uid())',t||'_own_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check(seller_id=auth.uid() and exists(select 1 from public.products p where p.id=product_id and p.seller_id=auth.uid()))',t||'_own_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using(seller_id=auth.uid()) with check(seller_id=auth.uid() and exists(select 1 from public.products p where p.id=product_id and p.seller_id=auth.uid()))',t||'_own_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using(seller_id=auth.uid() and exists(select 1 from public.products p where p.id=product_id and p.seller_id=auth.uid()))',t||'_own_delete',t);
 end loop;
end $$;
grant usage,select on sequence public.product_tracking_dedup_id_seq to authenticated;

-- Validação autoritativa: o browser nunca determina o desconto final.
create or replace function public.validate_product_coupon(p_product_id uuid,p_offer_id uuid,p_code text,p_amount_cents bigint,p_payment_method text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ declare c public.product_coupons%rowtype;v_discount bigint;v_billing text;v_amount_cents bigint;begin
 select * into c from public.product_coupons where product_id=p_product_id and upper(code)=upper(trim(p_code)) and status='active' and deleted_at is null for update;
 if not found then return jsonb_build_object('valid',false,'reason','invalid');end if;
 if c.starts_at is not null and now()<c.starts_at then return jsonb_build_object('valid',false,'reason','not_started');end if;
 if c.expires_at is not null and now()>=c.expires_at then return jsonb_build_object('valid',false,'reason','expired');end if;
 if c.total_limit is not null and c.uses_count>=c.total_limit then return jsonb_build_object('valid',false,'reason','limit_reached');end if;
 if cardinality(c.offer_ids)>0 and not(p_offer_id=any(c.offer_ids)) then return jsonb_build_object('valid',false,'reason','offer_not_allowed');end if;
 select billing_type,price_cents into v_billing,v_amount_cents from public.product_offers where id=p_offer_id and product_id=p_product_id and status='active' and deleted_at is null;
 if not found then return jsonb_build_object('valid',false,'reason','offer_unavailable');end if;
 if v_billing='subscription' and not c.allow_subscription then return jsonb_build_object('valid',false,'reason','subscription_not_allowed');end if;
 if c.minimum_cents is not null and v_amount_cents<c.minimum_cents then return jsonb_build_object('valid',false,'reason','minimum_not_met');end if;
 if cardinality(c.allowed_methods)>0 and (p_payment_method is null or not(p_payment_method=any(c.allowed_methods))) then return jsonb_build_object('valid',false,'reason','payment_method_not_allowed');end if;
 v_discount:=case when c.discount_type='percentage' then floor(v_amount_cents*c.discount_value/10000.0)::bigint else least(v_amount_cents,c.discount_value) end;
 return jsonb_build_object('valid',true,'couponId',c.id,'discountCents',v_discount,'finalCents',v_amount_cents-v_discount);
end $$;
revoke all on function public.validate_product_coupon(uuid,uuid,text,bigint,text) from public;
grant execute on function public.validate_product_coupon(uuid,uuid,text,bigint,text) to anon,authenticated,service_role;

-- Soma de participações nunca pode ultrapassar 100%; serializa convites do produto.
create or replace function public.product_coproducer_share_guard() returns trigger language plpgsql set search_path=public as $$ declare total integer;begin
 perform 1 from public.products where id=new.product_id for update;
 select coalesce(sum(share_basis_points),0) into total from public.product_coproducers where product_id=new.product_id and id<>new.id and status in ('pending','accepted');
 if total+new.share_basis_points>10000 then raise exception using errcode='23514',message='COPRODUCTION_SHARE_EXCEEDED';end if;return new;
end $$;
drop trigger if exists product_coproducer_share_guard on public.product_coproducers;
create trigger product_coproducer_share_guard before insert or update of share_basis_points,status on public.product_coproducers for each row execute function public.product_coproducer_share_guard();

-- Publicação exige oferta, checkout e capability de pagamento reais. Produtos legados não são reprocessados.
create or replace function public.product_publish_guard() returns trigger language plpgsql set search_path=public as $$ begin
 if new.status='active' and old.status is distinct from 'active' then
  if not exists(select 1 from public.product_offers o where o.product_id=new.id and o.status='active' and o.price_cents>0 and o.deleted_at is null) then raise exception using errcode='23514',message='PRODUCT_OFFER_REQUIRED';end if;
  if not exists(select 1 from public.product_payment_settings s where s.product_id=new.id and cardinality(s.enabled_methods)>0) then raise exception using errcode='23514',message='PRODUCT_PAYMENT_REQUIRED';end if;
  if not exists(select 1 from public.product_modules m where m.product_id=new.id and m.module='checkout' and m.status='active' and m.deleted_at is null) then raise exception using errcode='23514',message='PRODUCT_CHECKOUT_REQUIRED';end if;
 end if;return new;
end $$;
drop trigger if exists product_publish_guard on public.products;
create trigger product_publish_guard before update of status on public.products for each row execute function public.product_publish_guard();
