-- Restore true request-level idempotency for the substantial-scale target
-- adapter. A transport retry rebuilds the unsigned batch envelope with a new
-- batch id and timestamp, so its batch digest is expected to differ. The
-- immutable source dataset digest is the revision boundary.

create or replace function public.record_substantial_scale_release_targets_v2(
  p_batch jsonb,
  p_records jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_ingestion_batches%rowtype;
begin
  if p_batch is null or jsonb_typeof(p_batch) <> 'object'
    or coalesce(p_batch->>'adapterId','') <> 'substantial-scale-release'
    or coalesce(p_batch->>'sourceDatasetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid substantial scale release replay request.' using errcode = '22023'; end if;

  select * into v_existing
    from public.epistemic_ingestion_batches
    where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing.adapter_id <> 'substantial-scale-release'
      or v_existing.source_dataset_sha256 <> p_batch->>'sourceDatasetSha256'
    then raise exception 'Substantial scale release idempotency cannot cross dataset revisions.' using errcode = 'P0001'; end if;
    return jsonb_build_object(
      'batchId', v_existing.batch_id,
      'recordCount', v_existing.record_count,
      'idempotentReplay', true
    );
  end if;

  return public.record_substantial_scale_release_targets(
    p_batch,
    p_records,
    p_idempotency_hash,
    p_actor_fingerprint
  );
end; $$;

revoke all on function public.record_substantial_scale_release_targets_v2(jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_substantial_scale_release_targets_v2(jsonb,jsonb,text,text) to service_role;

comment on function public.record_substantial_scale_release_targets_v2(jsonb,jsonb,text,text) is
  'Replays one substantial-scale ingestion request when its immutable source dataset digest matches, without treating a regenerated transport envelope as a new revision.';

notify pgrst, 'reload schema';
