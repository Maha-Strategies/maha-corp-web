-- Server routes run as service_role and have relied on hosted Supabase's
-- implicit default privileges. Local/self-hosted images ship stricter defaults
-- (no DML for service_role), which 42501s every route. Make the required
-- access explicit so the schema does not depend on platform defaults.
-- No table needs DELETE: events and ledgers are append-only, and state
-- transitions are updates.

grant usage on schema public to service_role;

-- Registry: clients and credentials transition status; event logs are append-only.
grant select, insert, update on table public.agent_clients to service_role;
grant select, insert, update on table public.agent_client_credentials to service_role;
grant select, insert on table public.agent_credential_events to service_role;
grant select, insert, update on table public.agent_credential_rate_windows to service_role;

-- Inquiries: review status changes; event log append-only.
grant select, insert, update on table public.agent_inquiries to service_role;
grant select, insert on table public.agent_inquiry_events to service_role;

-- MPS audits: job status transitions; event log append-only.
grant select, insert, update on table public.agent_mps_audits to service_role;
grant select, insert on table public.agent_mps_audit_events to service_role;

-- OAuth: codes are marked used, tokens rotated or revoked in place.
grant select, insert, update on table public.mcp_oauth_clients to service_role;
grant select, insert, update on table public.mcp_oauth_authorization_codes to service_role;
grant select, insert, update on table public.mcp_oauth_access_tokens to service_role;
grant select, insert, update on table public.mcp_oauth_refresh_tokens to service_role;

-- Commerce: checkouts and webhook events transition status; the credit ledger
-- and operator actions are append-only by design.
grant select, insert, update on table public.mps_credit_checkouts to service_role;
grant select, insert on table public.mps_credit_ledger_entries to service_role;
grant select, insert on table public.mps_operator_actions to service_role;
grant select, insert, update on table public.mps_preflight_orders to service_role;
grant select, insert, update on table public.mps_receipts to service_role;
grant select, insert, update on table public.stripe_webhook_events to service_role;

-- Public audit demo: usage counters are upserted; event log append-only.
grant select, insert on table public.mps_public_audit_events to service_role;
grant select, insert, update on table public.mps_public_audit_usage to service_role;
grant select, insert on table public.mps_usage_events to service_role;

-- Match hosted behavior for tables created by future migrations so a platform
-- default change can never reintroduce the outage. New tables still narrow
-- their own grants explicitly when they need less.
alter default privileges for role postgres in schema public
  grant select, insert, update on tables to service_role;
