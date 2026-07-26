-- NÃO execute sem confirmar a conta correta.
-- Substitua o placeholder pelo UUID exibido em Authentication → Users.
insert into public.profiles(id,role,updated_at)
values('<USER_UUID>'::uuid,'admin',now())
on conflict(id) do update set role='admin',updated_at=now();

-- Alternativa por e-mail, para execução manual no SQL Editor:
-- insert into public.profiles(id,role,updated_at)
-- select id,'admin',now() from auth.users where lower(email)=lower('<USER_EMAIL>')
-- on conflict(id) do update set role='admin',updated_at=now();
