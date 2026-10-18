-- Retenção do log de auditoria (400 dias): limpeza semanal, domingos 03:00 UTC.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('prune-security-audit', '0 3 * * 0', $$select public.prune_security_audit_log()$$);
