-- Equipe, fase 2: o Administrador edita o catálogo da conta de quem convidou (produtos, ofertas,
-- checkouts, cupons, order bumps, funil, links e fretes). Continuam só com o dono: coprodução e
-- afiliados do produto (divisão de dinheiro), entrega e rastreamento (guardam credenciais),
-- formas de pagamento (conta Stripe), vitrine e exclusão definitiva de produto.
-- As políticas abaixo SOMAM às do dono; nenhuma regra do dono muda.

create or replace function public.team_can(p_owner uuid,p_permission text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and (p_owner=auth.uid() or exists(
  select 1 from public.team_members m where m.owner_id=p_owner and m.member_id=auth.uid() and m.status='active' and (
   (p_permission in ('sales.read','customers.read','shipments.write'))
   and m.role in ('admin','support')
   or (p_permission in ('sales.read','customers.read','disputes.read','reports.read','subscriptions.read','affiliates.read','finance.read'))
   and m.role in ('admin','finance')
   or p_permission='catalog.write' and m.role='admin')))
$$;

-- A conta dona de um registro do catálogo nunca muda depois de criado (evita mover itens entre
-- contas por quem administra mais de uma).
create or replace function public.catalog_seller_immutable() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if new.seller_id is distinct from old.seller_id then raise exception using errcode='42501',message='SELLER_IMMUTABLE';end if;
 return new;
end $$;

-- Tabelas filhas do produto: tudo liberado ao Administrador, sempre preso a um produto da mesma conta.
do $$
declare t text;
begin
 foreach t in array array['product_offers','product_checkouts','product_coupons','product_order_bumps','product_funnel_steps','product_funnel_settings','product_links'] loop
  if to_regclass('public.'||t) is null then continue;end if;
  execute format('drop policy if exists %I on public.%I',t||'_team_write',t);
  execute format('create policy %I on public.%I for all to authenticated using (public.team_can(seller_id,''catalog.write'') and exists(select 1 from public.products p where p.id=%I.product_id and p.seller_id=%I.seller_id)) with check (public.team_can(seller_id,''catalog.write'') and exists(select 1 from public.products p where p.id=%I.product_id and p.seller_id=%I.seller_id))',t||'_team_write',t,t,t,t,t);
  execute format('drop trigger if exists %I on public.%I',t||'_seller_immutable',t);
  execute format('create trigger %I before update on public.%I for each row execute function public.catalog_seller_immutable()',t||'_seller_immutable',t);
 end loop;
 foreach t in array array['checkout_versions','checkout_analytics_events'] loop
  if to_regclass('public.'||t) is null then continue;end if;
  execute format('drop policy if exists %I on public.%I',t||'_team_read',t);
  execute format('create policy %I on public.%I for select to authenticated using (public.team_can(seller_id,''catalog.write''))',t||'_team_read',t);
 end loop;
end $$;

-- Produto: criar e editar (inclui arquivar e a exclusão lógica por deleted_at). Sem DELETE.
drop policy if exists products_team_insert on public.products;
create policy products_team_insert on public.products for insert to authenticated with check (public.team_can(seller_id,'catalog.write'));
drop policy if exists products_team_update on public.products;
create policy products_team_update on public.products for update to authenticated using (public.team_can(seller_id,'catalog.write')) with check (public.team_can(seller_id,'catalog.write'));
drop trigger if exists products_seller_immutable on public.products;
create trigger products_seller_immutable before update on public.products for each row execute function public.catalog_seller_immutable();

-- Fretes da conta.
drop policy if exists shipping_rates_team_write on public.shipping_rates;
create policy shipping_rates_team_write on public.shipping_rates for all to authenticated using (public.team_can(seller_id,'catalog.write')) with check (public.team_can(seller_id,'catalog.write'));
drop trigger if exists shipping_rates_seller_immutable on public.shipping_rates;
create trigger shipping_rates_seller_immutable before update on public.shipping_rates for each row execute function public.catalog_seller_immutable();

-- Histórico do produto: o Administrador lê e registra, sempre como ele mesmo (actor_id).
drop policy if exists product_activity_log_team_select on public.product_activity_log;
create policy product_activity_log_team_select on public.product_activity_log for select to authenticated using (public.team_can(seller_id,'catalog.write'));
drop policy if exists product_activity_log_team_insert on public.product_activity_log;
create policy product_activity_log_team_insert on public.product_activity_log for insert to authenticated with check (actor_id=auth.uid() and public.team_can(seller_id,'catalog.write') and exists(select 1 from public.products p where p.id=product_activity_log.product_id and p.seller_id=product_activity_log.seller_id));

-- Criação de produto: a conta vem de p_input.sellerId (padrão: a própria) e precisa do cargo.
create or replace function public.create_product_v2(p_input jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;v_billing text;v_seller uuid;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED';end if;
 v_seller:=coalesce(nullif(p_input->>'sellerId','')::uuid,auth.uid());
 if not public.team_can(v_seller,'catalog.write') then raise exception using errcode='42501',message='FORBIDDEN';end if;
 v_billing:=p_input->>'billingType';
 insert into public.products(seller_id,name,slug,description,category,tags,image_url,sales_page_url,product_type,status,billing_type,warranty_days,price_cents,currency)
 values(v_seller,trim(p_input->>'name'),p_input->>'slug',trim(coalesce(p_input->>'description','')),nullif(p_input->>'category',''),coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'tags','[]'::jsonb))),'{}'),nullif(p_input->>'imageUrl',''),nullif(p_input->>'salesPageUrl',''),coalesce(p_input->>'productType','digital'),'draft',v_billing,nullif(p_input->>'warrantyDays','')::integer,(p_input->>'priceCents')::bigint,p_input->>'currency') returning id into v_id;
 insert into public.product_offers(product_id,seller_id,name,price_cents,currency,billing_type,billing_interval,installments,trial_days,setup_fee_cents,max_charges,access_duration_days,warranty_days,status,is_default)
 values(v_id,v_seller,trim(p_input->>'offerName'),(p_input->>'priceCents')::bigint,p_input->>'currency',v_billing,case when v_billing='subscription' then nullif(p_input->>'billingInterval','') else null end,case when v_billing='one_time' then coalesce((p_input->>'installments')::integer,1) else 1 end,nullif(p_input->>'trialDays','')::integer,nullif(p_input->>'setupFeeCents','')::bigint,nullif(p_input->>'maxCharges','')::integer,nullif(p_input->>'accessDurationDays','')::integer,nullif(p_input->>'warrantyDays','')::integer,'draft',true);
 -- Entrega fica só com o dono: colaborador sempre cria como "apenas pagamento".
 insert into public.product_delivery_settings(product_id,seller_id,provider,config)
 values(v_id,v_seller,case when v_seller=auth.uid() then coalesce(p_input->>'deliveryProvider','payment_only') else 'payment_only' end,case when v_seller=auth.uid() then coalesce(p_input->'deliveryConfig','{}'::jsonb) else '{}'::jsonb end);
 insert into public.product_activity_log(product_id,seller_id,actor_id,action,entity_type,entity_id) values(v_id,v_seller,auth.uid(),'product.created','product',v_id::text);
 return v_id;
end $$;

-- Checkouts: as funções agem na conta dona do checkout, com o cargo conferido.
create or replace function public.save_checkout_draft(p_checkout_id uuid,p_expected_lock bigint,p_layout jsonb,p_design jsonb,p_settings jsonb) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare next_lock bigint;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED';end if;
 if not public.checkout_layout_valid(p_layout) or jsonb_typeof(p_design)<>'object' or jsonb_typeof(p_settings)<>'object' then raise exception using errcode='22023',message='INVALID_CHECKOUT_SCHEMA';end if;
 update public.product_checkouts set draft_layout=p_layout,draft_design=p_design,draft_settings=p_settings,lock_version=lock_version+1,updated_at=now()
 where id=p_checkout_id and public.team_can(seller_id,'catalog.write') and lock_version=p_expected_lock and deleted_at is null returning lock_version into next_lock;
 if not found then raise exception using errcode='40001',message='CHECKOUT_VERSION_CONFLICT';end if;
 return next_lock;
end $$;

create or replace function public.publish_checkout(p_checkout_id uuid,p_expected_lock bigint,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.product_checkouts%rowtype;v integer;vid uuid;
begin
 if auth.uid() is null or nullif(trim(p_idempotency_key),'') is null then raise exception using errcode='42501',message='AUTH_REQUIRED';end if;
 select * into c from public.product_checkouts where id=p_checkout_id and deleted_at is null for update;
 if not found or not public.team_can(c.seller_id,'catalog.write') then raise exception using errcode='42501',message='CHECKOUT_NOT_FOUND';end if;
 if c.last_publish_key=p_idempotency_key and c.published_version_id is not null then return jsonb_build_object('versionId',c.published_version_id,'duplicate',true,'lockVersion',c.lock_version);end if;
 if c.lock_version<>p_expected_lock then raise exception using errcode='40001',message='CHECKOUT_VERSION_CONFLICT';end if;
 if not public.checkout_layout_valid(c.draft_layout) then raise exception using errcode='22023',message='INVALID_CHECKOUT_SCHEMA';end if;
 if not (c.draft_layout @> '[{"type":"buyer_form"}]'::jsonb and c.draft_layout @> '[{"type":"order_summary"}]'::jsonb and c.draft_layout @> '[{"type":"payment_methods"}]'::jsonb and c.draft_layout @> '[{"type":"button"}]'::jsonb) then raise exception using errcode='23514',message='CHECKOUT_REQUIRED_COMPONENTS';end if;
 if exists(select 1 from jsonb_array_elements(c.draft_layout) e where e->>'type'='order_bump' and (
   coalesce(e->'props'->>'orderBumpId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or not exists(select 1 from public.product_order_bumps b where b.id=(e->'props'->>'orderBumpId')::uuid and b.product_id=c.product_id and b.seller_id=c.seller_id and b.status='active' and b.deleted_at is null)
 )) then raise exception using errcode='23514',message='CHECKOUT_ORDER_BUMP_INVALID';end if;
 if not exists(select 1 from public.product_offers o where o.id=c.offer_id and o.product_id=c.product_id and o.seller_id=c.seller_id and o.status='active' and o.price_cents>0 and o.deleted_at is null) then raise exception using errcode='23514',message='CHECKOUT_OFFER_UNAVAILABLE';end if;
 select coalesce(max(version),0)+1 into v from public.checkout_versions where checkout_id=c.id;
 insert into public.checkout_versions(checkout_id,product_id,seller_id,version,layout,design,settings,offer_id,created_by) values(c.id,c.product_id,c.seller_id,v,c.draft_layout,c.draft_design,c.draft_settings,c.offer_id,auth.uid()) returning id into vid;
 update public.product_checkouts set published_version_id=vid,last_publish_key=p_idempotency_key,status='published',lock_version=lock_version+1,updated_at=now() where id=c.id;
 insert into public.product_activity_log(product_id,seller_id,actor_id,action,entity_type,entity_id,metadata) values(c.product_id,c.seller_id,auth.uid(),'checkout.published','checkout',c.id::text,jsonb_build_object('version',v));
 return jsonb_build_object('versionId',vid,'version',v,'lockVersion',c.lock_version+1);
end $$;

create or replace function public.restore_checkout_version(p_checkout_id uuid,p_version_id uuid,p_expected_lock bigint) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.checkout_versions%rowtype;next_lock bigint;
begin
 select * into v from public.checkout_versions where id=p_version_id and checkout_id=p_checkout_id;
 if not found or not public.team_can(v.seller_id,'catalog.write') then raise exception using errcode='42501',message='VERSION_NOT_FOUND';end if;
 update public.product_checkouts set draft_layout=v.layout,draft_design=v.design,draft_settings=v.settings,offer_id=v.offer_id,lock_version=lock_version+1,updated_at=now()
 where id=p_checkout_id and seller_id=v.seller_id and lock_version=p_expected_lock returning lock_version into next_lock;
 if not found then raise exception using errcode='40001',message='CHECKOUT_VERSION_CONFLICT';end if;
 return next_lock;
end $$;

create or replace function public.set_default_checkout(p_product_id uuid,p_checkout_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_seller uuid;
begin
 select seller_id into v_seller from public.product_checkouts where id=p_checkout_id and product_id=p_product_id and deleted_at is null;
 if auth.uid() is null or v_seller is null or not public.team_can(v_seller,'catalog.write') then raise exception using errcode='42501',message='CHECKOUT_NOT_FOUND';end if;
 update public.product_checkouts set is_default=false,updated_at=now() where product_id=p_product_id and seller_id=v_seller and is_default;
 update public.product_checkouts set is_default=true,updated_at=now() where id=p_checkout_id and product_id=p_product_id and seller_id=v_seller;
end $$;

-- Links de pagamento da conta escolhida (p_seller nulo = própria conta).
create or replace function public.seller_payment_links(p_seller uuid)
returns table(checkout_id uuid,checkout_name text,status text,is_published boolean,product_id uuid,product_name text,offer_name text,price_cents bigint,currency text,billing_type text,views bigint,started bigint,paid_count bigint,paid_cents bigint,updated_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_seller uuid:=coalesce(p_seller,auth.uid());
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if not public.team_can(v_seller,'catalog.write') then raise exception 'FORBIDDEN';end if;
 return query
 select c.id,c.name,c.status,(c.status='published' and c.published_version_id is not null),p.id,p.name,o.name,o.price_cents::bigint,o.currency::text,o.billing_type::text,
  (select count(*) from public.checkout_analytics_events e where e.checkout_id=c.id and e.event_type='page_view'),
  (select count(*) from public.checkout_analytics_events e where e.checkout_id=c.id and e.event_type='checkout_started'),
  coalesce(s.paid_count,0)::bigint,coalesce(s.paid_cents,0)::bigint,c.updated_at
 from public.product_checkouts c
 join public.products p on p.id=c.product_id and p.seller_id=c.seller_id and p.deleted_at is null
 left join public.product_offers o on o.id=c.offer_id and o.deleted_at is null
 left join lateral (
  select count(*) as paid_count,sum(t.amount_cents)::bigint as paid_cents
  from public.stripe_checkout_orders so
  join public.payment_transactions t on t.provider='stripe' and t.metadata->>'order_id'=so.id::text
  where so.checkout_id=c.id and t.status='approved' and t.refunded_at is null
 ) s on true
 where c.seller_id=v_seller and c.deleted_at is null and c.status<>'archived'
 order by (c.status='published') desc,c.updated_at desc;
end $$;
revoke all on function public.seller_payment_links(uuid) from public,anon;
grant execute on function public.seller_payment_links(uuid) to authenticated;

-- Imagens do produto: o Administrador envia na pasta da conta do dono.
drop policy if exists product_images_team_insert on storage.objects;
create policy product_images_team_insert on storage.objects for insert to authenticated
 with check (bucket_id='product-images' and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then public.team_can(((storage.foldername(name))[1])::uuid,'catalog.write') else false end);

-- Mídia do checkout: {conta}/{checkout}/{arquivo}, com o checkout pertencendo à conta. Vale para o
-- dono (team_can libera a própria conta) e para o Administrador. A regra antiga
-- checkout_media_owner_insert comparava a pasta com o nome do checkout (c.name) e nunca liberava
-- o envio; ela fica como está porque as regras de envio se somam.
drop policy if exists checkout_media_team_insert on storage.objects;
create policy checkout_media_team_insert on storage.objects for insert to authenticated
 with check (bucket_id='checkout-media' and exists(select 1 from public.product_checkouts c where c.id::text=(storage.foldername(objects.name))[2]
  and c.seller_id::text=(storage.foldername(objects.name))[1] and c.deleted_at is null and public.team_can(c.seller_id,'catalog.write')));
