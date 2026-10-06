begin;
-- Retain existing Express identities; new independent sellers use the full dashboard.
alter table public.stripe_connected_accounts drop constraint stripe_connected_accounts_stripe_account_type_check;
alter table public.stripe_connected_accounts add constraint stripe_connected_accounts_stripe_account_type_check
 check (stripe_account_type in ('express','full'));
-- Private evidence for an explicit reconciliation, never automatic retries/reset.
alter table public.stripe_account_requests add column if not exists reconciliation_history jsonb not null default '[]';
notify pgrst, 'reload schema';
commit;
