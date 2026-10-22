-- Colaboradores com 3 cargos fixos. O dono convida por e-mail; o convidado entra com a própria
-- conta e acessa a conta do dono conforme o cargo:
--  suporte:       vendas, clientes, carrinhos e encomendas (atualiza envio)
--  financeiro:    vendas, contestações, clientes, relatórios, assinaturas, afiliados e financeiro (leitura)
--  administrador: tudo acima
-- Ficam só com o dono: reembolso, cobrança, conta Stripe, verificação, equipe, integrações e
-- segurança. As regras abaixo SOMAM às existentes (políticas permissivas); nada do dono muda.

create table if not exists public.team_members (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 member_id uuid references auth.users(id) on delete cascade,
 email text not null check (char_length(email) between 3 and 254),
 role text not null check (role in ('admin','finance','support')),
 status text not null default 'invited' check (status in ('invited','active','revoked')),
 token_hash text unique,
 invited_at timestamptz not null default now(),
 accepted_at timestamptz,
 revoked_at timestamptz,
 constraint team_members_not_self check (member_id is null or member_id<>owner_id)
);
create unique index if not exists team_members_owner_email_uidx on public.team_members(owner_id,lower(email)) where status<>'revoked';
create index if not exists team_members_member_idx on public.team_members(member_id) where status='active';
alter table public.team_members enable row level security;
alter table public.team_members force row level security;
revoke all on public.team_members from anon,authenticated;

-- Permissão do usuário atual na conta p_owner. Dono pode tudo.
create or replace function public.team_can(p_owner uuid,p_permission text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and (p_owner=auth.uid() or exists(
  select 1 from public.team_members m where m.owner_id=p_owner and m.member_id=auth.uid() and m.status='active' and (
   (p_permission in ('sales.read','customers.read','shipments.write'))
   and m.role in ('admin','support')
   or (p_permission in ('sales.read','customers.read','disputes.read','reports.read','subscriptions.read','affiliates.read','finance.read'))
   and m.role in ('admin','finance'))))
$$;
revoke all on function public.team_can(uuid,text) from public,anon;
grant execute on function public.team_can(uuid,text) to authenticated;

-- Leitura da equipe nas tabelas usadas pelas telas permitidas (somam às do dono).
drop policy if exists payment_transactions_team_read on public.payment_transactions;
create policy payment_transactions_team_read on public.payment_transactions for select to authenticated using (public.team_can(user_id,'sales.read'));
drop policy if exists products_team_read on public.products;
create policy products_team_read on public.products for select to authenticated using (public.team_can(seller_id,'sales.read'));
drop policy if exists custom_charges_team_read on public.custom_charges;
create policy custom_charges_team_read on public.custom_charges for select to authenticated using (public.team_can(seller_id,'finance.read'));

-- Gestão da equipe (só o dono).
create or replace function public.invite_team_member(p_email text,p_role text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_email text:=lower(trim(coalesce(p_email,'')));v_token text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(v_email)>254 then raise exception 'INVALID_EMAIL';end if;
 if p_role not in ('admin','finance','support') then raise exception 'INVALID_ROLE';end if;
 if v_email=lower(coalesce(auth.jwt()->>'email','')) then raise exception 'SELF_INVITE';end if;
 if (select count(*) from public.team_members where owner_id=auth.uid() and status<>'revoked')>=20 then raise exception 'TEAM_LIMIT';end if;
 v_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.team_members(owner_id,email,role,token_hash) values(auth.uid(),v_email,p_role,encode(sha256(convert_to(v_token,'UTF8')),'hex'));
 return v_token;
exception when unique_violation then raise exception 'ALREADY_INVITED';
end $$;

create or replace function public.accept_team_invite(p_token text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row public.team_members%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select * into v_row from public.team_members where token_hash=encode(sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex') and status='invited' for update;
 if not found then raise exception 'INVITE_NOT_FOUND';end if;
 if v_row.owner_id=auth.uid() then raise exception 'SELF_INVITE';end if;
 if lower(v_row.email)<>lower(coalesce(auth.jwt()->>'email','')) then raise exception 'INVITE_EMAIL_MISMATCH';end if;
 if v_row.invited_at<now()-interval '7 days' then raise exception 'INVITE_EXPIRED';end if;
 update public.team_members set member_id=auth.uid(),status='active',accepted_at=now(),token_hash=null where id=v_row.id;
 return v_row.owner_id;
end $$;

create or replace function public.update_team_member(p_id uuid,p_role text,p_revoke boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if p_revoke then
  update public.team_members set status='revoked',revoked_at=now(),token_hash=null where id=p_id and owner_id=auth.uid() and status<>'revoked';
 else
  if p_role not in ('admin','finance','support') then raise exception 'INVALID_ROLE';end if;
  update public.team_members set role=p_role where id=p_id and owner_id=auth.uid() and status<>'revoked';
 end if;
 if not found then raise exception 'MEMBER_NOT_FOUND';end if;
end $$;

create or replace function public.my_team() returns table(id uuid,email text,role text,status text,invited_at timestamptz,accepted_at timestamptz,member_name text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return query select m.id,m.email,m.role,case when m.status='invited' and m.invited_at<now()-interval '7 days' then 'expired' else m.status end,m.invited_at,m.accepted_at,
  nullif(trim(u.raw_user_meta_data->>'full_name'),'')
 from public.team_members m left join auth.users u on u.id=m.member_id
 where m.owner_id=auth.uid() and m.status<>'revoked' order by m.invited_at desc;
end $$;

-- Contas em que o usuário atual é colaborador ativo.
create or replace function public.my_workspaces() returns table(owner_id uuid,owner_name text,owner_email text,role text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return query select m.owner_id,coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1)),u.email::text,m.role
 from public.team_members m join auth.users u on u.id=m.owner_id
 where m.member_id=auth.uid() and m.status='active' order by 2;
end $$;

revoke all on function public.invite_team_member(text,text) from public,anon;
revoke all on function public.accept_team_invite(text) from public,anon;
revoke all on function public.update_team_member(uuid,text,boolean) from public,anon;
revoke all on function public.my_team() from public,anon;
revoke all on function public.my_workspaces() from public,anon;
grant execute on function public.invite_team_member(text,text) to authenticated;
grant execute on function public.accept_team_invite(text) to authenticated;
grant execute on function public.update_team_member(uuid,text,boolean) to authenticated;
grant execute on function public.my_team() to authenticated;
grant execute on function public.my_workspaces() to authenticated;

-- Versões com a conta escolhida (p_seller): o dono passa nulo ou o próprio id; o colaborador
-- passa o id da conta e precisa da permissão do cargo. As funções antigas viram atalhos.
create or replace function public.seller_customers(p_seller uuid)
returns table(email text,name text,purchases integer,spent_cents bigint,refunded integer,other_currency boolean,first_purchase_at timestamptz,last_purchase_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_seller uuid:=coalesce(p_seller,auth.uid());
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if not public.team_can(v_seller,'customers.read') then raise exception 'FORBIDDEN';end if;
 return query
 select lower(o.buyer_email),(array_agg(o.buyer_name order by t.occurred_at desc))[1],
  count(*) filter (where t.status in ('approved','refunded','chargeback'))::integer,
  coalesce(sum(t.amount_cents) filter (where t.status='approved' and t.currency='BRL'),0)::bigint,
  count(*) filter (where t.status='refunded')::integer,bool_or(t.currency<>'BRL'),min(t.occurred_at),max(t.occurred_at)
 from public.payment_transactions t
 join public.stripe_checkout_orders o on o.id::text=t.metadata->>'order_id' and o.seller_id=t.user_id
 where t.user_id=v_seller and t.provider='stripe' and t.status in ('approved','refunded','chargeback')
 group by lower(o.buyer_email) order by max(t.occurred_at) desc limit 5000;
end $$;
create or replace function public.my_customers()
returns table(email text,name text,purchases integer,spent_cents bigint,refunded integer,other_currency boolean,first_purchase_at timestamptz,last_purchase_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$ select * from public.seller_customers(null) $$;

create or replace function public.seller_abandoned_checkouts(p_seller uuid)
returns table(id uuid,buyer_name text,buyer_email text,product_id uuid,product_name text,amount_cents bigint,currency text,billing_type text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_seller uuid:=coalesce(p_seller,auth.uid());
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if not public.team_can(v_seller,'customers.read') then raise exception 'FORBIDDEN';end if;
 return query
 select o.id,o.buyer_name,lower(o.buyer_email),o.product_id,o.product_name,o.amount_cents,o.currency,coalesce(o.billing_type,'one_time'),o.status,o.created_at
 from public.stripe_checkout_orders o
 join public.stripe_connected_accounts a on a.stripe_account_id=o.stripe_account_id and a.user_id=o.seller_id and a.stripe_mode='live'
 where o.seller_id=v_seller and o.status in ('pending','declined')
  and o.created_at<now()-interval '1 hour' and o.created_at>now()-interval '90 days'
  and not exists(select 1 from public.stripe_checkout_orders later where later.seller_id=o.seller_id and later.product_id=o.product_id
   and lower(later.buyer_email)=lower(o.buyer_email) and later.status in ('approved','refunded') and later.created_at>=o.created_at)
 order by o.created_at desc limit 2000;
end $$;
create or replace function public.my_abandoned_checkouts()
returns table(id uuid,buyer_name text,buyer_email text,product_id uuid,product_name text,amount_cents bigint,currency text,billing_type text,status text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$ select * from public.seller_abandoned_checkouts(null) $$;

create or replace function public.seller_shipments(p_seller uuid)
returns table(order_id uuid,buyer_name text,buyer_email text,product_name text,amount_cents bigint,shipping_cents bigint,currency text,order_status text,shipping_address jsonb,shipping_rate_name text,fulfillment_status text,tracking_code text,shipped_at timestamptz,delivered_at timestamptz,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_seller uuid:=coalesce(p_seller,auth.uid());
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if not public.team_can(v_seller,'sales.read') then raise exception 'FORBIDDEN';end if;
 return query
 select o.id,o.buyer_name,lower(o.buyer_email),o.product_name,o.amount_cents,o.shipping_cents,o.currency,o.status,o.shipping_address,r.name,
  coalesce(o.fulfillment_status,'pending'),o.tracking_code,o.shipped_at,o.delivered_at,o.created_at
 from public.stripe_checkout_orders o
 join public.stripe_connected_accounts a on a.stripe_account_id=o.stripe_account_id and a.user_id=o.seller_id and a.stripe_mode='live'
 left join public.shipping_rates r on r.id=o.shipping_rate_id
 where o.seller_id=v_seller and o.shipping_address is not null and o.status in ('approved','refunded')
 order by o.created_at desc limit 2000;
end $$;
create or replace function public.my_shipments()
returns table(order_id uuid,buyer_name text,buyer_email text,product_name text,amount_cents bigint,shipping_cents bigint,currency text,order_status text,shipping_address jsonb,shipping_rate_name text,fulfillment_status text,tracking_code text,shipped_at timestamptz,delivered_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$ select * from public.seller_shipments(null) $$;

create or replace function public.seller_update_shipment(p_seller uuid,p_order_id uuid,p_status text,p_tracking_code text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_seller uuid:=coalesce(p_seller,auth.uid());tracking text:=nullif(trim(coalesce(p_tracking_code,'')),'');
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if not public.team_can(v_seller,'shipments.write') then raise exception 'FORBIDDEN';end if;
 if p_status not in ('pending','preparing','shipped','delivered','returned') then raise exception 'INVALID_STATUS';end if;
 if tracking is not null and (char_length(tracking)>80 or tracking !~ '^[A-Za-z0-9 ._/-]+$') then raise exception 'INVALID_TRACKING';end if;
 update public.stripe_checkout_orders set fulfillment_status=p_status,tracking_code=tracking,
  shipped_at=case when p_status in ('shipped','delivered') then coalesce(shipped_at,now()) else shipped_at end,
  delivered_at=case when p_status='delivered' then coalesce(delivered_at,now()) else null end,updated_at=now()
 where id=p_order_id and seller_id=v_seller and shipping_address is not null and status='approved';
 if not found then raise exception 'ORDER_NOT_FOUND';end if;
end $$;
create or replace function public.update_shipment(p_order_id uuid,p_status text,p_tracking_code text)
returns void language sql security definer set search_path=public,pg_temp as $$ select public.seller_update_shipment(null,p_order_id,p_status,p_tracking_code) $$;

create or replace function public.seller_affiliate_sales(p_seller uuid,p_start timestamptz,p_end timestamptz)
returns table(order_id uuid,affiliate_id uuid,affiliate_name text,affiliate_public_id text,buyer_name text,product_name text,payment_method text,status text,amount_cents bigint,currency text,commission_cents bigint,commission_paid_at timestamptz,occurred_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_seller uuid:=coalesce(p_seller,auth.uid());
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if not public.team_can(v_seller,'affiliates.read') then raise exception 'FORBIDDEN';end if;
 return query
 select * from (
  select distinct on (o.id) o.id,o.affiliate_id,a.name,a.public_id,o.buyer_name,o.product_name,t.payment_method,t.status,t.amount_cents,t.currency,
   case when t.status='approved' then coalesce(o.affiliate_commission_cents,0) else 0 end::bigint,p.paid_at,t.occurred_at
  from public.payment_transactions t
  join public.stripe_checkout_orders o on o.id::text=t.metadata->>'order_id' and o.seller_id=t.user_id
  join public.affiliates a on a.id=o.affiliate_id and a.merchant_id=o.seller_id
  left join public.affiliate_commission_payments p on p.order_id=o.id
  where t.user_id=v_seller and t.provider='stripe' and o.affiliate_id is not null
  order by o.id,t.occurred_at asc
 ) first_sale
 where first_sale.occurred_at>=p_start and first_sale.occurred_at<=p_end
 order by first_sale.occurred_at desc limit 5000;
end $$;
create or replace function public.my_affiliate_sales(p_start timestamptz,p_end timestamptz)
returns table(order_id uuid,affiliate_id uuid,affiliate_name text,affiliate_public_id text,buyer_name text,product_name text,payment_method text,status text,amount_cents bigint,currency text,commission_cents bigint,commission_paid_at timestamptz,occurred_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$ select * from public.seller_affiliate_sales(null,p_start,p_end) $$;

revoke all on function public.seller_customers(uuid) from public,anon;
revoke all on function public.seller_abandoned_checkouts(uuid) from public,anon;
revoke all on function public.seller_shipments(uuid) from public,anon;
revoke all on function public.seller_update_shipment(uuid,uuid,text,text) from public,anon;
revoke all on function public.seller_affiliate_sales(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.seller_customers(uuid) to authenticated;
grant execute on function public.seller_abandoned_checkouts(uuid) to authenticated;
grant execute on function public.seller_shipments(uuid) to authenticated;
grant execute on function public.seller_update_shipment(uuid,uuid,text,text) to authenticated;
grant execute on function public.seller_affiliate_sales(uuid,timestamptz,timestamptz) to authenticated;
