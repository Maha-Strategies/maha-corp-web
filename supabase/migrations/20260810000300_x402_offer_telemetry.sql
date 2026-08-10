-- Per-offer acquisition telemetry for the autonomous x402 surface.
--
-- context_compiler_usage_daily answered "did agents find /api/v1/compress and
-- decline, or never find it at all" for exactly one endpoint. Its grain has no
-- offer column, so a second and third priced route would have folded into the
-- same rows and made every existing series wrong retroactively. Rather than
-- widen that table and rewrite its history, this is a new one at the grain the
-- three-offer question needs, and the old table keeps serving the
-- Context Compiler series it already has.
--
-- Grain is day x offer x event kind x status class x discovery source.
--
-- Privacy. No payload, task text, document content, passage, IP address, or
-- User-Agent string is recorded, and none is available to this table by
-- construction: the routes answer sourceTextStored:false and that stays true.
-- Token figures are the compiler's own model-neutral estimates -- volume, not
-- content.
--
-- What this table is NOT. It is not the payment ledger. Settled payments live
-- in x402_payments, which is append-only and authoritative, and this table
-- deliberately holds no amount, transaction id, or payer address. A funnel
-- that counted settlements from here would be counting route invocations,
-- which is a different number for any request that failed after payment.

create table if not exists public.x402_offer_usage_daily (
  usage_day date not null default current_date,
  -- The public catalog id, e.g. 'context-compression'. Deliberately the offer
  -- rather than the path: a path can be re-pointed, an offer id cannot.
  offer_id text not null check (char_length(offer_id) between 1 and 80),
  -- 'challenge' is an unpaid probe answered with a 402 and terminated at the
  -- proxy. 'invocation' is a request that reached the route. Kept as separate
  -- rows rather than separate columns so neither can be incremented twice by
  -- a single request: the proxy only ever writes 'challenge', the route only
  -- ever writes 'invocation', and there is no code path that writes both.
  event_kind text not null check (event_kind in ('challenge', 'invocation')),
  status_class text not null check (status_class in ('2xx', '4xx', '5xx')),
  -- Self-declared and spoofable, which is why the column is an allowlist of
  -- four coarse categories rather than a free-text field. A caller can claim
  -- to be Bazaar; nothing here treats that claim as evidence, and an
  -- unrecognised claim becomes 'unknown' rather than being retained verbatim.
  discovery_source text not null default 'unknown'
    check (discovery_source in ('bazaar', 'maha_canary', 'direct', 'unknown')),
  event_count integer not null default 0 check (event_count >= 0),
  -- Model-neutral estimates from the compiler, not provider billing counts.
  input_tokens_estimated numeric(18, 0) not null default 0 check (input_tokens_estimated >= 0),
  output_tokens_estimated numeric(18, 0) not null default 0 check (output_tokens_estimated >= 0),
  tokens_saved_estimated numeric(18, 0) not null default 0 check (tokens_saved_estimated >= 0),
  -- Populated only by the deep-context offer. Aggregate counts, never spans:
  -- the evidence text is hashed at the route and never reaches this table.
  required_evidence_total numeric(18, 0) not null default 0 check (required_evidence_total >= 0),
  retained_evidence_total numeric(18, 0) not null default 0 check (retained_evidence_total >= 0),
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  primary key (usage_day, offer_id, event_kind, status_class, discovery_source)
);

create index if not exists x402_offer_usage_daily_day_idx
  on public.x402_offer_usage_daily (usage_day desc);

create index if not exists x402_offer_usage_daily_offer_idx
  on public.x402_offer_usage_daily (offer_id, usage_day desc);

alter table public.x402_offer_usage_daily enable row level security;
revoke all on table public.x402_offer_usage_daily from public, anon, authenticated;
grant select, insert, update on table public.x402_offer_usage_daily to service_role;
-- UPDATE is granted because this is an aggregate counter incremented in place,
-- not a record of a transaction. DELETE and TRUNCATE stay revoked so history
-- cannot be quietly rewritten. See 20260803000300: Supabase's role defaults
-- grant these on every new table, so the revoke is load-bearing, not decorative.
revoke delete, truncate on table public.x402_offer_usage_daily from service_role;

-- Increments one bucket. Called after the response is produced, so a metering
-- failure can never change what the caller receives.
create or replace function public.record_x402_offer_usage(
  p_offer_id text,
  p_event_kind text,
  p_status_class text,
  p_discovery_source text default 'unknown',
  p_input_tokens numeric default 0,
  p_output_tokens numeric default 0,
  p_tokens_saved numeric default 0,
  p_required_evidence numeric default 0,
  p_retained_evidence numeric default 0,
  p_observed_at timestamptz default now()
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_day date := (coalesce(p_observed_at, now()) at time zone 'utc')::date;
  -- Anything unrecognised is recorded as unknown rather than rejected. A
  -- caller inventing a source string must not be able to fail a write and
  -- blank a bucket, and must not be able to smuggle its own text in here.
  v_source text := case
    when p_discovery_source in ('bazaar', 'maha_canary', 'direct') then p_discovery_source
    else 'unknown'
  end;
begin
  if coalesce(length(p_offer_id), 0) = 0 then
    raise exception 'offer_id is required.' using errcode = '22023';
  end if;
  if p_event_kind not in ('challenge', 'invocation') then
    raise exception 'Invalid event kind.' using errcode = '22023';
  end if;
  if p_status_class not in ('2xx', '4xx', '5xx') then
    raise exception 'Invalid status class.' using errcode = '22023';
  end if;

  insert into public.x402_offer_usage_daily as target
    (usage_day, offer_id, event_kind, status_class, discovery_source, event_count,
     input_tokens_estimated, output_tokens_estimated, tokens_saved_estimated,
     required_evidence_total, retained_evidence_total, first_observed_at, last_observed_at)
  values
    (v_day, p_offer_id, p_event_kind, p_status_class, v_source, 1,
     greatest(coalesce(p_input_tokens, 0), 0), greatest(coalesce(p_output_tokens, 0), 0),
     greatest(coalesce(p_tokens_saved, 0), 0),
     greatest(coalesce(p_required_evidence, 0), 0), greatest(coalesce(p_retained_evidence, 0), 0),
     coalesce(p_observed_at, now()), coalesce(p_observed_at, now()))
  on conflict (usage_day, offer_id, event_kind, status_class, discovery_source) do update
    set event_count = target.event_count + 1,
        input_tokens_estimated = target.input_tokens_estimated + greatest(coalesce(p_input_tokens, 0), 0),
        output_tokens_estimated = target.output_tokens_estimated + greatest(coalesce(p_output_tokens, 0), 0),
        tokens_saved_estimated = target.tokens_saved_estimated + greatest(coalesce(p_tokens_saved, 0), 0),
        required_evidence_total = target.required_evidence_total + greatest(coalesce(p_required_evidence, 0), 0),
        retained_evidence_total = target.retained_evidence_total + greatest(coalesce(p_retained_evidence, 0), 0),
        -- Monotonic: a delayed write must not drag the last-seen time backwards.
        last_observed_at = greatest(target.last_observed_at, coalesce(p_observed_at, now()));
end;
$$;

revoke all on function public.record_x402_offer_usage(text, text, text, text, numeric, numeric, numeric, numeric, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.record_x402_offer_usage(text, text, text, text, numeric, numeric, numeric, numeric, numeric, timestamptz) to service_role;

-- Repeat autonomous buyers, from the settlement ledger rather than from
-- telemetry.
--
-- This is the question the subscription decision turns on, and it is easy to
-- answer wrongly. agent_task_spend_daily cannot answer it: that table is keyed
-- by tenant and task, which an anonymous x402 wallet does not have, so any
-- join through it silently drops exactly the population being counted. The
-- only durable identity an autonomous payer has is its payer address, and the
-- only place that is recorded is x402_payments.
--
-- Returns one row per (payer, resource) with a payment count. A payer that
-- bought two different offers is two rows, because "came back for this offer"
-- and "came back at all" are different questions and conflating them would
-- overstate per-offer retention.
create or replace function public.x402_repeat_payers(
  p_from_day date,
  p_to_day date
) returns table (
  payer text,
  resource text,
  payment_count bigint,
  first_paid_at timestamptz,
  last_paid_at timestamptz
) language sql security definer set search_path = public, extensions as $$
  select
    p.payer,
    p.resource,
    count(*) as payment_count,
    min(p.claimed_at) as first_paid_at,
    max(p.claimed_at) as last_paid_at
  from public.x402_payments p
  where p.claimed_at >= p_from_day::timestamptz
    and p.claimed_at < (p_to_day + 1)::timestamptz
  group by p.payer, p.resource;
$$;

revoke all on function public.x402_repeat_payers(date, date) from public, anon, authenticated;
grant execute on function public.x402_repeat_payers(date, date) to service_role;

comment on table public.x402_offer_usage_daily is
  'Daily aggregate x402 acquisition telemetry by offer, event kind, status class and self-declared discovery source. Records volume, never content: no payload, IP, User-Agent or referrer is retained. Not a payment ledger -- x402_payments is authoritative for settlements.';

comment on function public.x402_repeat_payers(date, date) is
  'Repeat autonomous purchase counts derived from the x402_payments settlement ledger, keyed by payer address and resource. The payer address is the only durable identity an account-free buyer has; agent_task_spend_daily cannot identify these wallets.';
