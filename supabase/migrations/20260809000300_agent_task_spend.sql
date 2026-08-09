-- Attribution ledger for agent task spend.
--
-- The meters already here answer whether a customer came back. They cannot
-- answer which department inside that customer to bill, because the finest
-- grain recorded is day x access mode x credential x status class, and a
-- credential is the customer, not the cost centre.
--
-- This table is deliberately separate rather than a widening of
-- context_compiler_usage_daily. That table's own comment describes its grain as
-- "deliberately coarse", and adding a task identifier to its primary key would
-- turn a table with a handful of rows per day into one with a row per task per
-- day, destroying the retention question it exists to answer. Two grains, two
-- tables.
--
-- Out-of-band by construction. Nothing in a request path reads this table, and
-- writes happen after the response exists, so a failure here degrades a report
-- rather than a product.
--
-- RETENTION. task_id is the first customer-supplied string this platform
-- retains. Everything else recorded is derived (hashes, token counts) or
-- structural (status class, access mode). The endpoint's sourceTextStored:false
-- guarantee is unaffected -- an identifier is not payload -- but a caller can
-- put an email address or a case number in one, and it will appear in exports.
-- Hashing it would defeat the purpose, since a chargeback report the customer
-- cannot read against its own identifiers is useless. The mitigations are
-- therefore constraints, not obfuscation: a charset and length check so the
-- column cannot carry arbitrary text, and a tenant-scoped primary key so
-- identifiers can neither collide nor leak across tenants. The public contract
-- states that these are retained and that personal data must not be placed in
-- them. Accepted deliberately on 2026-08-09.
--
-- Tenant identity is denormalized. Tenants live in Redis, not Postgres, so
-- there is no table to reference and no foreign key to declare.

create table if not exists public.agent_task_spend_daily (
  usage_day date not null default current_date,
  tenant_id text not null check (char_length(tenant_id) between 1 and 120),
  -- Customer-supplied and constrained. See the retention note above.
  task_id text not null check (task_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  -- Resolved once at write time and stored, never joined at read time: a
  -- chargeback ledger must bill what was true when the call happened.
  -- Re-pointing a credential at another department next quarter must not
  -- silently rewrite last quarter's invoice.
  --
  -- 'unallocated' rather than an empty string. It is part of the primary key,
  -- and it is a value a finance team can see and chase, where a blank reads as
  -- a defect.
  cost_center text not null default 'unallocated'
    check (cost_center ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  surface text not null check (surface in ('compress', 'jobs', 'gateway', 'audit')),
  request_count integer not null default 0 check (request_count >= 0),
  -- Credits actually taken, never credits owed. A ledger that records
  -- intentions cannot be reconciled against the balance it claims to explain.
  credits_charged numeric(18, 0) not null default 0 check (credits_charged >= 0),
  -- Model-neutral estimates from the compiler, not provider billing counts.
  input_tokens_estimated numeric(18, 0) not null default 0 check (input_tokens_estimated >= 0),
  output_tokens_estimated numeric(18, 0) not null default 0 check (output_tokens_estimated >= 0),
  -- Exported as a quantity. Converting it to money needs the customer's own
  -- model input price, which this service does not know and must not invent.
  tokens_saved_estimated numeric(18, 0) not null default 0 check (tokens_saved_estimated >= 0),
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  primary key (usage_day, tenant_id, task_id, cost_center, surface)
);

-- The export reads a window for one tenant, grouped by cost centre.
create index if not exists agent_task_spend_daily_tenant_idx
  on public.agent_task_spend_daily (tenant_id, usage_day desc, cost_center);

-- A task spanning several days is summed across its rows at export time.
create index if not exists agent_task_spend_daily_task_idx
  on public.agent_task_spend_daily (tenant_id, task_id, usage_day desc);

alter table public.agent_task_spend_daily enable row level security;
revoke all on table public.agent_task_spend_daily from public, anon, authenticated;
grant select, insert, update on table public.agent_task_spend_daily to service_role;
-- UPDATE is granted for the same reason as context_compiler_usage_daily: these
-- are counters incremented in place, not records of individual transactions.
-- DELETE and TRUNCATE stay revoked so a billing period cannot be quietly
-- rewritten after it has been invoiced.
revoke delete, truncate on table public.agent_task_spend_daily from service_role;

-- Increments one bucket. Called after the response is produced, so an
-- attribution failure can never change what the caller receives.
create or replace function public.record_agent_task_spend(
  p_tenant_id text,
  p_task_id text,
  p_cost_center text,
  p_surface text,
  p_credits_charged numeric,
  p_input_tokens numeric,
  p_output_tokens numeric,
  p_tokens_saved numeric,
  p_observed_at timestamptz default now()
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_cost_center text := coalesce(nullif(btrim(p_cost_center), ''), 'unallocated');
  v_day date := (coalesce(p_observed_at, now()) at time zone 'utc')::date;
begin
  if p_surface not in ('compress', 'jobs', 'gateway', 'audit') then
    raise exception 'Invalid surface.' using errcode = '22023';
  end if;
  -- A row with no tenant or no task cannot be attributed to anyone, and
  -- writing it would put an unallocatable line on an invoice. The caller is
  -- expected to skip the call entirely; this is the backstop.
  if coalesce(btrim(p_tenant_id), '') = '' or coalesce(btrim(p_task_id), '') = '' then
    raise exception 'Tenant and task identifiers are required.' using errcode = '22023';
  end if;

  insert into public.agent_task_spend_daily as target
    (usage_day, tenant_id, task_id, cost_center, surface, request_count,
     credits_charged, input_tokens_estimated, output_tokens_estimated, tokens_saved_estimated,
     first_observed_at, last_observed_at)
  values
    (v_day, btrim(p_tenant_id), btrim(p_task_id), v_cost_center, p_surface, 1,
     greatest(coalesce(p_credits_charged, 0), 0),
     greatest(coalesce(p_input_tokens, 0), 0),
     greatest(coalesce(p_output_tokens, 0), 0),
     greatest(coalesce(p_tokens_saved, 0), 0),
     coalesce(p_observed_at, now()), coalesce(p_observed_at, now()))
  on conflict (usage_day, tenant_id, task_id, cost_center, surface) do update
    set request_count = target.request_count + 1,
        credits_charged = target.credits_charged + greatest(coalesce(p_credits_charged, 0), 0),
        input_tokens_estimated = target.input_tokens_estimated + greatest(coalesce(p_input_tokens, 0), 0),
        output_tokens_estimated = target.output_tokens_estimated + greatest(coalesce(p_output_tokens, 0), 0),
        tokens_saved_estimated = target.tokens_saved_estimated + greatest(coalesce(p_tokens_saved, 0), 0),
        -- Monotonic: a delayed write must not drag the last-seen time backwards.
        last_observed_at = greatest(target.last_observed_at, coalesce(p_observed_at, now()));
end;
$$;

revoke all on function public.record_agent_task_spend(text, text, text, text, numeric, numeric, numeric, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.record_agent_task_spend(text, text, text, text, numeric, numeric, numeric, numeric, timestamptz) to service_role;

comment on table public.agent_task_spend_daily is
  'Daily agent spend attributed to a customer-supplied task identifier and cost centre, for chargeback export. Retains task and cost-centre identifiers supplied by the caller: these are constrained metadata, not payload, and the endpoint''s sourceTextStored:false guarantee is unaffected. Personal data must not be placed in them. Credit figures are credits actually charged; token figures are model-neutral estimates, not provider billing counts.';
