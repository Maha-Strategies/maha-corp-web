-- Archived drafts can be restored by a human operator. Restoring never
-- republishes content; it returns the draft to private editorial review.

alter table public.content_page_draft_events drop constraint if exists content_page_draft_events_action_check;
alter table public.content_page_draft_events add constraint content_page_draft_events_action_check check (action in ('composed','revise','mark_editorial_ready','archive','restore'));

create or replace function public.operate_content_page_draft(
  p_draft_id text, p_action text, p_note text, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_draft public.content_page_drafts%rowtype; v_status text;
begin
  if p_draft_id !~ '^contentdraft_[a-f0-9]{32}$' or p_action not in ('mark_editorial_ready','archive','restore')
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
    or (p_note is not null and char_length(p_note) > 2000)
  then raise exception 'Invalid content draft operation.' using errcode='22023'; end if;
  select * into v_draft from public.content_page_drafts where public_id=p_draft_id for update;
  if not found then raise exception 'Content draft not found.' using errcode='P0002'; end if;
  if exists(select 1 from public.content_page_draft_events where draft_id=p_draft_id and idempotency_hash=p_idempotency_hash) then return jsonb_build_object('draftId',p_draft_id,'status',v_draft.status,'idempotentReplay',true); end if;
  v_status := case p_action when 'mark_editorial_ready' then 'editorial_ready' when 'restore' then 'draft' else 'archived' end;
  if not ((p_action='mark_editorial_ready' and v_draft.status='draft') or (p_action='archive' and v_draft.status in ('draft','editorial_ready')) or (p_action='restore' and v_draft.status='archived')) then raise exception 'Operation is not allowed for the current draft state.' using errcode='P0001'; end if;
  insert into public.content_page_draft_events (draft_id,action,idempotency_hash,actor_fingerprint,note,created_at) values (p_draft_id,p_action,p_idempotency_hash,p_actor_fingerprint,nullif(p_note,''),p_at);
  update public.content_page_drafts set status=v_status, reviewer_note=nullif(p_note,''), updated_at=p_at where public_id=p_draft_id;
  return jsonb_build_object('draftId',p_draft_id,'status',v_status,'idempotentReplay',false);
end;
$$;
