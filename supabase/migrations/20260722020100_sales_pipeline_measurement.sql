-- Explicit human-recorded bridge between private outbound work and the existing
-- revenue opportunity ledger. No heuristic or model may create this link.

create table if not exists public.outbound_revenue_attributions (
  prospect_id text primary key references public.outbound_prospects(public_id) on delete restrict,
  opportunity_id text not null unique references public.revenue_opportunities(public_id) on delete restrict,
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now()
);
alter table public.outbound_revenue_attributions enable row level security;
revoke all on table public.outbound_revenue_attributions from public, anon, authenticated;
grant select, insert on table public.outbound_revenue_attributions to service_role;

create or replace function public.link_outbound_prospect_to_revenue_opportunity(
  p_prospect_id text, p_opportunity_id text, p_note text, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_prospect public.outbound_prospects%rowtype;
begin
  if p_prospect_id !~ '^prospect_[a-f0-9]{32}$' or p_opportunity_id !~ '^revopp_[a-f0-9]{32}$' or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null or (p_note is not null and char_length(p_note)>2000) then raise exception 'Invalid pipeline attribution.' using errcode='22023'; end if;
  select * into v_prospect from public.outbound_prospects where public_id=p_prospect_id for update;
  if not found then raise exception 'Outbound prospect not found.' using errcode='P0002'; end if;
  if not exists(select 1 from public.revenue_opportunities where public_id=p_opportunity_id) then raise exception 'Revenue opportunity not found.' using errcode='P0002'; end if;
  if exists(select 1 from public.outbound_revenue_attributions where prospect_id=p_prospect_id and idempotency_hash=p_idempotency_hash) then return jsonb_build_object('prospectId',p_prospect_id,'opportunityId',p_opportunity_id,'idempotentReplay',true); end if;
  insert into public.outbound_revenue_attributions (prospect_id,opportunity_id,idempotency_hash,actor_fingerprint,note,created_at) values (p_prospect_id,p_opportunity_id,p_idempotency_hash,p_actor_fingerprint,nullif(p_note,''),p_at);
  return jsonb_build_object('prospectId',p_prospect_id,'opportunityId',p_opportunity_id,'idempotentReplay',false);
end; $$;
revoke all on function public.link_outbound_prospect_to_revenue_opportunity(text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.link_outbound_prospect_to_revenue_opportunity(text,text,text,text,text,timestamptz) to service_role;
