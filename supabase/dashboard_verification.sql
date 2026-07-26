-- Consultas somente de leitura. Execute depois da migration do Dashboard.

-- Substitua <USER_UUID> pelo UUID de Authentication → Users antes de executar.

-- 1. Papel administrativo da conta escolhida.
select id,
  coalesce(raw_app_meta_data->>'role','') as administrative_role,
  coalesce(raw_app_meta_data->>'role','')='admin' as dashboard_admin
from auth.users where id='<USER_UUID>'::uuid;

-- 2. Existência das tabelas e função.
select table_name from information_schema.tables
where table_schema='public'
  and table_name in ('payment_transactions','dashboard_scenarios','dashboard_exchange_rates')
order by table_name;
select routine_name from information_schema.routines
where routine_schema='public' and routine_name='is_dashboard_admin';
select pg_get_functiondef('public.is_dashboard_admin()'::regprocedure);

-- 3. RLS e políticas.
select c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('payment_transactions','dashboard_scenarios','dashboard_exchange_rates')
order by c.relname;
select tablename,policyname,cmd,roles,qual,with_check
from pg_policies
where schemaname='public'
  and tablename in ('payment_transactions','dashboard_scenarios','dashboard_exchange_rates')
order by tablename,policyname;

-- 4. Taxas ativas disponíveis.
select base_currency,quote_currency,rate,fetched_at,source,enabled
from public.dashboard_exchange_rates where enabled order by base_currency,quote_currency;

-- 5. Vendas elegíveis da conta autenticada.
select transaction_id,status,amount_cents,fee_cents,currency,occurred_at
from public.payment_transactions
where user_id='<USER_UUID>'::uuid and status='approved'
order by financial_at desc limit 20;

-- 6. Realtime habilitado.
select schemaname,tablename
from pg_publication_tables
where pubname='supabase_realtime' and schemaname='public'
  and tablename='payment_transactions';

-- 7. Total de hoje no timezone operacional.
select currency,
  coalesce(sum(amount_cents) filter(where status='approved'),0) as approved_revenue_cents,
  count(*) filter(where status='approved') as approved_sales,
  coalesce(sum(fee_cents) filter(where status='approved'),0) as fees_cents
from public.payment_transactions
where user_id='<USER_UUID>'::uuid
  and financial_at >= date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
group by currency order by currency;

-- 8. Série horária de hoje, inclusive horas sem venda.
with hours as (
  select generate_series(0,23) as hour
), totals as (
  select extract(hour from financial_at at time zone 'America/Sao_Paulo')::int as hour,
    sum(amount_cents) filter(where status='approved') as revenue_cents
  from public.payment_transactions
  where user_id='<USER_UUID>'::uuid
    and financial_at >= date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
  group by 1
)
select h.hour,coalesce(t.revenue_cents,0) as revenue_cents
from hours h left join totals t using(hour) order by h.hour;

-- 9. Contagens e última atualização da fonte financeira, sem dados pessoais.
select count(*) as transaction_count,
  count(*) filter(where status='approved') as approved_count,
  max(persisted_at) as last_persisted_at,
  max(financial_at) as last_financial_at
from public.payment_transactions
where user_id='<USER_UUID>'::uuid;
