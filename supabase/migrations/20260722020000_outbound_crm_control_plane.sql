-- Private, human-operated outbound CRM. It stores contact details only for
-- explicitly reviewed business outreach. It has no email provider, no sending
-- function, and no authority to contact anyone.

create table if not exists public.outbound_prospects (
  public_id text primary key check (public_id ~ '^prospect_[a-f0-9]{32}$'),
  source_kind text not null check (source_kind in ('manual','market_opportunity','inbound_referral')),
  source_reference text not null check (char_length(source_reference) between 3 and 200),
  company_name text not null check (char_length(company_name) between 2 and 160),
  company_website text check (company_website is null or company_website ~ '^https://'),
  contact_name text check (contact_name is null or char_length(contact_name) between 2 and 120),
  contact_email text check (contact_email is null or contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'),
  contact_role text check (contact_role is null or char_length(contact_role) between 2 and 120),
  contact_basis text not null check (contact_basis in ('public_business_contact','prior_relationship','inbound_referral')),
  offer_id text not null check (offer_id ~ '^[a-z0-9][a-z0-9-]{2,100}$'),
  relevance_note text not null check (char_length(relevance_note) between 20 and 2000),
  fit_score integer not null check (fit_score between 0 and 100),
  status text not null default 'discovered' check (status in ('discovered','reviewing','qualified','rejected','draft_ready','approved','sent','replied','won','lost')),
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_kind, source_reference, company_name)
);

create table if not exists public.outbound_outreach_drafts (
  public_id text primary key check (public_id ~ '^outdraft_[a-f0-9]{32}$'),
  prospect_id text not null references public.outbound_prospects(public_id) on delete restrict,
  version integer not null check (version >= 1),
  subject text not null check (char_length(subject) between 3 and 160),
  body text not null check (char_length(body) between 40 and 5000),
  status text not null default 'draft' check (status in ('draft','approved','sent','replied','superseded')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz,
  unique (prospect_id, version)
);

create table if not exists public.outbound_crm_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id text not null references public.outbound_prospects(public_id) on delete restrict,
  draft_id text references public.outbound_outreach_drafts(public_id) on delete restrict,
  action text not null check (action in ('created','start_review','qualify','reject','draft_prepared','approve_draft','record_manual_send','record_reply','mark_won','mark_lost')),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (prospect_id, idempotency_hash)
);

create index if not exists outbound_prospects_status_score_idx on public.outbound_prospects (status, fit_score desc, created_at asc);
create index if not exists outbound_drafts_prospect_idx on public.outbound_outreach_drafts (prospect_id, version desc);
alter table public.outbound_prospects enable row level security;
alter table public.outbound_outreach_drafts enable row level security;
alter table public.outbound_crm_events enable row level security;
revoke all on table public.outbound_prospects, public.outbound_outreach_drafts, public.outbound_crm_events from public, anon, authenticated;
grant select, insert, update on table public.outbound_prospects, public.outbound_outreach_drafts to service_role;
grant select, insert on table public.outbound_crm_events to service_role;

create or replace function public.create_outbound_prospect(
  p_prospect_id text, p_source_kind text, p_source_reference text, p_company_name text, p_company_website text, p_contact_name text, p_contact_email text, p_contact_role text, p_contact_basis text, p_offer_id text, p_relevance_note text, p_fit_score integer, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_existing public.outbound_prospects%rowtype;
begin
  if p_prospect_id !~ '^prospect_[a-f0-9]{32}$' or p_source_kind not in ('manual','market_opportunity','inbound_referral') or char_length(p_source_reference) not between 3 and 200 or char_length(p_company_name) not between 2 and 160 or (p_company_website is not null and p_company_website !~ '^https://') or (p_contact_name is not null and char_length(p_contact_name) not between 2 and 120) or (p_contact_email is not null and p_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$') or (p_contact_role is not null and char_length(p_contact_role) not between 2 and 120) or p_contact_basis not in ('public_business_contact','prior_relationship','inbound_referral') or p_offer_id !~ '^[a-z0-9][a-z0-9-]{2,100}$' or char_length(p_relevance_note) not between 20 and 2000 or p_fit_score not between 0 and 100 or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null then raise exception 'Invalid outbound prospect.' using errcode='22023'; end if;
  select * into v_existing from public.outbound_prospects where source_kind=p_source_kind and source_reference=p_source_reference and company_name=p_company_name for update;
  if found then return jsonb_build_object('prospectId',v_existing.public_id,'status',v_existing.status,'idempotentReplay',true); end if;
  insert into public.outbound_prospects (public_id,source_kind,source_reference,company_name,company_website,contact_name,contact_email,contact_role,contact_basis,offer_id,relevance_note,fit_score,status,created_at,updated_at) values (p_prospect_id,p_source_kind,p_source_reference,p_company_name,nullif(p_company_website,''),nullif(p_contact_name,''),nullif(p_contact_email,''),nullif(p_contact_role,''),p_contact_basis,p_offer_id,p_relevance_note,p_fit_score,'discovered',p_at,p_at);
  insert into public.outbound_crm_events (prospect_id,action,idempotency_hash,actor_fingerprint,note,created_at) values (p_prospect_id,'created',p_idempotency_hash,p_actor_fingerprint,'Prospect recorded. No contact was made.',p_at);
  return jsonb_build_object('prospectId',p_prospect_id,'status','discovered','idempotentReplay',false);
end; $$;

create or replace function public.operate_outbound_prospect(p_prospect_id text,p_action text,p_note text,p_idempotency_hash text,p_actor_fingerprint text,p_at timestamptz) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.outbound_prospects%rowtype; v_status text;
begin
  if p_prospect_id !~ '^prospect_[a-f0-9]{32}$' or p_action not in ('start_review','qualify','reject') or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null or (p_note is not null and char_length(p_note)>2000) then raise exception 'Invalid outbound operation.' using errcode='22023'; end if;
  select * into v from public.outbound_prospects where public_id=p_prospect_id for update;
  if not found then raise exception 'Outbound prospect not found.' using errcode='P0002'; end if;
  if exists(select 1 from public.outbound_crm_events where prospect_id=p_prospect_id and idempotency_hash=p_idempotency_hash) then return jsonb_build_object('prospectId',p_prospect_id,'status',v.status,'idempotentReplay',true); end if;
  v_status:=case p_action when 'start_review' then 'reviewing' when 'qualify' then 'qualified' else 'rejected' end;
  if not ((p_action='start_review' and v.status='discovered') or (p_action in ('qualify','reject') and v.status='reviewing')) then raise exception 'Operation is not allowed for the current prospect state.' using errcode='P0001'; end if;
  insert into public.outbound_crm_events (prospect_id,action,idempotency_hash,actor_fingerprint,note,created_at) values (p_prospect_id,p_action,p_idempotency_hash,p_actor_fingerprint,nullif(p_note,''),p_at);
  update public.outbound_prospects set status=v_status,reviewer_note=nullif(p_note,''),updated_at=p_at where public_id=p_prospect_id;
  return jsonb_build_object('prospectId',p_prospect_id,'status',v_status,'idempotentReplay',false);
end; $$;

create or replace function public.create_outbound_outreach_draft(p_draft_id text,p_prospect_id text,p_subject text,p_body text,p_idempotency_hash text,p_actor_fingerprint text,p_at timestamptz) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.outbound_prospects%rowtype; v_version integer;
begin
  if p_draft_id !~ '^outdraft_[a-f0-9]{32}$' or p_prospect_id !~ '^prospect_[a-f0-9]{32}$' or char_length(p_subject) not between 3 and 160 or char_length(p_body) not between 40 and 5000 or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null then raise exception 'Invalid outreach draft.' using errcode='22023'; end if;
  select * into v from public.outbound_prospects where public_id=p_prospect_id for update;
  if not found then raise exception 'Outbound prospect not found.' using errcode='P0002'; end if;
  if v.status not in ('qualified','draft_ready') then raise exception 'A prospect must be qualified before drafting.' using errcode='P0001'; end if;
  if exists(select 1 from public.outbound_crm_events where prospect_id=p_prospect_id and idempotency_hash=p_idempotency_hash) then return jsonb_build_object('prospectId',p_prospect_id,'status',v.status,'idempotentReplay',true); end if;
  update public.outbound_outreach_drafts set status='superseded' where prospect_id=p_prospect_id and status='draft';
  select coalesce(max(version),0)+1 into v_version from public.outbound_outreach_drafts where prospect_id=p_prospect_id;
  insert into public.outbound_outreach_drafts (public_id,prospect_id,version,subject,body,status,created_at) values (p_draft_id,p_prospect_id,v_version,p_subject,p_body,'draft',p_at);
  insert into public.outbound_crm_events (prospect_id,draft_id,action,idempotency_hash,actor_fingerprint,note,created_at) values (p_prospect_id,p_draft_id,'draft_prepared',p_idempotency_hash,p_actor_fingerprint,'Draft prepared; it cannot send.',p_at);
  update public.outbound_prospects set status='draft_ready',updated_at=p_at where public_id=p_prospect_id;
  return jsonb_build_object('prospectId',p_prospect_id,'draftId',p_draft_id,'status','draft_ready','idempotentReplay',false);
end; $$;

create or replace function public.operate_outbound_outreach_draft(p_draft_id text,p_action text,p_note text,p_idempotency_hash text,p_actor_fingerprint text,p_at timestamptz) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d public.outbound_outreach_drafts%rowtype; v public.outbound_prospects%rowtype; v_status text;
begin
  if p_draft_id !~ '^outdraft_[a-f0-9]{32}$' or p_action not in ('approve_draft','record_manual_send','record_reply','mark_won','mark_lost') or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null or (p_note is not null and char_length(p_note)>2000) then raise exception 'Invalid outreach operation.' using errcode='22023'; end if;
  select * into d from public.outbound_outreach_drafts where public_id=p_draft_id for update;
  if not found then raise exception 'Outbound draft not found.' using errcode='P0002'; end if;
  select * into v from public.outbound_prospects where public_id=d.prospect_id for update;
  if exists(select 1 from public.outbound_crm_events where prospect_id=v.public_id and idempotency_hash=p_idempotency_hash) then return jsonb_build_object('prospectId',v.public_id,'status',v.status,'idempotentReplay',true); end if;
  v_status:=case p_action when 'approve_draft' then 'approved' when 'record_manual_send' then 'sent' when 'record_reply' then 'replied' when 'mark_won' then 'won' else 'lost' end;
  if not ((p_action='approve_draft' and d.status='draft' and v.status='draft_ready') or (p_action='record_manual_send' and d.status='approved' and v.status='approved') or (p_action='record_reply' and d.status='sent' and v.status='sent') or (p_action in ('mark_won','mark_lost') and d.status in ('sent','replied') and v.status in ('sent','replied'))) then raise exception 'Operation is not allowed for the current draft state.' using errcode='P0001'; end if;
  insert into public.outbound_crm_events (prospect_id,draft_id,action,idempotency_hash,actor_fingerprint,note,created_at) values (v.public_id,p_draft_id,p_action,p_idempotency_hash,p_actor_fingerprint,nullif(p_note,''),p_at);
  update public.outbound_outreach_drafts set status=case when p_action='approve_draft' then 'approved' when p_action='record_manual_send' then 'sent' when p_action='record_reply' then 'replied' else status end,approved_at=case when p_action='approve_draft' then p_at else approved_at end,sent_at=case when p_action='record_manual_send' then p_at else sent_at end where public_id=p_draft_id;
  update public.outbound_prospects set status=v_status,reviewer_note=nullif(p_note,''),updated_at=p_at where public_id=v.public_id;
  return jsonb_build_object('prospectId',v.public_id,'draftId',p_draft_id,'status',v_status,'idempotentReplay',false);
end; $$;

revoke all on function public.create_outbound_prospect(text,text,text,text,text,text,text,text,text,text,text,integer,text,text,timestamptz), public.operate_outbound_prospect(text,text,text,text,text,timestamptz), public.create_outbound_outreach_draft(text,text,text,text,text,text,timestamptz), public.operate_outbound_outreach_draft(text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_outbound_prospect(text,text,text,text,text,text,text,text,text,text,text,integer,text,text,timestamptz), public.operate_outbound_prospect(text,text,text,text,text,timestamptz), public.create_outbound_outreach_draft(text,text,text,text,text,text,timestamptz), public.operate_outbound_outreach_draft(text,text,text,text,text,timestamptz) to service_role;
