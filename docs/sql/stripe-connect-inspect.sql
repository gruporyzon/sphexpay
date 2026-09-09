-- Somente leitura de metadados; nao consulta registros da tabela.
-- Execute no mesmo projeto Supabase usado pelo deployment que falhou.
-- Retorna uma unica celula JSON com todas as secoes para copiar.
with target as (
  select to_regclass('public.stripe_connected_accounts') as oid
)
select jsonb_pretty(jsonb_build_object(
  'table', 'public.stripe_connected_accounts',
  'table_found', (select oid is not null from target),
  'columns', coalesce((
    select jsonb_agg(to_jsonb(c) order by c.ordinal_position)
    from (
      select ordinal_position, column_name, data_type,
             udt_schema, udt_name, domain_schema, domain_name,
             is_nullable, column_default,
             character_maximum_length, numeric_precision, numeric_scale,
             is_identity, identity_generation, is_generated, generation_expression
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'stripe_connected_accounts'
    ) c
  ), '[]'::jsonb),
  'check_constraints', coalesce((
    select jsonb_agg(jsonb_build_object(
      'CONSTRAINT NAME', c.conname,
      'CHECK EXPRESSION', pg_get_expr(c.conbin, c.conrelid, false),
      'definition', pg_get_constraintdef(c.oid, false),
      'validated', c.convalidated
    ) order by c.conname)
    from pg_constraint c
    where c.conrelid = (select oid from target) and c.contype = 'c'
  ), '[]'::jsonb),
  'all_constraints', coalesce((
    select jsonb_agg(jsonb_build_object(
      'constraint_name', c.conname,
      'constraint_type', case c.contype
        when 'c' then 'CHECK' when 'u' then 'UNIQUE'
        when 'p' then 'PRIMARY KEY' when 'f' then 'FOREIGN KEY'
        when 'x' then 'EXCLUSION' when 'n' then 'NOT NULL'
        else c.contype::text end,
      'definition', pg_get_constraintdef(c.oid, false),
      'validated', c.convalidated,
      'deferrable', c.condeferrable,
      'initially_deferred', c.condeferred
    ) order by c.conname)
    from pg_constraint c
    where c.conrelid = (select oid from target)
  ), '[]'::jsonb),
  'indexes', coalesce((
    select jsonb_agg(to_jsonb(i) order by i.indexname)
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'stripe_connected_accounts'
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'trigger_name', t.tgname,
      'definition', pg_get_triggerdef(t.oid, false),
      'enabled', t.tgenabled,
      'internal', t.tgisinternal,
      'function', t.tgfoid::regprocedure::text
    ) order by t.tgname)
    from pg_trigger t
    where t.tgrelid = (select oid from target)
  ), '[]'::jsonb),
  'rls', (
    select jsonb_build_object(
      'enabled', c.relrowsecurity, 'forced', c.relforcerowsecurity
    ) from pg_class c where c.oid = (select oid from target)
  ),
  'rls_policies', coalesce((
    select jsonb_agg(to_jsonb(p) order by p.policyname)
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'stripe_connected_accounts'
  ), '[]'::jsonb)
)) as stripe_connect_inspection;
