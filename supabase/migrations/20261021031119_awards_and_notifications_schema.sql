-- Premiações e notificações reais.
-- award_requests: pedidos de plaquinha com endereço de entrega (dado pessoal — só o dono lê;
-- escrita apenas pela RPC request_award, que confere o faturamento real elegível).
-- user_notifications: central de notificações alimentada por eventos reais do banco
-- (vendas, reembolsos, contestações, verificação, premiações). O cliente só marca como lida,
-- arquiva ou apaga as próprias notificações.

create table public.award_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 award_id text not null check (award_id in ('10k','100k','500k','1m','5m')),
 status text not null default 'requested' check (status in ('requested','preparing','shipped','delivered','cancelled')),
 address jsonb not null,
 tracking_code text check (tracking_code is null or length(tracking_code) <= 80),
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (user_id, award_id)
);
alter table public.award_requests enable row level security;
alter table public.award_requests force row level security;
revoke all on public.award_requests from public, anon, authenticated;
grant select on public.award_requests to authenticated;
grant all on public.award_requests to service_role;
create policy award_requests_owner_read on public.award_requests for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.award_target_cents(p_award_id text) returns bigint
language sql immutable set search_path=public,pg_temp
as $$ select case p_award_id when '10k' then 1000000 when '100k' then 10000000 when '500k' then 50000000 when '1m' then 100000000 when '5m' then 500000000 end::bigint $$;

-- Faturamento elegível: vendas reais aprovadas em reais (reembolsos e contestações saem).
create or replace function public.award_eligible_revenue_cents(p_user_id uuid) returns bigint
language sql stable security definer set search_path=public,pg_temp
as $$ select coalesce(sum(amount_cents),0)::bigint from public.payment_transactions where user_id=p_user_id and status='approved' and currency='BRL' $$;
revoke all on function public.award_eligible_revenue_cents(uuid) from public, anon, authenticated;

create or replace function public.my_award_journey() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp
as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 return jsonb_build_object(
  'revenue_cents', public.award_eligible_revenue_cents(v_user),
  'requests', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'award_id',r.award_id,'status',r.status,'address',r.address,'tracking_code',r.tracking_code,'requested_at',r.requested_at,'updated_at',r.updated_at) order by r.requested_at)
   from public.award_requests r where r.user_id=v_user),'[]'::jsonb));
end $$;
revoke all on function public.my_award_journey() from public, anon;
grant execute on function public.my_award_journey() to authenticated;

create or replace function public.request_award(p_award_id text, p_address jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
 v_user uuid := auth.uid(); v_target bigint := public.award_target_cents(p_award_id); v_address jsonb := '{}'::jsonb;
 v_key text; v_value text; v_row public.award_requests;
 v_required text[] := array['recipient','phone','postalCode','street','number','district','city','state','country'];
 v_optional text[] := array['complement','reference'];
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if v_target is null then raise exception 'AWARD_NOT_FOUND' using errcode='22023'; end if;
 if jsonb_typeof(p_address) is distinct from 'object' then raise exception 'INVALID_ADDRESS' using errcode='22023'; end if;
 foreach v_key in array v_required||v_optional loop
  v_value := btrim(coalesce(p_address->>v_key,''));
  if v_key = any(v_required) and length(v_value) < 1 then raise exception 'INVALID_ADDRESS' using errcode='22023'; end if;
  if length(v_value) > 160 then raise exception 'INVALID_ADDRESS' using errcode='22023'; end if;
  v_address := v_address || jsonb_build_object(v_key, v_value);
 end loop;
 if public.award_eligible_revenue_cents(v_user) < v_target then raise exception 'AWARD_NOT_UNLOCKED' using errcode='42501'; end if;
 select * into v_row from public.award_requests where user_id=v_user and award_id=p_award_id for update;
 if found and v_row.status <> 'requested' then raise exception 'AWARD_ALREADY_IN_PROGRESS' using errcode='55000'; end if;
 insert into public.award_requests(user_id,award_id,address) values (v_user,p_award_id,v_address)
 on conflict (user_id,award_id) do update set address=excluded.address, updated_at=now()
 returning * into v_row;
 return jsonb_build_object('id',v_row.id,'award_id',v_row.award_id,'status',v_row.status,'address',v_row.address,'tracking_code',v_row.tracking_code,'requested_at',v_row.requested_at,'updated_at',v_row.updated_at);
end $$;
revoke all on function public.request_award(text,jsonb) from public, anon;
grant execute on function public.request_award(text,jsonb) to authenticated;

alter table public.team_notifications drop constraint if exists team_notifications_kind_check;
alter table public.team_notifications add constraint team_notifications_kind_check check (kind in ('onboarding','kyc_submitted','welcome','kyc_received','award_requested'));

-- Notificações -------------------------------------------------------------------------
create table public.user_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('sale','payment','subscription','withdrawal','achievement','goal','security','system')),
 category text not null check (category in ('Vendas','Financeiro','Saques','Assinaturas','Segurança','Sistema')),
 title text not null check (length(title) between 1 and 120),
 description text not null check (length(description) <= 400),
 detail_path text check (detail_path is null or detail_path ~ '^/app(/|$)'),
 priority text not null default 'normal' check (priority in ('critical','high','normal','low')),
 metadata jsonb not null default '{}'::jsonb,
 dedupe_key text not null,
 read_at timestamptz,
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 unique (user_id, dedupe_key)
);
create index user_notifications_user_created on public.user_notifications(user_id, created_at desc);
alter table public.user_notifications enable row level security;
alter table public.user_notifications force row level security;
revoke all on public.user_notifications from public, anon, authenticated;
grant select, delete on public.user_notifications to authenticated;
grant update (read_at, archived_at) on public.user_notifications to authenticated;
grant all on public.user_notifications to service_role;
create policy user_notifications_owner_read on public.user_notifications for select to authenticated using (user_id = (select auth.uid()));
create policy user_notifications_owner_update on public.user_notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_notifications_owner_delete on public.user_notifications for delete to authenticated using (user_id = (select auth.uid()));
do $$ begin
 if exists (select 1 from pg_publication where pubname='supabase_realtime') then
  execute 'alter publication supabase_realtime add table public.user_notifications';
 end if;
end $$;

create or replace function public.format_money_cents(p_cents bigint, p_currency text) returns text
language sql immutable set search_path=public,pg_temp
as $$ select case upper(coalesce(p_currency,'BRL')) when 'USD' then 'US$ ' when 'EUR' then '€ ' else 'R$ ' end
 || translate(to_char(coalesce(p_cents,0)/100.0,'FM999,999,999,990.00'),',.','.,') $$;

create or replace function public.notify_user(p_user uuid,p_kind text,p_category text,p_title text,p_description text,p_path text,p_priority text,p_metadata jsonb,p_dedupe text)
returns void language sql security definer set search_path=public,pg_temp
as $$
 insert into public.user_notifications(user_id,kind,category,title,description,detail_path,priority,metadata,dedupe_key)
 values (p_user,p_kind,p_category,left(p_title,120),left(p_description,400),p_path,p_priority,coalesce(p_metadata,'{}'::jsonb),p_dedupe)
 on conflict (user_id,dedupe_key) do nothing
$$;
revoke all on function public.notify_user(uuid,text,text,text,text,text,text,jsonb,text) from public, anon, authenticated;

create or replace function public.notify_payment_transaction() returns trigger
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_amount text; v_product text := coalesce(nullif(new.product_name_snapshot,''),nullif(new.product_name,''),'Produto');
 v_total bigint; v_before bigint; v_award record;
begin
 if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
 v_amount := public.format_money_cents(new.amount_cents,new.currency);
 if new.status='approved' then
  perform public.notify_user(new.user_id,'sale','Vendas','Venda aprovada',v_product||' · '||v_amount,'/app/vendas/'||new.transaction_id,'high',
   jsonb_build_object('product',v_product,'amount',new.amount_cents/100.0,'currency',new.currency,'status','approved','source','backend'),'tx:'||new.transaction_id||':approved');
  if new.currency='BRL' then
   v_total := public.award_eligible_revenue_cents(new.user_id); v_before := v_total - new.amount_cents;
   for v_award in select id, public.award_target_cents(id) as target from unnest(array['10k','100k','500k','1m','5m']) as id loop
    if v_before < v_award.target and v_total >= v_award.target then
     perform public.notify_user(new.user_id,'achievement','Sistema','Nova premiação liberada','Você alcançou o marco Sphex '||upper(v_award.id)||'. Solicite sua plaquinha em Premiações.','/app/premiacoes','high','{"source":"backend"}'::jsonb,'award:'||v_award.id||':unlocked');
    end if;
   end loop;
  end if;
 elsif new.status='refunded' then
  perform public.notify_user(new.user_id,'payment','Financeiro','Venda reembolsada',v_product||' · '||v_amount,'/app/vendas/'||new.transaction_id,'normal',
   jsonb_build_object('product',v_product,'amount',new.amount_cents/100.0,'currency',new.currency,'status','refunded','source','backend'),'tx:'||new.transaction_id||':refunded');
 elsif new.status='chargeback' then
  perform public.notify_user(new.user_id,'payment','Financeiro','Contestação recebida',v_product||' · '||v_amount||'. Acompanhe a disputa na Stripe.','/app/vendas/'||new.transaction_id,'critical',
   jsonb_build_object('product',v_product,'amount',new.amount_cents/100.0,'currency',new.currency,'status','chargeback','source','backend'),'tx:'||new.transaction_id||':chargeback');
 end if;
 return new;
end $$;
revoke all on function public.notify_payment_transaction() from public, anon, authenticated;
create trigger payment_transactions_notify after insert or update of status on public.payment_transactions
 for each row execute function public.notify_payment_transaction();

create or replace function public.notify_kyc_status() returns trigger
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if old.status is not distinct from new.status then return new; end if;
 if new.status='approved' then
  perform public.notify_user(new.user_id,'security','Segurança','Verificação aprovada','Sua conta foi verificada. Os recebimentos reais estão liberados.','/app/verificacao','high','{"source":"backend"}'::jsonb,'kyc:approved:'||extract(epoch from now())::bigint);
 elsif new.status='needs_more_info' then
  perform public.notify_user(new.user_id,'security','Segurança','Verificação precisa de ajustes','A análise pediu ajustes nos seus dados ou documentos. Veja o que corrigir.','/app/verificacao','high','{"source":"backend"}'::jsonb,'kyc:needs_more_info:'||extract(epoch from now())::bigint);
 elsif new.status='rejected' then
  perform public.notify_user(new.user_id,'security','Segurança','Verificação não aprovada','Sua verificação não foi aprovada. Veja os detalhes no painel.','/app/verificacao','high','{"source":"backend"}'::jsonb,'kyc:rejected:'||extract(epoch from now())::bigint);
 end if;
 return new;
end $$;
revoke all on function public.notify_kyc_status() from public, anon, authenticated;
create trigger kyc_profiles_notify after update of status on public.kyc_profiles
 for each row execute function public.notify_kyc_status();

create or replace function public.notify_award_request() returns trigger
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_label text := 'Sphex '||upper(new.award_id);
begin
 if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
 perform public.notify_user(new.user_id,'achievement','Sistema',
  case new.status when 'requested' then 'Pedido de premiação recebido' when 'preparing' then 'Premiação em preparação' when 'shipped' then 'Premiação enviada' when 'delivered' then 'Premiação entregue' else 'Pedido de premiação cancelado' end,
  v_label||case when new.status='shipped' and new.tracking_code is not null then ' · rastreio '||new.tracking_code else '' end,
  '/app/premiacoes','normal','{"source":"backend"}'::jsonb,'award:'||new.award_id||':'||new.status);
 return new;
end $$;
revoke all on function public.notify_award_request() from public, anon, authenticated;
create trigger award_requests_notify after insert or update of status on public.award_requests
 for each row execute function public.notify_award_request();
