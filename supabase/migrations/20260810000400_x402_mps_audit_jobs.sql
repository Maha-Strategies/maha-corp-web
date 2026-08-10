-- Audit jobs bought with an x402 payment rather than a prepaid credential.
--
-- Deliberately a separate table from agent_mps_audits. That table is keyed by
-- (credential_id, client_request_id) and its billing is the prepaid credit
-- ledger; an x402 buyer has no credential and consumes no credit, so reusing
-- it would mean a nullable credential column, a nullable billing mode, and a
-- credit path that has to be remembered not to take. The existing
-- credential/prepaid route keeps its table exactly as it was.
--
-- The invariant this table exists to hold: a settled payment must never
-- disappear into an untraceable 502. The row is written *before* the Anthropic
-- boundary is crossed, carrying the payment transaction, so a model timeout
-- leaves behind a record the payer can come back to rather than a charge with
-- nothing attached to it.

create table if not exists public.x402_mps_audits (
  public_id text primary key check (public_id ~ '^audit_[a-f0-9]{32}$'),

  -- SHA-256 of the retrieval credential, never the credential itself.
  --
  -- The audit id alone must not be enough to read a result: ids appear in
  -- logs, in error payloads, and in the response body of the request that
  -- created them, so treating one as a capability would make every result
  -- readable by anything that ever saw an id. The caller receives a
  -- high-entropy token once, at creation; this column stores only its digest,
  -- so a database read does not yield the ability to fetch results.
  retrieval_token_hash text not null unique check (retrieval_token_hash ~ '^sha256:[a-f0-9]{64}$'),

  -- The settled payment this job was created against. Unique, so one payment
  -- buys exactly one job -- the local replay guard in x402_payments prevents a
  -- proof being spent twice, and this prevents a single accepted payment being
  -- fanned out into several jobs if a retry races.
  payment_transaction text not null unique check (length(payment_transaction) between 1 and 200),
  payer text not null check (length(payer) between 1 and 200),

  client_request_id text not null check (char_length(client_request_id) between 8 and 120),
  -- Hash of the submitted passage. The passage itself is never stored: see the
  -- retention note on the offer catalog and the route's sourceTextStored:false.
  input_hash text not null check (input_hash ~ '^sha256:[a-f0-9]{64}$'),

  status text not null check (status in ('processing', 'completed', 'failed')),
  -- The audit result only: claims, tags, rationales, counts. Rationales are
  -- model-written prose about the passage, not the passage; excerpts are short
  -- verbatim spans the result is meaningless without.
  result jsonb,
  failure_code text check (failure_code is null or char_length(failure_code) <= 80),
  model text not null check (char_length(model) <= 80),

  -- Bounds our exposure on recovery. A paid job may be resumed after a model
  -- failure without a second payment, which means we absorb the model cost of
  -- each retry; without a ceiling a single payment could fund unlimited
  -- attempts. Enforced in resume_x402_mps_audit below, not just in the route.
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),

  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- The payer's idempotency key. A payer that retries the same clientRequestId
-- is asking about the job it already paid for, not buying a second one.
create unique index if not exists x402_mps_audits_payer_request_idx
  on public.x402_mps_audits (payer, client_request_id);

create index if not exists x402_mps_audits_created_idx
  on public.x402_mps_audits (created_at desc);

-- Recovery scans: jobs stuck in 'processing' past the model deadline.
create index if not exists x402_mps_audits_processing_idx
  on public.x402_mps_audits (created_at)
  where status = 'processing';

alter table public.x402_mps_audits enable row level security;
revoke all on table public.x402_mps_audits from public, anon, authenticated;
grant select, insert, update on table public.x402_mps_audits to service_role;
-- UPDATE is required: a job legitimately moves processing -> completed/failed
-- and back through a bounded resume. DELETE and TRUNCATE are not, and stay
-- revoked so a paid job cannot be erased.
revoke delete, truncate on table public.x402_mps_audits from service_role;

-- Claims the next attempt on an existing job, atomically.
--
-- Returns the new attempt number, or null when the job is already at its
-- ceiling or is not in a resumable state. Doing this as a conditional UPDATE
-- rather than a read-then-write is what makes the ceiling real: two concurrent
-- resume requests against the same job would otherwise both read attempt_count
-- and both proceed.
create or replace function public.resume_x402_mps_audit(
  p_public_id text,
  p_max_attempts integer default 3
) returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_attempt integer;
begin
  update public.x402_mps_audits
    set attempt_count = attempt_count + 1,
        status = 'processing',
        failure_code = null
  where public_id = p_public_id
    and status in ('processing', 'failed')
    and attempt_count < least(p_max_attempts, 3)
  returning attempt_count into v_attempt;

  return v_attempt;
end;
$$;

revoke all on function public.resume_x402_mps_audit(text, integer) from public, anon, authenticated;
grant execute on function public.resume_x402_mps_audit(text, integer) to service_role;

comment on table public.x402_mps_audits is
  'MPS audit jobs purchased with an autonomous x402 payment. Separate from agent_mps_audits, which is the credential/prepaid path and is unchanged. Stores no submitted source text: only its hash, the result, status metadata, the payer address and the settled payment transaction. Results are readable only with the high-entropy retrieval credential whose digest is stored here.';

comment on column public.x402_mps_audits.retrieval_token_hash is
  'SHA-256 of the retrieval credential issued once at creation. The audit id is not a capability; a database read does not yield the ability to fetch a result.';
