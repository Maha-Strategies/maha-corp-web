-- Completes the private MPS Document Preflight delivery lifecycle without
-- retaining submitted document content or adding public read access.

alter table public.mps_preflight_orders
  add column if not exists report_sha256 text check (report_sha256 is null or report_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  add column if not exists acknowledgement_sha256 text check (acknowledgement_sha256 is null or acknowledgement_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  add column if not exists acknowledged_at timestamptz;

alter table public.mps_preflight_orders
  drop constraint if exists mps_preflight_acknowledgement_complete;
alter table public.mps_preflight_orders
  add constraint mps_preflight_acknowledgement_complete check (
    (acknowledgement_sha256 is null and acknowledged_at is null)
    or (
      status = 'completed'
      and report is not null
      and report_sha256 is not null
      and acknowledgement_sha256 is not null
      and acknowledged_at is not null
    )
  );

create or replace function public.record_mps_preflight_acknowledgement(
  p_order_id text,
  p_report_sha256 text,
  p_acknowledgement_sha256 text,
  p_acknowledged_at timestamptz
) returns text language plpgsql security definer set search_path = public as $$
declare v_order public.mps_preflight_orders%rowtype;
begin
  if p_order_id !~ '^preflight_[a-f0-9]{32}$'
    or p_report_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_acknowledgement_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_acknowledged_at is null
  then raise exception 'Invalid MPS Preflight acknowledgement.' using errcode = '22023'; end if;

  select * into v_order from public.mps_preflight_orders where public_id = p_order_id for update;
  if not found then return 'not_found'; end if;
  if v_order.status <> 'completed' or v_order.report is null or v_order.report_sha256 is null then return 'not_delivered'; end if;
  if v_order.report_sha256 <> p_report_sha256 then return 'target_mismatch'; end if;
  if v_order.acknowledgement_sha256 is not null then
    if v_order.acknowledgement_sha256 = p_acknowledgement_sha256 then return 'duplicate'; end if;
    return 'conflict';
  end if;

  update public.mps_preflight_orders
    set acknowledgement_sha256 = p_acknowledgement_sha256, acknowledged_at = p_acknowledged_at
    where public_id = p_order_id;
  return 'processed';
end;
$$;

revoke all on function public.record_mps_preflight_acknowledgement(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_mps_preflight_acknowledgement(text,text,text,timestamptz) to service_role;

-- The existing privacy-safe conversion ledger originally admitted only API
-- credit and utility checkout references. MPS Document Preflight uses its
-- existing non-secret public order id as the attribution key.
alter table public.conversion_checkout_attributions
  drop constraint if exists conversion_checkout_attributions_checkout_reference_check;
alter table public.conversion_checkout_attributions
  add constraint conversion_checkout_attributions_checkout_reference_check check (
    checkout_reference ~ '^(credit_checkout|utility_checkout)_[a-f0-9]{32}$'
    or checkout_reference ~ '^preflight_[a-f0-9]{32}$'
  );

create or replace function public.record_checkout_conversion_attribution(
  p_checkout_reference text, p_offer_id text, p_experiment_id text, p_source_path text, p_event_hash text, p_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (
      p_checkout_reference ~ '^(credit_checkout|utility_checkout)_[a-f0-9]{32}$'
      or p_checkout_reference ~ '^preflight_[a-f0-9]{32}$'
    )
    or p_offer_id !~ '^[a-z0-9][a-z0-9-]{2,100}$'
    or (p_experiment_id is not null and p_experiment_id !~ '^experiment_[a-f0-9]{32}$')
    or p_source_path !~ '^/' or p_source_path ~ '[?#]' or p_source_path ~ '\.\.'
    or char_length(p_source_path) > 300 or p_event_hash !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid checkout attribution.' using errcode='22023'; end if;
  insert into public.conversion_checkout_attributions (checkout_reference,offer_id,experiment_id,source_path,created_at)
    values (p_checkout_reference,p_offer_id,p_experiment_id,p_source_path,p_at)
    on conflict (checkout_reference) do nothing;
  insert into public.conversion_measurements (event_hash,event_type,event_name,source_kind,experiment_id,source_path,offer_id,recorded_at)
    values (p_event_hash,'checkout_started','checkout_started','server_checkout',p_experiment_id,p_source_path,p_offer_id,p_at)
    on conflict (event_hash) do nothing;
  return 'recorded';
end;
$$;

revoke all on function public.record_checkout_conversion_attribution(text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_checkout_conversion_attribution(text,text,text,text,text,timestamptz) to service_role;

create or replace function public.record_verified_checkout_conversion(
  p_checkout_reference text, p_offer_id text, p_event_hash text, p_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_attribution public.conversion_checkout_attributions%rowtype;
begin
  if not (
      p_checkout_reference ~ '^(credit_checkout|utility_checkout)_[a-f0-9]{32}$'
      or p_checkout_reference ~ '^preflight_[a-f0-9]{32}$'
    )
    or p_offer_id !~ '^[a-z0-9][a-z0-9-]{2,100}$'
    or p_event_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_at is null
  then raise exception 'Invalid verified conversion.' using errcode='22023'; end if;
  select * into v_attribution from public.conversion_checkout_attributions where checkout_reference=p_checkout_reference;
  if not found then return 'missing_attribution'; end if;
  if v_attribution.offer_id <> p_offer_id then raise exception 'Checkout offer mismatch.' using errcode='22023'; end if;
  insert into public.conversion_measurements (event_hash,event_type,event_name,source_kind,experiment_id,source_path,offer_id,recorded_at)
    values (p_event_hash,'paid_conversion','paid_conversion','stripe_verified',v_attribution.experiment_id,v_attribution.source_path,p_offer_id,p_at)
    on conflict (event_hash) do nothing;
  return 'recorded';
end;
$$;

revoke all on function public.record_verified_checkout_conversion(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_verified_checkout_conversion(text,text,text,timestamptz) to service_role;
