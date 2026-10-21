-- Webhooks de saída do vendedor (Integrações).
-- Eventos de venda (aprovada, reembolsada, contestada) viram entregas em webhook_deliveries.
-- O envio é feito pelo próprio banco (pg_net) a cada minuto (pg_cron), com assinatura
-- HMAC-SHA256 de "<timestamp>.<corpo>" usando o segredo do webhook, e novas tentativas
-- com espera crescente. O vendedor gerencia os webhooks só pelas RPCs abaixo.
create extension if not exists pg_net;

create or replace function public.webhook_url_allowed(p_url text) returns boolean
language plpgsql immutable set search_path=public,pg_temp
as $$
declare v_host text;
begin
 if p_url is null or length(p_url) > 500 or p_url !~ '^https://[^/?#\s]+([/?#]\S*)?$' then return false; end if;
 v_host := lower(substring(p_url from '^https://([^/?#]+)'));
 if v_host ~ '@' then return false; end if;                         -- sem credenciais na URL
 if v_host ~ ':' and v_host !~ ':443$' then return false; end if;    -- só a porta padrão
 v_host := regexp_replace(v_host, ':443$', '');
 if v_host ~ '^\[' or v_host ~ '^[0-9.]+$' then return false; end if; -- sem IP literal
 if v_host !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then return false; end if;
 if v_host = 'localhost' or v_host ~ '\.(localhost|local|internal|lan|home|corp|intranet)$' then return false; end if;
 return true;
end $$;

create table public.seller_webhooks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 60),
 url text not null check (public.webhook_url_allowed(url)),
 events text[] not null check (cardinality(events) > 0 and events <@ array['sale.approved','sale.refunded','sale.chargeback']),
 secret text not null default 'whsec_'||encode(extensions.gen_random_bytes(24),'hex'),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index seller_webhooks_user on public.seller_webhooks(user_id);
alter table public.seller_webhooks enable row level security;
alter table public.seller_webhooks force row level security;
revoke all on public.seller_webhooks from public, anon, authenticated;
grant select (id, user_id, name, url, events, active, created_at, updated_at) on public.seller_webhooks to authenticated;
grant delete on public.seller_webhooks to authenticated;
grant all on public.seller_webhooks to service_role;
create policy seller_webhooks_owner_read on public.seller_webhooks for select to authenticated using (user_id = (select auth.uid()));
create policy seller_webhooks_owner_delete on public.seller_webhooks for delete to authenticated using (user_id = (select auth.uid()));

create table public.webhook_deliveries (
 id uuid primary key default gen_random_uuid(),
 webhook_id uuid not null references public.seller_webhooks(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id text not null,
 event_type text not null check (event_type in ('sale.approved','sale.refunded','sale.chargeback','webhook.test')),
 payload jsonb not null,
 status text not null default 'pending' check (status in ('pending','sending','succeeded','failed')),
 attempts integer not null default 0,
 request_id bigint,
 response_status integer,
 last_error text,
 next_attempt_at timestamptz not null default now(),
 last_attempt_at timestamptz,
 delivered_at timestamptz,
 created_at timestamptz not null default now(),
 unique (webhook_id, event_id)
);
create index webhook_deliveries_due on public.webhook_deliveries(status, next_attempt_at);
create index webhook_deliveries_owner on public.webhook_deliveries(user_id, created_at desc);
alter table public.webhook_deliveries enable row level security;
alter table public.webhook_deliveries force row level security;
revoke all on public.webhook_deliveries from public, anon, authenticated;
grant select (id, webhook_id, event_id, event_type, status, attempts, response_status, last_error, next_attempt_at, last_attempt_at, delivered_at, created_at) on public.webhook_deliveries to authenticated;
grant all on public.webhook_deliveries to service_role;
create policy webhook_deliveries_owner_read on public.webhook_deliveries for select to authenticated using (user_id = (select auth.uid()));

-- Gestão pelo vendedor ---------------------------------------------------------------
create or replace function public.webhook_clean_events(p_events text[]) returns text[]
language sql immutable set search_path=public,pg_temp
as $$ select coalesce(array_agg(distinct e order by e),'{}') from unnest(coalesce(p_events,'{}')) e where e in ('sale.approved','sale.refunded','sale.chargeback') $$;

create or replace function public.create_seller_webhook(p_name text, p_url text, p_events text[]) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_user uuid := auth.uid(); v_row public.seller_webhooks; v_events text[] := public.webhook_clean_events(p_events);
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if (select count(*) from public.seller_webhooks where user_id=v_user) >= 10 then raise exception 'WEBHOOK_LIMIT' using errcode='54000'; end if;
 if not public.webhook_url_allowed(btrim(p_url)) then raise exception 'WEBHOOK_URL_INVALID' using errcode='22023'; end if;
 if cardinality(v_events)=0 then raise exception 'WEBHOOK_EVENTS_REQUIRED' using errcode='22023'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 60 then raise exception 'WEBHOOK_NAME_INVALID' using errcode='22023'; end if;
 insert into public.seller_webhooks(user_id,name,url,events) values (v_user,btrim(p_name),btrim(p_url),v_events) returning * into v_row;
 return jsonb_build_object('id',v_row.id,'secret',v_row.secret);
end $$;

create or replace function public.update_seller_webhook(p_id uuid, p_name text, p_url text, p_events text[], p_active boolean) returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_user uuid := auth.uid(); v_events text[] := public.webhook_clean_events(p_events);
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if not public.webhook_url_allowed(btrim(p_url)) then raise exception 'WEBHOOK_URL_INVALID' using errcode='22023'; end if;
 if cardinality(v_events)=0 then raise exception 'WEBHOOK_EVENTS_REQUIRED' using errcode='22023'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 60 then raise exception 'WEBHOOK_NAME_INVALID' using errcode='22023'; end if;
 update public.seller_webhooks set name=btrim(p_name),url=btrim(p_url),events=v_events,active=coalesce(p_active,active),updated_at=now() where id=p_id and user_id=v_user;
 if not found then raise exception 'WEBHOOK_NOT_FOUND' using errcode='02000'; end if;
end $$;

create or replace function public.reveal_seller_webhook_secret(p_id uuid, p_rotate boolean default false) returns text
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_user uuid := auth.uid(); v_secret text;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_rotate then
  update public.seller_webhooks set secret='whsec_'||encode(extensions.gen_random_bytes(24),'hex'),updated_at=now() where id=p_id and user_id=v_user returning secret into v_secret;
 else
  select secret into v_secret from public.seller_webhooks where id=p_id and user_id=v_user;
 end if;
 if v_secret is null then raise exception 'WEBHOOK_NOT_FOUND' using errcode='02000'; end if;
 return v_secret;
end $$;

-- Envio ------------------------------------------------------------------------------
create or replace function public.dispatch_seller_webhooks() returns integer
language plpgsql security definer set search_path=public,pg_temp
as $$
declare d record; r record; v_body text; v_ts text; v_count integer := 0; v_ok boolean; v_error text; v_status integer;
begin
 -- 1) Confere o resultado das tentativas já enviadas.
 for d in select * from public.webhook_deliveries where status='sending' for update skip locked loop
  select status_code, timed_out, error_msg into r from net._http_response where id=d.request_id;
  if not found then
   if d.last_attempt_at > now() - interval '5 minutes' then continue; end if;
   v_ok := false; v_status := null; v_error := 'Sem resposta do endpoint';
  else
   v_status := r.status_code; v_ok := coalesce(r.status_code between 200 and 299,false);
   v_error := case when v_ok then null when r.timed_out then 'Tempo esgotado (5 s)' when r.error_msg is not null then left(r.error_msg,200) else 'Resposta HTTP '||r.status_code end;
  end if;
  if v_ok then
   update public.webhook_deliveries set status='succeeded',response_status=v_status,last_error=null,delivered_at=now() where id=d.id;
  elsif d.attempts >= 6 then
   update public.webhook_deliveries set status='failed',response_status=v_status,last_error=v_error where id=d.id;
  else
   update public.webhook_deliveries set status='pending',response_status=v_status,last_error=v_error,next_attempt_at=now()+make_interval(mins=>power(2,d.attempts)::int) where id=d.id;
  end if;
 end loop;
 -- 2) Envia as entregas pendentes.
 for d in select dl.*,w.url,w.secret,w.active from public.webhook_deliveries dl join public.seller_webhooks w on w.id=dl.webhook_id
  where dl.status='pending' and dl.next_attempt_at<=now() order by dl.next_attempt_at limit 50 for update of dl skip locked loop
  if not d.active and d.event_type<>'webhook.test' then
   update public.webhook_deliveries set status='failed',last_error='Webhook desativado' where id=d.id; continue;
  end if;
  v_body := d.payload::text; v_ts := floor(extract(epoch from now()))::bigint::text;
  update public.webhook_deliveries set status='sending',attempts=attempts+1,last_attempt_at=now(),
   request_id=net.http_post(url:=d.url,body:=d.payload,timeout_milliseconds:=5000,headers:=jsonb_build_object(
    'Content-Type','application/json','User-Agent','SphexPay-Webhooks/1.0','X-SphexPay-Event',d.event_type,'X-SphexPay-Delivery',d.id::text,
    'X-SphexPay-Timestamp',v_ts,'X-SphexPay-Signature','v1='||encode(extensions.hmac(v_ts||'.'||v_body,d.secret,'sha256'),'hex')))
  where id=d.id;
  v_count := v_count + 1;
 end loop;
 return v_count;
end $$;
revoke all on function public.dispatch_seller_webhooks() from public, anon, authenticated;

create or replace function public.send_test_seller_webhook(p_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_user uuid := auth.uid(); v_hook public.seller_webhooks; v_id uuid; v_event text := 'evt_test_'||replace(gen_random_uuid()::text,'-','');
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into v_hook from public.seller_webhooks where id=p_id and user_id=v_user;
 if not found then raise exception 'WEBHOOK_NOT_FOUND' using errcode='02000'; end if;
 if exists(select 1 from public.webhook_deliveries where webhook_id=p_id and event_type='webhook.test' and created_at>now()-interval '30 seconds') then raise exception 'WEBHOOK_TEST_RATE_LIMIT' using errcode='54000'; end if;
 insert into public.webhook_deliveries(webhook_id,user_id,event_id,event_type,payload)
 values (p_id,v_user,v_event,'webhook.test',jsonb_build_object('id',v_event,'type','webhook.test','created_at',now(),'livemode',false,'data',jsonb_build_object('message','Teste de webhook da SphexPay')))
 returning id into v_id;
 perform public.dispatch_seller_webhooks();
 return v_id;
end $$;

-- Eventos de venda -------------------------------------------------------------------
create or replace function public.enqueue_seller_webhooks() returns trigger
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_type text; v_event text; v_payload jsonb;
begin
 if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
 v_type := case new.status when 'approved' then 'sale.approved' when 'refunded' then 'sale.refunded' when 'chargeback' then 'sale.chargeback' end;
 if v_type is null then return new; end if;
 v_event := 'evt_'||md5(new.transaction_id||':'||v_type);
 v_payload := jsonb_build_object('id',v_event,'type',v_type,'created_at',now(),'livemode',true,'data',jsonb_build_object(
  'transaction_id',new.transaction_id,'status',new.status,'amount_cents',new.amount_cents,'currency',new.currency,
  'product_id',new.product_id,'product_name',coalesce(nullif(new.product_name_snapshot,''),new.product_name),
  'customer_name',new.customer_display_name,'payment_method',new.payment_method,'occurred_at',new.occurred_at));
 insert into public.webhook_deliveries(webhook_id,user_id,event_id,event_type,payload)
 select w.id,w.user_id,v_event,v_type,v_payload from public.seller_webhooks w where w.user_id=new.user_id and w.active and v_type=any(w.events)
 on conflict (webhook_id,event_id) do nothing;
 return new;
end $$;
revoke all on function public.enqueue_seller_webhooks() from public, anon, authenticated;
create trigger payment_transactions_seller_webhooks after insert or update of status on public.payment_transactions
 for each row execute function public.enqueue_seller_webhooks();

revoke all on function public.create_seller_webhook(text,text,text[]) from public, anon;
revoke all on function public.update_seller_webhook(uuid,text,text,text[],boolean) from public, anon;
revoke all on function public.reveal_seller_webhook_secret(uuid,boolean) from public, anon;
revoke all on function public.send_test_seller_webhook(uuid) from public, anon;
grant execute on function public.create_seller_webhook(text,text,text[]) to authenticated;
grant execute on function public.update_seller_webhook(uuid,text,text,text[],boolean) to authenticated;
grant execute on function public.reveal_seller_webhook_secret(uuid,boolean) to authenticated;
grant execute on function public.send_test_seller_webhook(uuid) to authenticated;

-- Limpeza: entregas concluídas há mais de 30 dias.
create or replace function public.prune_webhook_deliveries() returns void
language sql security definer set search_path=public,pg_temp
as $$ delete from public.webhook_deliveries where created_at < now() - interval '30 days' and status in ('succeeded','failed') $$;
revoke all on function public.prune_webhook_deliveries() from public, anon, authenticated;

do $$ begin
 if exists (select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('dispatch-seller-webhooks','* * * * *','select public.dispatch_seller_webhooks()');
  perform cron.schedule('prune-webhook-deliveries','17 4 * * *','select public.prune_webhook_deliveries()');
 end if;
end $$;
