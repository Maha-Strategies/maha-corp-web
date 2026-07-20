-- Private operating state for inbound submissions. It is deliberately separate
-- from qualification and from the revenue/payment ledger: a reviewer can refer
-- a buyer to an existing checkout, but only verified Stripe events move revenue.

alter table public.inbound_submissions
  add column if not exists operations_status text not null default 'new'
    check (operations_status in ('new','under_review','needs_clarification','approved_for_scoping','checkout_referred','declined','closed_lost')),
  add column if not exists reviewer_note text,
  add column if not exists reviewed_at timestamptz;

create table if not exists public.inbound_submission_operations_events (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null references public.inbound_submissions(public_id) on delete restrict,
  action text not null check (action in ('start_review','request_clarification','approve_for_scoping','refer_to_checkout','decline','close_lost')),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (submission_id, idempotency_hash)
);
create index if not exists inbound_submission_operations_queue_idx on public.inbound_submissions (operations_status, created_at asc);
create index if not exists inbound_submission_operations_events_idx on public.inbound_submission_operations_events (submission_id, created_at asc);
alter table public.inbound_submission_operations_events enable row level security;
revoke all on table public.inbound_submission_operations_events from public, anon, authenticated;
grant select, insert on table public.inbound_submission_operations_events to service_role;

create or replace function public.operate_inbound_submission(
  p_submission_id text, p_action text, p_note text, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_submission public.inbound_submissions%rowtype; v_status text; v_event public.inbound_submission_operations_events%rowtype;
begin
  if p_submission_id !~ '^inbound_[a-f0-9]{32}$' or p_action not in ('start_review','request_clarification','approve_for_scoping','refer_to_checkout','decline','close_lost')
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
    or (p_note is not null and char_length(p_note) > 2000) then raise exception 'Invalid inbound operation.' using errcode='22023'; end if;
  select * into v_submission from public.inbound_submissions where public_id=p_submission_id for update;
  if not found then raise exception 'Inbound submission not found.' using errcode='P0002'; end if;
  select * into v_event from public.inbound_submission_operations_events where submission_id=p_submission_id and idempotency_hash=p_idempotency_hash;
  if found then return jsonb_build_object('submissionId',p_submission_id,'status',v_submission.operations_status,'idempotentReplay',true); end if;
  v_status := case p_action
    when 'start_review' then 'under_review'
    when 'request_clarification' then 'needs_clarification'
    when 'approve_for_scoping' then 'approved_for_scoping'
    when 'refer_to_checkout' then 'checkout_referred'
    when 'decline' then 'declined'
    when 'close_lost' then 'closed_lost'
  end;
  if not (
    (p_action='start_review' and v_submission.operations_status in ('new','needs_clarification')) or
    (p_action='request_clarification' and v_submission.operations_status in ('new','under_review')) or
    (p_action='approve_for_scoping' and v_submission.operations_status='under_review') or
    (p_action='refer_to_checkout' and v_submission.operations_status in ('new','under_review','approved_for_scoping') and v_submission.offer_id in ('mps-prepaid-audit-access','mps-preflight','book-the-imagined-life','book-the-orbital-mind','book-the-synthetic-self','book-the-unfinished-species')) or
    (p_action in ('decline','close_lost') and v_submission.operations_status in ('new','under_review','needs_clarification','approved_for_scoping','checkout_referred'))
  ) then raise exception 'Operation is not allowed for the current inbound state.' using errcode='P0001'; end if;
  insert into public.inbound_submission_operations_events (submission_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_submission_id,p_action,p_idempotency_hash,p_actor_fingerprint,nullif(p_note,''),p_at);
  update public.inbound_submissions set operations_status=v_status, reviewer_note=nullif(p_note,''), reviewed_at=p_at, updated_at=p_at where public_id=p_submission_id;
  return jsonb_build_object('submissionId',p_submission_id,'status',v_status,'idempotentReplay',false);
end;
$$;
revoke all on function public.operate_inbound_submission(text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.operate_inbound_submission(text,text,text,text,text,timestamptz) to service_role;
