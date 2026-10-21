-- Gestão dos pedidos de premiação pela equipe (admin: app_metadata.role = 'admin').
-- A mudança de status dispara a notificação ao vendedor (trigger award_requests_notify).
create or replace function public.admin_list_award_requests(p_status text default null)
returns table(id uuid,user_id uuid,award_id text,status text,address jsonb,tracking_code text,requested_at timestamptz,updated_at timestamptz,seller_name text,seller_email text)
language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_dashboard_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 return query select r.id,r.user_id,r.award_id,r.status,r.address,r.tracking_code,r.requested_at,r.updated_at,
  coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),'')::text,u.email::text
 from public.award_requests r join auth.users u on u.id=r.user_id
 where p_status is null or r.status=p_status
 order by r.requested_at desc limit 200;
end $$;

create or replace function public.admin_update_award_request(p_id uuid,p_status text,p_tracking_code text)
returns void language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_dashboard_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_status not in ('requested','preparing','shipped','delivered','cancelled') then raise exception 'INVALID_STATUS' using errcode='22023'; end if;
 if length(btrim(coalesce(p_tracking_code,''))) > 80 then raise exception 'INVALID_TRACKING' using errcode='22023'; end if;
 update public.award_requests set status=p_status,tracking_code=nullif(btrim(coalesce(p_tracking_code,'')),''),updated_at=now() where id=p_id;
 if not found then raise exception 'AWARD_REQUEST_NOT_FOUND' using errcode='02000'; end if;
end $$;

revoke all on function public.admin_list_award_requests(text) from public, anon;
revoke all on function public.admin_update_award_request(uuid,text,text) from public, anon;
grant execute on function public.admin_list_award_requests(text) to authenticated;
grant execute on function public.admin_update_award_request(uuid,text,text) to authenticated;
