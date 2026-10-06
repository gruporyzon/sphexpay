-- Preserve the reserved checkout presentation across timeouts and retries.
alter table public.stripe_checkout_orders
 add column checkout_ui_mode text not null default 'hosted'
 check (checkout_ui_mode in ('hosted','elements'));

comment on column public.stripe_checkout_orders.checkout_ui_mode is
 'Server-reserved payment presentation; never infer it from a retry request.';
