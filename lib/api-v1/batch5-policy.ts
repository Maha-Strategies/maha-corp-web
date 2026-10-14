import { z } from 'zod'
import { input, object, records, id, digest, utc, text, count, field, list, spec, hash, otherHash, time, later, finding as f, metric as m, unique, cycles, type AuditSpec } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
const prefix = 'policy-excerpts-'
const unit = z.enum(['count', 'ratio', 's', 'min', 'day'])
const excerpt = object({ id, policyId: id, revision: digest, jurisdiction: id, sourceId: id, clauseId: id, scope: text, effectiveAt: utc })
const row = { id: 'x1', policyId: 'p1', revision: hash, jurisdiction: 'declared-j1', sourceId: 's1', clauseId: 'c1', scope: 'declared-work', effectiveAt: time }
const scalar = { name: 'scope', type: 'text', required: true, nullable: false }
export const BATCH5_POLICY: AuditSpec[] = [
  spec(prefix + 'required-field-coverage', 'Report absent jurisdiction, source and effective-time metadata for declared policy excerpts. No policy completeness, authority or applicability certification.',
    input({ excerpts: records({ policyId: id, jurisdiction: id.nullable(), sourceId: id.nullable(), effectiveAt: utc.nullable() }) }),
    { excerpts: [{ id: 'x1', policyId: 'p1', jurisdiction: 'j1', sourceId: 's1', effectiveAt: time }] },
    { excerpts: [{ id: 'x1', policyId: 'p1', jurisdiction: null, sourceId: 's1', effectiveAt: time }] },
    ['policy-jurisdiction-missing', 'policy-source-missing', 'policy-effective-time-missing'], ['missing-metadata-count'], i => {
      unique(i.excerpts.map(r => r.id)); const findings = i.excerpts.flatMap(r => [...(r.jurisdiction === null ? [f('policy-jurisdiction-missing', r.id)] : []), ...(r.sourceId === null ? [f('policy-source-missing', r.id)] : []), ...(r.effectiveAt === null ? [f('policy-effective-time-missing', r.id)] : [])])
      return { findings, metrics: [m('missing-metadata-count', 'policy', findings.length)] }
    }),
  spec(prefix + 'duplicate-record-identities', 'Group repeated excerpt IDs within a policy and edition; distinguish equal content digests from conflicting pinned content. Same excerpt ID in different editions is not automatically a duplicate.',
    input({ excerpts: records({ policyId: id, revision: digest, contentDigest: digest }) }),
    { excerpts: [{ id: 'x1', policyId: 'p1', revision: hash, contentDigest: hash }] },
    { excerpts: [{ id: 'x1', policyId: 'p1', revision: hash, contentDigest: hash }, { id: 'x1', policyId: 'p1', revision: hash, contentDigest: hash }] },
    ['policy-identical-duplicate', 'policy-conflicting-content'], ['identity-groups'], i => {
      const groups = new Map<string, typeof i.excerpts>(); for (const r of i.excerpts) { const key = demandDigest([r.policyId, r.revision, r.id]); groups.set(key, [...(groups.get(key) ?? []), r]) }
      return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(new Set(g.map(r => r.contentDigest)).size === 1 ? 'policy-identical-duplicate' : 'policy-conflicting-content', ...g.map(r => r.id))), metrics: [m('identity-groups', 'policy', groups.size)] }
    }),
  spec(prefix + 'unit-label-consistency', 'Audit declared policy threshold units against count, ratio or duration quantities and repeated rule labels. Does not convert time or interpret legal deadlines.',
    input({ rules: records({ ruleId: id, quantity: z.enum(['count', 'ratio', 'duration']), unit }) }),
    { rules: [{ id: 'r1', ruleId: 'limit', quantity: 'count', unit: 'count' }] },
    { rules: [{ id: 'r1', ruleId: 'limit', quantity: 'count', unit: 'ratio' }] },
    ['policy-quantity-unit-mismatch', 'policy-rule-unit-conflict'], ['checked-thresholds'], i => {
      unique(i.rules.map(r => r.id)); const findings = i.rules.filter(r => r.quantity === 'duration' ? !['s', 'min', 'day'].includes(r.unit) : r.quantity !== r.unit).map(r => f('policy-quantity-unit-mismatch', r.id))
      const groups = new Map<string, typeof i.rules>(); for (const r of i.rules) groups.set(r.ruleId, [...(groups.get(r.ruleId) ?? []), r])
      for (const g of groups.values()) if (new Set(g.map(r => r.quantity + ':' + r.unit)).size > 1) findings.push(f('policy-rule-unit-conflict', ...g.map(r => r.id)))
      return { findings, metrics: [m('checked-thresholds', 'policy', i.rules.length)] }
    }),
  spec(prefix + 'timestamp-order-audit', 'Check declared policy publication, effective and withdrawal times for inverted windows. Publication after effectiveness is reported, not judged invalid or unlawful.',
    input({ versions: records({ publishedAt: utc, effectiveAt: utc, withdrawnAt: utc.nullable() }) }),
    { versions: [{ id: 'v1', publishedAt: time, effectiveAt: later, withdrawnAt: null }] },
    { versions: [{ id: 'v1', publishedAt: later, effectiveAt: time, withdrawnAt: null }] },
    ['policy-published-after-effective', 'policy-withdrawal-not-after-effective'], ['checked-versions'], i => {
      unique(i.versions.map(r => r.id)); return { findings: i.versions.flatMap(r => [...(r.publishedAt > r.effectiveAt ? [f('policy-published-after-effective', r.id)] : []), ...(r.withdrawnAt !== null && r.withdrawnAt <= r.effectiveAt ? [f('policy-withdrawal-not-after-effective', r.id)] : [])]), metrics: [m('checked-versions', 'policy', i.versions.length)] }
    }),
  spec(prefix + 'revision-delta-map', 'Identify exact source/clause identifiers, jurisdiction, scope and effective-time changes between two pinned policy revisions. A changed revision digest is not interpreted as a changed legal obligation.',
    input({ before: excerpt, after: excerpt }), { before: row, after: { ...row, revision: otherHash } },
    { before: row, after: { ...row, revision: otherHash, jurisdiction: 'j2' } },
    ['policy-projection-fields-changed', 'policy-revision-not-advanced', 'policy-identity-changed'], ['changed-field-count'], i => {
      const fields = ['jurisdiction', 'sourceId', 'clauseId', 'scope', 'effectiveAt'] as const, n = fields.filter(k => i.before[k] !== i.after[k]).length
      return { findings: [...(n ? [f('policy-projection-fields-changed', i.before.id, i.after.id)] : []), ...(i.before.revision === i.after.revision ? [f('policy-revision-not-advanced', i.before.id)] : []), ...(i.before.policyId !== i.after.policyId || i.before.id !== i.after.id ? [f('policy-identity-changed', i.before.id, i.after.id)] : [])], metrics: [m('changed-field-count', 'policy', n)] }
    }),
  spec(prefix + 'source-coverage-map', 'Resolve excerpt source/revision declarations against a supplied policy source manifest. Coverage means a matching metadata pin, not passage support or an authoritative policy.',
    input({ sources: records({ revision: digest }, 0), excerpts: records({ sourceId: id, sourceRevision: digest }) }),
    { sources: [{ id: 's1', revision: hash }], excerpts: [{ id: 'x1', sourceId: 's1', sourceRevision: hash }] },
    { sources: [], excerpts: [{ id: 'x1', sourceId: 's1', sourceRevision: hash }] },
    ['policy-source-binding-missing', 'policy-source-pin-stale'], ['bound-excerpts'], i => {
      unique(i.sources.map(r => r.id)); unique(i.excerpts.map(r => r.id)); const sources = new Map(i.sources.map(r => [r.id, r])); let bound = 0
      const findings = i.excerpts.flatMap(r => { const s = sources.get(r.sourceId); if (!s) return [f('policy-source-binding-missing', r.id)]; if (s.revision !== r.sourceRevision) return [f('policy-source-pin-stale', r.id)]; bound++; return [] })
      return { findings, metrics: [m('bound-excerpts', 'policy', bound)] }
    }),
  spec(prefix + 'identifier-crosswalk-audit', 'Check declared old-to-new policy clause mappings for omissions, unknown clauses and merged identities. No inferred textual equivalence or approval of a mapping.',
    input({ oldClauseIds: list(id, 1, 32), newClauseIds: list(id, 1, 32), mappings: records({ oldId: id, newId: id }, 0) }),
    { oldClauseIds: ['a'], newClauseIds: ['b'], mappings: [{ id: 'm1', oldId: 'a', newId: 'b' }] },
    { oldClauseIds: ['a'], newClauseIds: ['b'], mappings: [] },
    ['policy-old-clause-unmapped', 'policy-crosswalk-unknown-clause', 'policy-clause-merge'], ['mapped-old-clauses'], i => {
      unique(i.oldClauseIds); unique(i.newClauseIds); unique(i.mappings.map(r => r.id)); const valid = i.mappings.filter(r => i.oldClauseIds.includes(r.oldId) && i.newClauseIds.includes(r.newId))
      const findings = [...i.oldClauseIds.filter(k => !valid.some(r => r.oldId === k)).map(k => f('policy-old-clause-unmapped', k)), ...i.mappings.filter(r => !valid.includes(r)).map(r => f('policy-crosswalk-unknown-clause', r.id))]
      for (const k of i.newClauseIds) { const g = valid.filter(r => r.newId === k); if (new Set(g.map(r => r.oldId)).size > 1) findings.push(f('policy-clause-merge', ...g.map(r => r.id))) }
      return { findings, metrics: [m('mapped-old-clauses', 'policy', new Set(valid.map(r => r.oldId)).size)] }
    }),
  spec(prefix + 'reference-integrity-map', 'Inspect declared policy excerpt parent links for missing parents, cycles and cross-policy links. Graph integrity does not prove policy applicability or document completeness.',
    input({ excerpts: records({ policyId: id, parentId: id.nullable() }) }),
    { excerpts: [{ id: 'x1', policyId: 'p1', parentId: null }] },
    { excerpts: [{ id: 'x1', policyId: 'p1', parentId: 'missing' }] },
    ['policy-parent-missing', 'policy-reference-cycle', 'policy-parent-frame-mismatch'], ['checked-parent-links'], i => {
      const cyclic = cycles(i.excerpts), byId = new Map(i.excerpts.map(r => [r.id, r]))
      return { findings: i.excerpts.flatMap(r => [...(r.parentId && !byId.has(r.parentId) ? [f('policy-parent-missing', r.id)] : []), ...(cyclic.has(r.id) ? [f('policy-reference-cycle', r.id)] : []), ...(r.parentId && byId.has(r.parentId) && byId.get(r.parentId)!.policyId !== r.policyId ? [f('policy-parent-frame-mismatch', r.id)] : [])]), metrics: [m('checked-parent-links', 'policy', i.excerpts.filter(r => r.parentId !== null).length)] }
    }),
  spec(prefix + 'condition-coverage-map', 'Compare required policy applicability-condition IDs with supplied yes/no/unknown declarations. Unknown and conflicting evidence stays explicit; no compliance determination.',
    input({ required: list(id, 1, 32), assessments: records({ conditionId: id, state: z.enum(['yes', 'no', 'unknown']) }, 0) }),
    { required: ['c1'], assessments: [{ id: 'a1', conditionId: 'c1', state: 'yes' }] },
    { required: ['c1'], assessments: [] },
    ['policy-condition-unassessed', 'policy-condition-unknown', 'policy-condition-no', 'policy-condition-conflict'], ['declared-yes-conditions'], i => {
      unique(i.required); unique(i.assessments.map(r => r.id)); let yes = 0; const findings = []
      for (const k of i.required) { const states = new Set(i.assessments.filter(r => r.conditionId === k).map(r => r.state)); if (!states.size) findings.push(f('policy-condition-unassessed', k)); else if (states.size > 1) findings.push(f('policy-condition-conflict', k)); else if (states.has('unknown')) findings.push(f('policy-condition-unknown', k)); else if (states.has('no')) findings.push(f('policy-condition-no', k)); else yes++ }
      return { findings, metrics: [m('declared-yes-conditions', 'policy', yes)] }
    }),
  spec(prefix + 'declared-bound-audit', 'Compare declared excerpt byte counts with per-excerpt and total caller limits. No text download, tokenizer measurement or inference that a complete policy fits.',
    input({ maximumExcerptBytes: count, maximumTotalBytes: count, excerpts: records({ utf8Bytes: count }) }),
    { maximumExcerptBytes: 100, maximumTotalBytes: 100, excerpts: [{ id: 'x1', utf8Bytes: 100 }] },
    { maximumExcerptBytes: 100, maximumTotalBytes: 200, excerpts: [{ id: 'x1', utf8Bytes: 101 }] },
    ['policy-excerpt-byte-bound-exceeded', 'policy-total-byte-bound-exceeded'], ['declared-total-bytes'], i => {
      unique(i.excerpts.map(r => r.id)); const total = i.excerpts.reduce((n, r) => n + r.utf8Bytes, 0)
      return { findings: [...i.excerpts.filter(r => r.utf8Bytes > i.maximumExcerptBytes).map(r => f('policy-excerpt-byte-bound-exceeded', r.id)), ...(total > i.maximumTotalBytes ? [f('policy-total-byte-bound-exceeded', 'policy')] : [])], metrics: [m('declared-total-bytes', 'policy', total)] }
    }),
  spec(prefix + 'missingness-cooccurrence', 'Count joint absence of policy jurisdiction, scope and effective-time metadata. Missingness is reported without imputation or a legal completeness score.',
    input({ excerpts: records({ jurisdiction: id.nullable(), scope: text.nullable(), effectiveAt: utc.nullable() }) }),
    { excerpts: [{ id: 'x1', jurisdiction: 'j1', scope: 'work', effectiveAt: time }] },
    { excerpts: [{ id: 'x1', jurisdiction: null, scope: null, effectiveAt: time }] },
    ['policy-joint-missingness'], ['jurisdiction-scope-nulls', 'jurisdiction-time-nulls', 'scope-time-nulls'], i => {
      unique(i.excerpts.map(r => r.id)); const pairs = [['jurisdiction', 'scope', 'jurisdiction-scope-nulls'], ['jurisdiction', 'effectiveAt', 'jurisdiction-time-nulls'], ['scope', 'effectiveAt', 'scope-time-nulls']] as const
      return { findings: i.excerpts.filter(r => (['jurisdiction', 'scope', 'effectiveAt'] as const).filter(k => r[k] === null).length >= 2).map(r => f('policy-joint-missingness', r.id)), metrics: pairs.map(([a, b, k]) => m(k, 'policy', i.excerpts.filter(r => r[a] === null && r[b] === null).length)) }
    }),
  spec(prefix + 'schema-directionality', 'Compare policy ingestion field declarations for removed properties, changed scalar types, new mandatory fields and loss of nullable values. No arbitrary JSON Schema execution.',
    input({ before: list(field, 1, 32), after: list(field, 0, 32) }), { before: [scalar], after: [scalar] }, { before: [scalar], after: [] },
    ['policy-field-removed', 'policy-field-type-changed', 'policy-nullability-narrowed', 'policy-field-newly-required'], ['schema-breaks'], i => {
      unique(i.before.map(r => r.name)); unique(i.after.map(r => r.name)); const a = new Map(i.after.map(r => [r.name, r])), b = new Map(i.before.map(r => [r.name, r])), findings = []
      for (const r of i.before) { const v = a.get(r.name); if (!v) findings.push(f('policy-field-removed', r.name)); else { if (v.type !== r.type) findings.push(f('policy-field-type-changed', r.name)); if (r.nullable && !v.nullable) findings.push(f('policy-nullability-narrowed', r.name)); if (!r.required && v.required) findings.push(f('policy-field-newly-required', r.name)) } }
      for (const r of i.after) if (!b.has(r.name) && r.required) findings.push(f('policy-field-newly-required', r.name))
      return { findings, metrics: [m('schema-breaks', 'policy', findings.length)] }
    }),
  spec(prefix + 'record-sequence-diff', 'Compare declared policy clause order and content digests across two extracts. Only relative order of shared clauses counts as reordering; no interpretation of policy priority.',
    input({ before: records({ contentDigest: digest }, 0), after: records({ contentDigest: digest }, 0) }),
    { before: [{ id: 'c1', contentDigest: hash }], after: [{ id: 'c1', contentDigest: hash }] },
    { before: [{ id: 'c1', contentDigest: hash }], after: [{ id: 'c1', contentDigest: otherHash }] },
    ['policy-clause-content-changed', 'policy-clause-added', 'policy-clause-removed', 'policy-shared-order-changed'], ['shared-clause-count'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), b = new Map(i.before.map(r => [r.id, r]))
      const findings = [...i.before.flatMap(r => !a.has(r.id) ? [f('policy-clause-removed', r.id)] : a.get(r.id)!.contentDigest !== r.contentDigest ? [f('policy-clause-content-changed', r.id)] : []), ...i.after.filter(r => !b.has(r.id)).map(r => f('policy-clause-added', r.id))]
      const before = i.before.filter(r => a.has(r.id)).map(r => r.id), after = i.after.filter(r => b.has(r.id)).map(r => r.id)
      if (demandDigest(before) !== demandDigest(after)) findings.push(f('policy-shared-order-changed', ...before))
      return { findings, metrics: [m('shared-clause-count', 'policy', before.length)] }
    }),
  spec(prefix + 'provenance-edge-audit', 'Check policy quotation-to-source edges for matching source revision and excerpt digests. No quotation text, authority lookup or entailment claim.',
    input({ sources: records({ revision: digest }, 0), excerpts: records({ contentDigest: digest }), edges: records({ excerptId: id, excerptDigest: digest, sourceId: id, sourceRevision: digest }) }),
    { sources: [{ id: 's1', revision: hash }], excerpts: [{ id: 'x1', contentDigest: hash }], edges: [{ id: 'e1', excerptId: 'x1', excerptDigest: hash, sourceId: 's1', sourceRevision: hash }] },
    { sources: [{ id: 's1', revision: hash }], excerpts: [{ id: 'x1', contentDigest: hash }], edges: [{ id: 'e1', excerptId: 'x1', excerptDigest: otherHash, sourceId: 's1', sourceRevision: hash }] },
    ['policy-edge-pin-mismatch', 'policy-edge-endpoint-missing'], ['pinned-edges'], i => {
      unique(i.sources.map(r => r.id)); unique(i.excerpts.map(r => r.id)); unique(i.edges.map(r => r.id)); const s = new Map(i.sources.map(r => [r.id, r])), x = new Map(i.excerpts.map(r => [r.id, r])); let pinned = 0
      const findings = i.edges.flatMap(r => { const sv = s.get(r.sourceId), xv = x.get(r.excerptId); if (!sv || !xv) return [f('policy-edge-endpoint-missing', r.id)]; if (sv.revision !== r.sourceRevision || xv.contentDigest !== r.excerptDigest) return [f('policy-edge-pin-mismatch', r.id)]; pinned++; return [] })
      return { findings, metrics: [m('pinned-edges', 'policy', pinned)] }
    }),
  spec(prefix + 'scope-boundary-audit', 'Check excerpt policy IDs, revisions and jurisdiction labels against a caller-defined allowed scope. Does not establish applicable law or an exhaustive policy set.',
    input({ policyId: id, revision: digest, allowedJurisdictions: list(id, 1, 32), excerpts: records({ policyId: id, revision: digest, jurisdiction: id }) }),
    { policyId: 'p1', revision: hash, allowedJurisdictions: ['j1'], excerpts: [{ id: 'x1', policyId: 'p1', revision: hash, jurisdiction: 'j1' }] },
    { policyId: 'p1', revision: hash, allowedJurisdictions: ['j1'], excerpts: [{ id: 'x1', policyId: 'p1', revision: hash, jurisdiction: 'j2' }] },
    ['policy-jurisdiction-outside-scope', 'policy-id-outside-scope', 'policy-edition-outside-scope'], ['in-scope-excerpts'], i => {
      unique(i.allowedJurisdictions); unique(i.excerpts.map(r => r.id)); let inside = 0
      const findings = i.excerpts.flatMap(r => { const issues = [...(!i.allowedJurisdictions.includes(r.jurisdiction) ? [f('policy-jurisdiction-outside-scope', r.id)] : []), ...(r.policyId !== i.policyId ? [f('policy-id-outside-scope', r.id)] : []), ...(r.revision !== i.revision ? [f('policy-edition-outside-scope', r.id)] : [])]; if (!issues.length) inside++; return issues })
      return { findings, metrics: [m('in-scope-excerpts', 'policy', inside)] }
    }),
  spec(prefix + 'export-semantic-parity', 'Compare closed policy excerpt projections by stable identity, scope, jurisdiction, source pin and effective time. Ignores row order; no natural-language equivalence judgment.',
    input({ before: list(excerpt, 0, 32), after: list(excerpt, 0, 32) }), { before: [row], after: [row] }, { before: [row], after: [{ ...row, jurisdiction: 'j2' }] },
    ['policy-export-fields-changed', 'policy-export-missing', 'policy-export-added'], ['identical-excerpts'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), b = new Map(i.before.map(r => [r.id, r])); let same = 0
      const findings = i.before.flatMap(r => { const v = a.get(r.id); if (!v) return [f('policy-export-missing', r.id)]; if (demandDigest(r) !== demandDigest(v)) return [f('policy-export-fields-changed', r.id)]; same++; return [] })
      findings.push(...i.after.filter(r => !b.has(r.id)).map(r => f('policy-export-added', r.id)))
      return { findings, metrics: [m('identical-excerpts', 'policy', same)] }
    }),
]
