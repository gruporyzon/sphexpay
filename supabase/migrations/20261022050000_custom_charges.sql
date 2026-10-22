-- Cobrança personalizada: fatura avulsa da Stripe na conta conectada do vendedor, enviada
-- por e-mail pela própria Stripe (Pix, boleto ou cartão). Criação só pelo servidor
-- (service_role); o vendedor lê as próprias cobranças. A venda entra no extrato quando o
-- webhook assinado confirma o pagamento, e só em contas live.

create table if not exists public.custom_charges (
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references auth.users(id) on delete cascade,
 stripe_account_id text not null,
 stripe_mode text not null check (stripe_mode in ('test','live')),
 customer_name text not null check (char_length(customer_name) between 2 and 120),
 customer_email text not null check (char_length(customer_email) between 3 and 254),
 description text not null check (char_length(description) between 2 and 200),
 amount_cents bigint not null check (amount_cents between 50 and 99999999),
 currency text not null default 'BRL' check (currency='BRL'),
 methods text[] not null check (cardinality(methods) between 1 and 3 and methods <@ array['card','pix','boleto']),
 fee_cents bigint not null check (fee_cents>=0 and fee_cents<=amount_cents),
 fee_rule text not null,
 due_date date not null,
 invoice_id text unique,
 hosted_url text,
 status text not null default 'creating' check (status in ('creating','open','paid','void','failed')),
 paid_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists custom_charges_seller_created_idx on public.custom_charges(seller_id,created_at desc);
alter table public.custom_charges enable row level security;
alter table public.custom_charges force row level security;
drop policy if exists custom_charges_own_read on public.custom_charges;
create policy custom_charges_own_read on public.custom_charges for select to authenticated using (seller_id=(select auth.uid()));
revoke all on public.custom_charges from anon,authenticated;
grant select on public.custom_charges to authenticated;

create or replace function public.apply_custom_charge_invoice(p_charge_id uuid,p_event_id text,p_event_type text,p_account text,p_invoice text,p_intent text,p_charge text,p_status text,p_amount bigint,p_fee bigint,p_method text,p_occurred_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.custom_charges%rowtype; t public.payment_transactions%rowtype; external_id text; previous text;
begin
 select * into c from public.custom_charges where id=p_charge_id for update;
 if not found or c.stripe_account_id<>p_account or c.invoice_id is distinct from p_invoice then raise exception 'STRIPE_IDENTITY_MISMATCH';end if;
 if p_status not in ('open','paid','void','failed') or p_method not in ('card','pix','boleto') then raise exception 'STRIPE_INVALID_STATUS';end if;
 insert into public.stripe_webhook_events(event_id,event_type,stripe_account_id) values(p_event_id,p_event_type,p_account) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true);end if;
 -- Pago é final: anulação ou falha atrasada não desfaz.
 update public.custom_charges set status=case when status='paid' then 'paid' else p_status end,
  paid_at=case when p_status='paid' then coalesce(paid_at,p_occurred_at) else paid_at end,updated_at=now() where id=c.id;
 if p_status<>'paid' or c.stripe_mode<>'live' then return jsonb_build_object('duplicate',false,'chargeId',c.id,'test',c.stripe_mode='test');end if;
 if p_amount<>c.amount_cents then raise exception 'STRIPE_PAYMENT_MISMATCH';end if;
 external_id:=p_account||':'||p_invoice;
 select status into previous from public.payment_transactions where provider='stripe' and external_transaction_id=external_id;
 insert into public.payment_transactions(transaction_id,provider,external_transaction_id,user_id,product_id,product_name,product_name_snapshot,product_price_cents_snapshot,
  payment_method,status,amount_cents,gross_amount_cents,fee_cents,net_amount_cents,currency,customer_name,customer_display_name,occurred_at,approved_at,metadata)
 values('stripe:'||external_id,'stripe',external_id,c.seller_id,null,c.description,c.description,c.amount_cents,
  p_method,'approved',p_amount,p_amount,p_fee,p_amount-p_fee,c.currency,c.customer_name,c.customer_name,p_occurred_at,p_occurred_at,
  jsonb_build_object('stripe_account_id',p_account,'payment_intent_id',p_intent,'charge_id',p_charge,'invoice_id',p_invoice,'custom_charge_id',c.id,'fee_rule',c.fee_rule,'stripe_mode',c.stripe_mode))
 on conflict(provider,external_transaction_id) where provider is not null and external_transaction_id is not null
 do update set metadata=payment_transactions.metadata||excluded.metadata,updated_at=now() returning * into t;
 insert into public.payment_transaction_events(event_id,provider,external_transaction_id,transaction_id,user_id,event_type,previous_status,status,occurred_at,metadata)
 values(p_event_id,'stripe',external_id,t.id,c.seller_id,p_event_type,previous,t.status,p_occurred_at,jsonb_build_object('custom_charge_id',c.id,'invoice_id',p_invoice));
 if previous is distinct from 'approved' then
  insert into public.financial_event_outbox(event_id,transaction_id,user_id,event_type,payload)
  values('stripe:charge:'||c.id||':sale_approved',t.id,c.seller_id,'sale_approved',jsonb_build_object('transactionId',t.transaction_id,'productId',null,'productName',c.description,'currency',c.currency,'amountCents',p_amount,'stripe_mode',c.stripe_mode))
  on conflict(event_id) do nothing;
 end if;
 return jsonb_build_object('duplicate',false,'transactionId',t.transaction_id);
end $$;

revoke all on function public.apply_custom_charge_invoice(uuid,text,text,text,text,text,text,text,bigint,bigint,text,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_custom_charge_invoice(uuid,text,text,text,text,text,text,text,bigint,bigint,text,timestamptz) to service_role;
