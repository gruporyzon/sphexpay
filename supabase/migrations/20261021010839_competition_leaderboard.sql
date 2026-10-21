-- Ranking de competição calculado das vendas reais (payment_transactions só recebe vendas live).
create table if not exists public.competitions (
 slug text primary key,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 target_cents bigint not null check (target_cents > 0),
 created_at timestamptz not null default now(),
 check (ends_at > starts_at)
);
alter table public.competitions enable row level security;
alter table public.competitions force row level security;
revoke all on public.competitions from public, anon, authenticated;
grant select on public.competitions to authenticated;
grant all on public.competitions to service_role;
create policy competitions_read on public.competitions for select to authenticated using (true);

insert into public.competitions(slug,starts_at,ends_at,target_cents)
values ('iphone-17-pro-max-2026','2026-09-01T00:00:00-03:00','2026-10-01T23:59:59-03:00',3000000)
on conflict (slug) do nothing;

create or replace function public.get_competition_leaderboard(p_competition_slug text)
returns table(user_id uuid,public_name text,avatar_url text,eligible_revenue_cents bigint,eligible_sales_count integer,target_reached_at timestamptz,last_eligible_sale_at timestamptz,audit_status text)
language sql stable security definer set search_path=public,pg_temp
as $$
 with c as (select * from public.competitions where slug=p_competition_slug),
 sales as (
  select t.user_id,t.amount_cents,coalesce(t.approved_at,t.occurred_at) as at
  from public.payment_transactions t, c
  where t.status='approved' and t.currency='BRL' and t.refunded_at is null and t.chargeback_at is null
   and coalesce(t.approved_at,t.occurred_at) between c.starts_at and c.ends_at
 ),
 running as (
  select s.*,sum(s.amount_cents) over (partition by s.user_id order by s.at,s.amount_cents rows unbounded preceding) as cumulative
  from sales s
 ),
 totals as (
  select r.user_id,sum(r.amount_cents)::bigint as revenue,count(*)::integer as sales_count,max(r.at) as last_at,
   min(r.at) filter (where r.cumulative >= (select target_cents from c)) as reached_at
  from running r group by r.user_id
 ),
 names as (
  select t.user_id,coalesce(nullif(trim(sp.display_name),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),'') as full_name,sp.avatar_url
  from totals t
  left join public.social_profiles sp on sp.user_id=t.user_id
  left join auth.users u on u.id=t.user_id
 )
 select t.user_id,
  case when length(n.full_name)<2 then 'Participante'
   when position(' ' in n.full_name)=0 then n.full_name
   else split_part(n.full_name,' ',1)||' '||left(reverse(split_part(reverse(n.full_name),' ',1)),1)||'.' end,
  n.avatar_url,t.revenue,t.sales_count,t.reached_at,t.last_at,'pending'::text
 from totals t join names n on n.user_id=t.user_id
 order by t.revenue desc,t.reached_at asc nulls last,t.last_at asc nulls last,t.user_id
 limit 100;
$$;
revoke all on function public.get_competition_leaderboard(text) from public,anon;
grant execute on function public.get_competition_leaderboard(text) to authenticated,service_role;
