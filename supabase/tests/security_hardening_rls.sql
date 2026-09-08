\set ON_ERROR_STOP on
begin;

-- Executar somente em Supabase local descartável, conectado como postgres.
-- Valida a migration 20260908120000_security_hardening.sql.

insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','authenticated','authenticated','sec-a@example.invalid','',now(),now()),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','authenticated','authenticated','sec-b@example.invalid','',now(),now())
on conflict(id) do nothing;

-- service_role registra um evento para o usuário A.
insert into public.security_audit_log(actor_id,event_type,metadata)
values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','webhook.accepted','{"provider":"partner"}');

-- ---------------------------------------------------------------------
-- Usuário A: lê o próprio evento, cria evento pela RPC, não escreve direto.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $$begin
 if not exists(select 1 from public.security_audit_log where actor_id=current_setting('request.jwt.claim.sub')::uuid) then
  raise exception 'Owner cannot read own audit rows';
 end if;
end $$;

select public.record_security_event('mfa.enrolled','{"factorType":"totp"}');

do $$declare n integer;begin
 if not exists(select 1 from public.security_audit_log where actor_id=current_setting('request.jwt.claim.sub')::uuid and event_type='mfa.enrolled') then
  raise exception 'record_security_event did not persist';
 end if;
 begin
  insert into public.security_audit_log(actor_id,event_type) values(current_setting('request.jwt.claim.sub')::uuid,'forged');
  raise exception 'Direct insert into security_audit_log should be denied';
 exception when insufficient_privilege then null; end;
 update public.security_audit_log set event_type='tampered' where actor_id=current_setting('request.jwt.claim.sub')::uuid;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Audit log must be append-only (update leaked)'; end if;
 delete from public.security_audit_log where actor_id=current_setting('request.jwt.claim.sub')::uuid;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Audit log must be append-only (delete leaked)'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Usuário B: não enxerga eventos do usuário A.
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $$begin
 if exists(select 1 from public.security_audit_log where actor_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') then
  raise exception 'RLS leak: user B sees user A audit rows';
 end if;
end $$;

-- ---------------------------------------------------------------------
-- anon: sem acesso à tabela de auditoria nem às tabelas financeiras.
-- ---------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);

do $$begin
 begin
  perform 1 from public.security_audit_log limit 1;
  raise exception 'anon must not read security_audit_log';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from public.payment_transactions limit 1;
  raise exception 'anon must not read payment_transactions';
 exception when insufficient_privilege then null; end;
end $$;

-- ---------------------------------------------------------------------
-- RLS forçada nas tabelas de negócio.
-- ---------------------------------------------------------------------
reset role;
do $$declare t text;begin
 foreach t in array array['payment_transactions','payment_transaction_events','financial_event_outbox','products','dashboard_scenarios','dashboard_exchange_rates','security_audit_log'] loop
  if not exists(select 1 from pg_class where oid=('public.'||t)::regclass and relrowsecurity and relforcerowsecurity) then
   raise exception 'RLS not forced on %', t;
  end if;
 end loop;
end $$;

rollback;
