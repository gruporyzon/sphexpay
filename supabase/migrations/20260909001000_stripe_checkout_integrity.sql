-- Incremental correction; preserves existing orders, receipts and ledger rows.
-- Never infer the original return origin of an already attempted checkout.
alter table public.stripe_checkout_orders add column checkout_origin text;

-- A current successful PaymentIntent wins over event delivery timestamps.
-- Existing terminal-state and refund protections remain in place.
create or replace function public.apply_stripe_payment(p_order_id uuid,p_event_id text,p_event_type text,p_account text,p_intent text,p_charge text,p_status text,p_refunded bigint,p_occurred_at timestamptz)
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
 if o.status='refunded' or (o.status='approved' and p_status in ('pending','declined')) or (o.last_event_at>p_occurred_at and p_status not in ('approved','refunded')) then next_status:=o.status;end if;
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
