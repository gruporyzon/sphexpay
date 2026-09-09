-- Additive, server-only Stripe operations. Apply manually after local review.
alter table public.stripe_connected_accounts add column stripe_capabilities jsonb not null default '{}';
create table public.stripe_account_requests (
 user_id uuid primary key references auth.users(id), parameters jsonb not null,
 created_at timestamptz not null default now()
);
create function public.reserve_stripe_account(p_user_id uuid,p_parameters jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.stripe_account_requests%rowtype;
begin
 insert into public.stripe_account_requests(user_id,parameters) values(p_user_id,p_parameters) on conflict do nothing;
 select * into r from public.stripe_account_requests where user_id=p_user_id for update;
 if r.created_at < now()-interval '23 hours' then
  raise exception 'CONNECT_RECONCILIATION_REQUIRED';
 end if;
 return r.parameters;
end $$;
-- A failed or concurrent retry must never replace an existing association.
create function public.stripe_connection_identity_guard() returns trigger language plpgsql as $$
begin
 if new.user_id<>old.user_id or new.stripe_account_id<>old.stripe_account_id then raise exception 'CONNECT_IDENTITY_IMMUTABLE';end if;
 return new;
end $$;
create trigger stripe_connection_identity_guard before update on public.stripe_connected_accounts for each row execute function public.stripe_connection_identity_guard();

create table public.stripe_checkout_orders (
 id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
 checkout_id uuid not null references public.product_checkouts(id),
 product_id uuid not null references public.products(id), seller_id uuid not null references auth.users(id),
 stripe_account_id text not null references public.stripe_connected_accounts(stripe_account_id),
 offer_id uuid not null references public.product_offers(id), product_name text not null,
 amount_cents bigint not null check(amount_cents>0), currency text not null check(currency in ('BRL','USD','EUR')),
 fee_cents bigint not null check(fee_cents>=0 and fee_cents<=amount_cents), fee_rule text not null,
 buyer_email text not null, buyer_name text not null,
 session_id text unique, payment_intent_id text, charge_id text,
 status text not null default 'pending' check(status in ('pending','approved','declined','refunded')),
 refunded_cents bigint not null default 0, last_event_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(stripe_account_id,payment_intent_id)
);
create table public.stripe_webhook_events (
 event_id text primary key, event_type text not null, stripe_account_id text,
 processed_at timestamptz not null default now()
);
-- Reuse the canonical ledger and its existing realtime subscriptions/outbox.
create function public.apply_stripe_payment(p_order_id uuid,p_event_id text,p_event_type text,p_account text,p_intent text,p_charge text,p_status text,p_refunded bigint,p_occurred_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.stripe_checkout_orders%rowtype; t public.payment_transactions%rowtype;
 previous text; next_status text; outbox_type text; external_id text;
begin
 select * into o from public.stripe_checkout_orders where id=p_order_id for update;
 if not found or o.stripe_account_id<>p_account or (o.payment_intent_id is not null and o.payment_intent_id<>p_intent)
 then raise exception 'STRIPE_IDENTITY_MISMATCH';end if;
 insert into public.stripe_webhook_events(event_id,event_type,stripe_account_id) values(p_event_id,p_event_type,p_account) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true);end if;
 if p_status not in ('pending','approved','declined','refunded') or p_refunded<0 or p_refunded>o.amount_cents then raise exception 'STRIPE_INVALID_STATUS';end if;
 previous:=o.status; next_status:=p_status;
 -- Terminal successes/refunds cannot be undone by delayed failure/pending events.
 if o.status='refunded' or (o.status='approved' and p_status in ('pending','declined')) or (o.last_event_at>p_occurred_at and p_status<>'refunded') then next_status:=o.status;end if;
 external_id:=p_account||':'||p_intent;
 update public.stripe_checkout_orders set payment_intent_id=p_intent,charge_id=coalesce(p_charge,charge_id),status=next_status,
 refunded_cents=greatest(refunded_cents,p_refunded),last_event_at=greatest(last_event_at,p_occurred_at),updated_at=now() where id=o.id;
 insert into public.payment_transactions(transaction_id,provider,external_transaction_id,user_id,product_id,product_name,product_name_snapshot,product_price_cents_snapshot,
 payment_method,status,amount_cents,gross_amount_cents,fee_cents,net_amount_cents,currency,customer_name,customer_display_name,occurred_at,approved_at,refunded_at,metadata)
 values('stripe:'||external_id,'stripe',external_id,o.seller_id,o.product_id,o.product_name,o.product_name,o.amount_cents,
 'card',next_status,o.amount_cents,o.amount_cents,o.fee_cents,o.amount_cents-o.fee_cents,o.currency,o.buyer_name,o.buyer_name,o.created_at,
 case when next_status in ('approved','refunded') then p_occurred_at end,case when next_status='refunded' then p_occurred_at end,
 jsonb_build_object('stripe_account_id',p_account,'payment_intent_id',p_intent,'charge_id',p_charge,'order_id',o.id,'refunded_cents',greatest(o.refunded_cents,p_refunded),'fee_rule',o.fee_rule))
 on conflict(provider,external_transaction_id) where provider is not null and external_transaction_id is not null
 do update set status=excluded.status,approved_at=coalesce(payment_transactions.approved_at,excluded.approved_at),refunded_at=coalesce(payment_transactions.refunded_at,excluded.refunded_at),
 metadata=payment_transactions.metadata||excluded.metadata,updated_at=now() returning * into t;
 insert into public.payment_transaction_events(event_id,provider,external_transaction_id,transaction_id,user_id,event_type,previous_status,status,occurred_at,metadata)
 values(p_event_id,'stripe',external_id,t.id,o.seller_id,p_event_type,previous,next_status,p_occurred_at,jsonb_build_object('order_id',o.id));
 outbox_type:=case when next_status='approved' and previous<>'approved' then 'sale_approved' when next_status='refunded' and previous<>'refunded' then 'refund_done' end;
 if outbox_type is not null then
  insert into public.financial_event_outbox(event_id,transaction_id,user_id,event_type,payload)
  values('stripe:'||o.id||':'||outbox_type,t.id,o.seller_id,outbox_type,jsonb_build_object('transactionId',t.transaction_id,'productId',o.product_id,'productName',o.product_name,'currency',o.currency,'amountCents',o.amount_cents)) on conflict(event_id) do nothing;
 end if;
 return jsonb_build_object('duplicate',false,'transactionId',t.transaction_id);
end $$;

do $$ declare t text;begin foreach t in array array['stripe_account_requests','stripe_checkout_orders','stripe_webhook_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end $$;
revoke all on function public.reserve_stripe_account(uuid,jsonb),public.apply_stripe_payment(uuid,text,text,text,text,text,text,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.reserve_stripe_account(uuid,jsonb),public.apply_stripe_payment(uuid,text,text,text,text,text,text,bigint,timestamptz) to service_role;
