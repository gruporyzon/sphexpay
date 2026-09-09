-- READ ONLY. Replace the UUID with the authenticated SphexPay user's UUID.
-- Returns one row even when the connection is absent; account ID is masked.
with target_user as (
  select '00000000-0000-0000-0000-000000000000'::uuid as user_id
)
select
  c.user_id is not null as connection_found,
  case when c.stripe_account_id is not null
    then 'acct_…' || right(c.stripe_account_id, 6)
  end as account_reference,
  c.stripe_account_id ~ '^acct_[A-Za-z0-9]+$' as account_id_format_valid,
  c.stripe_account_type,
  c.stripe_onboarding_status,
  c.stripe_details_submitted,
  c.stripe_charges_enabled,
  c.stripe_payouts_enabled
from target_user t
left join public.stripe_connected_accounts c on c.user_id = t.user_id;
