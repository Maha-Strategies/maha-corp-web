import { z } from 'zod'
import { input, object, records, id, digest, utc, signed, count, field, list, spec, hash, otherHash, time, later, finding as f, metric as m, unique, cycles, type AuditSpec } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
const prefix = 'technical-manuals-'
const row = { id: 'step1', manualId: 'm1', editionDigest: hash, modelId: 'model1', sourcePage: 1, procedureDigest: hash }
const step = object({ id, manualId: id, editionDigest: digest, modelId: id, sourcePage: count, procedureDigest: digest })
const units = z.enum(['m', 'mm', 's', 'ms', 'Nm'])
const scalar = { name: 'durationMs', type: 'integer', required: true, nullable: false }
export const BATCH5_MANUALS: AuditSpec[] = [
  spec(prefix + 'required-field-coverage', 'Report missing model, edition and source-page metadata in supplied procedure records. No manual completeness, instruction execution or engineering certification.',
    input({ steps: records({ modelId: id.nullable(), editionDigest: digest.nullable(), sourcePage: count.nullable() }) }),
    { steps: [{ id: 's1', modelId: 'model1', editionDigest: hash, sourcePage: 0 }] },
    { steps: [{ id: 's1', modelId: null, editionDigest: hash, sourcePage: 0 }] },
    ['manual-model-missing', 'manual-edition-missing', 'manual-page-missing'], ['missing-field-count'], i => {
      unique(i.steps.map(r => r.id)); const findings = i.steps.flatMap(r => [...(r.modelId === null ? [f('manual-model-missing', r.id)] : []), ...(r.editionDigest === null ? [f('manual-edition-missing', r.id)] : []), ...(r.sourcePage === null ? [f('manual-page-missing', r.id)] : [])])
      return { findings, metrics: [m('missing-field-count', 'manual', findings.length)] }
    }),
  spec(prefix + 'duplicate-record-identities', 'Detect repeated manual/edition/model/step identities with identical or conflicting procedure digests. Steps in different model variants remain separate identities.',
    input({ steps: list(step, 1, 32) }), { steps: [row] }, { steps: [row, row] },
    ['manual-identical-step-duplicate', 'manual-conflicting-step-digest'], ['step-identity-groups'], i => {
      const groups = new Map<string, typeof i.steps>(); for (const r of i.steps) { const key = demandDigest([r.manualId, r.editionDigest, r.modelId, r.id]); groups.set(key, [...(groups.get(key) ?? []), r]) }
      return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(new Set(g.map(r => demandDigest(r))).size === 1 ? 'manual-identical-step-duplicate' : 'manual-conflicting-step-digest', ...g.map(r => r.id))), metrics: [m('step-identity-groups', 'manual', groups.size)] }
    }),
  spec(prefix + 'unit-label-consistency', 'Check declared manual parameter quantity/unit pairs and conflicting labels for repeated parameters. Does not infer conversions, acceptable tolerances or safe operating settings.',
    input({ parameters: records({ parameterId: id, quantity: z.enum(['length', 'duration', 'torque']), unit: units }) }),
    { parameters: [{ id: 'r1', parameterId: 'width', quantity: 'length', unit: 'mm' }] },
    { parameters: [{ id: 'r1', parameterId: 'width', quantity: 'length', unit: 's' }] },
    ['manual-quantity-unit-mismatch', 'manual-parameter-unit-conflict'], ['checked-parameters'], i => {
      unique(i.parameters.map(r => r.id)); const allowed = { length: ['m', 'mm'], duration: ['s', 'ms'], torque: ['Nm'] }, findings = i.parameters.filter(r => !allowed[r.quantity].includes(r.unit)).map(r => f('manual-quantity-unit-mismatch', r.id)), groups = new Map<string, typeof i.parameters>()
      for (const r of i.parameters) groups.set(r.parameterId, [...(groups.get(r.parameterId) ?? []), r])
      for (const g of groups.values()) if (new Set(g.map(r => r.quantity + ':' + r.unit)).size > 1) findings.push(f('manual-parameter-unit-conflict', ...g.map(r => r.id)))
      return { findings, metrics: [m('checked-parameters', 'manual', i.parameters.length)] }
    }),
  spec(prefix + 'timestamp-order-audit', 'Check declared manual publication/revision/retirement chronology and per-manual revision regressions. Does not establish the latest authorized instruction or a trusted timestamp.',
    input({ editions: records({ manualId: id, publishedAt: utc, revisedAt: utc, retiredAt: utc.nullable() }) }),
    { editions: [{ id: 'e1', manualId: 'm1', publishedAt: time, revisedAt: later, retiredAt: null }] },
    { editions: [{ id: 'e1', manualId: 'm1', publishedAt: later, revisedAt: time, retiredAt: null }] },
    ['manual-revision-before-publication', 'manual-retirement-before-revision', 'manual-revision-order-regression'], ['checked-editions'], i => {
      unique(i.editions.map(r => r.id)); const previous = new Map<string, string>(), findings = []
      for (const r of i.editions) { if (r.revisedAt < r.publishedAt) findings.push(f('manual-revision-before-publication', r.id)); if (r.retiredAt !== null && r.retiredAt < r.revisedAt) findings.push(f('manual-retirement-before-revision', r.id)); if (previous.has(r.manualId) && r.revisedAt < previous.get(r.manualId)!) findings.push(f('manual-revision-order-regression', r.id)); previous.set(r.manualId, r.revisedAt) }
      return { findings, metrics: [m('checked-editions', 'manual', i.editions.length)] }
    }),
  spec(prefix + 'revision-delta-map', 'Compare two pinned procedure projections for changed model, source page and procedure digest. Flags unchanged edition pins and changed step identities without interpreting instruction meaning.',
    input({ before: step, after: step }), { before: row, after: { ...row, editionDigest: otherHash } },
    { before: row, after: { ...row, editionDigest: otherHash, procedureDigest: otherHash } },
    ['manual-procedure-fields-changed', 'manual-edition-not-advanced', 'manual-step-identity-changed'], ['changed-procedure-fields'], i => {
      const n = (['modelId', 'sourcePage', 'procedureDigest'] as const).filter(k => i.before[k] !== i.after[k]).length
      return { findings: [...(n ? [f('manual-procedure-fields-changed', i.before.id)] : []), ...(i.before.editionDigest === i.after.editionDigest ? [f('manual-edition-not-advanced', i.before.id)] : []), ...(i.before.manualId !== i.after.manualId || i.before.id !== i.after.id ? [f('manual-step-identity-changed', i.before.id, i.after.id)] : [])], metrics: [m('changed-procedure-fields', 'manual', n)] }
    }),
  spec(prefix + 'source-coverage-map', 'Bind procedure metadata to supplied page content digests and edition pins. A matching manifest entry is not evidence of instruction adequacy, equipment compatibility or safe operation.',
    input({ pages: records({ editionDigest: digest, contentDigest: digest }, 0), steps: records({ pageId: id, editionDigest: digest, pageContentDigest: digest }) }),
    { pages: [{ id: 'page1', editionDigest: hash, contentDigest: hash }], steps: [{ id: 's1', pageId: 'page1', editionDigest: hash, pageContentDigest: hash }] },
    { pages: [], steps: [{ id: 's1', pageId: 'page1', editionDigest: hash, pageContentDigest: hash }] },
    ['manual-source-page-missing', 'manual-source-page-pin-mismatch'], ['bound-procedures'], i => {
      unique(i.pages.map(r => r.id)); unique(i.steps.map(r => r.id)); const pages = new Map(i.pages.map(r => [r.id, r])); let bound = 0
      const findings = i.steps.flatMap(r => { const p = pages.get(r.pageId); if (!p) return [f('manual-source-page-missing', r.id)]; if (p.editionDigest !== r.editionDigest || p.contentDigest !== r.pageContentDigest) return [f('manual-source-page-pin-mismatch', r.id)]; bound++; return [] })
      return { findings, metrics: [m('bound-procedures', 'manual', bound)] }
    }),
  spec(prefix + 'identifier-crosswalk-audit', 'Resolve supplied legacy procedure aliases to exact step/model identities; flag unknown targets or model mismatch. Does not search manuals or infer matching instructions.',
    input({ steps: records({ modelId: id }), aliases: records({ targetStepId: id, expectedModelId: id }) }),
    { steps: [{ id: 's1', modelId: 'model1' }], aliases: [{ id: 'old1', targetStepId: 's1', expectedModelId: 'model1' }] },
    { steps: [{ id: 's1', modelId: 'model1' }], aliases: [{ id: 'old1', targetStepId: 's1', expectedModelId: 'model2' }] },
    ['manual-alias-model-mismatch', 'manual-alias-step-missing'], ['resolved-aliases'], i => {
      unique(i.steps.map(r => r.id)); unique(i.aliases.map(r => r.id)); const steps = new Map(i.steps.map(r => [r.id, r])); let n = 0
      const findings = i.aliases.flatMap(r => { const s = steps.get(r.targetStepId); if (!s) return [f('manual-alias-step-missing', r.id)]; if (s.modelId !== r.expectedModelId) return [f('manual-alias-model-mismatch', r.id)]; n++; return [] })
      return { findings, metrics: [m('resolved-aliases', 'manual', n)] }
    }),
  spec(prefix + 'reference-integrity-map', 'Check manual procedure dependency-parent declarations for missing steps, cycles and cross-manual/edition edges. No equipment actuation or judgment that a procedure is safe to perform.',
    input({ steps: records({ manualId: id, editionDigest: digest, parentId: id.nullable() }) }),
    { steps: [{ id: 's1', manualId: 'm1', editionDigest: hash, parentId: null }] },
    { steps: [{ id: 's1', manualId: 'm1', editionDigest: hash, parentId: 'missing' }] },
    ['manual-dependency-missing', 'manual-dependency-cycle', 'manual-dependency-frame-mismatch'], ['dependency-link-count'], i => {
      const cyclic = cycles(i.steps), steps = new Map(i.steps.map(r => [r.id, r]))
      return { findings: i.steps.flatMap(r => { const p = r.parentId ? steps.get(r.parentId) : undefined; return [...(r.parentId && !p ? [f('manual-dependency-missing', r.id)] : []), ...(cyclic.has(r.id) ? [f('manual-dependency-cycle', r.id)] : []), ...(p && (p.manualId !== r.manualId || p.editionDigest !== r.editionDigest) ? [f('manual-dependency-frame-mismatch', r.id)] : [])] }), metrics: [m('dependency-link-count', 'manual', i.steps.filter(r => r.parentId !== null).length)] }
    }),
  spec(prefix + 'condition-coverage-map', 'Check required precondition IDs against declared pass/fail/unknown observations. Missing or ambiguous observations remain unresolved; this is not a permission to operate equipment.',
    input({ requiredPreconditions: list(id, 1, 32), observations: records({ preconditionId: id, state: z.enum(['pass', 'fail', 'unknown']) }, 0) }),
    { requiredPreconditions: ['c1'], observations: [{ id: 'o1', preconditionId: 'c1', state: 'pass' }] },
    { requiredPreconditions: ['c1'], observations: [{ id: 'o1', preconditionId: 'c1', state: 'unknown' }] },
    ['manual-precondition-undetermined', 'manual-precondition-failed', 'manual-precondition-missing', 'manual-precondition-conflict'], ['declared-passing-preconditions'], i => {
      unique(i.requiredPreconditions); unique(i.observations.map(r => r.id)); const findings = []; let pass = 0
      for (const k of i.requiredPreconditions) { const states = new Set(i.observations.filter(r => r.preconditionId === k).map(r => r.state)); if (!states.size) findings.push(f('manual-precondition-missing', k)); else if (states.size > 1) findings.push(f('manual-precondition-conflict', k)); else if (states.has('unknown')) findings.push(f('manual-precondition-undetermined', k)); else if (states.has('fail')) findings.push(f('manual-precondition-failed', k)); else pass++ }
      return { findings, metrics: [m('declared-passing-preconditions', 'manual', pass)] }
    }),
  spec(prefix + 'declared-bound-audit', 'Check caller-declared procedure duration limits using exact integer second/millisecond conversion. No execution-time estimate, instruction scheduling or safety limit inference.',
    input({ maximumStepMs: count, maximumTotalMs: count, steps: records({ duration: count, unit: z.enum(['s', 'ms']) }) }),
    { maximumStepMs: 1000, maximumTotalMs: 1000, steps: [{ id: 's1', duration: 1, unit: 's' }] },
    { maximumStepMs: 1000, maximumTotalMs: 2000, steps: [{ id: 's1', duration: 1001, unit: 'ms' }] },
    ['manual-step-duration-over-bound', 'manual-total-duration-over-bound'], ['declared-total-ms'], i => {
      unique(i.steps.map(r => r.id)); const values = i.steps.map(r => ({ id: r.id, ms: BigInt(r.duration) * BigInt(r.unit === 's' ? 1000 : 1) })), total = values.reduce((n, r) => n + r.ms, 0n)
      return { findings: [...values.filter(r => r.ms > BigInt(i.maximumStepMs)).map(r => f('manual-step-duration-over-bound', r.id)), ...(total > BigInt(i.maximumTotalMs) ? [f('manual-total-duration-over-bound', 'manual')] : [])], metrics: [m('declared-total-ms', 'manual', total)] }
    }),
  spec(prefix + 'missingness-cooccurrence', 'Count joint absence of procedure unit, tolerance and source-page metadata. Zero tolerance and page zero are supplied values; no imputation or engineering validity score.',
    input({ parameters: records({ unit: units.nullable(), toleranceMilli: signed.nullable(), sourcePage: count.nullable() }) }),
    { parameters: [{ id: 'p1', unit: 'mm', toleranceMilli: 0, sourcePage: 0 }] },
    { parameters: [{ id: 'p1', unit: null, toleranceMilli: null, sourcePage: 0 }] },
    ['manual-joint-missingness'], ['unit-tolerance-nulls', 'unit-page-nulls', 'tolerance-page-nulls'], i => {
      unique(i.parameters.map(r => r.id)); const pairs = [['unit', 'toleranceMilli', 'unit-tolerance-nulls'], ['unit', 'sourcePage', 'unit-page-nulls'], ['toleranceMilli', 'sourcePage', 'tolerance-page-nulls']] as const
      return { findings: i.parameters.filter(r => (['unit', 'toleranceMilli', 'sourcePage'] as const).filter(k => r[k] === null).length >= 2).map(r => f('manual-joint-missingness', r.id)), metrics: pairs.map(([a, b, k]) => m(k, 'manual', i.parameters.filter(r => r[a] === null && r[b] === null).length)) }
    }),
  spec(prefix + 'schema-directionality', 'Compare closed manual extraction fields for type, requiredness and nullability changes. Checks declared ingestion compatibility only, not full schema subtyping or instruction correctness.',
    input({ before: list(field, 1, 32), after: list(field, 0, 32) }), { before: [scalar], after: [scalar] }, { before: [scalar], after: [{ ...scalar, type: 'text' }] },
    ['manual-extraction-type-changed', 'manual-extraction-field-removed', 'manual-extraction-nullability-narrowed', 'manual-extraction-new-required'], ['extraction-schema-breaks'], i => {
      unique(i.before.map(r => r.name)); unique(i.after.map(r => r.name)); const a = new Map(i.after.map(r => [r.name, r])), b = new Map(i.before.map(r => [r.name, r])), findings = []
      for (const r of i.before) { const v = a.get(r.name); if (!v) findings.push(f('manual-extraction-field-removed', r.name)); else { if (v.type !== r.type) findings.push(f('manual-extraction-type-changed', r.name)); if (r.nullable && !v.nullable) findings.push(f('manual-extraction-nullability-narrowed', r.name)); if (!r.required && v.required) findings.push(f('manual-extraction-new-required', r.name)) } }
      for (const r of i.after) if (!b.has(r.name) && r.required) findings.push(f('manual-extraction-new-required', r.name))
      return { findings, metrics: [m('extraction-schema-breaks', 'manual', findings.length)] }
    }),
  spec(prefix + 'record-sequence-diff', 'Compare supplied procedure-step order and pinned digests across extracts. Inserted steps are distinct from reordered shared steps; no execution plan or safety assessment.',
    input({ before: records({ procedureDigest: digest }, 0), after: records({ procedureDigest: digest }, 0) }),
    { before: [{ id: 's1', procedureDigest: hash }], after: [{ id: 's1', procedureDigest: hash }] },
    { before: [{ id: 's1', procedureDigest: hash }], after: [{ id: 's1', procedureDigest: otherHash }] },
    ['manual-step-content-changed', 'manual-step-added', 'manual-step-removed', 'manual-shared-order-changed'], ['shared-step-count'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), b = new Map(i.before.map(r => [r.id, r]))
      const findings = [...i.before.flatMap(r => !a.has(r.id) ? [f('manual-step-removed', r.id)] : a.get(r.id)!.procedureDigest !== r.procedureDigest ? [f('manual-step-content-changed', r.id)] : []), ...i.after.filter(r => !b.has(r.id)).map(r => f('manual-step-added', r.id))]
      const before = i.before.filter(r => a.has(r.id)).map(r => r.id), after = i.after.filter(r => b.has(r.id)).map(r => r.id)
      if (demandDigest(before) !== demandDigest(after)) findings.push(f('manual-shared-order-changed', ...before))
      return { findings, metrics: [m('shared-step-count', 'manual', before.length)] }
    }),
  spec(prefix + 'provenance-edge-audit', 'Check declared procedure-to-page provenance edges for exact model, edition and content bindings. No source acquisition, signatures, physical reproduction or engineering approval.',
    input({ steps: records({ modelId: id, editionDigest: digest }), pages: records({ modelId: id, editionDigest: digest, contentDigest: digest }), edges: records({ stepId: id, pageId: id, pageDigest: digest }) }),
    { steps: [{ id: 's1', modelId: 'model1', editionDigest: hash }], pages: [{ id: 'p1', modelId: 'model1', editionDigest: hash, contentDigest: hash }], edges: [{ id: 'e1', stepId: 's1', pageId: 'p1', pageDigest: hash }] },
    { steps: [{ id: 's1', modelId: 'model1', editionDigest: hash }], pages: [{ id: 'p1', modelId: 'model2', editionDigest: hash, contentDigest: hash }], edges: [{ id: 'e1', stepId: 's1', pageId: 'p1', pageDigest: hash }] },
    ['manual-edge-model-edition-mismatch', 'manual-edge-endpoint-missing', 'manual-edge-content-pin-mismatch'], ['bound-page-edges'], i => {
      unique(i.steps.map(r => r.id)); unique(i.pages.map(r => r.id)); unique(i.edges.map(r => r.id)); const s = new Map(i.steps.map(r => [r.id, r])), p = new Map(i.pages.map(r => [r.id, r])); let bound = 0
      const findings = i.edges.flatMap(r => { const sv = s.get(r.stepId), pv = p.get(r.pageId); if (!sv || !pv) return [f('manual-edge-endpoint-missing', r.id)]; if (sv.modelId !== pv.modelId || sv.editionDigest !== pv.editionDigest) return [f('manual-edge-model-edition-mismatch', r.id)]; if (pv.contentDigest !== r.pageDigest) return [f('manual-edge-content-pin-mismatch', r.id)]; bound++; return [] })
      return { findings, metrics: [m('bound-page-edges', 'manual', bound)] }
    }),
  spec(prefix + 'scope-boundary-audit', 'Filter supplied procedure metadata against allowed model variants and exact manual/edition scope before retrieval. Does not determine equipment suitability or authorize an operation.',
    input({ manualId: id, editionDigest: digest, allowedModelIds: list(id, 1, 32), steps: list(step, 1, 32) }),
    { manualId: 'm1', editionDigest: hash, allowedModelIds: ['model1'], steps: [row] },
    { manualId: 'm1', editionDigest: hash, allowedModelIds: ['model2'], steps: [row] },
    ['manual-model-outside-scope', 'manual-id-outside-scope', 'manual-edition-outside-scope'], ['in-scope-steps'], i => {
      unique(i.allowedModelIds); unique(i.steps.map(r => r.id)); let inside = 0
      const findings = i.steps.flatMap(r => { const issues = [...(!i.allowedModelIds.includes(r.modelId) ? [f('manual-model-outside-scope', r.id)] : []), ...(r.manualId !== i.manualId ? [f('manual-id-outside-scope', r.id)] : []), ...(r.editionDigest !== i.editionDigest ? [f('manual-edition-outside-scope', r.id)] : [])]; if (!issues.length) inside++; return issues })
      return { findings, metrics: [m('in-scope-steps', 'manual', inside)] }
    }),
  spec(prefix + 'export-semantic-parity', 'Compare fixed-model, edition-pinned length parameter exports using exact integer metre/millimetre scaling. Preserves parameter IDs; does not validate measurements, tolerance or instructions.',
    input({ before: records({ modelId: id, editionDigest: digest, valueMilli: signed, unit: z.enum(['m', 'mm']) }, 0), after: records({ modelId: id, editionDigest: digest, valueMilli: signed, unit: z.enum(['m', 'mm']) }, 0) }),
    { before: [{ id: 'length', modelId: 'model1', editionDigest: hash, valueMilli: 1, unit: 'm' }], after: [{ id: 'length', modelId: 'model1', editionDigest: hash, valueMilli: 1000, unit: 'mm' }] },
    { before: [{ id: 'length', modelId: 'model1', editionDigest: hash, valueMilli: 1, unit: 'm' }], after: [{ id: 'length', modelId: 'model1', editionDigest: hash, valueMilli: 1, unit: 'mm' }] },
    ['manual-scaled-parameter-changed', 'manual-parameter-frame-changed', 'manual-export-parameter-missing', 'manual-export-parameter-added'], ['equivalent-parameters'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), b = new Map(i.before.map(r => [r.id, r])); let same = 0
      const findings = i.before.flatMap(r => { const v = a.get(r.id); if (!v) return [f('manual-export-parameter-missing', r.id)]; if (r.modelId !== v.modelId || r.editionDigest !== v.editionDigest) return [f('manual-parameter-frame-changed', r.id)]; if (BigInt(r.valueMilli) * BigInt(r.unit === 'm' ? 1000 : 1) !== BigInt(v.valueMilli) * BigInt(v.unit === 'm' ? 1000 : 1)) return [f('manual-scaled-parameter-changed', r.id)]; same++; return [] })
      findings.push(...i.after.filter(r => !b.has(r.id)).map(r => f('manual-export-parameter-added', r.id)))
      return { findings, metrics: [m('equivalent-parameters', 'manual', same)] }
    }),
]
