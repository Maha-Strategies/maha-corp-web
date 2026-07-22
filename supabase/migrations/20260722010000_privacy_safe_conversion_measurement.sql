-- First-party, privacy-safe aggregate measurement. This ledger deliberately
-- stores no IP address, user agent, cookie, referrer, email, free text, or
-- persistent visitor identifier. Browser signals are unverified; paid outcomes
-- are written only by server code after Stripe signature verification.

create table if not exists public.conversion_checkout_attributions (
  checkout_reference text primary key check (checkout_reference ~ '^(credit_checkout|utility_checkout)_[a-f0-9]{32}$'),
  offer_id text not null check (offer_id ~ '^[a-z0-9][a-z0-9-]{2,100}$'),
  experiment_id text references public.growth_experiments(public_id) on delete set null,
  source_path text not null check (source_path ~ '^/' and source_path !~ '[?#]' and source_path !~ '\.\.' and char_length(source_path) <= 300),
  created_at timestamptz not null default now()
);

create table if not exists public.conversion_measurements (
  id uuid primary key default gen_random_uuid(),
  event_hash text not null unique check (event_hash ~ '^sha256:[a-f0-9]{64}$'),
  event_type text not null check (event_type in ('cta_click','inquiry_submitted','checkout_started','paid_conversion')),
  event_name text not null check (event_name ~ '^[a-z][a-z0-9_]{2,79}$'),
  source_kind text not null check (source_kind in ('client_unverified','server_checkout','stripe_verified')),
  experiment_id text references public.growth_experiments(public_id) on delete set null,
  source_path text not null check (source_path ~ '^/' and source_path !~ '[?#]' and source_path !~ '\.\.' and char_length(source_path) <= 300),
  offer_id text check (offer_id is null or offer_id ~ '^[a-z0-9][a-z0-9-]{2,100}$'),
  recorded_at timestamptz not null
);

create index if not exists conversion_measurements_experiment_recorded_idx on public.conversion_measurements (experiment_id, recorded_at desc);
create index if not exists conversion_measurements_event_recorded_idx on public.conversion_measurements (event_type, recorded_at desc);
alter table public.conversion_checkout_attributions enable row level security;
alter table public.conversion_measurements enable row level security;
revoke all on table public.conversion_checkout_attributions, public.conversion_measurements from public, anon, authenticated;
grant select, insert on table public.conversion_checkout_attributions, public.conversion_measurements to service_role;

create or replace function public.record_public_conversion_measurement(
  p_event_hash text, p_event_type text, p_event_name text, p_experiment_id text, p_source_path text, p_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_event_hash !~ '^sha256:[a-f0-9]{64}$' or p_event_type not in ('cta_click','inquiry_submitted')
    or p_event_name !~ '^[a-z][a-z0-9_]{2,79}$' or (p_experiment_id is not null and p_experiment_id !~ '^experiment_[a-f0-9]{32}$')
    or p_source_path !~ '^/' or p_source_path ~ '[?#]' or p_source_path ~ '\.\.' or char_length(p_source_path) > 300 or p_at is null
  then raise exception 'Invalid conversion measurement.' using errcode='22023'; end if;
  insert into public.conversion_measurements (event_hash,event_type,event_name,source_kind,experiment_id,source_path,recorded_at)
    values (p_event_hash,p_event_type,p_event_name,'client_unverified',p_experiment_id,p_source_path,p_at)
    on conflict (event_hash) do nothing;
  return 'recorded';
end;
$$;

create or replace function public.record_checkout_conversion_attribution(
  p_checkout_reference text, p_offer_id text, p_experiment_id text, p_source_path text, p_event_hash text, p_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_checkout_reference !~ '^(credit_checkout|utility_checkout)_[a-f0-9]{32}$' or p_offer_id !~ '^[a-z0-9][a-z0-9-]{2,100}$'
    or (p_experiment_id is not null and p_experiment_id !~ '^experiment_[a-f0-9]{32}$') or p_source_path !~ '^/' or p_source_path ~ '[?#]' or p_source_path ~ '\.\.'
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

create or replace function public.record_verified_checkout_conversion(
  p_checkout_reference text, p_offer_id text, p_event_hash text, p_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_attribution public.conversion_checkout_attributions%rowtype;
begin
  if p_checkout_reference !~ '^(credit_checkout|utility_checkout)_[a-f0-9]{32}$' or p_offer_id !~ '^[a-z0-9][a-z0-9-]{2,100}$'
    or p_event_hash !~ '^sha256:[a-f0-9]{64}$' or p_at is null
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

revoke all on function public.record_public_conversion_measurement(text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.record_checkout_conversion_attribution(text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.record_verified_checkout_conversion(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_public_conversion_measurement(text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.record_checkout_conversion_attribution(text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.record_verified_checkout_conversion(text,text,text,timestamptz) to service_role;
