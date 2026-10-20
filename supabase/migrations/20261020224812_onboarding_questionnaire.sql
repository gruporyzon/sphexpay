-- Questionário inicial da conta (5 etapas). Uma linha por usuário; respostas fechadas.
create table public.onboarding_responses (
 user_id uuid primary key references auth.users(id) on delete cascade,
 business_type text not null check (business_type in ('infoprodutos','loja_virtual','dropshipping','nutra','saas','servicos','produtos_fisicos','comecando')),
 segment text not null check (segment in ('saude','renda_extra','relacionamento','desenvolvimento_pessoal','beleza','financas','tecnologia','educacao','outros')),
 monthly_revenue text not null check (monthly_revenue in ('sem_faturamento','ate_10k','10k_50k','50k_100k','100k_500k','acima_500k')),
 goal text not null check (goal in ('comecar_a_vender','migrar_plataforma','aumentar_conversao','vender_exterior','gestao_financeira','outro')),
 acquisition_channel text not null check (acquisition_channel in ('instagram','google','youtube','facebook','indicacao','comunidade_evento','outro')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.onboarding_responses enable row level security;
alter table public.onboarding_responses force row level security;
revoke all on public.onboarding_responses from public, anon, authenticated;
grant select on public.onboarding_responses to authenticated;
grant insert (user_id,business_type,segment,monthly_revenue,goal,acquisition_channel) on public.onboarding_responses to authenticated;
grant update (business_type,segment,monthly_revenue,goal,acquisition_channel) on public.onboarding_responses to authenticated;
grant all on public.onboarding_responses to service_role;
create policy onboarding_responses_own_select on public.onboarding_responses for select to authenticated using (user_id = auth.uid());
create policy onboarding_responses_own_insert on public.onboarding_responses for insert to authenticated with check (user_id = auth.uid());
create policy onboarding_responses_own_update on public.onboarding_responses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace function public.onboarding_responses_touch() returns trigger language plpgsql set search_path = public as $$begin new.updated_at = now(); return new; end$$;
create trigger onboarding_responses_touch before update on public.onboarding_responses for each row execute function public.onboarding_responses_touch();

-- Registro interno dos avisos enviados à equipe (deduplicação). Só service_role.
create table public.team_notifications (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('onboarding','kyc_submitted')),
 ref text not null,
 sent_at timestamptz not null default now(),
 unique (kind, user_id, ref)
);
alter table public.team_notifications enable row level security;
alter table public.team_notifications force row level security;
revoke all on public.team_notifications from public, anon, authenticated;
grant all on public.team_notifications to service_role;
