-- Reserva de imposto e dados fiscais (preparação para IBS/CBS e split payment).
-- Nada aqui cobra, retém ou envia imposto: o dinheiro da venda continua indo inteiro para a
-- conta Stripe do vendedor. A reserva é só um cálculo exibido no Financeiro para o vendedor
-- separar o valor por conta própria. Os dados fiscais do produto ficam guardados para quando
-- o recolhimento na liquidação (split payment) for liberado pelos órgãos e pela Stripe.

-- Configuração fiscal da conta: regime e porcentagem a reservar (pontos-base, 0 a 10000).
create table if not exists public.seller_tax_settings(
 seller_id uuid primary key references auth.users(id) on delete cascade,
 tax_regime text not null default 'mei' check (tax_regime in ('mei','simples','presumido','real')),
 reserve_bps integer not null default 0 check (reserve_bps between 0 and 10000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

-- Dados fiscais por produto.
create table if not exists public.product_fiscal_profiles(
 product_id uuid primary key references public.products(id) on delete cascade,
 seller_id uuid not null references auth.users(id) on delete cascade,
 item_kind text not null default 'digital' check (item_kind in ('physical','digital','service','subscription')),
 fiscal_code text check (fiscal_code is null or fiscal_code ~ '^[0-9.]{1,20}$'),
 notes text check (notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create or replace function public.tax_touch_updated_at() returns trigger
language plpgsql set search_path=public,pg_temp as $$begin new.updated_at=now();return new;end$$;

drop trigger if exists seller_tax_settings_touch on public.seller_tax_settings;
create trigger seller_tax_settings_touch before update on public.seller_tax_settings for each row execute function public.tax_touch_updated_at();
drop trigger if exists product_fiscal_profiles_touch on public.product_fiscal_profiles;
create trigger product_fiscal_profiles_touch before update on public.product_fiscal_profiles for each row execute function public.tax_touch_updated_at();
drop trigger if exists product_fiscal_profiles_seller_immutable on public.product_fiscal_profiles;
create trigger product_fiscal_profiles_seller_immutable before update on public.product_fiscal_profiles for each row execute function public.catalog_seller_immutable();

alter table public.seller_tax_settings enable row level security;
alter table public.seller_tax_settings force row level security;
alter table public.product_fiscal_profiles enable row level security;
alter table public.product_fiscal_profiles force row level security;
revoke all on public.seller_tax_settings from anon;
revoke all on public.product_fiscal_profiles from anon;
grant select,insert,update on public.seller_tax_settings to authenticated;
grant select,insert,update,delete on public.product_fiscal_profiles to authenticated;
grant all on public.seller_tax_settings to service_role;
grant all on public.product_fiscal_profiles to service_role;

-- Configuração fiscal: o dono edita; a equipe com acesso ao financeiro só lê.
drop policy if exists seller_tax_settings_own on public.seller_tax_settings;
create policy seller_tax_settings_own on public.seller_tax_settings for all to authenticated
 using (seller_id=auth.uid()) with check (seller_id=auth.uid());
drop policy if exists seller_tax_settings_team_read on public.seller_tax_settings;
create policy seller_tax_settings_team_read on public.seller_tax_settings for select to authenticated
 using (public.team_can(seller_id,'finance.read'));

-- Dados fiscais do produto: dono e Administrador do catálogo, sempre presos a um produto da mesma conta.
drop policy if exists product_fiscal_profiles_write on public.product_fiscal_profiles;
create policy product_fiscal_profiles_write on public.product_fiscal_profiles for all to authenticated
 using (public.team_can(seller_id,'catalog.write') and exists(select 1 from public.products p where p.id=product_fiscal_profiles.product_id and p.seller_id=product_fiscal_profiles.seller_id))
 with check (public.team_can(seller_id,'catalog.write') and exists(select 1 from public.products p where p.id=product_fiscal_profiles.product_id and p.seller_id=product_fiscal_profiles.seller_id));
