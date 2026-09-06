-- Durable jobs for the $1 Research Intake Evidence Pack.
-- Complete supplied sections are transient. The result retains the question,
-- supplied identifiers and metadata, and short claim excerpts by design.

create table if not exists public.x402_research_intake_packs (
  public_id text primary key check (public_id ~ '^intake_[a-f0-9]{32}$'),
  retrieval_token_hash text not null unique check (retrieval_token_hash ~ '^sha256:[a-f0-9]{64}$'),
  payment_transaction text not null unique check (length(payment_transaction) between 1 and 200),
  payer text not null check (length(payer) between 1 and 200),
  client_request_id text not null check (char_length(client_request_id) between 8 and 120),
  input_hash text not null check (input_hash ~ '^sha256:[a-f0-9]{64}$'),
  status text not null check (status in ('processing', 'completed', 'failed')),
  result jsonb,
  failure_code text check (failure_code is null or char_length(failure_code) <= 80),
  model text not null check (char_length(model) <= 80),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists x402_research_intake_payer_request_idx
  on public.x402_research_intake_packs (payer, client_request_id);
create index if not exists x402_research_intake_created_idx
  on public.x402_research_intake_packs (created_at desc);

alter table public.x402_research_intake_packs enable row level security;
revoke all on table public.x402_research_intake_packs from public, anon, authenticated;
grant select, insert, update on table public.x402_research_intake_packs to service_role;
revoke delete, truncate on table public.x402_research_intake_packs from service_role;

create table if not exists public.x402_research_intake_section_audits (
  pack_public_id text not null references public.x402_research_intake_packs(public_id) on delete restrict,
  section_order integer not null check (section_order between 1 and 10),
  source_id text not null check (char_length(source_id) between 1 and 80),
  section_id text not null check (char_length(section_id) between 1 and 80),
  source_section_hash text not null check (source_section_hash ~ '^sha256:[a-f0-9]{64}$'),
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  audit_result jsonb,
  failure_code text check (failure_code is null or char_length(failure_code) <= 80),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (pack_public_id, section_order),
  unique (pack_public_id, source_id, section_id),
  check ((status = 'completed' and audit_result is not null and completed_at is not null)
    or (status <> 'completed' and audit_result is null and completed_at is null))
);

alter table public.x402_research_intake_section_audits enable row level security;
revoke all on table public.x402_research_intake_section_audits from public, anon, authenticated;
grant select, insert, update on table public.x402_research_intake_section_audits to service_role;
revoke delete, truncate on table public.x402_research_intake_section_audits from service_role;

-- Claims one section at a time. A completed row is deliberately ineligible,
-- so a pack retry cannot rerun a successful sibling.
create or replace function public.claim_x402_research_intake_section(
  p_pack_public_id text,
  p_section_order integer,
  p_max_attempts integer default 3
) returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_attempt integer;
begin
  update public.x402_research_intake_section_audits
    set attempt_count = attempt_count + 1,
        status = 'processing',
        failure_code = null,
        updated_at = now()
  where pack_public_id = p_pack_public_id
    and section_order = p_section_order
    and status in ('pending', 'failed')
    and attempt_count < least(p_max_attempts, 3)
  returning attempt_count into v_attempt;
  return v_attempt;
end;
$$;

revoke all on function public.claim_x402_research_intake_section(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_x402_research_intake_section(text, integer, integer) to service_role;

create or replace function public.protect_completed_x402_research_intake_section()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if old.status = 'completed' and new is distinct from old then
    raise exception 'completed research-intake section audits are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_completed_x402_research_intake_section
  on public.x402_research_intake_section_audits;
create trigger protect_completed_x402_research_intake_section
  before update on public.x402_research_intake_section_audits
  for each row execute function public.protect_completed_x402_research_intake_section();

comment on table public.x402_research_intake_packs is
  'Paid machine-generated research intake packets. Complete supplied sections are not stored; results retain question and intake metadata, supplied source and section identifiers, short verbatim claim excerpts, classifications, digests, payer, and settlement transaction.';

comment on table public.x402_research_intake_section_audits is
  'Section-local recovery ledger. Completed section audits are immutable inputs to pack assembly and are never rerun when another section fails.';
