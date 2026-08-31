-- The public evidence-audit form is a separate, allow-listed human intake
-- surface. The application has always normalized its source path, but the
-- original attribution migration only permitted /contact and rejected an
-- otherwise valid, Turnstile-verified audit submission at insert time.

alter table public.inbound_submissions
  drop constraint if exists inbound_submissions_source_path_check;

alter table public.inbound_submissions
  add constraint inbound_submissions_source_path_check
    check (source_path in ('/contact', '/evidence-audit'));
