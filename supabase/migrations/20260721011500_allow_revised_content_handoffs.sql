-- A revision supersedes the earlier handoff rather than deleting it. Keep that
-- audit history while allowing one current handoff for each private draft.
alter table public.content_publication_handoffs
  drop constraint if exists content_publication_handoffs_draft_id_key;

create unique index if not exists content_publication_handoffs_one_active_draft_idx
  on public.content_publication_handoffs (draft_id)
  where superseded_at is null;
