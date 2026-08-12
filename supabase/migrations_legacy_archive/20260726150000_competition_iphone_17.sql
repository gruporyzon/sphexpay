-- Competição SphexPay. Aplicar depois das migrations base de autenticação.
-- Não contém dados financeiros demonstrativos nem declara vencedor.

create table if not exists public.competitions (
  id text primary key,
  slug text not null unique,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  target_cents bigint not null check (target_cents > 0),
  status text not null default 'upcoming' check (status in ('upcoming','active','ended','audit','finalized','paused')),
  rules_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.competition_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id text not null references public.competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  public_name text not null default 'Participante',
  avatar_url text,
  eligible_revenue_cents bigint not null default 0 check (eligible_revenue_cents >= 0),
  eligible_sales_count integer not null default 0 check (eligible_sales_count >= 0),
  target_reached_at timestamptz,
  qualifying_transaction_id text,
  last_eligible_sale_at timestamptz,
  audit_status text not null default 'pending' check (audit_status in ('pending','eligible','ineligible','approved')),
  audited_at timestamptz,
  audit_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id,user_id)
);

create table if not exists public.competition_events (
  id uuid primary key default gen_random_uuid(),
  competition_id text not null references public.competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id text not null,
  event_type text not null check (event_type in ('approved','cancelled','refunded','chargeback')),
  amount_cents bigint not null check (amount_cents >= 0),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (competition_id,transaction_id,event_type)
);

create table if not exists public.competition_rules_acceptance (
  competition_id text not null references public.competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rules_version text not null,
  accepted_at timestamptz not null default now(),
  primary key (competition_id,user_id,rules_version)
);

create index if not exists competition_participants_rank_idx on public.competition_participants(competition_id,eligible_revenue_cents desc,target_reached_at asc,last_eligible_sale_at asc);
create index if not exists competition_events_user_time_idx on public.competition_events(competition_id,user_id,occurred_at);

insert into public.competitions(id,slug,name,starts_at,ends_at,target_cents,status,rules_version)
values('iphone-17-pro-max-2026','iphone-17-pro-max-2026','Competição SphexPay','2026-09-01 00:00:00-03','2026-10-01 23:59:59-03',3000000,'upcoming','provisional-1')
on conflict (id) do update set slug=excluded.slug,name=excluded.name,starts_at=excluded.starts_at,ends_at=excluded.ends_at,target_cents=excluded.target_cents,rules_version=excluded.rules_version,updated_at=now();

alter table public.competitions enable row level security;
alter table public.competition_participants enable row level security;
alter table public.competition_events enable row level security;
alter table public.competition_rules_acceptance enable row level security;

revoke all on public.competitions,public.competition_participants,public.competition_events,public.competition_rules_acceptance from anon;
revoke insert,update,delete on public.competitions,public.competition_participants,public.competition_events from authenticated;
grant select on public.competitions to authenticated;
grant select on public.competition_participants to authenticated;
grant select,insert on public.competition_rules_acceptance to authenticated;
grant all on public.competitions,public.competition_participants,public.competition_events,public.competition_rules_acceptance to service_role;

drop policy if exists competitions_authenticated_read on public.competitions;
create policy competitions_authenticated_read on public.competitions for select to authenticated using (true);
drop policy if exists competition_participants_own_read on public.competition_participants;
create policy competition_participants_own_read on public.competition_participants for select to authenticated using (user_id=auth.uid());
drop policy if exists competition_acceptance_own_read on public.competition_rules_acceptance;
create policy competition_acceptance_own_read on public.competition_rules_acceptance for select to authenticated using (user_id=auth.uid());
drop policy if exists competition_acceptance_own_insert on public.competition_rules_acceptance;
create policy competition_acceptance_own_insert on public.competition_rules_acceptance for insert to authenticated with check (user_id=auth.uid());

create or replace function public.get_competition_leaderboard(p_competition_slug text)
returns table(user_id uuid,public_name text,avatar_url text,eligible_revenue_cents bigint,eligible_sales_count integer,target_reached_at timestamptz,last_eligible_sale_at timestamptz,audit_status text)
language sql stable security definer set search_path=public,pg_temp
as $$
  select p.user_id,
    case when length(trim(p.public_name))<2 then 'Participante' else split_part(trim(p.public_name),' ',1)||' '||left(reverse(split_part(reverse(trim(p.public_name)),' ',1)),1)||'.' end,
    p.avatar_url,p.eligible_revenue_cents,p.eligible_sales_count,p.target_reached_at,p.last_eligible_sale_at,p.audit_status
  from public.competition_participants p
  join public.competitions c on c.id=p.competition_id
  where c.slug=p_competition_slug and p.audit_status<>'ineligible'
  order by p.eligible_revenue_cents desc,p.target_reached_at asc nulls last,p.last_eligible_sale_at asc nulls last,p.user_id
  limit 100;
$$;
revoke all on function public.get_competition_leaderboard(text) from public,anon;
grant execute on function public.get_competition_leaderboard(text) to authenticated,service_role;

-- Ingestão somente server-side. O primeiro target_reached_at nunca é regravado automaticamente.
create or replace function public.record_competition_event(p_competition_id text,p_user_id uuid,p_transaction_id text,p_event_type text,p_amount_cents bigint,p_occurred_at timestamptz,p_public_name text default 'Participante')
returns void language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_target bigint;v_total bigint;v_count integer;
begin
  if auth.role()<>'service_role' then raise exception using message='SERVICE_ROLE_REQUIRED'; end if;
  insert into public.competition_events(competition_id,user_id,transaction_id,event_type,amount_cents,occurred_at)
  values(p_competition_id,p_user_id,p_transaction_id,p_event_type,p_amount_cents,p_occurred_at)
  on conflict do nothing;
  select c.target_cents into v_target from public.competitions c where c.id=p_competition_id;
  select coalesce(sum(case when e.event_type='approved' and not exists(select 1 from public.competition_events x where x.competition_id=e.competition_id and x.transaction_id=e.transaction_id and x.event_type in ('cancelled','refunded','chargeback')) then e.amount_cents else 0 end),0),
    count(distinct e.transaction_id) filter(where e.event_type='approved' and not exists(select 1 from public.competition_events x where x.competition_id=e.competition_id and x.transaction_id=e.transaction_id and x.event_type in ('cancelled','refunded','chargeback')))
  into v_total,v_count from public.competition_events e where e.competition_id=p_competition_id and e.user_id=p_user_id;
  insert into public.competition_participants(competition_id,user_id,public_name,eligible_revenue_cents,eligible_sales_count,last_eligible_sale_at)
  values(p_competition_id,p_user_id,p_public_name,v_total,v_count,p_occurred_at)
  on conflict(competition_id,user_id) do update set eligible_revenue_cents=v_total,eligible_sales_count=v_count,last_eligible_sale_at=greatest(competition_participants.last_eligible_sale_at,p_occurred_at),updated_at=now();
  update public.competition_participants set target_reached_at=p_occurred_at,qualifying_transaction_id=p_transaction_id,updated_at=now()
  where competition_id=p_competition_id and user_id=p_user_id and target_reached_at is null and v_total>=v_target and p_event_type='approved';
end;
$$;
revoke all on function public.record_competition_event(text,uuid,text,text,bigint,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_competition_event(text,uuid,text,text,bigint,timestamptz,text) to service_role;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='competition_participants') then
    alter publication supabase_realtime add table public.competition_participants;
  end if;
end $$;
