-- Refresh the PostgREST schema cache after the content handoff revision added
-- `superseded_at`. This affects only API metadata; it does not alter content.
notify pgrst, 'reload schema';
