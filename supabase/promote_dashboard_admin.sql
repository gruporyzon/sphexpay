-- NÃO execute sem confirmar a conta correta.
-- Substitua o placeholder pelo UUID exibido em Authentication → Users.
update auth.users
set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"role":"admin"}'::jsonb,
    updated_at=now()
where id='<USER_UUID>'::uuid
  and coalesce(raw_app_meta_data->>'role','')<>'admin';

-- Alternativa por e-mail, para execução manual no SQL Editor:
-- update auth.users
-- set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"role":"admin"}'::jsonb,
--     updated_at=now()
-- where lower(email)=lower('<USER_EMAIL>')
--   and coalesce(raw_app_meta_data->>'role','')<>'admin';
