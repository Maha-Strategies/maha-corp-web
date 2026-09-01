-- Batch 11: make the release content comparison reachable.
--
-- The execution migration wrote the frozen-target comparison as
--
--   record_snapshot->'candidateSnapshot' - 'publication'
--
-- and `-` binds tighter than `->`, so PostgreSQL reads that as
-- record_snapshot -> ('candidateSnapshot' - 'publication'). Both operands are
-- untyped, no `-` operator is unique for unknown/unknown, and the function
-- raises SQLSTATE 42725 before it can compare anything. 42725 is not one of the
-- codes the release route classifies, so every attempt surfaced as a 503.
--
-- Run 33498939287 stopped there. The whole path was then rebuilt locally - the
-- six migrations, five ingestion records, twenty scoped approvals, two lineage
-- witnesses - and reproduced it exactly.
--
-- This replaces the function with the comparison parenthesised. Nothing else
-- changes: same signature, same validations, same error codes, same grants. The
-- comparison is the one proving released content equals the frozen target, so
-- this does not relax it - it makes it run for the first time.
--
-- A forward migration rather than an edit, because the execution migration is
-- already committed and may have been applied elsewhere.

create or replace function public.record_batch_11_rehearsal_canonical_release(
  p_release jsonb,
  p_authority_sha256 text,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_canonical_releases%rowtype;
  v_target public.epistemic_ingestion_records%rowtype;
  v_witness public.batch_11_rehearsal_imported_lineage%rowtype;
  v_scope text;
  v_scope_count integer := 0;
  v_review public.epistemic_expert_review_decisions%rowtype;
  v_reason text;
  v_expected_path text;
begin
  if p_release is null or jsonb_typeof(p_release) <> 'object'
    or coalesce(p_release->>'schemaVersion','') <> 'maha-epistemic-release/1.0'
    or coalesce(p_release->>'releaseId','') !~ '^epirelease_[a-f0-9]{32}$'
    or coalesce(p_release->>'releaseKind','') not in ('initial','superseding')
    or coalesce(p_release->>'recordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_release->>'targetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_release->>'canonicalVersion','') !~ '^batch-11-preview-[a-z0-9._-]+$'
    or jsonb_typeof(p_release->'approvals') <> 'array' or jsonb_array_length(p_release->'approvals') <> 4
    or jsonb_typeof(p_release->'authority') <> 'object'
    or coalesce(p_release#>>'{authority,authorityId}','') !~ '^authority_[a-z0-9][a-z0-9_-]{6,63}$'
    or coalesce(p_release->>'authoritySha256','') <> p_authority_sha256
    or p_authority_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or char_length(coalesce(p_release->>'publicChangeSummary','')) not between 20 and 500
    or char_length(coalesce(p_release->>'rationale','')) not between 40 and 4000
    or coalesce(p_release->>'recordSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or jsonb_typeof(p_release->'recordSnapshot') <> 'object'
    or coalesce(p_release#>>'{gateDecision,publicEligible}','false') <> 'true'
    or jsonb_typeof(p_release#>'{gateDecision,reasons}') <> 'array'
    or jsonb_array_length(p_release#>'{gateDecision,reasons}') <> 0
    or coalesce(p_release->>'releaseSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_release->>'releasedAt','') !~ 'Z$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid Batch 11 rehearsal release.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_canonical_releases where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('releaseId', v_existing.release_id, 'canonicalPath', v_existing.canonical_path, 'idempotentReplay', true); end if;
  if exists (select 1 from public.epistemic_canonical_releases where candidate_record_id = p_release->>'recordId')
  then raise exception 'Batch 11 rehearsal permits exactly one new release per record.' using errcode = 'P0001'; end if;

  select * into v_target from public.epistemic_ingestion_records
    where adapter_id = 'batch-11-mixed-lineage-rehearsal'
      and candidate_record_id = p_release->>'recordId'
      and review_target_sha256 = p_release->>'targetSha256'
    order by created_at desc limit 1;
  if not found then raise exception 'Exact Batch 11 target not found.' using errcode = 'P0002'; end if;
  if (v_target.record_snapshot->'candidateSnapshot') - 'publication' <> (p_release->'recordSnapshot') - 'publication'
  then raise exception 'Released content differs from the frozen Batch 11 target.' using errcode = 'P0001'; end if;
  if v_target.record_snapshot#>>'{candidateSnapshot,id}' <> p_release->>'recordId'
    or v_target.record_snapshot#>>'{candidateSnapshot,domainSlug}' <> p_release->>'domainSlug'
  then raise exception 'Released identity differs from the frozen Batch 11 target.' using errcode = 'P0001'; end if;

  for v_reason in select jsonb_array_elements_text(coalesce(v_target.gate_decision->'reasons','[]'::jsonb)) loop
    if v_reason not in ('public-promotion-not-requested','review-state-not-canonical','publication-date-missing','canonical-version-missing','approval-review-missing')
      and v_reason not like 'expert-review-%'
    then raise exception 'The frozen Batch 11 target retains a non-release blocker: %', v_reason using errcode = 'P0001'; end if;
  end loop;

  v_expected_path := format('/knowledge/%s/%s/%s',
    v_target.record_snapshot#>>'{candidateSnapshot,domainSlug}',
    case when v_target.record_snapshot#>>'{candidateSnapshot,recordKind}' = 'hypothesis'
      then 'hypotheses'
      else (v_target.record_snapshot#>>'{candidateSnapshot,recordKind}') || 's'
    end,
    v_target.record_snapshot#>>'{candidateSnapshot,slug}');
  if p_release->>'canonicalPath' <> v_expected_path
    or p_release#>>'{recordSnapshot,publication,requestedPublicPromotion}' <> 'true'
    or p_release#>>'{recordSnapshot,publication,reviewState}' <> 'published-canonical'
    or p_release#>>'{recordSnapshot,publication,canonicalVersion}' <> p_release->>'canonicalVersion'
    or coalesce(p_release#>>'{recordSnapshot,publication,publishedAt}','') !~ '^\d{4}-\d{2}-\d{2}$'
  then raise exception 'Batch 11 canonical publication controls or path are invalid.' using errcode = 'P0001'; end if;

  for v_scope in select jsonb_array_elements_text(v_target.record_snapshot#>'{candidateSnapshot,publication,requiredReviewScopes}') loop
    v_scope_count := v_scope_count + 1;
    select * into v_review from public.epistemic_expert_review_decisions
      where candidate_record_id = p_release->>'recordId'
        and target_sha256 = p_release->>'targetSha256'
        and review_scope = v_scope
      order by reviewed_at desc, created_at desc limit 1;
    if not found or v_review.decision <> 'approve'
    then raise exception 'Batch 11 scope % lacks an exact approval.', v_scope using errcode = 'P0001'; end if;
    if not exists (
      select 1 from jsonb_array_elements(p_release->'approvals') approval
      where approval->>'scope' = v_scope
        and approval->>'reviewId' = v_review.review_id
        and approval->>'reviewSha256' = v_review.review_sha256
    ) then raise exception 'Batch 11 approval manifest does not match %.', v_scope using errcode = 'P0001'; end if;
    if not exists (
      select 1 from jsonb_array_elements(p_release#>'{recordSnapshot,publication,reviewEvents}') event
      where event->>'scope' = v_scope
        and event->>'reviewId' = v_review.review_id
        and event->>'targetSha256' = p_release->>'targetSha256'
        and event->>'verdict' = 'approve'
    ) then raise exception 'Batch 11 canonical record does not embed the exact % approval.', v_scope using errcode = 'P0001'; end if;
  end loop;
  if v_scope_count <> 4 then raise exception 'Batch 11 requires four exact review scopes.' using errcode = 'P0001'; end if;

  select * into v_witness from public.batch_11_rehearsal_imported_lineage where record_id = p_release->>'recordId';
  if found then
    if p_release->>'releaseKind' <> 'superseding'
      or p_release->>'supersedesReleaseId' <> v_witness.prior_release_id
      or p_release->>'targetSha256' = v_witness.prior_target_sha256
    then raise exception 'Batch 11 superseding release does not match its external predecessor witness.' using errcode = 'P0001'; end if;
  elsif p_release->>'releaseKind' <> 'initial' or nullif(p_release->>'supersedesReleaseId','') is not null then
    raise exception 'Batch 11 initial release cannot supersede anything.' using errcode = 'P0001';
  end if;

  insert into public.epistemic_canonical_releases (
    release_id, schema_version, release_kind, candidate_record_id, domain_slug,
    target_sha256, canonical_path, canonical_version, supersedes_release_id,
    approvals, authority_id, authority_sha256, authority_snapshot, public_change_summary, rationale,
    record_sha256, record_snapshot, gate_decision, release_sha256, release_snapshot,
    actor_fingerprint, idempotency_hash, released_at, created_at
  ) values (
    p_release->>'releaseId', p_release->>'schemaVersion', p_release->>'releaseKind', p_release->>'recordId', p_release->>'domainSlug',
    p_release->>'targetSha256', p_release->>'canonicalPath', p_release->>'canonicalVersion', nullif(p_release->>'supersedesReleaseId',''),
    p_release->'approvals', p_release#>>'{authority,authorityId}', p_authority_sha256, p_release->'authority', p_release->>'publicChangeSummary', p_release->>'rationale',
    p_release->>'recordSha256', p_release->'recordSnapshot', p_release->'gateDecision', p_release->>'releaseSha256', p_release,
    p_actor_fingerprint, p_idempotency_hash, (p_release->>'releasedAt')::timestamptz, (p_release->>'releasedAt')::timestamptz
  );
  return jsonb_build_object('releaseId', p_release->>'releaseId', 'canonicalPath', p_release->>'canonicalPath', 'idempotentReplay', false);
end; $$;

revoke all on function public.record_batch_11_rehearsal_canonical_release(jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.record_batch_11_rehearsal_canonical_release(jsonb,text,text,text) to service_role;

notify pgrst, 'reload schema';
