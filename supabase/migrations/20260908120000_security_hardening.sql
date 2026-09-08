-- Endurecimento de segurança da plataforma SphexPay.
--
-- Objetivos:
--   1. Log de auditoria de segurança append-only (public.security_audit_log).
--   2. Forçar RLS nas tabelas financeiras/negócio (defesa contra bypass por owner).
--   3. Reduzir GRANTs amplos para o mínimo necessário; revogar acesso de anon.
--   4. Classificação de dados registrada como COMMENT em cada tabela sensível.
--
-- Idempotente. Não remove tabelas nem altera o comportamento efetivo das policies
-- existentes. Aplicar depois das migrations anteriores.

set check_function_bodies = false;

-- =====================================================================
-- 1. Log de auditoria de segurança
-- =====================================================================

create table if not exists public.security_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (length(trim(event_type)) between 1 and 80),
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  user_agent text check (user_agent is null or length(user_agent) <= 400),
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.security_audit_log is
  'Confidencial. Trilha de auditoria append-only de eventos de segurança (MFA, webhook, acesso admin). Nunca armazena PAN, CVV, PII do comprador nem IP em claro (apenas hash).';

create index if not exists security_audit_log_actor_idx on public.security_audit_log (actor_id, occurred_at desc);
create index if not exists security_audit_log_event_idx on public.security_audit_log (event_type, occurred_at desc);

alter table public.security_audit_log enable row level security;
alter table public.security_audit_log force row level security;

revoke all on public.security_audit_log from anon;
revoke all on public.security_audit_log from authenticated;
grant select on public.security_audit_log to authenticated;
grant all on public.security_audit_log to service_role;

-- authenticated lê apenas as próprias linhas; ninguém além de service_role escreve/edita.
drop policy if exists security_audit_log_own_read on public.security_audit_log;
create policy security_audit_log_own_read on public.security_audit_log
  for select to authenticated using (actor_id = auth.uid());

-- RPC controlada para o frontend registrar eventos do próprio usuário.
create or replace function public.record_security_event(p_event_type text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_event_type is null or length(trim(p_event_type)) = 0 or length(p_event_type) > 80 then
    raise exception using errcode = '22023', message = 'INVALID_EVENT_TYPE';
  end if;
  insert into public.security_audit_log (actor_id, event_type, metadata)
  values (
    auth.uid(),
    trim(p_event_type),
    case when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then p_metadata else '{}'::jsonb end
  );
end;
$$;

alter function public.record_security_event(text, jsonb) owner to postgres;
revoke all on function public.record_security_event(text, jsonb) from public;
grant execute on function public.record_security_event(text, jsonb) to authenticated;
grant execute on function public.record_security_event(text, jsonb) to service_role;

-- Retenção: 400 dias. O agendamento (pg_cron ou rotina externa) é passo operacional
-- documentado em docs/SECURITY.md e não faz parte desta migration.
create or replace function public.prune_security_audit_log()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  removed integer;
begin
  delete from public.security_audit_log where occurred_at < now() - interval '400 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

alter function public.prune_security_audit_log() owner to postgres;
revoke all on function public.prune_security_audit_log() from public;
grant execute on function public.prune_security_audit_log() to service_role;

-- =====================================================================
-- 2. Forçar RLS e reduzir privilégios nas tabelas de negócio
-- =====================================================================

do $$
declare
  t text;
  business_tables text[] := array[
    'payment_transactions',
    'payment_transaction_events',
    'financial_event_outbox',
    'products',
    'dashboard_scenarios',
    'dashboard_exchange_rates'
  ];
begin
  foreach t in array business_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- products / dashboard_scenarios / dashboard_exchange_rates hoje têm GRANT ALL para
-- authenticated (inclui TRUNCATE, REFERENCES, TRIGGER, MAINTAIN). Reduzir para DML puro
-- — as policies RLS continuam sendo a fronteira real de linhas.
do $$
declare
  t text;
begin
  foreach t in array array['products', 'dashboard_scenarios', 'dashboard_exchange_rates'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('revoke all on public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- payment_transactions / payment_transaction_events / financial_event_outbox: o frontend
-- só precisa de leitura (as policies já são apenas SELECT). Remover privilégios de escrita.
do $$
declare
  t text;
begin
  foreach t in array array['payment_transactions', 'payment_transaction_events', 'financial_event_outbox'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('revoke all on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;

-- =====================================================================
-- 3. Classificação de dados (COMMENT ON TABLE) — ver docs/DATA-CLASSIFICATION.md
-- =====================================================================

do $$
begin
  if to_regclass('public.payment_transactions') is not null then
    comment on table public.payment_transactions is
      'Confidencial. Log de transações do vendedor: valores, método, status, nome de exibição do comprador. NAO contém PAN/CVV/tarja. Acesso: dono via RLS (SELECT), escrita apenas via RPC process_payment_event (service_role).';
  end if;
  if to_regclass('public.payment_transaction_events') is not null then
    comment on table public.payment_transaction_events is
      'Confidencial. Histórico imutável de eventos de transação. Acesso: dono via RLS (SELECT).';
  end if;
  if to_regclass('public.financial_event_outbox') is not null then
    comment on table public.financial_event_outbox is
      'Interno. Fila de eventos financeiros confirmados para notificação. Acesso: dono via RLS (SELECT), processamento por service_role.';
  end if;
  if to_regclass('public.products') is not null then
    comment on table public.products is
      'Interno. Catálogo do vendedor. Acesso: dono via RLS.';
  end if;
  if to_regclass('public.push_subscriptions') is not null then
    comment on table public.push_subscriptions is
      'Confidencial. Assinaturas Web Push (endpoint + chaves). Acesso: dono via RLS restrita a colunas; escrita por service_role.';
  end if;
end;
$$;
