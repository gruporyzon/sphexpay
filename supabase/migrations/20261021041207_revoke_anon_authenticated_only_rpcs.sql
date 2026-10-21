-- Funções usadas só por usuários logados deixam de ser executáveis por visitantes anônimos.
-- authenticated e service_role mantêm as permissões explícitas que já tinham.
revoke execute on function public.create_product_v2(jsonb) from public, anon;
revoke execute on function public.kyc_submit() from public, anon;
revoke execute on function public.publish_checkout(uuid,bigint,text) from public, anon;
revoke execute on function public.record_security_event(text,jsonb) from public, anon;
revoke execute on function public.restore_checkout_version(uuid,uuid,bigint) from public, anon;
revoke execute on function public.save_checkout_draft(uuid,bigint,jsonb,jsonb,jsonb) from public, anon;
revoke execute on function public.set_default_checkout(uuid,uuid) from public, anon;
revoke execute on function public.social_open_conversation(uuid) from public, anon;
