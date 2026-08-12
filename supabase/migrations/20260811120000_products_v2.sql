-- Products V2. Evolui o catálogo usado pelo processador financeiro sem trocar IDs públicos.
create extension if not exists pgcrypto;

alter table public.products
  add column if not exists slug text,
  add column if not exists category text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists image_url text,
  add column if not exists sales_page_url text,
  add column if not exists product_type text not null default 'digital',
  add column if not exists status text not null default 'active',
  add column if not exists billing_type text not null default 'one_time',
  add column if not exists warranty_days integer,
  add column if not exists support_email text,
  add column if not exists producer_display_name text,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;
alter table public.products force row level security;

-- Todas as linhas presentes neste ponto são legadas; preserva exatamente o booleano active.
update public.products set status=case when active then 'active' else 'paused' end;
alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check check (status in ('draft','active','paused','archived'));
alter table public.products drop constraint if exists products_billing_type_check;
alter table public.products add constraint products_billing_type_check check (billing_type in ('one_time','subscription'));
alter table public.products drop constraint if exists products_product_type_check;
alter table public.products add constraint products_product_type_check check (product_type in ('digital','physical','service','event','other'));
alter table public.products drop constraint if exists products_warranty_days_check;
alter table public.products add constraint products_warranty_days_check check (warranty_days is null or warranty_days between 0 and 3650);
create unique index if not exists products_seller_slug_uidx on public.products(seller_id,lower(slug)) where deleted_at is null and slug is not null;
create index if not exists products_seller_status_updated_idx on public.products(seller_id,status,updated_at desc) where deleted_at is null;

create table if not exists public.product_offers (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade, name text not null check(length(trim(name)) between 2 and 160),
  price_cents bigint not null check(price_cents>=0), currency text not null default 'BRL' check(currency in ('BRL','USD','EUR')),
  billing_type text not null check(billing_type in ('one_time','subscription')), billing_interval text check(billing_interval in ('month','quarter','semester','year')),
  installments integer not null default 1 check(installments between 1 and 24), trial_days integer check(trial_days between 0 and 365),
  setup_fee_cents bigint check(setup_fee_cents>=0), max_charges integer check(max_charges>0), access_duration_days integer check(access_duration_days>0),
  warranty_days integer check(warranty_days between 0 and 3650), status text not null default 'draft' check(status in ('draft','active','paused','archived')),
  is_default boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists product_offers_owner_idx on public.product_offers(seller_id,product_id,updated_at desc) where deleted_at is null;
create unique index if not exists product_offers_one_default_idx on public.product_offers(product_id) where is_default and deleted_at is null;

create table if not exists public.product_payment_settings (
 id uuid primary key default gen_random_uuid(), product_id uuid not null unique references public.products(id) on delete cascade, seller_id uuid not null references auth.users(id) on delete cascade,
 enabled_methods text[] not null default '{}', method_order text[] not null default '{}', default_method text,
 checkout_fields jsonb not null default '{"emailConfirmation":false,"phone":false,"taxId":false,"address":false,"coupon":true,"savePaymentMethod":false}'::jsonb,
 capabilities jsonb not null default '{}'::jsonb, installments integer not null default 1 check(installments between 1 and 24), updated_at timestamptz not null default now()
);
create table if not exists public.product_delivery_settings (
 id uuid primary key default gen_random_uuid(), product_id uuid not null unique references public.products(id) on delete cascade, seller_id uuid not null references auth.users(id) on delete cascade,
 provider text not null default 'payment_only' check(provider in ('sphex_members','external_members','email','webhook','telegram','discord','private_link','payment_only')),
 config jsonb not null default '{}'::jsonb, enabled boolean not null default true, updated_at timestamptz not null default now()
);

-- Recursos avançados usam uma estrutura comum, privada e extensível. Não implica que integrações externas estejam ativas.
create table if not exists public.product_modules (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, seller_id uuid not null references auth.users(id) on delete cascade,
 module text not null check(module in ('tracking','order_bump','funnel','checkout','coproduction','coupon','affiliate','link')),
 name text not null default '', status text not null default 'draft' check(status in ('draft','active','paused','archived')),
 config jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists product_modules_owner_idx on public.product_modules(seller_id,product_id,module,updated_at desc) where deleted_at is null;

create table if not exists public.product_activity_log (
 id bigint generated always as identity primary key, product_id uuid not null references public.products(id) on delete cascade,
 seller_id uuid not null references auth.users(id) on delete cascade, actor_id uuid references auth.users(id) on delete set null,
 action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists product_activity_owner_idx on public.product_activity_log(seller_id,product_id,created_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

do $$ declare t text; begin
 foreach t in array array['product_offers','product_payment_settings','product_delivery_settings','product_modules','product_activity_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('drop policy if exists %I on public.%I',t||'_own_select',t);
  execute format('create policy %I on public.%I for select to authenticated using(seller_id=auth.uid())',t||'_own_select',t);
  execute format('drop policy if exists %I on public.%I',t||'_own_insert',t);
  execute format('create policy %I on public.%I for insert to authenticated with check(seller_id=auth.uid() and exists(select 1 from public.products p where p.id=product_id and p.seller_id=auth.uid()))',t||'_own_insert',t);
  if t <> 'product_activity_log' then
   execute format('drop policy if exists %I on public.%I',t||'_own_update',t);
   execute format('create policy %I on public.%I for update to authenticated using(seller_id=auth.uid()) with check(seller_id=auth.uid() and exists(select 1 from public.products p where p.id=product_id and p.seller_id=auth.uid()))',t||'_own_update',t);
   execute format('drop policy if exists %I on public.%I',t||'_own_delete',t);
  execute format('create policy %I on public.%I for delete to authenticated using(seller_id=auth.uid() and exists(select 1 from public.products p where p.id=product_id and p.seller_id=auth.uid()))',t||'_own_delete',t);
  end if;
 end loop;
end $$;
grant usage,select on sequence public.product_activity_log_id_seq to authenticated;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects for select using(bucket_id='product-images');
drop policy if exists product_images_insert_own on storage.objects;
create policy product_images_insert_own on storage.objects for insert to authenticated with check(bucket_id='product-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists product_images_update_own on storage.objects;
create policy product_images_update_own on storage.objects for update to authenticated using(bucket_id='product-images' and owner_id=auth.uid()::text) with check(bucket_id='product-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists product_images_delete_own on storage.objects;
create policy product_images_delete_own on storage.objects for delete to authenticated using(bucket_id='product-images' and owner_id=auth.uid()::text);

create or replace function public.products_v2_sync_legacy() returns trigger language plpgsql set search_path=public as $$ begin
 new.active := new.status='active'; new.updated_at:=now(); return new; end $$;
drop trigger if exists products_v2_sync_legacy on public.products;
create trigger products_v2_sync_legacy before insert or update on public.products for each row execute function public.products_v2_sync_legacy();

create or replace function public.product_offer_sync_legacy() returns trigger language plpgsql set search_path=public as $$ begin
 if new.is_default and new.deleted_at is null then
  update public.products set price_cents=new.price_cents,currency=new.currency,billing_type=new.billing_type where id=new.product_id and seller_id=new.seller_id;
 end if;
 return new;
end $$;
drop trigger if exists product_offer_sync_legacy on public.product_offers;
create trigger product_offer_sync_legacy after insert or update of price_cents,currency,billing_type,is_default,deleted_at on public.product_offers for each row execute function public.product_offer_sync_legacy();

-- Migra o preço legado para uma oferta principal sem alterar o produto.
insert into public.product_offers(product_id,seller_id,name,price_cents,currency,billing_type,status,is_default)
select p.id,p.seller_id,'Oferta principal',p.price_cents,p.currency,p.billing_type,p.status,true from public.products p
where p.deleted_at is null and not exists(select 1 from public.product_offers o where o.product_id=p.id and o.deleted_at is null);

-- Produto, oferta inicial e entrega nascem na mesma transação: nunca deixa cadastro parcial.
create or replace function public.create_product_v2(p_input jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_id uuid;v_billing text;begin
 if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED';end if;
 v_billing:=p_input->>'billingType';
 insert into public.products(seller_id,name,slug,description,category,tags,image_url,sales_page_url,product_type,status,billing_type,warranty_days,price_cents,currency)
 values(auth.uid(),trim(p_input->>'name'),p_input->>'slug',trim(coalesce(p_input->>'description','')),nullif(p_input->>'category',''),coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'tags','[]'::jsonb))),'{}'),nullif(p_input->>'imageUrl',''),nullif(p_input->>'salesPageUrl',''),coalesce(p_input->>'productType','digital'),'draft',v_billing,nullif(p_input->>'warrantyDays','')::integer,(p_input->>'priceCents')::bigint,p_input->>'currency') returning id into v_id;
 insert into public.product_offers(product_id,seller_id,name,price_cents,currency,billing_type,billing_interval,installments,trial_days,setup_fee_cents,max_charges,access_duration_days,warranty_days,status,is_default)
 values(v_id,auth.uid(),trim(p_input->>'offerName'),(p_input->>'priceCents')::bigint,p_input->>'currency',v_billing,case when v_billing='subscription' then nullif(p_input->>'billingInterval','') else null end,case when v_billing='one_time' then coalesce((p_input->>'installments')::integer,1) else 1 end,nullif(p_input->>'trialDays','')::integer,nullif(p_input->>'setupFeeCents','')::bigint,nullif(p_input->>'maxCharges','')::integer,nullif(p_input->>'accessDurationDays','')::integer,nullif(p_input->>'warrantyDays','')::integer,'draft',true);
 insert into public.product_delivery_settings(product_id,seller_id,provider,config) values(v_id,auth.uid(),coalesce(p_input->>'deliveryProvider','payment_only'),coalesce(p_input->'deliveryConfig','{}'::jsonb));
 insert into public.product_activity_log(product_id,seller_id,actor_id,action,entity_type,entity_id) values(v_id,auth.uid(),auth.uid(),'product.created','product',v_id::text);
 return v_id;
end $$;
revoke all on function public.create_product_v2(jsonb) from public;
grant execute on function public.create_product_v2(jsonb) to authenticated;
