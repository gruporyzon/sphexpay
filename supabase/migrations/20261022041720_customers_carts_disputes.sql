-- Clientes reais, carrinhos abandonados e contestações (Stripe).
-- Clientes e carrinhos saem dos pedidos do checkout (nome e e-mail informados pelo comprador)
-- e só de contas Stripe em modo live: vendas de teste não entram, como nos relatórios.
-- Cada vendedor só enxerga os próprios compradores.

create or replace function public.my_customers()
returns table(email text,name text,purchases integer,spent_cents bigint,refunded integer,other_currency boolean,first_purchase_at timestamptz,last_purchase_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return query
 select lower(o.buyer_email) as email,
  (array_agg(o.buyer_name order by t.occurred_at desc))[1] as name,
  count(*) filter (where t.status in ('approved','refunded','chargeback'))::integer as purchases,
  coalesce(sum(t.amount_cents) filter (where t.status='approved' and t.currency='BRL'),0)::bigint as spent_cents,
  count(*) filter (where t.status='refunded')::integer as refunded,
  bool_or(t.currency<>'BRL') as other_currency,
  min(t.occurred_at) as first_purchase_at,max(t.occurred_at) as last_purchase_at
 from public.payment_transactions t
 join public.stripe_checkout_orders o on o.id::text=t.metadata->>'order_id' and o.seller_id=t.user_id
 where t.user_id=auth.uid() and t.provider='stripe' and t.status in ('approved','refunded','chargeback')
 group by lower(o.buyer_email)
 order by max(t.occurred_at) desc
 limit 5000;
end $$;

-- Pedido iniciado (comprador informou nome e e-mail) que não virou pagamento em 1 hora
-- e sem compra aprovada posterior do mesmo e-mail no mesmo produto. Janela de 90 dias.
create or replace function public.my_abandoned_checkouts()
returns table(id uuid,buyer_name text,buyer_email text,product_id uuid,product_name text,amount_cents bigint,currency text,billing_type text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return query
 select o.id,o.buyer_name,lower(o.buyer_email),o.product_id,o.product_name,o.amount_cents,o.currency,coalesce(o.billing_type,'one_time'),o.status,o.created_at
 from public.stripe_checkout_orders o
 join public.stripe_connected_accounts a on a.stripe_account_id=o.stripe_account_id and a.user_id=o.seller_id and a.stripe_mode='live'
 where o.seller_id=auth.uid() and o.status in ('pending','declined')
  and o.created_at<now()-interval '1 hour' and o.created_at>now()-interval '90 days'
  and not exists(select 1 from public.stripe_checkout_orders later where later.seller_id=o.seller_id and later.product_id=o.product_id
   and lower(later.buyer_email)=lower(o.buyer_email) and later.status in ('approved','refunded') and later.created_at>=o.created_at)
 order by o.created_at desc
 limit 2000;
end $$;

revoke all on function public.my_customers() from public,anon;
revoke all on function public.my_abandoned_checkouts() from public,anon;
grant execute on function public.my_customers() to authenticated;
grant execute on function public.my_abandoned_checkouts() to authenticated;

-- Contestação (cartão) ou devolução Pix (MED) vinda do webhook da Stripe. Aberta → venda
-- fica como contestada; ganha pelo vendedor → volta a aprovada; perdida → continua contestada.
create or replace function public.apply_stripe_dispute(p_event_id text,p_event_type text,p_account text,p_intent text,p_dispute text,p_dispute_status text,p_reason text,p_amount bigint,p_due_by timestamptz,p_occurred_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.payment_transactions%rowtype; next_status text;
begin
 insert into public.stripe_webhook_events(event_id,event_type,stripe_account_id) values(p_event_id,p_event_type,p_account) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true);end if;
 select * into t from public.payment_transactions where provider='stripe' and metadata->>'payment_intent_id'=p_intent and metadata->>'stripe_account_id'=p_account
  order by occurred_at desc limit 1 for update;
 if not found then return jsonb_build_object('ignored',true);end if;
 next_status:=case
  when p_dispute_status='won' and t.status='chargeback' then 'approved'
  when p_dispute_status='won' then t.status
  when t.status in ('approved','chargeback') then 'chargeback'
  else t.status end;
 update public.payment_transactions set status=next_status,
  chargeback_at=case when next_status='chargeback' then coalesce(chargeback_at,p_occurred_at) else chargeback_at end,
  metadata=metadata||jsonb_build_object('dispute_id',p_dispute,'dispute_status',p_dispute_status,'dispute_reason',p_reason,'dispute_amount_cents',p_amount,'dispute_due_by',p_due_by),
  updated_at=now() where id=t.id;
 insert into public.payment_transaction_events(event_id,provider,external_transaction_id,transaction_id,user_id,event_type,previous_status,status,occurred_at,metadata)
 values(p_event_id,'stripe',t.external_transaction_id,t.id,t.user_id,p_event_type,t.status,next_status,p_occurred_at,jsonb_build_object('dispute_id',p_dispute,'dispute_status',p_dispute_status));
 return jsonb_build_object('duplicate',false,'transactionId',t.transaction_id,'status',next_status);
end $$;

revoke all on function public.apply_stripe_dispute(text,text,text,text,text,text,text,bigint,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_stripe_dispute(text,text,text,text,text,text,text,bigint,timestamptz,timestamptz) to service_role;
