-- E-mails ao próprio usuário (boas-vindas e verificação recebida) usam a mesma deduplicação.
alter table public.team_notifications drop constraint if exists team_notifications_kind_check;
alter table public.team_notifications add constraint team_notifications_kind_check check (kind in ('onboarding','kyc_submitted','welcome','kyc_received'));
