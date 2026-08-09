-- Usage telemetry for the Context Compiler.
--
-- The 2026-08-08 infrastructure review named acquisition-to-paid conversion as
-- unmeasurable, and the reason turns out to be narrower than "no dashboard":
-- /api/v1/compress records nothing at all. commercial_api_usage_daily covers
-- mps_audit, credit balance and book routes only, so the product identified as
-- the primary revenue wedge is the one product with no activation or repeat-use
-- signal. A funnel cannot be assembled over a stage that emits no events.
--
-- Grain is day x access mode x credential x status class. That is deliberately
-- coarse: it answers "did this credential come back the next day" without
-- retaining anything about what was compressed.
--
-- Privacy. No payload, task text, document content, IP, or user agent is
-- recorded, and none is available to this table by construction -- the route
-- already answers sourceTextStored:false and that stays true. Token counts are
-- the compiler's own model-neutral estimates, kept because they are the unit
-- the commercial case is argued in, and they describe volume rather than
-- content.
--
-- Anonymous and x402 callers hold no credential, so credential_id is '' for
-- them rather than null: it is part of the primary key, and a null there would
-- silently split rows that should aggregate. The x402 payer address is already
-- recorded in x402_payments and is deliberately not duplicated here.

create table if not exists public.context_compiler_usage_daily (
  usage_day date not null default current_date,
  -- How the caller was authorised. 'anonymous' covers unpaid attempts, which
  -- are the denominator of the activation question.
  access_mode text not null check (access_mode in ('api_key', 'x402', 'anonymous')),
  -- Empty string for x402 and anonymous. See the note above on nulls.
  credential_id text not null default '' check (char_length(credential_id) <= 120),
  status_class text not null check (status_class in ('2xx', '4xx', '5xx')),
  request_count integer not null default 0 check (request_count >= 0),
  -- Model-neutral estimates from the compiler, not provider billing counts.
  input_tokens_estimated numeric(18, 0) not null default 0 check (input_tokens_estimated >= 0),
  output_tokens_estimated numeric(18, 0) not null default 0 check (output_tokens_estimated >= 0),
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  primary key (usage_day, access_mode, credential_id, status_class)
);

create index if not exists context_compiler_usage_daily_day_idx
  on public.context_compiler_usage_daily (usage_day desc);

-- Repeat use is the question this table exists to answer, and it is asked per
-- credential across days.
create index if not exists context_compiler_usage_daily_credential_idx
  on public.context_compiler_usage_daily (credential_id, usage_day desc)
  where credential_id <> '';

alter table public.context_compiler_usage_daily enable row level security;
revoke all on table public.context_compiler_usage_daily from public, anon, authenticated;
grant select, insert, update on table public.context_compiler_usage_daily to service_role;
-- UPDATE is granted here, unlike the commercial ledgers: this is an aggregate
-- counter that is incremented in place, not a record of a transaction. DELETE
-- and TRUNCATE remain revoked so history cannot be quietly rewritten.
revoke delete, truncate on table public.context_compiler_usage_daily from service_role;

-- Increments one bucket. Called after the response is produced, so a metering
-- failure can never change what the caller receives.
create or replace function public.record_context_compiler_usage(
  p_access_mode text,
  p_credential_id text,
  p_status_class text,
  p_input_tokens numeric,
  p_output_tokens numeric,
  p_observed_at timestamptz default now()
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_credential text := coalesce(nullif(p_credential_id, ''), '');
  v_day date := (coalesce(p_observed_at, now()) at time zone 'utc')::date;
begin
  if p_access_mode not in ('api_key', 'x402', 'anonymous') then
    raise exception 'Invalid access mode.' using errcode = '22023';
  end if;
  if p_status_class not in ('2xx', '4xx', '5xx') then
    raise exception 'Invalid status class.' using errcode = '22023';
  end if;

  insert into public.context_compiler_usage_daily as target
    (usage_day, access_mode, credential_id, status_class, request_count,
     input_tokens_estimated, output_tokens_estimated, first_observed_at, last_observed_at)
  values
    (v_day, p_access_mode, v_credential, p_status_class, 1,
     greatest(coalesce(p_input_tokens, 0), 0), greatest(coalesce(p_output_tokens, 0), 0),
     coalesce(p_observed_at, now()), coalesce(p_observed_at, now()))
  on conflict (usage_day, access_mode, credential_id, status_class) do update
    set request_count = target.request_count + 1,
        input_tokens_estimated = target.input_tokens_estimated + greatest(coalesce(p_input_tokens, 0), 0),
        output_tokens_estimated = target.output_tokens_estimated + greatest(coalesce(p_output_tokens, 0), 0),
        -- Monotonic: a delayed write must not drag the last-seen time backwards.
        last_observed_at = greatest(target.last_observed_at, coalesce(p_observed_at, now()));
end;
$$;

revoke all on function public.record_context_compiler_usage(text, text, text, numeric, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.record_context_compiler_usage(text, text, text, numeric, numeric, timestamptz) to service_role;

comment on table public.context_compiler_usage_daily is
  'Daily aggregate usage of /api/v1/compress by access mode, credential and status class. Records volume, never content: no payload, task text, IP or user agent is retained, consistent with the endpoint''s sourceTextStored:false guarantee. Token figures are model-neutral estimates, not provider billing counts.';
