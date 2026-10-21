-- Assinatura recorrente (Stripe Billing na conta conectada, cobrança por cartão).
-- Cada fatura paga vira uma transação própria (external id = conta:fatura) com os dados da
-- assinatura no metadata, que o módulo Assinaturas já lê. Status da assinatura e reembolsos
-- de faturas são aplicados pelas funções abaixo, chamadas só pelo webhook (service_role).
alter table public.stripe_checkout_orders
 add column if not exists billing_type text not null default 'one_time',
 add column if not exists billing_interval text,
 add column if not exists subscription_id text;
do $$ begin
 if not exists (select 1 from pg_constraint where conname='stripe_checkout_orders_billing_type_check') then
  alter table public.stripe_checkout_orders add constraint stripe_checkout_orders_billing_type_check check (billing_type in ('one_time','subscription'));
 end if;
 if not exists (select 1 from pg_constraint where conname='stripe_checkout_orders_billing_interval_check') then
  alter table public.stripe_checkout_orders add constraint stripe_checkout_orders_billing_interval_check check (
   (billing_type='one_time' and billing_interval is null) or (billing_type='subscription' and billing_interval in ('month','quarter','semester','year')));
 end if;
end $$;
create unique index if not exists stripe_checkout_orders_subscription on public.stripe_checkout_orders(stripe_account_id, subscription_id) where subscription_id is not null;

create or replace function public.apply_stripe_subscription_invoice(
 p_order_id uuid,p_event_id text,p_event_type text,p_account text,p_subscription text,p_invoice text,p_intent text,p_charge text,
 p_status text,p_amount bigint,p_fee bigint,p_occurred_at timestamptz,p_period_end timestamptz,p_subscription_status text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.stripe_checkout_orders%rowtype; t public.payment_transactions%rowtype; account_mode text; external_id text; previous text;
begin
 select * into o from public.stripe_checkout_orders where id=p_order_id for update;
 if not found or o.stripe_account_id<>p_account or o.billing_type<>'subscription' or (o.subscription_id is not null and o.subscription_id<>p_subscription)
 then raise exception 'STRIPE_IDENTITY_MISMATCH';end if;
 if p_status not in ('pending','approved','declined') or p_amount<>o.amount_cents or p_fee<0 or p_fee>p_amount then raise exception 'STRIPE_INVALID_STATUS';end if;
 select stripe_mode into account_mode from public.stripe_connected_accounts where stripe_account_id=p_account and user_id=o.seller_id;
 if account_mode is null or account_mode not in ('test','live') then raise exception 'STRIPE_ACCOUNT_MODE_REQUIRED';end if;
 insert into public.stripe_webhook_events(event_id,event_type,stripe_account_id) values(p_event_id,p_event_type,p_account) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true);end if;
 update public.stripe_checkout_orders set subscription_id=p_subscription,
  status=case when p_status='approved' then 'approved' when status='pending' then p_status else status end,
  last_event_at=greatest(last_event_at,p_occurred_at),updated_at=now() where id=o.id;
 if account_mode='test' then return jsonb_build_object('duplicate',false,'test',true,'orderId',o.id);end if;
 external_id:=p_account||':'||p_invoice;
 select status into previous from public.payment_transactions where provider='stripe' and external_transaction_id=external_id;
 insert into public.payment_transactions(transaction_id,provider,external_transaction_id,user_id,product_id,product_name,product_name_snapshot,product_price_cents_snapshot,
  payment_method,status,amount_cents,gross_amount_cents,fee_cents,net_amount_cents,currency,customer_name,customer_display_name,occurred_at,approved_at,metadata)
 values('stripe:'||external_id,'stripe',external_id,o.seller_id,o.product_id,o.product_name,o.product_name,o.amount_cents,
  'card',p_status,p_amount,p_amount,p_fee,p_amount-p_fee,o.currency,o.buyer_name,o.buyer_name,p_occurred_at,case when p_status='approved' then p_occurred_at end,
  jsonb_build_object('stripe_account_id',p_account,'payment_intent_id',p_intent,'charge_id',p_charge,'invoice_id',p_invoice,'order_id',o.id,'fee_rule',o.fee_rule,'stripe_mode',account_mode,
   'subscription_id',p_subscription,'subscription_status',p_subscription_status,'current_period_end',p_period_end,'billing_interval',o.billing_interval))
 on conflict(provider,external_transaction_id) where provider is not null and external_transaction_id is not null
 do update set status=case when payment_transactions.status in ('approved','refunded','chargeback') then payment_transactions.status else excluded.status end,
  approved_at=coalesce(payment_transactions.approved_at,excluded.approved_at),metadata=payment_transactions.metadata||excluded.metadata,updated_at=now()
 returning * into t;
 insert into public.payment_transaction_events(event_id,provider,external_transaction_id,transaction_id,user_id,event_type,previous_status,status,occurred_at,metadata)
 values(p_event_id,'stripe',external_id,t.id,o.seller_id,p_event_type,previous,t.status,p_occurred_at,jsonb_build_object('order_id',o.id,'invoice_id',p_invoice));
 if t.status='approved' and previous is distinct from 'approved' then
  insert into public.financial_event_outbox(event_id,transaction_id,user_id,event_type,payload)
  values('stripe:'||o.id||':'||p_invoice||':sale_approved',t.id,o.seller_id,'sale_approved',jsonb_build_object('transactionId',t.transaction_id,'productId',o.product_id,'productName',o.product_name,'currency',o.currency,'amountCents',p_amount,'stripe_mode',account_mode))
  on conflict(event_id) do nothing;
 end if;
 update public.payment_transactions set metadata=metadata||jsonb_build_object('subscription_status',p_subscription_status,'current_period_end',p_period_end)
 where provider='stripe' and user_id=o.seller_id and metadata->>'subscription_id'=p_subscription and metadata->>'stripe_account_id'=p_account;
 return jsonb_build_object('duplicate',false,'transactionId',t.transaction_id);
end $$;

create or replace function public.apply_stripe_subscription_status(
 p_event_id text,p_event_type text,p_account text,p_order_id uuid,p_subscription text,p_status text,p_period_end timestamptz,p_cancelled_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.stripe_checkout_orders%rowtype;
begin
 select * into o from public.stripe_checkout_orders where id=p_order_id for update;
 if not found or o.stripe_account_id<>p_account or o.billing_type<>'subscription' or (o.subscription_id is not null and o.subscription_id<>p_subscription)
 then raise exception 'STRIPE_IDENTITY_MISMATCH';end if;
 if p_status not in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused') then raise exception 'STRIPE_INVALID_STATUS';end if;
 insert into public.stripe_webhook_events(event_id,event_type,stripe_account_id) values(p_event_id,p_event_type,p_account) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true);end if;
 update public.stripe_checkout_orders set subscription_id=p_subscription,updated_at=now() where id=o.id;
 update public.payment_transactions set metadata=metadata||jsonb_build_object('subscription_status',p_status,'current_period_end',p_period_end,'cancelled_at',p_cancelled_at),updated_at=now()
 where provider='stripe' and user_id=o.seller_id and metadata->>'subscription_id'=p_subscription and metadata->>'stripe_account_id'=p_account;
 return jsonb_build_object('duplicate',false,'subscription',p_subscription,'status',p_status);
end $$;

create or replace function public.apply_stripe_invoice_refund(p_event_id text,p_event_type text,p_account text,p_intent text,p_refunded bigint,p_occurred_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.payment_transactions%rowtype; next_status text;
begin
 select * into t from public.payment_transactions where provider='stripe' and metadata->>'payment_intent_id'=p_intent and metadata->>'stripe_account_id'=p_account and metadata ? 'invoice_id' for update;
 if not found then return jsonb_build_object('ignored',true);end if;
 if p_refunded<0 or p_refunded>t.amount_cents then raise exception 'STRIPE_INVALID_STATUS';end if;
 insert into public.stripe_webhook_events(event_id,event_type,stripe_account_id) values(p_event_id,p_event_type,p_account) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true);end if;
 next_status:=case when p_refunded=t.amount_cents and t.status='approved' then 'refunded' else t.status end;
 update public.payment_transactions set status=next_status,refunded_at=case when next_status='refunded' then coalesce(refunded_at,p_occurred_at) else refunded_at end,
  metadata=metadata||jsonb_build_object('refunded_cents',p_refunded),updated_at=now() where id=t.id;
 insert into public.payment_transaction_events(event_id,provider,external_transaction_id,transaction_id,user_id,event_type,previous_status,status,occurred_at,metadata)
 values(p_event_id,'stripe',t.external_transaction_id,t.id,t.user_id,p_event_type,t.status,next_status,p_occurred_at,jsonb_build_object('refunded_cents',p_refunded));
 if next_status='refunded' and t.status<>'refunded' then
  insert into public.financial_event_outbox(event_id,transaction_id,user_id,event_type,payload)
  values('stripe:'||t.external_transaction_id||':refund_done',t.id,t.user_id,'refund_done',jsonb_build_object('transactionId',t.transaction_id,'productId',t.product_id,'productName',t.product_name,'currency',t.currency,'amountCents',t.amount_cents))
  on conflict(event_id) do nothing;
 end if;
 return jsonb_build_object('duplicate',false,'transactionId',t.transaction_id,'status',next_status);
end $$;

revoke all on function public.apply_stripe_subscription_invoice(uuid,text,text,text,text,text,text,text,text,bigint,bigint,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function public.apply_stripe_subscription_status(text,text,text,uuid,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.apply_stripe_invoice_refund(text,text,text,text,bigint,timestamptz) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_invoice(uuid,text,text,text,text,text,text,text,text,bigint,bigint,timestamptz,timestamptz,text) to service_role;
grant execute on function public.apply_stripe_subscription_status(text,text,text,uuid,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.apply_stripe_invoice_refund(text,text,text,text,bigint,timestamptz) to service_role;
