create extension if not exists pgcrypto;

create table if not exists public.agent_inquiries (
  public_id text primary key check (public_id ~ '^inq_[a-f0-9]{32}$'),
  client_token_fingerprint text not null,
  client_request_id text not null,
  offer_id text not null check (offer_id in ('rapid-intelligence-brief', 'verified-research-brief')),
  requester_name text not null,
  requester_email text not null,
  requester_organization text,
  decision text not null,
  question text not null,
  deadline text,
  payload jsonb not null,
  payload_hash text not null check (payload_hash ~ '^sha256:[a-f0-9]{64}$'),
  status text not null default 'received' check (status in ('received', 'under_review', 'needs_clarification', 'declined', 'approved_for_scoping')),
  notification_status text not null default 'pending' check (notification_status in ('pending', 'sent', 'failed')),
  reviewer_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (client_token_fingerprint, client_request_id)
);

create table if not exists public.agent_inquiry_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id text not null references public.agent_inquiries(public_id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('agent', 'reviewer', 'system')),
  event_hash text not null check (event_hash ~ '^sha256:[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.record_agent_inquiry_created()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  insert into public.agent_inquiry_events (inquiry_id, event_type, actor_type, event_hash, metadata)
  values (
    new.public_id,
    'received',
    'agent',
    new.payload_hash,
    jsonb_build_object('offerId', new.offer_id, 'clientRequestId', new.client_request_id)
  );
  return new;
end;
$$;

create or replace function public.record_agent_inquiry_review()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if new.status is distinct from old.status or new.reviewer_note is distinct from old.reviewer_note then
    insert into public.agent_inquiry_events (inquiry_id, event_type, actor_type, event_hash, metadata)
    values (
      new.public_id,
      case new.status
        when 'under_review' then 'start_review'
        when 'needs_clarification' then 'needs_clarification'
        when 'declined' then 'decline'
        when 'approved_for_scoping' then 'approve_for_scoping'
        else 'review_update'
      end,
      'reviewer',
      'sha256:' || encode(digest(new.public_id || '|' || new.status || '|' || coalesce(new.reviewer_note, '') || '|' || new.updated_at::text, 'sha256'), 'hex'),
      jsonb_build_object('status', new.status, 'note', new.reviewer_note)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists agent_inquiry_created_event on public.agent_inquiries;
create trigger agent_inquiry_created_event
after insert on public.agent_inquiries
for each row execute function public.record_agent_inquiry_created();

drop trigger if exists agent_inquiry_review_event on public.agent_inquiries;
create trigger agent_inquiry_review_event
after update of status, reviewer_note on public.agent_inquiries
for each row execute function public.record_agent_inquiry_review();

create index if not exists agent_inquiries_status_created_at_idx on public.agent_inquiries (status, created_at desc);
create index if not exists agent_inquiry_events_inquiry_id_created_at_idx on public.agent_inquiry_events (inquiry_id, created_at asc);

alter table public.agent_inquiries enable row level security;
alter table public.agent_inquiry_events enable row level security;

-- No public policies: only the server-side Supabase service-role client accesses this ledger.
