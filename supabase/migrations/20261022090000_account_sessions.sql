-- Segurança da conta: o próprio usuário vê os aparelhos conectados (sessões do Supabase Auth).
-- Encerrar acesso usa só a API oficial do Supabase ("sair de todos os outros"); a SphexPay não
-- apaga linhas do schema auth.
create or replace function public.my_sessions()
returns table(id uuid,created_at timestamptz,last_seen_at timestamptz,user_agent text,ip text,aal text,current boolean)
language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare current_session uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return query
 select s.id,s.created_at,coalesce(s.refreshed_at::timestamptz,s.updated_at,s.created_at),left(s.user_agent,300),host(s.ip),s.aal::text,s.id=current_session
 from auth.sessions s
 where s.user_id=auth.uid() and (s.not_after is null or s.not_after>now())
 order by (s.id=current_session) desc,coalesce(s.refreshed_at::timestamptz,s.updated_at,s.created_at) desc
 limit 50;
end $$;


revoke all on function public.my_sessions() from public,anon;
grant execute on function public.my_sessions() to authenticated;
