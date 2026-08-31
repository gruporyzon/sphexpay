-- Affiliates V1: cadastro e vínculos de comissão por produto, isolados por merchant.
create extension if not exists pgcrypto;
create table if not exists public.affiliates (
 id uuid primary key default gen_random_uuid(), merchant_id uuid not null references auth.users(id) on delete cascade,
 public_id text not null default ('AFF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))), name text not null check(length(trim(name)) between 2 and 160), email text,
 status text not null default 'pending' check(status in ('active','pending','suspended','inactive')), joined_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint affiliates_id_merchant_unique unique(id,merchant_id), constraint affiliates_public_id_format check(public_id ~ '^AFF-[A-Z0-9]{6,20}$'),
 constraint affiliates_email_format check(email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'), constraint affiliates_merchant_public_unique unique(merchant_id,public_id)
);
create unique index if not exists affiliates_merchant_email_uidx on public.affiliates(merchant_id,lower(email)) where email is not null;
create index if not exists affiliates_merchant_status_joined_idx on public.affiliates(merchant_id,status,joined_at desc);
create index if not exists affiliates_merchant_joined_idx on public.affiliates(merchant_id,joined_at desc);
create unique index if not exists products_id_seller_uidx on public.products(id,seller_id);
create table if not exists public.affiliate_products (
 id uuid primary key default gen_random_uuid(), merchant_id uuid not null references auth.users(id) on delete cascade, affiliate_id uuid not null, product_id uuid not null,
 commission_type text not null check(commission_type in ('percentage','fixed')), commission_value numeric(14,2) not null check(commission_value>=0), currency text not null default 'BRL' check(currency in ('BRL','USD','EUR')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint affiliate_products_affiliate_owner_fk foreign key(affiliate_id,merchant_id) references public.affiliates(id,merchant_id) on delete cascade,
 constraint affiliate_products_product_owner_fk foreign key(product_id,merchant_id) references public.products(id,seller_id) on delete cascade,
 constraint affiliate_products_unique_link unique(affiliate_id,product_id), constraint affiliate_products_percentage_range check(commission_type<>'percentage' or commission_value<=100),
 constraint affiliate_products_fixed_minor_units check(commission_type<>'fixed' or commission_value=trunc(commission_value))
);
comment on column public.affiliate_products.commission_value is 'Percentual (0-100) quando percentage; unidades monetárias mínimas/centavos inteiros quando fixed.';
create index if not exists affiliate_products_merchant_affiliate_idx on public.affiliate_products(merchant_id,affiliate_id,created_at);
create index if not exists affiliate_products_merchant_product_idx on public.affiliate_products(merchant_id,product_id,created_at);
alter table public.affiliates enable row level security; alter table public.affiliates force row level security;
alter table public.affiliate_products enable row level security; alter table public.affiliate_products force row level security;
revoke all on public.affiliates,public.affiliate_products from anon;
grant select,insert,update,delete on public.affiliates,public.affiliate_products to authenticated;
grant all on public.affiliates,public.affiliate_products to service_role;
create policy affiliates_own_select on public.affiliates for select to authenticated using(merchant_id=auth.uid());
create policy affiliates_own_insert on public.affiliates for insert to authenticated with check(merchant_id=auth.uid());
create policy affiliates_own_update on public.affiliates for update to authenticated using(merchant_id=auth.uid()) with check(merchant_id=auth.uid());
create policy affiliates_own_delete on public.affiliates for delete to authenticated using(merchant_id=auth.uid());
create policy affiliate_products_own_select on public.affiliate_products for select to authenticated using(merchant_id=auth.uid());
create policy affiliate_products_own_insert on public.affiliate_products for insert to authenticated with check(merchant_id=auth.uid());
create policy affiliate_products_own_update on public.affiliate_products for update to authenticated using(merchant_id=auth.uid()) with check(merchant_id=auth.uid());
create policy affiliate_products_own_delete on public.affiliate_products for delete to authenticated using(merchant_id=auth.uid());
create or replace function public.affiliates_touch_updated_at() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=now();return new;end$$;
create trigger affiliates_touch before update on public.affiliates for each row execute function public.affiliates_touch_updated_at();
create trigger affiliate_products_touch before update on public.affiliate_products for each row execute function public.affiliates_touch_updated_at();
