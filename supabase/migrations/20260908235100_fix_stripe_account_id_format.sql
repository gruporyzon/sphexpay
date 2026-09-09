-- Correct the remote CHECK regex containing a newline and trailing spaces.
-- One atomic statement: validation failure preserves the previous constraint.
-- Re-running this statement leaves the same definition. No rows are modified.
alter table public.stripe_connected_accounts
  drop constraint if exists stripe_connected_accounts_account_id_format,
  add constraint stripe_connected_accounts_account_id_format
    check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$');
