-- Checkout Studio versionado. Não processa pagamentos e não altera o checkout demonstrativo legado.
create table if not exists public.product_checkouts(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 offer_id uuid not null references public.product_offers(id) on delete restrict,name text not null check(length(trim(name)) between 2 and 120),slug text not null,
 template text not null default 'minimal' check(template in ('minimal','conversion','premium','clean','dark','blank')),
 status text not null default 'draft' check(status in ('draft','published','paused','archived')),is_default boolean not null default false,
 draft_layout jsonb not null default '[]',draft_design jsonb not null default '{}',draft_settings jsonb not null default '{}',
 published_version_id uuid,last_publish_key text,lock_version bigint not null default 1 check(lock_version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz
);
create unique index if not exists product_checkouts_slug_uidx on public.product_checkouts(seller_id,lower(slug)) where deleted_at is null;
create unique index if not exists product_checkouts_default_uidx on public.product_checkouts(product_id) where is_default and deleted_at is null and status<>'archived';
create index if not exists product_checkouts_product_idx on public.product_checkouts(seller_id,product_id,updated_at desc) where deleted_at is null;

create table if not exists public.checkout_versions(
 id uuid primary key default gen_random_uuid(),checkout_id uuid not null references public.product_checkouts(id) on delete cascade,product_id uuid not null references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 version integer not null check(version>0),layout jsonb not null,design jsonb not null,settings jsonb not null,offer_id uuid not null references public.product_offers(id) on delete restrict,
 published_at timestamptz not null default now(),created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),unique(checkout_id,version)
);
alter table public.product_checkouts drop constraint if exists product_checkouts_published_version_fk;
alter table public.product_checkouts add constraint product_checkouts_published_version_fk foreign key(published_version_id) references public.checkout_versions(id) on delete set null;

create table if not exists public.checkout_analytics_events(
 id bigint generated always as identity primary key,checkout_id uuid not null references public.product_checkouts(id) on delete cascade,product_id uuid not null references public.products(id) on delete cascade,seller_id uuid not null references auth.users(id) on delete cascade,
 event_id text not null,event_type text not null check(event_type in ('page_view','checkout_started','payment_method_selected','purchase','abandon')),session_id text,order_id text,created_at timestamptz not null default now(),unique(checkout_id,event_id)
);
create index if not exists checkout_analytics_rollup_idx on public.checkout_analytics_events(seller_id,checkout_id,event_type,created_at desc);

-- Impede referências cruzadas entre merchants mesmo quando IDs válidos forem enviados manualmente.
create or replace function public.checkout_ownership_guard() returns trigger language plpgsql set search_path=public as $$begin
 if not exists(select 1 from public.products p where p.id=new.product_id and p.seller_id=new.seller_id)
 or not exists(select 1 from public.product_offers o where o.id=new.offer_id and o.product_id=new.product_id and o.seller_id=new.seller_id and o.deleted_at is null)
 then raise exception using errcode='23514',message='CHECKOUT_OWNERSHIP_MISMATCH';end if;
 return new;
end $$;
drop trigger if exists checkout_ownership_guard on public.product_checkouts;
create trigger checkout_ownership_guard before insert or update of product_id,seller_id,offer_id on public.product_checkouts for each row execute function public.checkout_ownership_guard();

do $$ declare t text;begin foreach t in array array['product_checkouts','checkout_versions','checkout_analytics_events'] loop
 execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);execute format('revoke all on public.%I from anon',t);execute format('grant select,insert,update,delete on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);
 execute format('drop policy if exists %I on public.%I',t||'_own_select',t);execute format('create policy %I on public.%I for select to authenticated using(seller_id=auth.uid())',t||'_own_select',t);
 execute format('drop policy if exists %I on public.%I',t||'_own_insert',t);execute format('create policy %I on public.%I for insert to authenticated with check(seller_id=auth.uid() and exists(select 1 from public.products p where p.id=product_id and p.seller_id=auth.uid()))',t||'_own_insert',t);
 execute format('drop policy if exists %I on public.%I',t||'_own_update',t);execute format('create policy %I on public.%I for update to authenticated using(seller_id=auth.uid()) with check(seller_id=auth.uid() and exists(select 1 from public.products p where p.id=product_id and p.seller_id=auth.uid()))',t||'_own_update',t);
 execute format('drop policy if exists %I on public.%I',t||'_own_delete',t);execute format('create policy %I on public.%I for delete to authenticated using(seller_id=auth.uid() and exists(select 1 from public.products p where p.id=product_id and p.seller_id=auth.uid()))',t||'_own_delete',t);
end loop;end $$;
revoke insert,update,delete on public.checkout_analytics_events from authenticated;
revoke insert,update,delete on public.checkout_versions from authenticated;
grant usage,select on sequence public.checkout_analytics_events_id_seq to authenticated;

create or replace function public.checkout_layout_valid(v jsonb) returns boolean language sql immutable as $$
 select jsonb_typeof(v)='array' and jsonb_array_length(v)<=100 and not exists(
  select 1 from jsonb_array_elements(v) e where e->>'type' not in ('logo','text','title','image','video','benefits','list','badge','warranty','testimonial','faq','timer','divider','spacer','banner','order_summary','buyer_form','payment_methods','order_bump','button','notice','footer','social_proof','purchase_notification','exit_intent')
  or length(e::text)>20000
 )
$$;

create or replace function public.save_checkout_draft(p_checkout_id uuid,p_expected_lock bigint,p_layout jsonb,p_design jsonb,p_settings jsonb)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$declare next_lock bigint;begin
 if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED';end if;
 if not public.checkout_layout_valid(p_layout) or jsonb_typeof(p_design)<>'object' or jsonb_typeof(p_settings)<>'object' then raise exception using errcode='22023',message='INVALID_CHECKOUT_SCHEMA';end if;
 update public.product_checkouts set draft_layout=p_layout,draft_design=p_design,draft_settings=p_settings,lock_version=lock_version+1,updated_at=now()
 where id=p_checkout_id and seller_id=auth.uid() and lock_version=p_expected_lock and deleted_at is null returning lock_version into next_lock;
 if not found then raise exception using errcode='40001',message='CHECKOUT_VERSION_CONFLICT';end if;return next_lock;
end $$;

create or replace function public.publish_checkout(p_checkout_id uuid,p_expected_lock bigint,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare c public.product_checkouts%rowtype;v integer;vid uuid;begin
 if auth.uid() is null or nullif(trim(p_idempotency_key),'') is null then raise exception using errcode='42501',message='AUTH_REQUIRED';end if;
 select * into c from public.product_checkouts where id=p_checkout_id and seller_id=auth.uid() and deleted_at is null for update;
 if not found then raise exception using errcode='42501',message='CHECKOUT_NOT_FOUND';end if;
 if c.last_publish_key=p_idempotency_key and c.published_version_id is not null then return jsonb_build_object('versionId',c.published_version_id,'duplicate',true,'lockVersion',c.lock_version);end if;
 if c.lock_version<>p_expected_lock then raise exception using errcode='40001',message='CHECKOUT_VERSION_CONFLICT';end if;
 if not public.checkout_layout_valid(c.draft_layout) then raise exception using errcode='22023',message='INVALID_CHECKOUT_SCHEMA';end if;
 if not (c.draft_layout @> '[{"type":"buyer_form"}]'::jsonb and c.draft_layout @> '[{"type":"order_summary"}]'::jsonb and c.draft_layout @> '[{"type":"payment_methods"}]'::jsonb and c.draft_layout @> '[{"type":"button"}]'::jsonb) then raise exception using errcode='23514',message='CHECKOUT_REQUIRED_COMPONENTS';end if;
 if exists(select 1 from jsonb_array_elements(c.draft_layout) e where e->>'type'='order_bump' and (
   coalesce(e->'props'->>'orderBumpId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or not exists(select 1 from public.product_order_bumps b where b.id=(e->'props'->>'orderBumpId')::uuid and b.product_id=c.product_id and b.seller_id=c.seller_id and b.status='active' and b.deleted_at is null)
 )) then raise exception using errcode='23514',message='CHECKOUT_ORDER_BUMP_INVALID';end if;
 if not exists(select 1 from public.product_offers o where o.id=c.offer_id and o.product_id=c.product_id and o.seller_id=auth.uid() and o.status='active' and o.price_cents>0 and o.deleted_at is null) then raise exception using errcode='23514',message='CHECKOUT_OFFER_UNAVAILABLE';end if;
 select coalesce(max(version),0)+1 into v from public.checkout_versions where checkout_id=c.id;
 insert into public.checkout_versions(checkout_id,product_id,seller_id,version,layout,design,settings,offer_id,created_by) values(c.id,c.product_id,c.seller_id,v,c.draft_layout,c.draft_design,c.draft_settings,c.offer_id,auth.uid()) returning id into vid;
 update public.product_checkouts set published_version_id=vid,last_publish_key=p_idempotency_key,status='published',lock_version=lock_version+1,updated_at=now() where id=c.id;
 insert into public.product_activity_log(product_id,seller_id,actor_id,action,entity_type,entity_id,metadata) values(c.product_id,c.seller_id,auth.uid(),'checkout.published','checkout',c.id::text,jsonb_build_object('version',v));
 return jsonb_build_object('versionId',vid,'version',v,'lockVersion',c.lock_version+1);
end $$;
grant execute on function public.save_checkout_draft(uuid,bigint,jsonb,jsonb,jsonb),public.publish_checkout(uuid,bigint,text) to authenticated;

create or replace function public.restore_checkout_version(p_checkout_id uuid,p_version_id uuid,p_expected_lock bigint)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$declare v public.checkout_versions%rowtype;next_lock bigint;begin
 select * into v from public.checkout_versions where id=p_version_id and checkout_id=p_checkout_id and seller_id=auth.uid();if not found then raise exception using errcode='42501',message='VERSION_NOT_FOUND';end if;
 update public.product_checkouts set draft_layout=v.layout,draft_design=v.design,draft_settings=v.settings,offer_id=v.offer_id,lock_version=lock_version+1,updated_at=now() where id=p_checkout_id and seller_id=auth.uid() and lock_version=p_expected_lock returning lock_version into next_lock;
 if not found then raise exception using errcode='40001',message='CHECKOUT_VERSION_CONFLICT';end if;return next_lock;
end $$;
grant execute on function public.restore_checkout_version(uuid,uuid,bigint) to authenticated;

-- Fronteira pública: expõe somente o snapshot publicado necessário ao comprador.
create or replace function public.get_published_checkout(p_checkout_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
  'checkoutId',c.id,'name',c.name,'slug',c.slug,
  'product',jsonb_build_object('id',p.id,'name',p.name,'description',p.description,'imageUrl',p.image_url,'warrantyDays',p.warranty_days,'producerDisplayName',p.producer_display_name),
  'offer',jsonb_build_object('id',o.id,'name',o.name,'priceCents',o.price_cents,'currency',o.currency,'billingType',o.billing_type,'billingInterval',o.billing_interval,'installments',o.installments),
  'version',jsonb_build_object('number',v.version,'layout',v.layout,'design',v.design,'settings',v.settings,'publishedAt',v.published_at)
 )
 from public.product_checkouts c
 join public.checkout_versions v on v.id=c.published_version_id and v.checkout_id=c.id
 join public.products p on p.id=c.product_id and p.seller_id=c.seller_id and p.status='active' and p.deleted_at is null
 join public.product_offers o on o.id=v.offer_id and o.product_id=p.id and o.seller_id=c.seller_id and o.status='active' and o.deleted_at is null
 where c.id=p_checkout_id and c.status='published' and c.deleted_at is null
$$;
revoke all on function public.get_published_checkout(uuid) from public;
grant execute on function public.get_published_checkout(uuid) to anon,authenticated;

-- Troca do principal é atômica e sempre limitada ao proprietário/produto.
create or replace function public.set_default_checkout(p_product_id uuid,p_checkout_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 if auth.uid() is null or not exists(select 1 from public.product_checkouts where id=p_checkout_id and product_id=p_product_id and seller_id=auth.uid() and deleted_at is null) then raise exception using errcode='42501',message='CHECKOUT_NOT_FOUND';end if;
 update public.product_checkouts set is_default=false,updated_at=now() where product_id=p_product_id and seller_id=auth.uid() and is_default;
 update public.product_checkouts set is_default=true,updated_at=now() where id=p_checkout_id and product_id=p_product_id and seller_id=auth.uid();
end $$;
grant execute on function public.set_default_checkout(uuid,uuid) to authenticated;

-- O checkout principal não pode ser removido enquanto for a única opção publicada.
create or replace function public.checkout_delete_guard() returns trigger language plpgsql set search_path=public as $$begin
 if old.is_default and old.status='published' and not exists(select 1 from public.product_checkouts c where c.product_id=old.product_id and c.id<>old.id and c.status='published' and c.deleted_at is null) then raise exception using errcode='23514',message='CHECKOUT_DEFAULT_REQUIRED';end if;return new;
end $$;
drop trigger if exists checkout_delete_guard on public.product_checkouts;
create trigger checkout_delete_guard before update of deleted_at,status on public.product_checkouts for each row when(new.deleted_at is not null or new.status='archived') execute function public.checkout_delete_guard();

-- Atualiza o guard legado para reconhecer exclusivamente checkouts versionados publicados.
create or replace function public.product_publish_guard() returns trigger language plpgsql set search_path=public as $$begin
 if new.status='active' and old.status is distinct from 'active' then
  if not exists(select 1 from public.product_offers o where o.product_id=new.id and o.seller_id=new.seller_id and o.status='active' and o.price_cents>0 and o.deleted_at is null) then raise exception using errcode='23514',message='PRODUCT_OFFER_REQUIRED';end if;
  if not exists(select 1 from public.product_payment_settings s where s.product_id=new.id and s.seller_id=new.seller_id and cardinality(s.enabled_methods)>0) then raise exception using errcode='23514',message='PRODUCT_PAYMENT_REQUIRED';end if;
  if not exists(select 1 from public.product_checkouts c where c.product_id=new.id and c.seller_id=new.seller_id and c.status='published' and c.published_version_id is not null and c.deleted_at is null) then raise exception using errcode='23514',message='PRODUCT_CHECKOUT_REQUIRED';end if;
 end if;return new;
end $$;
