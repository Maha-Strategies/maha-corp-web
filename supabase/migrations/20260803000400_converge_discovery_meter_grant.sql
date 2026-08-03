-- The last statement of schema drift, and an ordering artifact rather than a
-- decision anyone made.
--
-- agent_discovery_usage_daily is created in 20260802000100. The role-level
-- default privileges Supabase applies were only declared in 20260803000300,
-- so a database rebuilt from this tree creates the table before those defaults
-- exist and never grants DELETE, while Production granted it at creation time.
-- Every table created after the declaration matches in both.
--
-- Revoking rather than declaring, for the same reason the earlier audit
-- revoked: this is an append-only daily aggregate, its RPC only inserts and
-- increments, and nothing in the tree or the application deletes from it. It
-- would have been in 20260803000200 had it existed when that list was built.

revoke delete on table public.agent_discovery_usage_daily from service_role;
