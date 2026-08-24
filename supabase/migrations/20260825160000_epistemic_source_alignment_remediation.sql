-- Make factory-detected source-to-claim mismatches actionable without weakening
-- immutable lineage, evidence binding, review reset, or publication controls.
-- A correction can refine one source's declared scope, replace it while
-- explicitly remapping every linked claim, or split a multi-claim source.

do $migration$
declare
  v_body text;
  v_old text;
  v_new text;
begin
  select procedure.prosrc into v_body
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'record_epistemic_source_completion_event'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_event jsonb, p_idempotency_hash text, p_actor_fingerprint text';

  if v_body is null then raise exception 'The source-completion function is missing.'; end if;

  v_old := $old$  v_target_gate jsonb;
  v_previous_state text := 'untriaged';$old$;
  v_new := $new$  v_target_gate jsonb;
  v_target_snapshot jsonb;
  v_previous_state text := 'untriaged';$new$;
  if strpos(v_body, v_old) = 0 then raise exception 'The source-completion declaration does not match the expected definition.'; end if;
  v_body := replace(v_body, v_old, v_new);

  v_old := $old$  select target.gate_decision into v_target_gate from (
    select gate_decision, created_at as target_at from public.epistemic_ingestion_records
      where candidate_record_id = p_event->>'recordId' and review_target_sha256 = p_event->>'targetSha256'
    union all
    select gate_decision, compiled_at as target_at from public.epistemic_reingestion_compilations
      where candidate_record_id = p_event->>'recordId' and output_review_target_sha256 = p_event->>'targetSha256'
  ) as target order by target.target_at desc limit 1;
  if v_target_gate is null then raise exception 'Frozen source-completion target not found.' using errcode = 'P0002'; end if;$old$;
  v_new := $new$  select target.gate_decision, target.record_snapshot into v_target_gate, v_target_snapshot from (
    select gate_decision, record_snapshot->'candidateSnapshot' as record_snapshot, created_at as target_at from public.epistemic_ingestion_records
      where candidate_record_id = p_event->>'recordId' and review_target_sha256 = p_event->>'targetSha256'
    union all
    select gate_decision, record_snapshot, compiled_at as target_at from public.epistemic_reingestion_compilations
      where candidate_record_id = p_event->>'recordId' and output_review_target_sha256 = p_event->>'targetSha256'
  ) as target order by target.target_at desc limit 1;
  if v_target_gate is null or v_target_snapshot is null then raise exception 'Frozen source-completion target not found.' using errcode = 'P0002'; end if;$new$;
  if strpos(v_body, v_old) = 0 then raise exception 'The source-completion target lookup does not match the expected definition.'; end if;
  v_body := replace(v_body, v_old, v_new);

  v_old := $old$    if not (coalesce(v_target_gate->'reasons', '[]'::jsonb) ? v_blocker)
      or v_blocker like 'expert-review-%'
      or v_blocker in ('approval-review-missing','public-promotion-not-requested','review-state-not-canonical','publication-date-missing','canonical-version-missing')
    then raise exception 'Blocker is not a source-completion blocker on the frozen target.' using errcode = 'P0001'; end if;$old$;
  v_new := $new$    if not (
        coalesce(v_target_gate->'reasons', '[]'::jsonb) ? v_blocker
        or (
          v_blocker like 'source-claim-alignment-mismatch:%'
          and exists (
            select 1 from jsonb_array_elements(v_target_snapshot->'sources') source
            where source->>'id' = substr(v_blocker, char_length('source-claim-alignment-mismatch:') + 1)
              and concat_ws(E'\n', source->>'exactLocator', source->>'establishes', source->>'boundary')
                ~* '(no supporting passage|no passage.{0,40}located|could not be matched|does not establish|do not establish|not a matching source|does not support)'
          )
        )
      )
      or v_blocker like 'expert-review-%'
      or v_blocker in ('approval-review-missing','public-promotion-not-requested','review-state-not-canonical','publication-date-missing','canonical-version-missing')
    then raise exception 'Blocker is not a source-completion blocker on the frozen target.' using errcode = 'P0001'; end if;$new$;
  if strpos(v_body, v_old) = 0 then raise exception 'The source-completion blocker validator does not match the expected definition.'; end if;
  v_body := replace(v_body, v_old, v_new);

  execute format(
    'create or replace function public.record_epistemic_source_completion_event(p_event jsonb, p_idempotency_hash text, p_actor_fingerprint text) returns jsonb language plpgsql security definer set search_path = public, extensions as %L',
    v_body
  );
end;
$migration$;

do $migration$
declare
  v_body text;
  v_old text;
  v_new text;
begin
  select procedure.prosrc into v_body
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'record_epistemic_reingestion_compilation'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_compilation jsonb, p_idempotency_hash text, p_actor_fingerprint text';

  if v_body is null then raise exception 'The controlled re-ingestion function is missing.'; end if;

  v_old := $old$      or not (coalesce(v_base_gate->'reasons','[]'::jsonb) ? v_blocker)
      or not (p_compilation->'resolvedBlockerCodes' ? v_blocker)$old$;
  v_new := $new$      or not (
        coalesce(v_base_gate->'reasons','[]'::jsonb) ? v_blocker
        or (
          v_blocker like 'source-claim-alignment-mismatch:%'
          and exists (
            select 1 from jsonb_array_elements(v_base_snapshot->'sources') source
            where source->>'id' = substr(v_blocker, char_length('source-claim-alignment-mismatch:') + 1)
              and concat_ws(E'\n', source->>'exactLocator', source->>'establishes', source->>'boundary')
                ~* '(no supporting passage|no passage.{0,40}located|could not be matched|does not establish|do not establish|not a matching source|does not support)'
          )
        )
      )
      or not (p_compilation->'resolvedBlockerCodes' ? v_blocker)$new$;
  if strpos(v_body, v_old) = 0 then raise exception 'The controlled compiler blocker validator does not match the expected definition.'; end if;
  v_body := replace(v_body, v_old, v_new);

  v_old := $old$    elsif v_blocker like 'claim-evidence-not-assessed:%' then
      v_entity_id := substr(v_blocker, char_length('claim-evidence-not-assessed:') + 1);
      if v_proposed_value not in ('not-applicable','single-study','multi-study','independently-replicated','contested','historical-attestation','formally-verified')
        or not exists (select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,claims}') item where item->>'id' = v_entity_id and item->>'evidenceMaturity' = v_proposed_value)
      then raise exception 'Compiled claim evidence maturity does not match the correction.' using errcode = 'P0001'; end if;
    else$old$;
  v_new := $new$    elsif v_blocker like 'claim-evidence-not-assessed:%' then
      v_entity_id := substr(v_blocker, char_length('claim-evidence-not-assessed:') + 1);
      if v_proposed_value not in ('not-applicable','single-study','multi-study','independently-replicated','contested','historical-attestation','formally-verified')
        or not exists (select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,claims}') item where item->>'id' = v_entity_id and item->>'evidenceMaturity' = v_proposed_value)
      then raise exception 'Compiled claim evidence maturity does not match the correction.' using errcode = 'P0001'; end if;
    elsif v_blocker like 'source-claim-alignment-mismatch:%' then
      v_entity_id := substr(v_blocker, char_length('source-claim-alignment-mismatch:') + 1);
      begin
        if jsonb_typeof(v_proposed_value::jsonb) <> 'object'
          or coalesce(v_proposed_value::jsonb->>'mode','') not in ('refine','replace','split')
        then raise exception 'Alignment correction must be a refine, replace, or split object.' using errcode = 'P0001'; end if;

        if v_proposed_value::jsonb->>'mode' = 'refine' then
          if not exists (
            select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,sources}') source
            where source->>'id' = v_entity_id
              and source->>'establishes' = v_proposed_value::jsonb->>'establishes'
              and source->>'boundary' = v_proposed_value::jsonb->>'boundary'
          ) then raise exception 'Compiled alignment refinement does not match the correction.' using errcode = 'P0001'; end if;
        elsif v_proposed_value::jsonb->>'mode' = 'replace' then
          if jsonb_typeof(v_proposed_value::jsonb->'replacement') <> 'object'
            or jsonb_typeof(v_proposed_value::jsonb->'claimIds') <> 'array'
            or jsonb_array_length(v_proposed_value::jsonb->'claimIds') < 1
            or exists (
              select 1 from jsonb_array_elements(v_base_snapshot->'claims') claim
              where claim->'sourceIds' ? v_entity_id
                and not (v_proposed_value::jsonb->'claimIds' ? (claim->>'id'))
            )
            or exists (
              select 1 from jsonb_array_elements_text(v_proposed_value::jsonb->'claimIds') claim_id
              where not exists (
                select 1 from jsonb_array_elements(v_base_snapshot->'claims') claim
                where claim->>'id' = claim_id and claim->'sourceIds' ? v_entity_id
              )
            )
            or not exists (
              select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,sources}') source
              where source->>'id' = v_proposed_value::jsonb#>>'{replacement,id}'
                and source->>'url' = v_proposed_value::jsonb#>>'{replacement,url}'
                and source->>'exactLocator' = v_proposed_value::jsonb#>>'{replacement,exactLocator}'
                and source->>'establishes' = v_proposed_value::jsonb#>>'{replacement,establishes}'
                and source->>'boundary' = v_proposed_value::jsonb#>>'{replacement,boundary}'
            )
            or exists (
              select 1 from jsonb_array_elements_text(v_proposed_value::jsonb->'claimIds') claim_id
              where not exists (
                select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,claims}') claim
                where claim->>'id' = claim_id
                  and claim->'sourceIds' ? (v_proposed_value::jsonb#>>'{replacement,id}')
                  and not (claim->'sourceIds' ? v_entity_id)
              )
            )
          then raise exception 'Compiled alignment replacement does not match the correction.' using errcode = 'P0001'; end if;
        else
          if jsonb_typeof(v_proposed_value::jsonb->'retained') <> 'object'
            or jsonb_typeof(v_proposed_value::jsonb->'addition') <> 'object'
            or jsonb_typeof(v_proposed_value::jsonb->'claimIds') <> 'array'
            or jsonb_array_length(v_proposed_value::jsonb->'claimIds') < 1
            or jsonb_array_length(v_proposed_value::jsonb->'claimIds') >= (
              select count(*) from jsonb_array_elements(v_base_snapshot->'claims') claim
              where claim->'sourceIds' ? v_entity_id
            )
            or exists (
              select 1 from jsonb_array_elements_text(v_proposed_value::jsonb->'claimIds') claim_id
              where not exists (
                select 1 from jsonb_array_elements(v_base_snapshot->'claims') claim
                where claim->>'id' = claim_id and claim->'sourceIds' ? v_entity_id
              )
            )
            or exists (
              select 1 from jsonb_array_elements(v_base_snapshot->'sources') source
              where source->>'id' = v_proposed_value::jsonb#>>'{addition,id}'
            )
            or not exists (
              select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,sources}') source
              where source->>'id' = v_entity_id
                and source->>'establishes' = v_proposed_value::jsonb#>>'{retained,establishes}'
                and source->>'boundary' = v_proposed_value::jsonb#>>'{retained,boundary}'
            )
            or not exists (
              select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,sources}') source
              where source->>'id' = v_proposed_value::jsonb#>>'{addition,id}'
                and source->>'url' = v_proposed_value::jsonb#>>'{addition,url}'
                and source->>'exactLocator' = v_proposed_value::jsonb#>>'{addition,exactLocator}'
                and source->>'establishes' = v_proposed_value::jsonb#>>'{addition,establishes}'
                and source->>'boundary' = v_proposed_value::jsonb#>>'{addition,boundary}'
            )
            or exists (
              select 1 from jsonb_array_elements_text(v_proposed_value::jsonb->'claimIds') claim_id
              where not exists (
                select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,claims}') claim
                where claim->>'id' = claim_id
                  and claim->'sourceIds' ? (v_proposed_value::jsonb#>>'{addition,id}')
                  and not (claim->'sourceIds' ? v_entity_id)
              )
            )
            or exists (
              select 1 from jsonb_array_elements(v_base_snapshot->'claims') base_claim
              where base_claim->'sourceIds' ? v_entity_id
                and not (v_proposed_value::jsonb->'claimIds' ? (base_claim->>'id'))
                and not exists (
                  select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,claims}') output_claim
                  where output_claim->>'id' = base_claim->>'id'
                    and output_claim->'sourceIds' ? v_entity_id
                    and not (output_claim->'sourceIds' ? (v_proposed_value::jsonb#>>'{addition,id}'))
                )
            )
          then raise exception 'Compiled alignment split does not match the correction.' using errcode = 'P0001'; end if;
        end if;

        if exists (
          select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,sources}') source
          where source->>'id' in (
            v_entity_id,
            coalesce(v_proposed_value::jsonb#>>'{replacement,id}', v_proposed_value::jsonb#>>'{addition,id}', v_entity_id)
          )
            and exists (
              select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,claims}') claim
              where claim->'sourceIds' ? (source->>'id')
            )
            and concat_ws(E'\n', source->>'exactLocator', source->>'establishes', source->>'boundary')
              ~* '(no supporting passage|no passage.{0,40}located|could not be matched|does not establish|do not establish|not a matching source|does not support)'
        ) then raise exception 'Compiled source remains explicitly mismatched.' using errcode = 'P0001'; end if;
      exception when invalid_text_representation then
        raise exception 'Alignment correction is not valid JSON.' using errcode = 'P0001';
      end;
    else$new$;
  if strpos(v_body, v_old) = 0 then raise exception 'The controlled compiler correction switch does not match the expected definition.'; end if;
  v_body := replace(v_body, v_old, v_new);

  execute format(
    'create or replace function public.record_epistemic_reingestion_compilation(p_compilation jsonb, p_idempotency_hash text, p_actor_fingerprint text) returns jsonb language plpgsql security definer set search_path = public, extensions as %L',
    v_body
  );
end;
$migration$;

revoke all on function public.record_epistemic_source_completion_event(jsonb,text,text) from public, anon, authenticated;
revoke all on function public.record_epistemic_reingestion_compilation(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_epistemic_source_completion_event(jsonb,text,text) to service_role;
grant execute on function public.record_epistemic_reingestion_compilation(jsonb,text,text) to service_role;

comment on function public.record_epistemic_reingestion_compilation(jsonb, text, text) is
  'Append-only controlled compiler supporting evidence-bound source alignment refinement, complete linked-claim source replacement, or bounded source splitting. Every output remains a noncanonical draft requiring fresh scoped review.';

notify pgrst, 'reload schema';
