-- A decisão e o aviso são gravados na mesma transação. Sem conteúdo de documentos,
-- motivos de rejeição, nome, endereço ou e-mail na fila. Somente service_role.
create table public.kyc_email_outbox (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 target text not null check (target in ('profile','document')),
 target_id uuid not null,
 decision text not null check (decision in ('approved','rejected','needs_more_info')),
 reviewed_at timestamptz not null,
 status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 unique(target,target_id,decision,reviewed_at),
 check(target <> 'document' or decision <> 'needs_more_info')
);
alter table public.kyc_email_outbox enable row level security;
alter table public.kyc_email_outbox force row level security;
revoke all on public.kyc_email_outbox from public, anon, authenticated;
grant all on public.kyc_email_outbox to service_role;
create index kyc_email_outbox_pending_idx on public.kyc_email_outbox(available_at) where status in ('pending','processing');

-- A função de análise já é a única responsável por aprovar/rejeitar. Este trigger
-- não altera decisões nem permissões. Não gera envios retroativos.
create function public.enqueue_kyc_email() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
 if new.status is distinct from old.status and new.reviewed_at is not null
  and new.status in ('approved','rejected','needs_more_info') then
  insert into public.kyc_email_outbox(user_id,target,target_id,decision,reviewed_at)
  values(new.user_id,case when tg_table_name='kyc_documents' then 'document' else 'profile' end,
   case when tg_table_name='kyc_documents' then (to_jsonb(new)->>'id')::uuid else new.user_id end,
   new.status,new.reviewed_at)
  on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.enqueue_kyc_email() from public, anon, authenticated;
create trigger kyc_profile_email after update on public.kyc_profiles for each row execute function public.enqueue_kyc_email();
create trigger kyc_document_email after update on public.kyc_documents for each row execute function public.enqueue_kyc_email();

-- Lease de 2 minutos: um worker interrompido não perde o aviso. Até 8 tentativas.
create function public.claim_kyc_emails(p_limit integer default 5)
returns setof public.kyc_email_outbox language sql security invoker set search_path = public as $$
 update public.kyc_email_outbox q set status='processing',attempts=q.attempts+1,available_at=now()+interval '2 minutes'
 where q.id in (select id from public.kyc_email_outbox where status in ('pending','processing') and available_at<=now() and attempts<8 and created_at>now()-interval '23 hours' order by created_at for update skip locked limit least(greatest(p_limit,1),10))
 returning q.*;
$$;
revoke all on function public.claim_kyc_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_kyc_emails(integer) to service_role;
