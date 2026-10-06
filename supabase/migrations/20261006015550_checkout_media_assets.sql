-- Dedicated public marketing media. Existing private buckets are unchanged.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('checkout-media','checkout-media',true,26214400,array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict(id) do nothing;

do $$ begin
if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='checkout_media_owner_insert') then
create policy checkout_media_owner_insert on storage.objects for insert to authenticated
with check (
 bucket_id='checkout-media'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.product_checkouts c
   where c.id::text=(storage.foldername(name))[2] and c.seller_id=(select auth.uid()) and c.deleted_at is null)
);
end if;
if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='checkout_media_owner_select') then
create policy checkout_media_owner_select on storage.objects for select to authenticated
using(bucket_id='checkout-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
end if;
end $$;
-- No overwrite/delete: URLs referenced by immutable published versions remain available.
