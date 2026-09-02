-- Release readiness policy v2: a second, disjoint assurance path.
--
-- Until now a candidate became releasable one way: four scoped expert
-- approvals. That path is unchanged here, and nothing about it is relaxed.
--
-- What this adds is a separate path for an automated internal editorial
-- reviewer with its own five axes and its own public label. The two are
-- disjunctive, never additive: a machine axis is never counted toward an
-- expert scope, and a bundle carrying both kinds satisfies neither, because a
-- review that half happened is not a review.
--
-- Every decision binds to the candidate target, which is the record hashed
-- without its publication envelope. That exclusion is deliberate: release
-- bookkeeping must not be able to invalidate a review that examined content.
-- Supplying a record-revision digest instead therefore fails as a stale target
-- rather than quietly matching.
--
-- A forward migration. No earlier file is edited.

create or replace function public.evaluate_release_readiness_v2(
  p_target text,
  p_decisions jsonb,
  p_alignment_audit_target text,
  p_alignment_clear boolean,
  p_active_release_target text,
  p_release_authority_separate boolean
) returns jsonb language plpgsql immutable set search_path = public, extensions as $$
declare
  v_refusals text[] := array[]::text[];
  v_kinds text[];
  v_machine boolean;
  v_expert boolean;
  v_required text[];
  v_scope text;
  v_matching jsonb;
  v_count int;
  v_distinct int;
  v_extra int;
  v_path text := null;
  v_label text := null;
  v_expert_scopes constant text[] := array[
    'source-fidelity', 'domain-fidelity', 'boundary-adequacy', 'rights-and-locator'];
  v_machine_axes constant text[] := array[
    'source-identity-and-fidelity', 'claim-to-passage-support',
    'scope-and-unsupported-inference', 'rights-and-locator-adequacy',
    'release-boundary-and-nonclaims'];
  v_expert_kinds constant text[] := array['expert', 'external-expert', 'domain-expert'];
begin
  if p_decisions is null or jsonb_typeof(p_decisions) <> 'array' or jsonb_array_length(p_decisions) = 0 then
    return jsonb_build_object('ready', false, 'path', null, 'assuranceLabel', null,
      'refusals', to_jsonb(array['no-decisions']), 'policyVersion', 2);
  end if;

  -- Every decision must bind to the target under evaluation. A record-revision
  -- digest supplied here does not match and is refused as stale.
  if exists (
    select 1 from jsonb_array_elements(p_decisions) d
    where d->>'boundTarget' is distinct from p_target
  ) then
    v_refusals := v_refusals || 'stale-target'::text;
  end if;

  if (select count(distinct d->>'policyVersion') from jsonb_array_elements(p_decisions) d) > 1 then
    v_refusals := v_refusals || 'inconsistent-policy-version'::text;
  end if;

  select array_agg(distinct d->>'reviewerKind') into v_kinds
  from jsonb_array_elements(p_decisions) d;

  v_machine := (array_length(v_kinds, 1) = 1 and v_kinds[1] = 'automated-internal-editorial');
  v_expert := (select bool_and(k = any(v_expert_kinds)) from unnest(v_kinds) k);

  if not v_machine and not v_expert then
    -- Unknown kinds fail closed; a recognised mixture fails as a mixed bundle.
    if exists (
      select 1 from unnest(v_kinds) k
      where k <> 'automated-internal-editorial' and not (k = any(v_expert_kinds))
    ) then
      v_refusals := v_refusals || 'unknown-reviewer-kind'::text;
    else
      v_refusals := v_refusals || 'mixed-policy-bundle'::text;
    end if;
  end if;

  -- An already-released target is classified separately, never re-released.
  if p_active_release_target is not null and p_active_release_target = p_target then
    v_refusals := v_refusals || 'already-released-at-target'::text;
  end if;
  if p_release_authority_separate is distinct from true then
    v_refusals := v_refusals || 'release-authority-not-separate'::text;
  end if;
  if p_alignment_clear is distinct from true then
    v_refusals := v_refusals || 'alignment-not-clear'::text;
  end if;
  if p_alignment_audit_target is distinct from p_target then
    v_refusals := v_refusals || 'alignment-audit-target-mismatch'::text;
  end if;

  if v_machine then
    v_required := v_machine_axes;
    -- A machine decision that names a person is claiming a human looked at it.
    if exists (
      select 1 from jsonb_array_elements(p_decisions) d
      where coalesce(d->>'personAttribution', '') <> ''
    ) then
      v_refusals := v_refusals || 'person-attribution-on-machine-decision'::text;
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_decisions) d
      where coalesce((d->>'inspectedContent')::boolean, false) is not true
    ) then
      v_refusals := v_refusals || 'content-not-inspected'::text;
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_decisions) d
      where coalesce(d->>'exactLocator', '') = ''
    ) then
      v_refusals := v_refusals || 'locator-missing'::text;
    end if;
  elsif v_expert then
    v_required := v_expert_scopes;
  else
    v_required := null;
  end if;

  if v_required is not null then
    foreach v_scope in array v_required loop
      select jsonb_agg(d) into v_matching
      from jsonb_array_elements(p_decisions) d
      where d->>'scope' = v_scope;

      if v_matching is null then
        v_refusals := v_refusals || 'missing-axis'::text;
      else
        v_count := jsonb_array_length(v_matching);
        select count(distinct e->>'decision') into v_distinct from jsonb_array_elements(v_matching) e;
        if v_count > 1 then
          v_refusals := v_refusals || (case when v_distinct > 1 then 'conflicting-axis' else 'duplicate-axis' end)::text;
        end if;
        if exists (select 1 from jsonb_array_elements(v_matching) e where e->>'decision' <> 'approve') then
          v_refusals := v_refusals || 'not-approved'::text;
        end if;
      end if;
    end loop;

    -- Any scope outside the path's own vocabulary makes the bundle mixed, so
    -- expert decisions can never be silently counted as machine axes.
    select count(*) into v_extra
    from (select distinct d->>'scope' as s from jsonb_array_elements(p_decisions) d) x
    where not (x.s = any(v_required));
    if v_extra > 0 then
      v_refusals := v_refusals || 'mixed-policy-bundle'::text;
    end if;
  end if;

  select array_agg(distinct r) into v_refusals from unnest(v_refusals) r;
  v_refusals := coalesce(v_refusals, array[]::text[]);

  if array_length(v_refusals, 1) is null then
    if v_machine then
      v_path := 'B'; v_label := 'automated-internal-review-canonical';
    elsif v_expert then
      v_path := 'A'; v_label := 'expert-reviewed-canonical';
    end if;
  end if;

  return jsonb_build_object(
    'ready', array_length(v_refusals, 1) is null,
    'path', v_path,
    'assuranceLabel', v_label,
    'refusals', to_jsonb(v_refusals),
    'policyVersion', 2
  );
end;
$$;

comment on function public.evaluate_release_readiness_v2 is
  'Disjunctive readiness: four expert scopes, or five automated internal editorial axes. Readiness is not a release; the release path still requires separate authority.';
