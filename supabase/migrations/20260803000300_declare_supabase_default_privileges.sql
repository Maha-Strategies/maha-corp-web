-- Declares the privileges Supabase configures on a hosted project, so the
-- migration tree describes the live database instead of disagreeing with it.
--
-- The previous migration revoked table privileges that nothing uses, which is
-- still the right call: DELETE and UPDATE are gone from the append-only
-- ledgers, and the credit ledger and operator-action record are now immutable
-- by privilege rather than by convention.
--
-- What remains is a different object class and a different problem. Supabase
-- sets ALTER DEFAULT PRIVILEGES at the role level, so every future table,
-- routine, and sequence receives these grants automatically. Revoking them
-- object by object is a treadmill: the drift returns the moment anyone adds a
-- table, and the convergence gate would fail on work unrelated to it.
--
-- Declaring them is not a retreat from the security work. Row level security
-- covers every table, including content_page_draft_revisions which this series
-- fixed. The seven functions below all return trigger, and PostgREST does not
-- expose trigger-returning functions as RPC endpoints, so the anon grants on
-- them cannot be invoked over the API at all. Every function the application
-- does call through RPC is granted explicitly elsewhere in this tree and
-- revoked from public, anon, and authenticated there.
--
-- Statements are transcribed verbatim from the convergence check's output so
-- that the tree and the live database agree exactly.

-- Role-level defaults applied to every future object in this schema.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

-- Trigger functions created before this tree granted explicitly.
GRANT ALL ON FUNCTION public.record_agent_credential_issued() TO anon;
GRANT ALL ON FUNCTION public.record_agent_credential_issued() TO authenticated;
GRANT ALL ON FUNCTION public.record_agent_credential_issued() TO service_role;
GRANT ALL ON FUNCTION public.record_agent_credential_revoked() TO anon;
GRANT ALL ON FUNCTION public.record_agent_credential_revoked() TO authenticated;
GRANT ALL ON FUNCTION public.record_agent_credential_revoked() TO service_role;
GRANT ALL ON FUNCTION public.record_agent_credential_use() TO anon;
GRANT ALL ON FUNCTION public.record_agent_credential_use() TO authenticated;
GRANT ALL ON FUNCTION public.record_agent_credential_use() TO service_role;
GRANT ALL ON FUNCTION public.record_agent_inquiry_created() TO anon;
GRANT ALL ON FUNCTION public.record_agent_inquiry_created() TO authenticated;
GRANT ALL ON FUNCTION public.record_agent_inquiry_created() TO service_role;
GRANT ALL ON FUNCTION public.record_agent_inquiry_review() TO anon;
GRANT ALL ON FUNCTION public.record_agent_inquiry_review() TO authenticated;
GRANT ALL ON FUNCTION public.record_agent_inquiry_review() TO service_role;
GRANT ALL ON FUNCTION public.record_mps_audit_created() TO anon;
GRANT ALL ON FUNCTION public.record_mps_audit_created() TO authenticated;
GRANT ALL ON FUNCTION public.record_mps_audit_created() TO service_role;
GRANT ALL ON FUNCTION public.record_mps_audit_finished() TO anon;
GRANT ALL ON FUNCTION public.record_mps_audit_finished() TO authenticated;
GRANT ALL ON FUNCTION public.record_mps_audit_finished() TO service_role;
