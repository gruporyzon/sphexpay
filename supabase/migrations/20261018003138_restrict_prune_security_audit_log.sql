-- O revoke de public em 20260908120000 não remove os GRANTs diretos que o Supabase dá a
-- anon/authenticated. A limpeza é manutenção: só service_role e o pg_cron (postgres).
revoke execute on function public.prune_security_audit_log() from anon, authenticated;
