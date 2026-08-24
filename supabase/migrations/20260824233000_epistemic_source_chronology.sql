-- Some authoritative sources are undated or maintained as living documents.
-- Extend the existing evidence-bound compiler without weakening its lineage,
-- review-reset, idempotency, or non-publication checks. An access date is kept
-- inside sourceChronology and is never substituted for publishedAt.

do $migration$
declare
  v_body text;
  v_old text := $old$
    elsif v_blocker like 'source-publication-date-missing:%' then
      v_entity_id := substr(v_blocker, char_length('source-publication-date-missing:') + 1);
      if v_proposed_value !~ '^\d{4}-\d{2}-\d{2}$'
        or not exists (select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,sources}') item where item->>'id' = v_entity_id and item->>'publishedAt' = v_proposed_value)
      then raise exception 'Compiled source publication date does not match the correction.' using errcode = 'P0001'; end if;
$old$;
  v_new text := $new$
    elsif v_blocker like 'source-publication-date-missing:%' then
      v_entity_id := substr(v_blocker, char_length('source-publication-date-missing:') + 1);
      if v_proposed_value ~ '^\d{4}-\d{2}-\d{2}$' then
        if not exists (
          select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,sources}') item
          where item->>'id' = v_entity_id
            and item->>'publishedAt' = v_proposed_value
            and item->'sourceChronology' is null
        ) then raise exception 'Compiled source publication date does not match the correction.' using errcode = 'P0001'; end if;
      else
        begin
          if jsonb_typeof(v_proposed_value::jsonb) <> 'object'
            or coalesce(v_proposed_value::jsonb->>'status','') not in ('undated','living-document')
            or coalesce(v_proposed_value::jsonb->>'accessedAt','') !~ '^\d{4}-\d{2}-\d{2}$'
            or exists (
              select 1 from jsonb_object_keys(v_proposed_value::jsonb) key
              where key not in ('status','accessedAt','sourceVersion')
            )
            or not exists (
              select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,sources}') item
              where item->>'id' = v_entity_id
                and coalesce(item->>'publishedAt','') = ''
                and item->'sourceChronology' = v_proposed_value::jsonb
            )
          then raise exception 'Compiled source chronology does not match the correction.' using errcode = 'P0001'; end if;
        exception when invalid_text_representation then
          raise exception 'Compiled source chronology is not valid JSON.' using errcode = 'P0001';
        end;
      end if;
$new$;
begin
  select procedure.prosrc into v_body
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'record_epistemic_reingestion_compilation'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_compilation jsonb, p_idempotency_hash text, p_actor_fingerprint text';

  if v_body is null then
    raise exception 'The controlled re-ingestion function is missing.';
  end if;
  if strpos(v_body, v_old) = 0 then
    raise exception 'The controlled re-ingestion source-date validator does not match the expected fail-closed definition.';
  end if;
  if strpos(substr(v_body, strpos(v_body, v_old) + char_length(v_old)), v_old) > 0 then
    raise exception 'The controlled re-ingestion source-date validator occurs more than once.';
  end if;

  v_body := replace(v_body, v_old, v_new);
  execute format(
    'create or replace function public.record_epistemic_reingestion_compilation(p_compilation jsonb, p_idempotency_hash text, p_actor_fingerprint text) returns jsonb language plpgsql security definer set search_path = public, extensions as %L',
    v_body
  );
end;
$migration$;

comment on function public.record_epistemic_reingestion_compilation(jsonb, text, text) is
  'Append-only controlled compiler. A source-date blocker may resolve to a real publication date or evidence-bound undated/living-document chronology with an access date; neither path grants publication authority.';
