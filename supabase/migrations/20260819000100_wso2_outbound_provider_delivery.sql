-- Approval-gated provider delivery for the bounded WSO2 partner campaign.
--
-- This migration prepares four reviewable drafts but sends nothing. Provider
-- delivery requires two separate operator actions in the application:
-- approving a draft, then confirming that exact draft's one-time send claim.

-- The original CRM constraint used a doubled backslash in a standard
-- PostgreSQL string, so ordinary addresses such as info@example.com were
-- rejected. Keep the application and database validators aligned without
-- relaxing the surrounding no-whitespace and single-@ requirements.
alter table public.outbound_prospects drop constraint if exists outbound_prospects_contact_email_check;
alter table public.outbound_prospects add constraint outbound_prospects_contact_email_check check (
  contact_email is null or contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
);

alter table public.outbound_crm_events drop constraint if exists outbound_crm_events_action_check;
alter table public.outbound_crm_events add constraint outbound_crm_events_action_check check (action in (
  'created','start_review','qualify','reject','draft_prepared','approve_draft',
  'record_manual_send','record_reply','mark_won','mark_lost',
  'provider_send_claimed','provider_sent','provider_failed'
));

create table if not exists public.outbound_email_deliveries (
  public_id text primary key check (public_id ~ '^outmail_[a-f0-9]{32}$'),
  prospect_id text not null references public.outbound_prospects(public_id) on delete restrict,
  draft_id text not null unique references public.outbound_outreach_drafts(public_id) on delete restrict,
  provider text not null check (provider in ('resend')),
  status text not null check (status in ('claimed','sent','failed')),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  provider_message_id text,
  failure_code text,
  claimed_at timestamptz not null,
  sent_at timestamptz,
  failed_at timestamptz
);

create index if not exists outbound_email_deliveries_prospect_idx on public.outbound_email_deliveries (prospect_id, claimed_at desc);
alter table public.outbound_email_deliveries enable row level security;
revoke all on table public.outbound_email_deliveries from public, anon, authenticated;
grant select, insert, update on table public.outbound_email_deliveries to service_role;

create or replace function public.claim_outbound_provider_send(
  p_delivery_id text,
  p_draft_id text,
  p_confirmation text,
  p_idempotency_hash text,
  p_actor_fingerprint text,
  p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d public.outbound_outreach_drafts%rowtype; p public.outbound_prospects%rowtype; existing public.outbound_email_deliveries%rowtype;
begin
  if p_delivery_id !~ '^outmail_[a-f0-9]{32}$' or p_draft_id !~ '^outdraft_[a-f0-9]{32}$'
    or p_confirmation <> 'SEND ' || p_draft_id
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid provider-send claim.' using errcode='22023'; end if;

  select * into d from public.outbound_outreach_drafts where public_id=p_draft_id for update;
  if not found then raise exception 'Outbound draft not found.' using errcode='P0002'; end if;
  select * into p from public.outbound_prospects where public_id=d.prospect_id for update;
  if d.status <> 'approved' or p.status <> 'approved' or p.contact_email is null then
    raise exception 'Only an approved draft with a reviewed recipient can be sent.' using errcode='P0001';
  end if;

  select * into existing from public.outbound_email_deliveries where draft_id=p_draft_id for update;
  if found then
    return jsonb_build_object('deliveryId',existing.public_id,'draftId',p_draft_id,'status',existing.status,'idempotentReplay',true);
  end if;

  insert into public.outbound_email_deliveries (public_id,prospect_id,draft_id,provider,status,idempotency_hash,claimed_at)
  values (p_delivery_id,p.public_id,p_draft_id,'resend','claimed',p_idempotency_hash,p_at);
  insert into public.outbound_crm_events (prospect_id,draft_id,action,idempotency_hash,actor_fingerprint,note,created_at)
  values (p.public_id,p_draft_id,'provider_send_claimed',p_idempotency_hash,p_actor_fingerprint,'One provider delivery was claimed after explicit draft confirmation.',p_at);
  return jsonb_build_object('deliveryId',p_delivery_id,'draftId',p_draft_id,'status','claimed','idempotentReplay',false);
end; $$;

create or replace function public.finalize_outbound_provider_send(
  p_delivery_id text,
  p_provider_message_id text,
  p_actor_fingerprint text,
  p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare delivery public.outbound_email_deliveries%rowtype;
begin
  if p_delivery_id !~ '^outmail_[a-f0-9]{32}$' or char_length(p_provider_message_id) not between 3 and 500
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid provider-send finalization.' using errcode='22023'; end if;
  select * into delivery from public.outbound_email_deliveries where public_id=p_delivery_id for update;
  if not found then raise exception 'Outbound delivery not found.' using errcode='P0002'; end if;
  if delivery.status='sent' then return jsonb_build_object('deliveryId',delivery.public_id,'status','sent','idempotentReplay',true); end if;
  if delivery.status<>'claimed' then raise exception 'Delivery is not claimable.' using errcode='P0001'; end if;

  update public.outbound_email_deliveries set status='sent',provider_message_id=p_provider_message_id,sent_at=p_at where public_id=p_delivery_id;
  update public.outbound_outreach_drafts set status='sent',sent_at=p_at where public_id=delivery.draft_id;
  update public.outbound_prospects set status='sent',updated_at=p_at where public_id=delivery.prospect_id;
  insert into public.outbound_crm_events (prospect_id,draft_id,action,idempotency_hash,actor_fingerprint,note,created_at)
  values (delivery.prospect_id,delivery.draft_id,'provider_sent',
    'sha256:' || encode(digest('provider-sent:' || delivery.public_id,'sha256'),'hex'),p_actor_fingerprint,
    'Provider accepted the approved email. No automatic follow-up was scheduled.',p_at);
  return jsonb_build_object('deliveryId',delivery.public_id,'status','sent','idempotentReplay',false);
end; $$;

create or replace function public.fail_outbound_provider_send(
  p_delivery_id text,
  p_failure_code text,
  p_actor_fingerprint text,
  p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare delivery public.outbound_email_deliveries%rowtype;
begin
  if p_delivery_id !~ '^outmail_[a-f0-9]{32}$' or p_failure_code !~ '^[a-z0-9_]{3,80}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid provider-send failure.' using errcode='22023'; end if;
  select * into delivery from public.outbound_email_deliveries where public_id=p_delivery_id for update;
  if not found then raise exception 'Outbound delivery not found.' using errcode='P0002'; end if;
  if delivery.status<>'claimed' then return jsonb_build_object('deliveryId',delivery.public_id,'status',delivery.status,'idempotentReplay',true); end if;
  update public.outbound_email_deliveries set status='failed',failure_code=p_failure_code,failed_at=p_at where public_id=p_delivery_id;
  insert into public.outbound_crm_events (prospect_id,draft_id,action,idempotency_hash,actor_fingerprint,note,created_at)
  values (delivery.prospect_id,delivery.draft_id,'provider_failed',
    'sha256:' || encode(digest('provider-failed:' || delivery.public_id,'sha256'),'hex'),p_actor_fingerprint,
    'Provider delivery failed closed. No automatic retry is permitted.',p_at);
  return jsonb_build_object('deliveryId',delivery.public_id,'status','failed','idempotentReplay',false);
end; $$;

revoke all on function public.claim_outbound_provider_send(text,text,text,text,text,timestamptz), public.finalize_outbound_provider_send(text,text,text,timestamptz), public.fail_outbound_provider_send(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.claim_outbound_provider_send(text,text,text,text,text,timestamptz), public.finalize_outbound_provider_send(text,text,text,timestamptz), public.fail_outbound_provider_send(text,text,text,timestamptz) to service_role;

-- Frozen, source-cited first cohort. These rows stop at draft_ready; the
-- migration does not approve or send them.
do $$
declare
  actor text := 'sha256:' || encode(digest('wso2-outreach-seed-v1','sha256'),'hex');
  p_id text; d_id text; created_hash text; review_hash text; qualify_hash text; draft_hash text;
  item record;
begin
  for item in select * from (values
    ('x-venture','X-Venture','https://www.x-venture.io/','info@x-venture.io','https://www.x-venture.io/services/wso2-partnership/',
     'X-Venture publicly describes itself as a WSO2 Global Implementation Partner with an existing unified Data, API and AI governance product, making technical complementarity and overlap directly testable.',
     'A bounded WSO2 AI Gateway evaluation',
     E'Hello X-Venture team,\n\nI am reaching out because X-Venture publicly describes deep WSO2 implementation experience and an existing unified Data, API and AI governance product. That makes you unusually well placed to assess whether Maha complements a real WSO2 deployment or merely duplicates existing controls.\n\nMaha has packaged a reproducible, bounded evaluation of a Context Compiler request interceptor for large RAG and document-analysis workloads. It compares baseline WSO2 AI Gateway, Prompt Compressor and Maha on provider-token cost, evidence retention, citations, latency and fail-closed behavior.\n\nThe public overview and reproduction path are here:\nhttps://www.mahastrategies.com/integrations/wso2\n\nWould one of your WSO2 architects be willing to review the evaluation boundary and identify one sanitized customer-shaped workload for a bounded pilot? We are not asking for a broad partnership commitment.\n\nIf this is not relevant, no response is needed and I will not continue contacting you.\n\nBest regards,\nMayone Rajan\nManaging Director, Maha Strategies LLC'),
    ('chakray-apac','Chakray APAC','https://chakray.com/','apac-info@chakray.com','https://chakray.com/technologies/wso2/',
     'Chakray publicly identifies as a longstanding WSO2 Platinum partner with certified experts across APAC and a Sri Lanka office, providing a credible path to a locally coordinated enterprise-shaped evaluation.',
     'A bounded context-control evaluation for a WSO2 workload',
     E'Hello Chakray APAC team,\n\nI am based in Sri Lanka and am reaching out because Chakray publicly describes longstanding WSO2 implementation experience, certified APAC expertise and work extending the platform for enterprise customers.\n\nMaha has packaged a reproducible, bounded evaluation of a Context Compiler request interceptor for large RAG and document-analysis workloads. It compares baseline WSO2 AI Gateway, Prompt Compressor and Maha on provider-token cost, evidence retention, citations, latency and fail-closed behavior.\n\nThe public overview and reproduction path are here:\nhttps://www.mahastrategies.com/integrations/wso2\n\nWould one of your WSO2 or AI Gateway architects be open to reviewing the configuration and, if the methodology is sound, suggesting one sanitized customer-shaped workload for a bounded pilot? This is a technical-validation request, not a request for a broad commercial commitment.\n\nIf this is not relevant, no response is needed and I will not continue contacting you.\n\nBest regards,\nMayone Rajan\nManaging Director, Maha Strategies LLC'),
    ('claria','Claria','https://www.claria.com/','info@claria.com','https://www.claria.com/technologies/wso2',
     'Claria publicly presents itself as an official WSO2 implementation partner combining integration, data governance, security and regulated-sector delivery, closely matching the evaluation use case.',
     'Reviewing a provenance-preserving WSO2 interceptor',
     E'Hello Claria team,\n\nI am reaching out because Claria publicly combines WSO2 implementation with data governance, security and regulated-sector delivery. That is closely aligned with the problem Maha is testing: reducing large model contexts while retaining source-linked evidence about what reached the model.\n\nMaha has packaged a reproducible, bounded Context Compiler evaluation for WSO2 AI Gateway. It compares baseline, Prompt Compressor and Maha on provider-token cost, evidence retention, citations, latency and fail-closed behavior.\n\nThe public overview and reproduction path are here:\nhttps://www.mahastrategies.com/integrations/wso2\n\nWould one of your architects be willing to review the evaluation boundary and determine whether a sanitized public-sector, claims, policy or document-analysis workload would make a useful bounded pilot? No customer data or installation commitment is required for the first review.\n\nIf this is not relevant, no response is needed and I will not continue contacting you.\n\nBest regards,\nMayone Rajan\nManaging Director, Maha Strategies LLC'),
    ('tellestia','Tellestia','https://tellestia.com/','info@tellestia.com','https://tellestia.com/contact-us/',
     'Tellestia publicly identifies as a certified WSO2 partner and describes an engagement model progressing from opportunity assessment to pilot and rollout, matching Maha''s bounded-evaluation approach.',
     'A bounded WSO2 AI Gateway pilot for large contexts',
     E'Hello Tellestia team,\n\nI am reaching out because Tellestia publicly describes a WSO2 engagement model that progresses from opportunity assessment to a pilot and then enterprise rollout. Maha has prepared a narrowly bounded evaluation that fits that sequence.\n\nThe evaluation tests a Context Compiler request interceptor for large RAG and document-analysis workloads. It compares baseline WSO2 AI Gateway, Prompt Compressor and Maha on provider-token cost, evidence retention, citations, latency and fail-closed behavior.\n\nThe public overview and one-command reproduction path are here:\nhttps://www.mahastrategies.com/integrations/wso2\n\nWould one of your WSO2 architects be willing to review the configuration and identify one sanitized customer-shaped workload that would make the pilot commercially meaningful? We would keep the first step technical and bounded.\n\nIf this is not relevant, no response is needed and I will not continue contacting you.\n\nBest regards,\nMayone Rajan\nManaging Director, Maha Strategies LLC')
  ) as cohort(slug,company,website,email,source_url,relevance,subject,body)
  loop
    p_id := 'prospect_' || md5('wso2-outreach:' || item.slug);
    d_id := 'outdraft_' || md5('wso2-outreach-draft:' || item.slug);
    created_hash := 'sha256:' || encode(digest('wso2-created:' || item.slug,'sha256'),'hex');
    review_hash := 'sha256:' || encode(digest('wso2-review:' || item.slug,'sha256'),'hex');
    qualify_hash := 'sha256:' || encode(digest('wso2-qualify:' || item.slug,'sha256'),'hex');
    draft_hash := 'sha256:' || encode(digest('wso2-draft:' || item.slug,'sha256'),'hex');

    insert into public.outbound_prospects (public_id,source_kind,source_reference,company_name,company_website,contact_email,contact_basis,offer_id,relevance_note,fit_score,status,reviewer_note)
    values (p_id,'manual',item.source_url,item.company,item.website,item.email,'public_business_contact','wso2-context-compiler-pilot',item.relevance,80,'draft_ready','Seeded for human review; no contact made.')
    on conflict (source_kind,source_reference,company_name) do nothing;

    if exists(select 1 from public.outbound_prospects where public_id=p_id) then
      insert into public.outbound_outreach_drafts (public_id,prospect_id,version,subject,body,status)
      values (d_id,p_id,1,item.subject,item.body,'draft') on conflict (public_id) do nothing;
      insert into public.outbound_crm_events (prospect_id,action,idempotency_hash,actor_fingerprint,note)
      values
        (p_id,'created',created_hash,actor,'Source-cited WSO2 prospect prepared. No contact was made.'),
        (p_id,'start_review',review_hash,actor,'Official WSO2 capability and public business contact reviewed.'),
        (p_id,'qualify',qualify_hash,actor,'Qualified only for a bounded technical evaluation request.'),
        (p_id,'draft_prepared',draft_hash,actor,'Editable draft prepared. It is not approved and cannot send.')
      on conflict (prospect_id,idempotency_hash) do nothing;
    end if;
  end loop;
end $$;
