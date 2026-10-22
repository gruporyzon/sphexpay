-- Indicação de vendedores: quem indica recebe 10% da taxa SphexPay das vendas aprovadas do
-- indicado durante 12 meses a partir do vínculo. A comissão sai da taxa da plataforma (o
-- indicado não paga nada a mais) e é paga pela equipe uma vez por mês, fora do sistema; aqui
-- fica o cálculo e o registro do pagamento. Só vendas reais (live) entram.

create table if not exists public.referral_codes (
 user_id uuid primary key references auth.users(id) on delete cascade,
 code text not null unique check (code ~ '^SPX-[A-Z0-9]{8}$'),
 created_at timestamptz not null default now()
);
create table if not exists public.seller_referrals (
 referred_id uuid primary key references auth.users(id) on delete cascade,
 referrer_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 constraint seller_referrals_not_self check (referred_id<>referrer_id)
);
create index if not exists seller_referrals_referrer_idx on public.seller_referrals(referrer_id);
create table if not exists public.referral_payouts (
 referrer_id uuid not null references auth.users(id) on delete cascade,
 month date not null check (extract(day from month)=1),
 amount_cents bigint not null check (amount_cents>=0),
 paid_at timestamptz not null default now(),
 paid_by uuid references auth.users(id),
 primary key (referrer_id,month)
);
alter table public.referral_codes enable row level security;alter table public.referral_codes force row level security;
alter table public.seller_referrals enable row level security;alter table public.seller_referrals force row level security;
alter table public.referral_payouts enable row level security;alter table public.referral_payouts force row level security;
revoke all on public.referral_codes,public.seller_referrals,public.referral_payouts from anon,authenticated;

create or replace function public.referral_commission_bps() returns integer language sql immutable as $$ select 1000 $$;

-- Código de indicação do próprio vendedor (criado na primeira vez).
create or replace function public.my_referral_code() returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_code text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select code into v_code from public.referral_codes where user_id=auth.uid();
 if v_code is not null then return v_code;end if;
 loop
  v_code:='SPX-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  exit when not exists(select 1 from public.referral_codes where code=v_code);
 end loop;
 insert into public.referral_codes(user_id,code) values(auth.uid(),v_code) on conflict(user_id) do nothing;
 select code into v_code from public.referral_codes where user_id=auth.uid();
 return v_code;
end $$;

-- Vincula a conta recém-criada a quem indicou. Só contas com até 7 dias, uma única vez, sem
-- autoindicação e sem vendas reais antes do vínculo.
create or replace function public.claim_referral(p_code text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_referrer uuid;v_created timestamptz;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select user_id into v_referrer from public.referral_codes where code=upper(trim(coalesce(p_code,'')));
 if v_referrer is null or v_referrer=auth.uid() then return false;end if;
 select created_at into v_created from auth.users where id=auth.uid();
 if v_created is null or v_created<now()-interval '7 days' then return false;end if;
 if exists(select 1 from public.payment_transactions where user_id=auth.uid() and status='approved') then return false;end if;
 insert into public.seller_referrals(referred_id,referrer_id,expires_at) values(auth.uid(),v_referrer,now()+interval '12 months') on conflict(referred_id) do nothing;
 return found;
end $$;

-- Relatório de quem indicou: uma linha por venda aprovada (live) dos indicados no período,
-- com a comissão de 10% da taxa. O indicado aparece pelo primeiro nome.
create or replace function public.my_referral_sales(p_start timestamptz,p_end timestamptz)
returns table(referred_id uuid,referred_name text,referred_since timestamptz,occurred_at timestamptz,amount_cents bigint,fee_cents bigint,commission_cents bigint,currency text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return query
 select r.referred_id,split_part(coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),'Vendedor'),' ',1),r.created_at,t.occurred_at,t.amount_cents,t.fee_cents,
  floor(t.fee_cents*public.referral_commission_bps()/10000.0)::bigint,t.currency
 from public.seller_referrals r
 join auth.users u on u.id=r.referred_id
 join public.payment_transactions t on t.user_id=r.referred_id and t.provider='stripe' and t.status='approved'
  and t.occurred_at>=r.created_at and t.occurred_at<r.expires_at and coalesce(t.metadata->>'stripe_mode','live')='live'
 where r.referrer_id=auth.uid() and t.occurred_at>=p_start and t.occurred_at<=p_end
 order by t.occurred_at desc
 limit 5000;
end $$;

create or replace function public.my_referral_summary()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object(
  'referred',(select count(*) from public.seller_referrals where referrer_id=auth.uid()),
  'active',(select count(*) from public.seller_referrals where referrer_id=auth.uid() and expires_at>now()),
  'paid_cents',(select coalesce(sum(amount_cents),0) from public.referral_payouts where referrer_id=auth.uid()),
  'payouts',coalesce((select jsonb_agg(jsonb_build_object('month',month,'amount_cents',amount_cents,'paid_at',paid_at) order by month desc) from public.referral_payouts where referrer_id=auth.uid()),'[]'::jsonb));
end $$;

-- Equipe (admin): comissão de cada indicador num mês e registro do pagamento.
create or replace function public.admin_referral_month(p_month date)
returns table(referrer_id uuid,referrer_name text,referrer_email text,sales integer,commission_cents bigint,paid_cents bigint,paid_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_start timestamptz:=date_trunc('month',p_month)::timestamptz;
begin
 if not coalesce(public.is_dashboard_admin(),false) then raise exception 'ADMIN_REQUIRED';end if;
 return query
 select r.referrer_id,coalesce(u.raw_user_meta_data->>'full_name',''),u.email::text,count(t.id)::integer,
  coalesce(sum(floor(t.fee_cents*public.referral_commission_bps()/10000.0)) filter (where t.currency='BRL'),0)::bigint,p.amount_cents,p.paid_at
 from public.seller_referrals r
 join auth.users u on u.id=r.referrer_id
 join public.payment_transactions t on t.user_id=r.referred_id and t.provider='stripe' and t.status='approved'
  and t.occurred_at>=r.created_at and t.occurred_at<r.expires_at and coalesce(t.metadata->>'stripe_mode','live')='live'
  and t.occurred_at>=v_start and t.occurred_at<v_start+interval '1 month'
 left join public.referral_payouts p on p.referrer_id=r.referrer_id and p.month=v_start::date
 group by r.referrer_id,u.raw_user_meta_data,u.email,p.amount_cents,p.paid_at
 order by 5 desc;
end $$;

create or replace function public.admin_mark_referral_paid(p_referrer uuid,p_month date,p_amount_cents bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.is_dashboard_admin(),false) then raise exception 'ADMIN_REQUIRED';end if;
 if p_amount_cents is null or p_amount_cents<0 then raise exception 'INVALID_AMOUNT';end if;
 insert into public.referral_payouts(referrer_id,month,amount_cents,paid_by) values(p_referrer,date_trunc('month',p_month)::date,p_amount_cents,auth.uid())
 on conflict(referrer_id,month) do update set amount_cents=excluded.amount_cents,paid_at=now(),paid_by=excluded.paid_by;
end $$;

revoke all on function public.my_referral_code() from public,anon;
revoke all on function public.claim_referral(text) from public,anon;
revoke all on function public.my_referral_sales(timestamptz,timestamptz) from public,anon;
revoke all on function public.my_referral_summary() from public,anon;
revoke all on function public.admin_referral_month(date) from public,anon;
revoke all on function public.admin_mark_referral_paid(uuid,date,bigint) from public,anon;
grant execute on function public.my_referral_code() to authenticated;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.my_referral_sales(timestamptz,timestamptz) to authenticated;
grant execute on function public.my_referral_summary() to authenticated;
grant execute on function public.admin_referral_month(date) to authenticated;
grant execute on function public.admin_mark_referral_paid(uuid,date,bigint) to authenticated;
