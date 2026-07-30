-- Expose the API-credit billing tables and RPCs to PostgREST after the
-- preceding migration. This is read by Supabase's API schema cache; without
-- it a correctly applied migration can still appear as PGRST205 to the
-- server-side readiness checker until the cache naturally refreshes.
notify pgrst, 'reload schema';
