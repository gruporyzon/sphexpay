-- NÃO execute sem confirmar a conta correta.
-- Substitua o placeholder por um UUID autenticado específico.
update public.profiles
set role='admin',updated_at=now()
where id='<UUID_DA_CONTA_ADMINISTRATIVA>'::uuid;

-- Alternativa por e-mail, para execução manual no SQL Editor:
-- update public.profiles p
-- set role='admin',updated_at=now()
-- from auth.users u
-- where p.id=u.id and lower(u.email)=lower('<EMAIL_DA_CONTA_ADMINISTRATIVA>');
