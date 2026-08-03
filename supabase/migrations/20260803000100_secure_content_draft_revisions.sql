-- content_page_draft_revisions was created without row level security, alone
-- among the content tables. Its siblings content_page_drafts and
-- content_page_draft_events enable RLS and revoke anon/authenticated in the
-- same migration that creates them; this one was missed.
--
-- Supabase's default privileges then granted anon and authenticated DML on it,
-- which the schema-drift check surfaced. Nothing is currently exposed: the
-- REST endpoint rejects unauthenticated requests, and this application never
-- publishes an anon key. But the table holds unpublished editorial drafts and
-- is the single row of defence-in-depth missing across the whole tree, so a
-- future browser client or a leaked anon key would reach it while every
-- neighbouring table stayed protected.
--
-- Safe to apply: no application code reads or writes this table directly. It is
-- written only by revise_content_page_draft, which is security definer and so
-- runs as the function owner, unaffected by RLS.

alter table public.content_page_draft_revisions enable row level security;

revoke all on table public.content_page_draft_revisions from public, anon, authenticated;

grant select, insert on table public.content_page_draft_revisions to service_role;
