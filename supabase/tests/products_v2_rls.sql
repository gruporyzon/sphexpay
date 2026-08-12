\set ON_ERROR_STOP on
begin;

-- Executar somente no Supabase local descartável, conectado como postgres.
insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','products-a@example.invalid','',now(),now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','products-b@example.invalid','',now(),now())
on conflict(id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.create_product_v2('{"name":"Produto A","slug":"produto-a","description":"Teste A","tags":[],"productType":"digital","billingType":"one_time","warrantyDays":7,"priceCents":10000,"currency":"BRL","offerName":"Oferta A","installments":1,"deliveryProvider":"payment_only","deliveryConfig":{}}') as product_a \gset
select set_config('test.product_a',:'product_a',true);
update public.product_offers set status='active' where product_id=current_setting('test.product_a')::uuid;
select id as offer_a from public.product_offers where product_id=current_setting('test.product_a')::uuid \gset
select set_config('test.offer_a',:'offer_a',true);
insert into public.product_checkouts(product_id,seller_id,offer_id,name,slug,draft_layout,draft_design,draft_settings)
values(:'product_a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'offer_a','Checkout A','checkout-a','[{"id":"buyer","type":"buyer_form","props":{}},{"id":"summary","type":"order_summary","props":{}},{"id":"payment","type":"payment_methods","props":{}},{"id":"button","type":"button","props":{}}]','{}','{}') returning id as checkout_a \gset
select public.publish_checkout(:'checkout_a',1,'rls-initial') as publish_a \gset
select set_config('test.checkout_a',:'checkout_a',true);
select set_config('test.version_a1',(:'publish_a'::jsonb->>'versionId'),true);
insert into public.product_payment_settings(product_id,seller_id,enabled_methods,method_order,default_method)
values(:'product_a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['pix'],array['pix'],'pix');
insert into public.product_modules(product_id,seller_id,module,name,status)
values(:'product_a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','checkout','Checkout A','active');
update public.products set status='active' where id=:'product_a';
insert into public.product_coupons(product_id,seller_id,code,discount_type,discount_value) values(:'product_a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A10','percentage',1000) returning id as coupon_a \gset
select set_config('test.coupon_a',:'coupon_a',true);
insert into public.product_links(product_id,seller_id,offer_id,name,slug,link_type,base_url) values(:'product_a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'offer_a','Link A','link-a','checkout','/checkout') returning id as link_a \gset
select set_config('test.link_a',:'link_a',true);
select public.create_product_v2('{"name":"Bump A","slug":"bump-a","description":"Bump A","tags":[],"productType":"digital","billingType":"one_time","warrantyDays":0,"priceCents":2500,"currency":"BRL","offerName":"Oferta Bump A","installments":1,"deliveryProvider":"payment_only","deliveryConfig":{}}') as bump_product_a \gset
update public.product_offers set status='active' where product_id=:'bump_product_a';
select id as bump_offer_a from public.product_offers where product_id=:'bump_product_a' \gset
insert into public.product_order_bumps(product_id,seller_id,bump_product_id,bump_offer_id,name,title,status)
values(:'product_a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'bump_product_a',:'bump_offer_a','Bump A','Adicionar Bump A','active') returning id as bump_a \gset
select set_config('test.bump_a',:'bump_a',true);
insert into public.product_tracking_integrations(product_id,seller_id,provider,identifier) values(:'product_a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ga4','G-TEST-A');
insert into public.product_affiliate_settings(product_id,seller_id) values(:'product_a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.product_coproducers(product_id,seller_id,email,share_basis_points) values(:'product_a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','coprod@example.invalid',1000);

do $$begin
 if not exists(select 1 from public.products where id=current_setting('test.product_a')::uuid) then raise exception 'Owner cannot read product';end if;
 if not exists(select 1 from public.product_offers where id=current_setting('test.offer_a')::uuid) then raise exception 'Owner cannot read offer';end if;
 if not exists(select 1 from public.product_checkouts where id=current_setting('test.checkout_a')::uuid) then raise exception 'Owner cannot read checkout';end if;
 if not exists(select 1 from public.product_coupons where id=current_setting('test.coupon_a')::uuid) then raise exception 'Owner cannot read coupon';end if;
 if not exists(select 1 from public.product_order_bumps where id=current_setting('test.bump_a')::uuid) then raise exception 'Owner cannot read order bump';end if;
 if not exists(select 1 from public.product_links where id=current_setting('test.link_a')::uuid) then raise exception 'Owner cannot read link';end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.create_product_v2('{"name":"Produto B","slug":"produto-b","description":"Teste B","tags":[],"productType":"digital","billingType":"one_time","warrantyDays":0,"priceCents":20000,"currency":"BRL","offerName":"Oferta B","installments":1,"deliveryProvider":"payment_only","deliveryConfig":{}}') as product_b \gset

do $$begin
 if exists(select 1 from public.products where id=current_setting('test.product_a')::uuid) then raise exception 'RLS leak: product';end if;
 if exists(select 1 from public.product_offers where id=current_setting('test.offer_a')::uuid) then raise exception 'RLS leak: offer';end if;
 if exists(select 1 from public.product_checkouts where id=current_setting('test.checkout_a')::uuid) then raise exception 'RLS leak: checkout';end if;
 if exists(select 1 from public.checkout_versions where checkout_id=current_setting('test.checkout_a')::uuid) then raise exception 'RLS leak: version';end if;
 if exists(select 1 from public.product_coupons where id=current_setting('test.coupon_a')::uuid) then raise exception 'RLS leak: coupon';end if;
 if exists(select 1 from public.product_links where id=current_setting('test.link_a')::uuid) then raise exception 'RLS leak: link';end if;
 if exists(select 1 from public.product_order_bumps where id=current_setting('test.bump_a')::uuid) then raise exception 'RLS leak: order bump';end if;
 if exists(select 1 from public.product_tracking_integrations where product_id=current_setting('test.product_a')::uuid) then raise exception 'RLS leak: tracking';end if;
 if exists(select 1 from public.product_delivery_settings where product_id=current_setting('test.product_a')::uuid) then raise exception 'RLS leak: delivery';end if;
 if exists(select 1 from public.product_affiliate_settings where product_id=current_setting('test.product_a')::uuid) then raise exception 'RLS leak: affiliate';end if;
 if exists(select 1 from public.product_coproducers where product_id=current_setting('test.product_a')::uuid) then raise exception 'RLS leak: coproduction';end if;
 if exists(select 1 from public.product_activity_log where product_id=current_setting('test.product_a')::uuid) then raise exception 'RLS leak: activity';end if;
end $$;

do $$declare n integer;begin
 update public.products set name='INVASAO' where id=current_setting('test.product_a')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'RLS update allowed';end if;
 update public.product_checkouts set name='INVASAO' where id=current_setting('test.checkout_a')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'RLS checkout update allowed';end if;
 delete from public.product_checkouts where id=current_setting('test.checkout_a')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'RLS delete allowed';end if;
 begin insert into public.product_offers(product_id,seller_id,name,price_cents,currency,billing_type) values(current_setting('test.product_a')::uuid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','IDOR',1,'BRL','one_time');raise exception 'RLS cross insert allowed';exception when insufficient_privilege then null;end;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
do $$declare payload jsonb;begin
 payload:=public.get_published_checkout(current_setting('test.checkout_a')::uuid);
 if payload is null then raise exception 'Published checkout unavailable';end if;
 if payload ? 'sellerId' or payload ? 'draft_layout' or payload ? 'secret_digest' then raise exception 'Public payload leaked private data';end if;
 begin
  if exists(select 1 from public.product_checkouts where id=current_setting('test.checkout_a')::uuid) then raise exception 'Anon table read allowed';end if;
 exception when insufficient_privilege then null;
 end;
end $$;

-- O draft 2 permanece privado até uma publicação explícita.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.save_checkout_draft(
 current_setting('test.checkout_a')::uuid,2,
 '[{"id":"buyer","type":"buyer_form","props":{}},{"id":"summary","type":"order_summary","props":{}},{"id":"payment","type":"payment_methods","props":{}},{"id":"title-v2","type":"title","props":{"text":"VERSAO 2 PRIVADA"}},{"id":"button","type":"button","props":{}}]'::jsonb,
 '{"primaryColor":"#123456"}'::jsonb,'{}'::jsonb
) as draft_lock \gset

reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
do $$declare payload jsonb;begin
 payload:=public.get_published_checkout(current_setting('test.checkout_a')::uuid);
 if payload->'version'->>'number'<>'1' then raise exception 'Draft replaced published version';end if;
 if payload::text like '%VERSAO 2 PRIVADA%' then raise exception 'Draft leaked publicly';end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.publish_checkout(current_setting('test.checkout_a')::uuid,:'draft_lock','rls-v2') as publish_a2 \gset

reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
do $$declare payload jsonb;begin
 payload:=public.get_published_checkout(current_setting('test.checkout_a')::uuid);
 if payload->'version'->>'number'<>'2' or payload::text not like '%VERSAO 2 PRIVADA%' then raise exception 'Published version 2 unavailable';end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.restore_checkout_version(current_setting('test.checkout_a')::uuid,current_setting('test.version_a1')::uuid,(:'publish_a2'::jsonb->>'lockVersion')::bigint) as restore_lock \gset
select public.publish_checkout(current_setting('test.checkout_a')::uuid,:'restore_lock','rls-rollback') as rollback_publish \gset

reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
do $$declare payload jsonb;begin
 payload:=public.get_published_checkout(current_setting('test.checkout_a')::uuid);
 if payload->'version'->>'number'<>'3' then raise exception 'Rollback publication unavailable';end if;
 if payload::text like '%VERSAO 2 PRIVADA%' then raise exception 'Rollback did not restore version 1 content';end if;
end $$;

rollback;
