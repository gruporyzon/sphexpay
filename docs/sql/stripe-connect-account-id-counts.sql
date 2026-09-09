-- Read only: aggregate counts, without exposing account IDs.
select
  count(*) as total,
  count(*) filter (
    where stripe_account_id ~ '^acct_[A-Za-z0-9]+$'
  ) as validos,
  count(*) filter (
    where (stripe_account_id ~ '^acct_[A-Za-z0-9]+$') is not true
  ) as invalidos
from public.stripe_connected_accounts;
