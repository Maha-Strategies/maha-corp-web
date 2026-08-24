-- Phases 5-8: immutable automated audits and reviewer-ready packets for
-- noncanonical candidates. This ledger cannot write expert reviews or releases.

create table if not exists public.epistemic_factory_runs (
  run_id text primary key check (run_id ~ '^epifactory_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-epistemic-factory-run/1.0'),
  compiler_version text not null check (compiler_version = 'maha-noncanonical-publishing-factory/1.0'),
  operation text not null check (operation = 'compile-noncanonical-candidates'),
  target_count integer not null check (target_count between 1 and 500),
  counts jsonb not null check (jsonb_typeof(counts) = 'object'),
  run_sha256 text not null unique check (run_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  run_snapshot jsonb not null check (jsonb_typeof(run_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  compiled_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((run_snapshot->>'canonicalReleaseAttempted')::boolean = false),
  check ((counts->>'canonical')::integer = 0),
  check ((counts->>'sitemapEligible')::integer = 0)
);

create table if not exists public.epistemic_candidate_audits (
  audit_id text primary key check (audit_id ~ '^epiaudit_[a-f0-9]{32}$'),
  factory_run_id text not null references public.epistemic_factory_runs(run_id),
  candidate_record_id text not null check (candidate_record_id ~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'),
  candidate_sha256 text not null check (candidate_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  review_target_sha256 text not null check (review_target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  status text not null check (status in ('blocked','review-required','automated-checks-passed')),
  finding_count integer not null check (finding_count between 0 and 1000),
  audit_sha256 text not null unique check (audit_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  audit_snapshot jsonb not null check (jsonb_typeof(audit_snapshot) = 'object'),
  audited_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (factory_run_id, review_target_sha256)
);

create table if not exists public.epistemic_review_packets (
  packet_id text primary key check (packet_id ~ '^epipacket_[a-f0-9]{32}$'),
  factory_run_id text not null references public.epistemic_factory_runs(run_id),
  candidate_record_id text not null check (candidate_record_id ~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'),
  domain_slug text not null check (domain_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  candidate_sha256 text not null check (candidate_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  review_target_sha256 text not null check (review_target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  canonical_status text not null check (canonical_status = 'noncanonical-draft'),
  packet_sha256 text not null unique check (packet_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  packet_snapshot jsonb not null check (jsonb_typeof(packet_snapshot) = 'object'),
  prepared_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (factory_run_id, review_target_sha256),
  check ((packet_snapshot#>>'{indexControl,crawlable}')::boolean = false),
  check ((packet_snapshot#>>'{indexControl,sitemapEligible}')::boolean = false),
  check (packet_snapshot#>>'{indexControl,robotsDirective}' = 'noindex, nofollow, noarchive')
);

create index if not exists epistemic_factory_runs_compiled_idx
  on public.epistemic_factory_runs (compiled_at desc);
create index if not exists epistemic_candidate_audits_target_idx
  on public.epistemic_candidate_audits (candidate_record_id, review_target_sha256, audited_at desc);
create index if not exists epistemic_review_packets_target_idx
  on public.epistemic_review_packets (candidate_record_id, review_target_sha256, prepared_at desc);

create trigger epistemic_factory_runs_immutable
  before update or delete on public.epistemic_factory_runs
  for each row execute function public.reject_epistemic_ledger_mutation();
create trigger epistemic_candidate_audits_immutable
  before update or delete on public.epistemic_candidate_audits
  for each row execute function public.reject_epistemic_ledger_mutation();
create trigger epistemic_review_packets_immutable
  before update or delete on public.epistemic_review_packets
  for each row execute function public.reject_epistemic_ledger_mutation();

alter table public.epistemic_factory_runs enable row level security;
alter table public.epistemic_candidate_audits enable row level security;
alter table public.epistemic_review_packets enable row level security;

revoke all on table public.epistemic_factory_runs from public, anon, authenticated;
revoke all on table public.epistemic_candidate_audits from public, anon, authenticated;
revoke all on table public.epistemic_review_packets from public, anon, authenticated;
grant select on table public.epistemic_factory_runs to service_role;
grant select on table public.epistemic_candidate_audits to service_role;
grant select on table public.epistemic_review_packets to service_role;
revoke insert, update, delete, truncate on table public.epistemic_factory_runs from service_role;
revoke insert, update, delete, truncate on table public.epistemic_candidate_audits from service_role;
revoke insert, update, delete, truncate on table public.epistemic_review_packets from service_role;

create or replace function public.record_epistemic_factory_run(
  p_run jsonb,
  p_packets jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_factory_runs%rowtype;
  v_packet jsonb;
  v_audit jsonb;
  v_target record;
  v_packet_count integer;
  v_automated_checks_passed integer;
  v_review_required integer;
  v_blocked integer;
begin
  if p_run is null or jsonb_typeof(p_run) <> 'object'
    or p_packets is null or jsonb_typeof(p_packets) <> 'array'
    or coalesce(p_run->>'schemaVersion','') <> 'maha-epistemic-factory-run/1.0'
    or coalesce(p_run->>'compilerVersion','') <> 'maha-noncanonical-publishing-factory/1.0'
    or coalesce(p_run->>'runId','') !~ '^epifactory_[a-f0-9]{32}$'
    or coalesce(p_run->>'operation','') <> 'compile-noncanonical-candidates'
    or coalesce(p_run->>'runSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_run->>'compiledAt','') !~ 'Z$'
    or coalesce(jsonb_typeof(p_run->'counts'),'') <> 'object'
    or coalesce(jsonb_typeof(p_run->'packetSha256s'),'') <> 'array'
    or coalesce(jsonb_typeof(p_run->'targetSha256s'),'') <> 'array'
    or coalesce(p_run->>'canonicalReleaseAttempted','') <> 'false'
    or coalesce(p_run#>>'{counts,canonical}','') <> '0'
    or coalesce(p_run#>>'{counts,sitemapEligible}','') <> '0'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid noncanonical factory run.' using errcode = '22023'; end if;

  v_packet_count := jsonb_array_length(p_packets);
  if v_packet_count not between 1 and 500
    or coalesce(p_run->>'targetCount','') !~ '^[1-9][0-9]*$'
    or coalesce(p_run#>>'{counts,automatedChecksPassed}','') !~ '^[0-9]+$'
    or coalesce(p_run#>>'{counts,reviewRequired}','') !~ '^[0-9]+$'
    or coalesce(p_run#>>'{counts,blocked}','') !~ '^[0-9]+$'
    or (p_run->>'targetCount')::integer <> v_packet_count
    or jsonb_array_length(p_run->'packetSha256s') <> v_packet_count
    or jsonb_array_length(p_run->'targetSha256s') <> v_packet_count
    or (select count(distinct value) from jsonb_array_elements_text(p_run->'packetSha256s')) <> v_packet_count
    or (select count(distinct value) from jsonb_array_elements_text(p_run->'targetSha256s')) <> v_packet_count
  then raise exception 'Factory target counts do not agree.' using errcode = '22023'; end if;

  select
    count(*) filter (where value#>>'{automatedAudit,status}' = 'automated-checks-passed'),
    count(*) filter (where value#>>'{automatedAudit,status}' = 'review-required'),
    count(*) filter (where value#>>'{automatedAudit,status}' = 'blocked')
  into v_automated_checks_passed, v_review_required, v_blocked
  from jsonb_array_elements(p_packets);
  if (p_run#>>'{counts,automatedChecksPassed}')::integer <> v_automated_checks_passed
    or (p_run#>>'{counts,reviewRequired}')::integer <> v_review_required
    or (p_run#>>'{counts,blocked}')::integer <> v_blocked
    or v_automated_checks_passed + v_review_required + v_blocked <> v_packet_count
  then raise exception 'Factory run counts do not agree with packet audit states.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_factory_runs where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing.run_snapshot->'targetSha256s' <> p_run->'targetSha256s'
    then raise exception 'Factory idempotency cannot cross target revisions.' using errcode = 'P0001'; end if;
    return jsonb_build_object('runId', v_existing.run_id, 'targetCount', v_existing.target_count, 'idempotentReplay', true);
  end if;

  insert into public.epistemic_factory_runs (
    run_id, schema_version, compiler_version, operation, target_count, counts,
    run_sha256, run_snapshot, actor_fingerprint, idempotency_hash, compiled_at, created_at
  ) values (
    p_run->>'runId', p_run->>'schemaVersion', p_run->>'compilerVersion', p_run->>'operation',
    (p_run->>'targetCount')::integer, p_run->'counts', p_run->>'runSha256', p_run,
    p_actor_fingerprint, p_idempotency_hash, (p_run->>'compiledAt')::timestamptz, (p_run->>'compiledAt')::timestamptz
  );

  for v_packet in select value from jsonb_array_elements(p_packets) loop
    v_audit := v_packet->'automatedAudit';
    if coalesce(v_packet->>'schemaVersion','') <> 'maha-epistemic-review-packet/1.0'
      or coalesce(v_packet->>'compilerVersion','') <> p_run->>'compilerVersion'
      or coalesce(v_packet->>'packetId','') !~ '^epipacket_[a-f0-9]{32}$'
      or coalesce(v_packet->>'factoryRunId','') <> p_run->>'runId'
      or coalesce(v_packet->>'recordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
      or coalesce(v_packet->>'candidateSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_packet->>'reviewTargetSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_packet->>'canonicalStatus','') <> 'noncanonical-draft'
      or coalesce(jsonb_typeof(v_packet->'sourceClaimMatrix'),'') <> 'array'
      or coalesce(v_packet#>>'{indexControl,crawlable}','') <> 'false'
      or coalesce(v_packet#>>'{indexControl,sitemapEligible}','') <> 'false'
      or coalesce(v_packet#>>'{indexControl,robotsDirective}','') <> 'noindex, nofollow, noarchive'
      or coalesce(v_packet->>'packetSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_packet->>'preparedAt','') !~ 'Z$'
      or coalesce(v_audit->>'schemaVersion','') <> 'maha-epistemic-audit/1.0'
      or coalesce(v_audit->>'recordId','') <> v_packet->>'recordId'
      or coalesce(v_audit->>'candidateSha256','') <> v_packet->>'candidateSha256'
      or coalesce(v_audit->>'reviewTargetSha256','') <> v_packet->>'reviewTargetSha256'
      or coalesce(v_audit->>'status','') not in ('blocked','review-required','automated-checks-passed')
      or coalesce(v_audit->>'auditId','') !~ '^epiaudit_[a-f0-9]{32}$'
      or coalesce(v_audit->>'auditSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or not (p_run->'packetSha256s' @> jsonb_build_array(v_packet->>'packetSha256'))
      or not (p_run->'targetSha256s' @> jsonb_build_array(v_packet->>'reviewTargetSha256'))
    then raise exception 'Invalid reviewer packet or automated audit.' using errcode = '22023'; end if;

    if coalesce(jsonb_typeof(v_packet->'reviewScopes'),'') <> 'array'
    then raise exception 'Every reviewer packet must retain the four unreviewed scopes.' using errcode = '22023'; end if;
    if jsonb_array_length(v_packet->'reviewScopes') <> 4
      or (select count(distinct value->>'scope') from jsonb_array_elements(v_packet->'reviewScopes')) <> 4
      or exists (
        select 1 from jsonb_array_elements(v_packet->'reviewScopes') as review_scope(value)
        where coalesce(review_scope.value->>'scope','') not in ('source-fidelity','domain-fidelity','boundary-adequacy','rights-and-locator')
          or coalesce(review_scope.value->>'status','') <> 'unreviewed'
          or coalesce(jsonb_typeof(review_scope.value->'criteria'),'') <> 'array'
      )
    then raise exception 'Every reviewer packet must retain the four unreviewed scopes.' using errcode = '22023'; end if;

    select target.candidate_sha256, target.review_target_sha256, target.source_public_path, target.candidate_snapshot,
      target.target_origin, target.base_target_sha256, target.lineage_snapshot into v_target from (
      select candidate_sha256, review_target_sha256, source_public_path, record_snapshot->'candidateSnapshot' as candidate_snapshot,
        'ingestion'::text as target_origin, null::text as base_target_sha256, record_snapshot as lineage_snapshot, created_at as target_at
        from public.epistemic_ingestion_records where candidate_record_id = v_packet->>'recordId'
      union all
      select output_candidate_sha256 as candidate_sha256, output_review_target_sha256 as review_target_sha256,
        source_public_path, record_snapshot as candidate_snapshot, 'reingestion'::text as target_origin,
        base_target_sha256, compilation_snapshot as lineage_snapshot, compiled_at as target_at
        from public.epistemic_reingestion_compilations where candidate_record_id = v_packet->>'recordId'
    ) as target order by target.target_at desc limit 1;

    if not found
      or v_target.candidate_sha256 <> v_packet->>'candidateSha256'
      or v_target.review_target_sha256 <> v_packet->>'reviewTargetSha256'
      or v_target.source_public_path <> v_packet->>'sourcePublicPath'
      or v_target.candidate_snapshot <> v_packet->'candidateSnapshot'
      or v_target.candidate_snapshot->>'domainSlug' <> v_packet->>'domainSlug'
      or v_target.candidate_snapshot->>'title' <> v_packet->>'title'
      or v_target.target_origin <> v_packet#>>'{lineage,origin}'
      or coalesce(v_target.base_target_sha256,'') <> coalesce(v_packet#>>'{lineage,baseTargetSha256}','')
      or v_target.lineage_snapshot <> v_packet#>'{lineage,snapshot}'
      or coalesce(v_packet#>>'{candidateSnapshot,publication,reviewState}','') <> 'draft'
      or coalesce(v_packet#>>'{candidateSnapshot,publication,requestedPublicPromotion}','') <> 'false'
    then raise exception 'Reviewer packet is not bound to the latest immutable draft target.' using errcode = 'P0001'; end if;

    insert into public.epistemic_candidate_audits (
      audit_id, factory_run_id, candidate_record_id, candidate_sha256, review_target_sha256,
      status, finding_count, audit_sha256, audit_snapshot, audited_at, created_at
    ) values (
      v_audit->>'auditId', p_run->>'runId', v_packet->>'recordId', v_packet->>'candidateSha256', v_packet->>'reviewTargetSha256',
      v_audit->>'status', jsonb_array_length(coalesce(v_audit->'findings','[]'::jsonb)), v_audit->>'auditSha256', v_audit,
      (v_audit->>'auditedAt')::timestamptz, (v_audit->>'auditedAt')::timestamptz
    );

    insert into public.epistemic_review_packets (
      packet_id, factory_run_id, candidate_record_id, domain_slug, candidate_sha256,
      review_target_sha256, canonical_status, packet_sha256, packet_snapshot, prepared_at, created_at
    ) values (
      v_packet->>'packetId', p_run->>'runId', v_packet->>'recordId', v_packet->>'domainSlug', v_packet->>'candidateSha256',
      v_packet->>'reviewTargetSha256', v_packet->>'canonicalStatus', v_packet->>'packetSha256', v_packet,
      (v_packet->>'preparedAt')::timestamptz, (v_packet->>'preparedAt')::timestamptz
    );
  end loop;

  return jsonb_build_object('runId', p_run->>'runId', 'targetCount', v_packet_count, 'idempotentReplay', false);
end; $$;

revoke all on function public.record_epistemic_factory_run(jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_epistemic_factory_run(jsonb,jsonb,text,text) to service_role;

comment on table public.epistemic_factory_runs is 'Append-only Phase 5-8 noncanonical factory runs. A run is operational provenance, not publication or expert approval.';
comment on table public.epistemic_candidate_audits is 'Append-only automated source-to-claim and unsupported-inference audits. Automated checks cannot satisfy an expert-review scope.';
comment on table public.epistemic_review_packets is 'Append-only exact-hash reviewer packets. Packets remain private, noindex, noncanonical, and absent from the sitemap.';

notify pgrst, 'reload schema';
