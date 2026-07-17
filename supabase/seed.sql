-- Local development seed. Applied only by `supabase db reset`; never runs in production.

-- Parity with hosted Supabase, where service_role receives full DML on public
-- tables through default privileges. The local supabase/postgres image ships
-- stricter defaults (no DML for service_role), which would 42501 every route.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

-- Deterministic verification fixtures: one active client with a prepaid
-- credential, a paid checkout, and a 10-credit purchase grant.
insert into public.agent_clients (public_id, display_name, status)
values ('client_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'localtest@mahastrategies.com', 'active')
on conflict (public_id) do nothing;

insert into public.agent_client_credentials
  (public_id, client_id, label, secret_hash, secret_prefix, allowed_offer_ids, allowed_capabilities,
   rate_limit_per_hour, expires_at, status, billing_mode)
values
  ('cred_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'client_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
   'Local verification credential',
   repeat('b', 64), 'mhaic_seed0001',
   array['rapid-intelligence-brief'], array['mps_audit'],
   12, now() + interval '1 year', 'active', 'prepaid')
on conflict (public_id) do nothing;

insert into public.mps_credit_checkouts
  (public_id, client_id, credential_id, request_hash, stripe_checkout_session_id,
   stripe_payment_intent_id, stripe_payment_amount, stripe_payment_currency,
   stripe_price_id, credit_quantity, status, paid_at)
values
  ('credit_checkout_cccccccccccccccccccccccccccccccc', 'client_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
   'cred_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'sha256:' || repeat('c', 64),
   'cs_test_localseed001', 'pi_localseed001', 4900, 'usd',
   'price_LocalSeed123', 10, 'paid', now())
on conflict (public_id) do nothing;

insert into public.mps_credit_ledger_entries
  (public_id, client_id, checkout_id, entry_type, unit, quantity, source_type, source_id, event_hash, metadata)
values
  ('credit_dddddddddddddddddddddddddddddddd', 'client_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
   'credit_checkout_cccccccccccccccccccccccccccccccc', 'purchase_grant', 'mps_audit_invocation', 10,
   'stripe_checkout_session', 'cs_test_localseed001', 'sha256:' || repeat('d', 64),
   '{"seed": "local-verification"}'::jsonb)
on conflict (public_id) do nothing;
