-- Links de pagamento reais: visitas registradas pelo checkout público e listagem com vendas live.

-- Registro de visita/início do checkout público (anon). Só aceita eventos de funil, só para
-- checkout publicado, e deduplica por sessão em 30 minutos para conter inflação por recarga.
create or replace function public.record_checkout_event(p_checkout_id uuid,p_event_type text,p_session_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c record;
begin
 if p_event_type not in ('page_view','checkout_started') then raise exception using errcode='22023',message='CHECKOUT_EVENT_INVALID'; end if;
 if p_session_id is null or length(p_session_id) not between 8 and 80 then raise exception using errcode='22023',message='CHECKOUT_SESSION_INVALID'; end if;
 select id,product_id,seller_id into c from public.product_checkouts
  where id=p_checkout_id and status='published' and deleted_at is null and published_version_id is not null;
 if not found then return; end if;
 if exists(select 1 from public.checkout_analytics_events e where e.checkout_id=c.id and e.session_id=p_session_id and e.event_type=p_event_type and e.created_at>now()-interval '30 minutes') then return; end if;
 insert into public.checkout_analytics_events(checkout_id,product_id,seller_id,event_id,event_type,session_id)
 values(c.id,c.product_id,c.seller_id,gen_random_uuid()::text,p_event_type,p_session_id);
end $$;
revoke all on function public.record_checkout_event(uuid,text,text) from public;
grant execute on function public.record_checkout_event(uuid,text,text) to anon,authenticated,service_role;

-- Links do vendedor autenticado: checkouts com produto, oferta, visitas e vendas live aprovadas.
create or replace function public.list_my_payment_links()
returns table(checkout_id uuid,checkout_name text,status text,is_published boolean,product_id uuid,product_name text,offer_name text,price_cents bigint,currency text,billing_type text,views bigint,started bigint,paid_count bigint,paid_cents bigint,updated_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select c.id,c.name,c.status,(c.status='published' and c.published_version_id is not null),p.id,p.name,o.name,o.price_cents,o.currency,o.billing_type,
  (select count(*) from public.checkout_analytics_events e where e.checkout_id=c.id and e.event_type='page_view'),
  (select count(*) from public.checkout_analytics_events e where e.checkout_id=c.id and e.event_type='checkout_started'),
  coalesce(s.paid_count,0),coalesce(s.paid_cents,0),c.updated_at
 from public.product_checkouts c
 join public.products p on p.id=c.product_id and p.seller_id=c.seller_id and p.deleted_at is null
 left join public.product_offers o on o.id=c.offer_id and o.deleted_at is null
 left join lateral (
  select count(*) as paid_count,sum(t.amount_cents)::bigint as paid_cents
  from public.stripe_checkout_orders so
  join public.payment_transactions t on t.provider='stripe' and t.metadata->>'order_id'=so.id::text
  where so.checkout_id=c.id and t.status='approved' and t.refunded_at is null
 ) s on true
 where c.seller_id=auth.uid() and c.deleted_at is null and c.status<>'archived'
 order by (c.status='published') desc,c.updated_at desc;
$$;
revoke all on function public.list_my_payment_links() from public,anon;
grant execute on function public.list_my_payment_links() to authenticated,service_role;
