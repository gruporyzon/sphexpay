-- Resolve o checkout padrão publicado de um produto ativo (links de campanha /p/{produto}).
create or replace function public.get_product_checkout_link(p_product_id uuid)
returns uuid language sql stable security definer set search_path=public,pg_temp as $$
 select c.id from public.product_checkouts c
 join public.products p on p.id=c.product_id and p.seller_id=c.seller_id and p.status='active' and p.deleted_at is null
 where c.product_id=p_product_id and c.status='published' and c.deleted_at is null and c.published_version_id is not null
 order by c.is_default desc,c.updated_at desc
 limit 1;
$$;
revoke all on function public.get_product_checkout_link(uuid) from public;
grant execute on function public.get_product_checkout_link(uuid) to anon,authenticated,service_role;
