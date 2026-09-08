-- Módulo de recebimento de documentos / KYC do merchant (cadastro e onboarding).
--
-- Objetivos:
--   1. Registro de cadastro por merchant (public.kyc_profiles) com status
--      draft -> pending -> approved | rejected | needs_more_info.
--   2. Documentos enviados (public.kyc_documents) referenciando objetos em um
--      bucket privado 'kyc-documents'. Nenhum binário fica em tabela.
--   3. RLS: o merchant enxerga e edita apenas o próprio cadastro; a transição
--      para 'pending' só acontece via RPC public.kyc_submit(); aprovação/reprovação
--      só por admin (is_dashboard_admin) ou service_role (endpoint /api/kyc/*).
--   4. Classificação de dados registrada como COMMENT (ver docs/DATA-CLASSIFICATION.md).
--
-- Idempotente. Aplicar depois de 20260908120000_security_hardening.sql.

set check_function_bodies = false;

-- =====================================================================
-- 1. Cadastro do merchant
-- =====================================================================

create table if not exists public.kyc_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  person_type text not null default 'individual' check (person_type in ('individual','company')),
  legal_name text check (legal_name is null or length(trim(legal_name)) between 2 and 180),
  tax_id text check (tax_id is null or tax_id ~ '^[0-9]{11}$' or tax_id ~ '^[0-9]{14}$'),
  company_name text check (company_name is null or length(trim(company_name)) between 2 and 180),
  trade_name text check (trade_name is null or length(trim(trade_name)) <= 180),
  birth_date date check (birth_date is null or birth_date between date '1900-01-01' and date '2012-12-31'),
  phone text check (phone is null or length(trim(phone)) between 8 and 20),
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected','needs_more_info')),
  rejection_reason text check (rejection_reason is null or length(rejection_reason) <= 2000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.kyc_profiles is
  'Confidencial. Cadastro/KYC do merchant: nome legal, CPF/CNPJ, endereço, status de aprovação. Acesso: dono via RLS (select/insert/update de dados); transição para pending só via RPC kyc_submit(); aprovação/reprovação só admin ou service_role. Nunca contém PAN/CVV/tarja.';

create index if not exists kyc_profiles_status_idx on public.kyc_profiles (status, submitted_at desc nulls last);

-- =====================================================================
-- 2. Documentos enviados
-- =====================================================================

create table if not exists public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'identity_front','identity_back','proof_of_address',
    'company_registration','company_tax_card','representative_document'
  )),
  storage_path text not null check (length(storage_path) between 3 and 400),
  original_filename text check (original_filename is null or length(original_filename) <= 300),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','application/pdf')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text check (rejection_reason is null or length(rejection_reason) <= 2000),
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint kyc_documents_user_doc_type_key unique (user_id, doc_type)
);

comment on table public.kyc_documents is
  'Restrito. Metadados de documentos de identificação do merchant (RG/CNH, comprovante de endereço, contrato social). O binário fica no bucket privado kyc-documents; aqui só path + status. Acesso: dono via RLS (select); leitura do arquivo por admin apenas via URL assinada gerada no servidor.';

create index if not exists kyc_documents_user_idx on public.kyc_documents (user_id, uploaded_at desc);

-- =====================================================================
-- 3. Bucket privado para os arquivos
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc-documents', 'kyc-documents', false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- =====================================================================
-- 4. RLS e privilégios
-- =====================================================================

alter table public.kyc_profiles enable row level security;
alter table public.kyc_profiles force row level security;
alter table public.kyc_documents enable row level security;
alter table public.kyc_documents force row level security;

revoke all on public.kyc_profiles from anon;
revoke all on public.kyc_documents from anon;
grant select, insert, update on public.kyc_profiles to authenticated;
grant select on public.kyc_documents to authenticated;
grant all on public.kyc_profiles to service_role;
grant all on public.kyc_documents to service_role;

drop policy if exists kyc_profiles_own_select on public.kyc_profiles;
create policy kyc_profiles_own_select on public.kyc_profiles
  for select to authenticated using (user_id = auth.uid() or public.is_dashboard_admin());

drop policy if exists kyc_profiles_own_insert on public.kyc_profiles;
create policy kyc_profiles_own_insert on public.kyc_profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists kyc_profiles_own_update on public.kyc_profiles;
create policy kyc_profiles_own_update on public.kyc_profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_dashboard_admin())
  with check (user_id = auth.uid() or public.is_dashboard_admin());

drop policy if exists kyc_documents_own_select on public.kyc_documents;
create policy kyc_documents_own_select on public.kyc_documents
  for select to authenticated using (user_id = auth.uid() or public.is_dashboard_admin());

drop policy if exists kyc_documents_admin_write on public.kyc_documents;
create policy kyc_documents_admin_write on public.kyc_documents
  for update to authenticated
  using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

-- Objetos do bucket: dono lê/escreve a própria pasta (<user_id>/...); admin lê tudo.
drop policy if exists kyc_docs_read on storage.objects;
create policy kyc_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents'
    and (split_part(name, '/', 1) = auth.uid()::text or public.is_dashboard_admin()));

drop policy if exists kyc_docs_insert on storage.objects;
create policy kyc_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists kyc_docs_delete on storage.objects;
create policy kyc_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'kyc-documents' and split_part(name, '/', 1) = auth.uid()::text);

-- =====================================================================
-- 5. Guard: cliente não define status de análise por conta própria
-- =====================================================================

create or replace function public.kyc_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Admin (JWT app_metadata.role) e service_role (endpoint de análise) passam direto.
  if public.is_dashboard_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.submitted_at := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.rejection_reason := null;
    return new;
  end if;

  -- UPDATE pelo próprio merchant: colunas de análise são imutáveis pelo cliente.
  new.reviewed_at := old.reviewed_at;
  new.reviewed_by := old.reviewed_by;
  new.created_at := old.created_at;

  if coalesce(current_setting('sphex.kyc_submit', true), '') = '1'
     and old.status in ('draft', 'rejected', 'needs_more_info')
     and new.status = 'pending' then
    new.submitted_at := now();
    new.rejection_reason := null;
  else
    new.status := old.status;
    new.submitted_at := old.submitted_at;
    new.rejection_reason := old.rejection_reason;
  end if;

  return new;
end;
$$;

alter function public.kyc_profiles_guard() owner to postgres;

drop trigger if exists kyc_profiles_guard_trigger on public.kyc_profiles;
create trigger kyc_profiles_guard_trigger
  before insert or update on public.kyc_profiles
  for each row execute function public.kyc_profiles_guard();

create or replace function public.kyc_touch_updated_at()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter function public.kyc_touch_updated_at() owner to postgres;

drop trigger if exists kyc_profiles_touch on public.kyc_profiles;
create trigger kyc_profiles_touch
  before update on public.kyc_profiles
  for each row execute function public.kyc_touch_updated_at();

-- =====================================================================
-- 6. RPC de envio para análise (única forma de chegar em 'pending')
-- =====================================================================

create or replace function public.kyc_submit()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_profile public.kyc_profiles%rowtype;
  v_required text[];
  v_missing text[];
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_profile from public.kyc_profiles where user_id = auth.uid();
  if not found then
    raise exception using errcode = '22023', message = 'KYC_PROFILE_NOT_FOUND';
  end if;
  if v_profile.status = 'pending' then
    raise exception using errcode = '22023', message = 'KYC_ALREADY_SUBMITTED';
  end if;
  if v_profile.status = 'approved' then
    raise exception using errcode = '22023', message = 'KYC_ALREADY_APPROVED';
  end if;

  if coalesce(trim(v_profile.legal_name), '') = '' or coalesce(trim(v_profile.tax_id), '') = '' then
    raise exception using errcode = '22023', message = 'KYC_PROFILE_INCOMPLETE';
  end if;
  if v_profile.person_type = 'company' and coalesce(trim(v_profile.company_name), '') = '' then
    raise exception using errcode = '22023', message = 'KYC_PROFILE_INCOMPLETE';
  end if;

  v_required := case v_profile.person_type
    when 'individual' then array['identity_front', 'identity_back', 'proof_of_address']
    else array['company_registration', 'proof_of_address', 'representative_document']
  end;

  select array_agg(t) into v_missing
  from unnest(v_required) as t
  where t not in (select doc_type from public.kyc_documents where user_id = auth.uid());

  if v_missing is not null then
    raise exception using errcode = '22023', message = 'KYC_DOCUMENTS_MISSING';
  end if;

  perform set_config('sphex.kyc_submit', '1', true);
  update public.kyc_profiles
    set status = 'pending', submitted_at = now(), rejection_reason = null
    where user_id = auth.uid()
    returning * into v_profile;
  perform set_config('sphex.kyc_submit', '', true);

  insert into public.security_audit_log (actor_id, event_type, metadata)
  values (auth.uid(), 'kyc.submitted', jsonb_build_object('person_type', v_profile.person_type));

  return to_jsonb(v_profile);
end;
$$;

alter function public.kyc_submit() owner to postgres;
revoke all on function public.kyc_submit() from public;
grant execute on function public.kyc_submit() to authenticated;
grant execute on function public.kyc_submit() to service_role;
