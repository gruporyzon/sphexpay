-- Notificações no padrão dos gateways:
-- 1) Venda real aprovada ou pendente avisa na hora ("Venda aprovada!" / "Valor: R$ 197,00").
-- 2) Lembretes de faturamento às 0h, 8h, 12h, 15h, 18h e 20h (Brasília), ligados para todos,
--    com estilo (misto, profissional ou humor) e horários escolhidos pelo vendedor.
-- O banco chama o envio de push da Vercel (api/push/send.js, que já tem as chaves VAPID) com um
-- token interno guardado no Vault (gerado aqui, nunca sai do banco); o servidor confere o token
-- por RPC exclusiva do service_role.

create table if not exists public.revenue_reminder_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 style text not null default 'mixed' check (style in ('mixed','professional','humor')),
 hours smallint[] not null default '{0,8,12,15,18,20}' check (hours <@ '{0,8,12,15,18,20}'::smallint[]),
 updated_at timestamptz not null default now()
);
alter table public.revenue_reminder_settings enable row level security;
alter table public.revenue_reminder_settings force row level security;
revoke all on public.revenue_reminder_settings from anon,authenticated;
grant select,insert,update on public.revenue_reminder_settings to authenticated;
drop policy if exists revenue_reminder_settings_own_select on public.revenue_reminder_settings;
create policy revenue_reminder_settings_own_select on public.revenue_reminder_settings for select to authenticated using (user_id=auth.uid());
drop policy if exists revenue_reminder_settings_own_insert on public.revenue_reminder_settings;
create policy revenue_reminder_settings_own_insert on public.revenue_reminder_settings for insert to authenticated with check (user_id=auth.uid());
drop policy if exists revenue_reminder_settings_own_update on public.revenue_reminder_settings;
create policy revenue_reminder_settings_own_update on public.revenue_reminder_settings for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Um envio por vendedor e horário, mesmo que o agendador dispare duas vezes.
create table if not exists public.revenue_reminder_log (
 user_id uuid not null references auth.users(id) on delete cascade,
 slot text not null check (slot ~ '^\d{4}-\d{2}-\d{2}T\d{2}$'),
 sent_at timestamptz not null default now(),
 primary key (user_id,slot)
);
alter table public.revenue_reminder_log enable row level security;
alter table public.revenue_reminder_log force row level security;
revoke all on public.revenue_reminder_log from anon,authenticated;

-- Quem recebe o lembrete do horário e o faturamento real do dia (vendas aprovadas em reais,
-- só contas de produção). Sem preferência salva, vale o padrão: ligado, misto, todos os horários.
create or replace function public.revenue_reminder_targets(p_hour integer,p_day date)
returns table(user_id uuid,style text,first_name text,revenue_cents bigint,sales integer)
language sql stable security definer set search_path=public,pg_temp as $$
 with eligible as (select distinct s.user_id from public.push_subscriptions s where s.enabled),
 cfg as (
  select e.user_id,coalesce(r.enabled,true) as enabled,coalesce(r.style,'mixed') as style,coalesce(r.hours,'{0,8,12,15,18,20}'::smallint[]) as hours
  from eligible e left join public.revenue_reminder_settings r on r.user_id=e.user_id)
 select c.user_id,c.style,nullif(split_part(trim(coalesce(u.raw_user_meta_data->>'full_name','')),' ',1),''),
  coalesce(sum(t.amount_cents),0)::bigint,count(t.id)::integer
 from cfg c
 join auth.users u on u.id=c.user_id
 left join public.payment_transactions t on t.user_id=c.user_id and t.provider='stripe' and t.status='approved' and t.currency='BRL'
  and coalesce(t.metadata->>'stripe_mode','live')='live'
  and coalesce(t.approved_at,t.occurred_at)>=(p_day::timestamp at time zone 'America/Sao_Paulo')
  and coalesce(t.approved_at,t.occurred_at)<((p_day+1)::timestamp at time zone 'America/Sao_Paulo')
 where c.enabled and p_hour::smallint=any(c.hours)
 group by c.user_id,c.style,u.raw_user_meta_data
$$;
revoke all on function public.revenue_reminder_targets(integer,date) from public,anon,authenticated;
grant execute on function public.revenue_reminder_targets(integer,date) to service_role;

-- [vault] Token interno banco -> função. Criado uma vez; o valor nunca aparece fora do banco.
do $$
begin
 if not exists(select 1 from vault.secrets where name='sphex_notify_token') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'sphex_notify_token','Token interno do banco para o envio automático de push');
 end if;
end $$;

create or replace function public.sphex_notify_token_ok(p_token text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(length(p_token)=64 and p_token=(select decrypted_secret from vault.decrypted_secrets where name='sphex_notify_token'),false)
$$;
revoke all on function public.sphex_notify_token_ok(text) from public,anon,authenticated;
grant execute on function public.sphex_notify_token_ok(text) to service_role;

-- Chamada assíncrona (pg_net): sai depois do commit e nunca derruba a transação de origem.
create or replace function public.sphex_notify(p_body jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_token text;
begin
 select decrypted_secret into v_token from vault.decrypted_secrets where name='sphex_notify_token';
 if v_token is null then return;end if;
 perform net.http_post(
  url:='https://www.sphexpay.com.br/api/push/send',
  body:=p_body,
  headers:=jsonb_build_object('Content-Type','application/json','x-sphex-notify',v_token),
  timeout_milliseconds:=20000);
exception when others then
 raise warning 'sphex_notify: %',sqlerrm;
end $$;
revoke all on function public.sphex_notify(jsonb) from public,anon,authenticated;

-- Venda real aprovada ou pendente: aviso imediato. Falha no aviso nunca bloqueia a venda.
create or replace function public.push_sale_status() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.provider='stripe' and new.status in ('approved','pending') and (tg_op='INSERT' or old.status is distinct from new.status) then
  perform public.sphex_notify(jsonb_build_object('kind','sale','transactionId',new.id));
 end if;
 return new;
exception when others then
 return new;
end $$;
revoke all on function public.push_sale_status() from public,anon,authenticated;
drop trigger if exists payment_transactions_push on public.payment_transactions;
create trigger payment_transactions_push after insert or update of status on public.payment_transactions
 for each row execute function public.push_sale_status();

-- [cron] A cada hora cheia; o servidor calcula o horário de Brasília e só envia nos horários
-- escolhidos por cada vendedor.
select cron.unschedule('revenue-reminders') where exists(select 1 from cron.job where jobname='revenue-reminders');
select cron.schedule('revenue-reminders','0 * * * *',$$select public.sphex_notify('{"kind":"reminders"}'::jsonb)$$);
