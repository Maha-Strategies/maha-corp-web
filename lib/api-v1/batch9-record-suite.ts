import { z } from 'zod'
import { input, object, records, id, digest, utc, list, spec, hash, otherHash, time, later, finding as f, metric as m, unique, cycles, type AuditSpec } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'

type Row = { id: string; [key: string]: unknown }
type Policy = {
  category: string; noun: string; boundary: string; pins: Record<string, z.ZodType>;
  sample: Row; owner: string; subject: string; revision: string; content: string;
  units: readonly [string, string, ...string[]]; unitMeaning: string;
}
const val = (r: Row, key: string) => r[key] as string
const same = (a: Row, b: Row, keys: string[]) => keys.every(k => a[k] === b[k])
const field = object({ name: id, type: z.enum(['identifier', 'digest', 'utc', 'integer', 'boolean']), required: z.boolean(), nullable: z.boolean() })
const scalar = { name: 'reference', type: 'identifier', required: true, nullable: false }

/** Shared record algebra; each family supplies a closed domain contract,
 * identity frame, revision/content semantics and explicit non-certification.
 * No arbitrary expressions, remote schema resolution or API calls. */
export function recordAuditSuite(p: Policy): AuditSpec[] {
  const prefix = p.category + '-', code = (s: string) => p.category + '-' + s
  const keys = Object.keys(p.pins), record = object({ id, ...p.pins }), row = p.sample
  const statement = (task: string) => `${task} for ${p.noun}. ${p.boundary}`
  const nullable = Object.fromEntries(Object.entries(p.pins).map(([k, v]) => [k, v.nullable()]))
  const nullableRecord = object({ ...nullable, id })
  const domainFields = z.enum(keys as [string, ...string[]])
  const changed = { ...row, [p.content]: otherHash }
  const identity = (r: Row) => demandDigest([r[p.owner], r[p.subject], r[p.revision]])
  const checkIds = (rows: Row[]) => unique(rows.map(r => r.id))
  const projectionDiff = (before: Row[], after: Row[], mode: 'sequence' | 'export') => {
    checkIds(before); checkIds(after)
    const a = new Map(after.map(r => [r.id, r])), b = new Set(before.map(r => r.id))
    const findings = before.flatMap(r => !a.has(r.id) ? [f(code(mode + '-removed'), r.id)]
      : !same(r, a.get(r.id)!, keys) ? [f(code(mode + '-changed'), r.id)] : [])
    findings.push(...after.filter(r => !b.has(r.id)).map(r => f(code(mode + '-added'), r.id)))
    if (mode === 'sequence') {
      const left = before.filter(r => a.has(r.id)).map(r => r.id), right = after.filter(r => b.has(r.id)).map(r => r.id)
      if (left.some((v, n) => right[n] !== v)) findings.push(f(code('sequence-reordered'), ...left))
    }
    return { findings, metrics: [m(code(mode + '-differences'), p.category, findings.length)] }
  }
  return [
    spec(prefix + 'required-field-coverage', statement('Check presence of required issuer/subject or producer/work pins; null is missing, not an invalid credential or artifact'),
      input({ requiredFields: list(domainFields, 1, 8), rows: list(nullableRecord, 1, 32) }),
      { requiredFields: [p.content], rows: [row] }, { requiredFields: [p.content], rows: [{ ...row, [p.content]: null }] },
      [code('required-pin-missing')], [code('complete-records'), code('missing-pins')], i => {
        unique(i.requiredFields); checkIds(i.rows); let missing = 0
        const findings = i.rows.flatMap(r => { const absent = i.requiredFields.filter(k => (r as Row)[k] === null); missing += absent.length; return absent.length ? [f(code('required-pin-missing'), r.id, ...absent)] : [] })
        return { findings, metrics: [m(code('complete-records'), p.category, i.rows.length - findings.length), m(code('missing-pins'), p.category, missing)] }
      }),
    spec(prefix + 'duplicate-record-identities', statement('Group matching owner/subject/revision frames and distinguish repeated pins from conflicting content pins'),
      input({ rows: list(record, 1, 32) }), { rows: [row] }, { rows: [row, { ...row, id: 'r2' }] },
      [code('duplicate-frame'), code('conflicting-frame-content')], [code('distinct-frames')], i => {
        checkIds(i.rows); const groups = new Map<string, Row[]>()
        for (const r of i.rows) { const key = identity(r); groups.set(key, [...(groups.get(key) ?? []), r]) }
        return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(code(new Set(g.map(r => r[p.content])).size === 1 ? 'duplicate-frame' : 'conflicting-frame-content'), ...g.map(r => r.id))), metrics: [m(code('distinct-frames'), p.category, groups.size)] }
      }),
    spec(prefix + 'unit-label-consistency', statement('Compare declared ' + p.unitMeaning + ' labels within a pinned frame; no unit conversion or inferred equivalence'),
      input({ measurements: records({ ...p.pins, unit: z.enum(p.units), value: z.number().finite().min(0).max(1e9) }) }),
      { measurements: [{ ...row, unit: p.units[0], value: 32 }] }, { measurements: [{ ...row, unit: p.units[0], value: 32 }, { ...row, id: 'r2', unit: p.units[1], value: 32 }] },
      [code('unit-label-conflict')], [code('unit-frames')], i => {
        checkIds(i.measurements); const groups = new Map<string, typeof i.measurements>()
        for (const r of i.measurements) { const key = demandDigest([identity(r), val(r, p.content)]); groups.set(key, [...(groups.get(key) ?? []), r]) }
        return { findings: [...groups.values()].filter(g => new Set(g.map(r => r.unit)).size > 1).map(g => f(code('unit-label-conflict'), ...g.map(r => r.id))), metrics: [m(code('unit-frames'), p.category, groups.size)] }
      }),
    spec(prefix + 'timestamp-order-audit', statement('Check declared issue/creation time, expiry and assessment time, including expiry equality and future timestamps; not an online freshness check'),
      input({ assessedAt: utc, rows: records({ createdAt: utc, expiresAt: utc.nullable() }) }),
      { assessedAt: time, rows: [{ id: 'r1', createdAt: time, expiresAt: later }] }, { assessedAt: later, rows: [{ id: 'r1', createdAt: time, expiresAt: later }] },
      [code('expired-at-assessment'), code('expiry-before-creation'), code('creation-from-future')], [code('checked-time-windows')], i => {
        checkIds(i.rows)
        return { findings: i.rows.flatMap(r => [...(r.expiresAt !== null && r.expiresAt <= i.assessedAt ? [f(code('expired-at-assessment'), r.id)] : []), ...(r.expiresAt !== null && r.expiresAt < r.createdAt ? [f(code('expiry-before-creation'), r.id)] : []), ...(r.createdAt > i.assessedAt ? [f(code('creation-from-future'), r.id)] : [])]), metrics: [m(code('checked-time-windows'), p.category, i.rows.length)] }
      }),
    spec(prefix + 'revision-delta-map', statement('Enumerate owner, subject, revision, content and scope pin changes by stable record ID in two supplied revisions'),
      input({ before: list(record, 0, 32), after: list(record, 0, 32) }), { before: [row], after: [row] }, { before: [row], after: [changed] },
      [code('revision-pin-changed'), code('revision-record-removed'), code('revision-record-added')], [code('changed-revision-pins')], i => {
        checkIds(i.before); checkIds(i.after); const a = new Map(i.after.map(r => [r.id, r])), b = new Set(i.before.map(r => r.id)); let count = 0
        const findings = i.before.flatMap(r => { const next = a.get(r.id); if (!next) return [f(code('revision-record-removed'), r.id)]; const changedFields = keys.filter(k => val(r, k) !== val(next, k)); count += changedFields.length; return changedFields.length ? [f(code('revision-pin-changed'), r.id, ...changedFields)] : [] })
        findings.push(...i.after.filter(r => !b.has(r.id)).map(r => f(code('revision-record-added'), r.id)))
        return { findings, metrics: [m(code('changed-revision-pins'), p.category, count)] }
      }),
    spec(prefix + 'source-coverage-map', statement('Bind record references to an exact owner/subject/revision/content/source frame; hash-shaped strings are declarations, not independently verified source bytes'),
      input({ sources: list(record, 1, 32), rows: records({ sourceId: id, ...p.pins }) }),
      { sources: [{ ...row, id: 'source1' }], rows: [{ ...row, sourceId: 'source1' }] }, { sources: [{ ...row, id: 'source1' }], rows: [{ ...changed, sourceId: 'source1' }] },
      [code('source-frame-mismatch'), code('source-missing')], [code('bound-sources')], i => {
        checkIds(i.sources); checkIds(i.rows); const sources = new Map(i.sources.map(r => [r.id, r])); let bound = 0
        const findings = i.rows.flatMap(r => { const s = sources.get(r.sourceId); if (!s) return [f(code('source-missing'), r.id)]; if (!same(r, s, keys)) return [f(code('source-frame-mismatch'), r.id)]; bound++; return [] })
        return { findings, metrics: [m(code('bound-sources'), p.category, bound)] }
      }),
    spec(prefix + 'identifier-crosswalk-audit', statement('Check one-to-one aliases against every typed pin; identifier mapping does not establish ownership, rights or authenticity'),
      input({ rows: list(record, 1, 32), mappings: records({ targetId: id, ...p.pins }) }),
      { rows: [row], mappings: [{ ...row, id: 'alias1', targetId: row.id }] }, { rows: [row], mappings: [{ ...changed, id: 'alias1', targetId: row.id }] },
      [code('crosswalk-frame-mismatch'), code('crosswalk-target-missing'), code('crosswalk-many-to-one'), code('crosswalk-row-unmapped')], [code('bound-aliases')], i => {
        checkIds(i.rows); checkIds(i.mappings); const rows = new Map(i.rows.map(r => [r.id, r])); let bound = 0
        const findings = i.mappings.flatMap(r => { const t = rows.get(r.targetId), issues = [...(!t ? [f(code('crosswalk-target-missing'), r.id)] : !same(r, t, keys) ? [f(code('crosswalk-frame-mismatch'), r.id)] : []), ...(i.mappings.filter(a => a.targetId === r.targetId).length > 1 ? [f(code('crosswalk-many-to-one'), r.id)] : [])]; if (!issues.length) bound++; return issues })
        findings.push(...i.rows.filter(r => !i.mappings.some(a => a.targetId === r.id)).map(r => f(code('crosswalk-row-unmapped'), r.id)))
        return { findings, metrics: [m(code('bound-aliases'), p.category, bound)] }
      }),
    spec(prefix + 'reference-integrity-map', statement('Check parent existence and cycles within owner and subject frames. Declared links do not prove causal execution or delegation authority'),
      input({ rows: records({ ...p.pins, parentId: id.nullable() }) }), { rows: [{ ...row, parentId: null }] }, { rows: [{ ...row, parentId: 'missing' }] },
      [code('parent-missing'), code('parent-cycle'), code('parent-frame-mismatch')], [code('declared-parent-links')], i => {
        const cyclic = cycles(i.rows), rows = new Map(i.rows.map(r => [r.id, r]))
        return { findings: i.rows.flatMap(r => { const parent = r.parentId === null ? undefined : rows.get(r.parentId); return [...(r.parentId !== null && !parent ? [f(code('parent-missing'), r.id)] : []), ...(cyclic.has(r.id) ? [f(code('parent-cycle'), r.id)] : []), ...(parent && !same(r, parent, [p.owner, p.subject]) ? [f(code('parent-frame-mismatch'), r.id)] : [])] }), metrics: [m(code('declared-parent-links'), p.category, i.rows.filter(r => r.parentId !== null).length)] }
      }),
    spec(prefix + 'condition-coverage-map', statement('Require exactly one satisfied declaration per requested precondition; absent, duplicate, unsatisfied or unknown checks cannot pass'),
      input({ requiredChecks: list(id, 1, 16), checks: records({ checkId: id, state: z.enum(['satisfied', 'unsatisfied', 'unknown']) }) }),
      { requiredChecks: ['one'], checks: [{ id: 'c1', checkId: 'one', state: 'satisfied' }] }, { requiredChecks: ['one'], checks: [{ id: 'c1', checkId: 'one', state: 'unknown' }] },
      [code('condition-not-established'), code('condition-undeclared')], [code('satisfied-required-checks')], i => {
        unique(i.requiredChecks); checkIds(i.checks); let satisfied = 0
        const findings = i.requiredChecks.flatMap(k => { const matches = i.checks.filter(c => c.checkId === k); if (matches.length === 1 && matches[0].state === 'satisfied') { satisfied++; return [] }; return [f(code('condition-not-established'), k)] })
        findings.push(...i.checks.filter(c => !i.requiredChecks.includes(c.checkId)).map(c => f(code('condition-undeclared'), c.id)))
        return { findings, metrics: [m(code('satisfied-required-checks'), p.category, satisfied)] }
      }),
    spec(prefix + 'declared-bound-audit', statement('Compare nonnegative declared counts against an explicit ceiling in matching units. Bounds are caller policy, not security strength, material safety or legally binding quotas'),
      input({ maximum: z.number().int().min(0).max(1e9), unit: z.enum(p.units), measurements: records({ unit: z.enum(p.units), value: z.number().int().min(0).max(1e9) }) }),
      { maximum: 100, unit: p.units[0], measurements: [{ id: 'r1', unit: p.units[0], value: 100 }] }, { maximum: 100, unit: p.units[0], measurements: [{ id: 'r1', unit: p.units[0], value: 101 }] },
      [code('declared-ceiling-exceeded'), code('bound-unit-mismatch')], [code('checked-compatible-bounds')], i => {
        checkIds(i.measurements)
        return { findings: i.measurements.flatMap(r => r.unit !== i.unit ? [f(code('bound-unit-mismatch'), r.id)] : r.value > i.maximum ? [f(code('declared-ceiling-exceeded'), r.id)] : []), metrics: [m(code('checked-compatible-bounds'), p.category, i.measurements.filter(r => r.unit === i.unit).length)] }
      }),
    spec(prefix + 'missingness-cooccurrence', statement('Count paired missing owner, revision and content pins without silently treating a missing value as a matching value'),
      input({ rows: list(nullableRecord, 1, 32) }), { rows: [row] }, { rows: [{ ...row, [p.owner]: null, [p.content]: null }] },
      [code('joint-pin-missingness')], [code('owner-revision-nulls'), code('owner-content-nulls'), code('revision-content-nulls')], i => {
        checkIds(i.rows); const pairs = [[p.owner, p.revision, 'owner-revision-nulls'], [p.owner, p.content, 'owner-content-nulls'], [p.revision, p.content, 'revision-content-nulls']]
        return { findings: i.rows.filter(r => [p.owner, p.revision, p.content].filter(k => (r as Row)[k] === null).length >= 2).map(r => f(code('joint-pin-missingness'), r.id)), metrics: pairs.map(([a, b, k]) => m(code(k), p.category, i.rows.filter(r => (r as Row)[a] === null && (r as Row)[b] === null).length)) }
      }),
    spec(prefix + 'schema-directionality', statement('Compare closed export-field guarantees. Removing fields, changing types or weakening required/non-null promises breaks the declared reader; extra fields depend on its explicit strictness'),
      input({ before: list(field, 1, 32), after: list(field, 0, 32), consumerAllowsExtraFields: z.boolean() }),
      { before: [scalar], after: [scalar], consumerAllowsExtraFields: false }, { before: [scalar], after: [], consumerAllowsExtraFields: false },
      [code('schema-field-removed'), code('schema-type-changed'), code('schema-guarantee-weakened'), code('schema-extra-field')], [code('schema-breaks')], i => {
        unique(i.before.map(r => r.name)); unique(i.after.map(r => r.name)); const a = new Map(i.after.map(r => [r.name, r])), b = new Set(i.before.map(r => r.name))
        const findings = i.before.flatMap(r => { const next = a.get(r.name); if (!next) return [f(code('schema-field-removed'), r.name)]; return [...(next.type !== r.type ? [f(code('schema-type-changed'), r.name)] : []), ...(r.required && !next.required || !r.nullable && next.nullable ? [f(code('schema-guarantee-weakened'), r.name)] : [])] })
        if (!i.consumerAllowsExtraFields) findings.push(...i.after.filter(r => !b.has(r.name)).map(r => f(code('schema-extra-field'), r.name)))
        return { findings, metrics: [m(code('schema-breaks'), p.category, findings.length)] }
      }),
    spec(prefix + 'record-sequence-diff', statement('Separate record changes from shared-record reordering; inserting or deleting a record does not itself reorder surviving records'),
      input({ before: list(record, 0, 32), after: list(record, 0, 32) }), { before: [row], after: [row] }, { before: [row], after: [changed] },
      [code('sequence-changed'), code('sequence-removed'), code('sequence-added'), code('sequence-reordered')], [code('sequence-differences')], i => projectionDiff(i.before, i.after, 'sequence')),
    spec(prefix + 'provenance-edge-audit', statement('Bind a declared edge to both pinned endpoints and the exact owner/subject frame. Unresolved targets, wrong digests and cycles remain negative evidence, not independent provenance verification'),
      input({ nodes: list(record, 1, 32), edges: records({ childId: id, parentId: id, childDigest: digest, parentDigest: digest }) }),
      { nodes: [row, { ...row, id: 'parent' }], edges: [{ id: 'e1', childId: row.id, parentId: 'parent', childDigest: hash, parentDigest: hash }] },
      { nodes: [row, { ...row, id: 'parent' }], edges: [{ id: 'e1', childId: row.id, parentId: 'parent', childDigest: otherHash, parentDigest: hash }] },
      [code('edge-pin-mismatch'), code('edge-endpoint-missing'), code('edge-frame-mismatch'), code('edge-cycle'), code('duplicate-edge')], [code('bound-edges')], i => {
        checkIds(i.nodes); checkIds(i.edges); const nodes = new Map(i.nodes.map(r => [r.id, r])), edgeCounts = new Map<string, number>()
        for (const e of i.edges) { const key = demandDigest([e.childId, e.parentId]); edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1) }
        const reaches = (start: string, target: string, seen = new Set<string>()): boolean => { if (start === target) return true; if (seen.has(start)) return false; seen.add(start); return i.edges.filter(e => e.childId === start).some(e => reaches(e.parentId, target, seen)) }
        let bound = 0
        const findings = i.edges.flatMap(e => { const child = nodes.get(e.childId), parent = nodes.get(e.parentId)
          const issues = [...(!child || !parent ? [f(code('edge-endpoint-missing'), e.id)] : []), ...(child && parent && (val(child, p.content) !== e.childDigest || val(parent, p.content) !== e.parentDigest) ? [f(code('edge-pin-mismatch'), e.id)] : []), ...(child && parent && !same(child, parent, [p.owner, p.subject]) ? [f(code('edge-frame-mismatch'), e.id)] : []), ...(child && parent && reaches(e.parentId, e.childId) ? [f(code('edge-cycle'), e.id)] : []), ...(edgeCounts.get(demandDigest([e.childId, e.parentId]))! > 1 ? [f(code('duplicate-edge'), e.id)] : [])]
          if (!issues.length) bound++; return issues })
        return { findings, metrics: [m(code('bound-edges'), p.category, bound)] }
      }),
    spec(prefix + 'scope-boundary-audit', statement('Enforce exact declared owner, subject, revision and allowed scope labels; a matching label grants no permission or access'),
      input({ ownerRef: id, subjectRef: id, revision: digest, allowedScopes: list(id, 1, 16), rows: list(record, 1, 32) }),
      { ownerRef: row[p.owner], subjectRef: row[p.subject], revision: row[p.revision], allowedScopes: ['public-metadata'], rows: [row] },
      { ownerRef: 'different-owner', subjectRef: row[p.subject], revision: row[p.revision], allowedScopes: ['public-metadata'], rows: [row] },
      [code('record-outside-frame'), code('scope-label-outside-boundary')], [code('in-scope-records')], i => {
        unique(i.allowedScopes); checkIds(i.rows); let inside = 0
        const findings = i.rows.flatMap(r => { const issues = [...(val(r, p.owner) !== i.ownerRef || val(r, p.subject) !== i.subjectRef || val(r, p.revision) !== i.revision ? [f(code('record-outside-frame'), r.id)] : []), ...(!i.allowedScopes.includes(val(r, 'scopeRef')) ? [f(code('scope-label-outside-boundary'), r.id)] : [])]; if (!issues.length) inside++; return issues })
        return { findings, metrics: [m(code('in-scope-records'), p.category, inside)] }
      }),
    spec(prefix + 'export-semantic-parity', statement('Compare parsed typed record projections, preserving all pins and scope while ignoring order; not raw-byte equality or proof of the underlying artifact'),
      input({ before: list(record, 0, 32), after: list(record, 0, 32) }), { before: [row], after: [row] }, { before: [row], after: [changed] },
      [code('export-changed'), code('export-removed'), code('export-added')], [code('export-differences')], i => projectionDiff(i.before, i.after, 'export')),
  ]
}

export const BATCH9_IDENTITIES = recordAuditSuite({
  category: 'identity-records', noun: 'public nonpersonal agent credential declarations',
  boundary: 'No DID resolution, live revocation lookup, signature verification, person identification, key custody or identity certification.',
  pins: { issuerRef: id, subjectRef: id, credentialRevision: digest, keyFingerprint: digest, scopeRef: id },
  sample: { id: 'credential1', issuerRef: 'issuer1', subjectRef: 'agent1', credentialRevision: hash, keyFingerprint: hash, scopeRef: 'public-metadata' },
  owner: 'issuerRef', subject: 'subjectRef', revision: 'credentialRevision', content: 'keyFingerprint', units: ['seconds', 'milliseconds'], unitMeaning: 'credential lifetime',
})
export const BATCH9_PROVENANCE = recordAuditSuite({
  category: 'provenance-manifests', noun: 'caller-supplied artifact and dataset provenance manifests',
  boundary: 'No source download, build reproduction, signature verification, proof of origin, causality or scientific validity.',
  pins: { producerRef: id, datasetRef: id, manifestRevision: digest, artifactDigest: digest, scopeRef: id },
  sample: { id: 'manifest1', producerRef: 'producer1', datasetRef: 'dataset1', manifestRevision: hash, artifactDigest: hash, scopeRef: 'public-metadata' },
  owner: 'producerRef', subject: 'datasetRef', revision: 'manifestRevision', content: 'artifactDigest', units: ['bytes', 'KiB', 'KB'], unitMeaning: 'artifact size',
})
export const LICENSE_RECORD_AUDITS = recordAuditSuite({
  category: 'license-records', noun: 'nonpersonal work and permission-manifest metadata',
  boundary: 'No authoritative license interpretation, rights clearance, agreement acceptance, royalty transfer or legal advice. Satisfied conditions are caller declarations only.',
  pins: { rightsholderRef: id, workRef: id, licenseRevision: digest, permissionDigest: digest, scopeRef: id },
  sample: { id: 'license1', rightsholderRef: 'owner1', workRef: 'work1', licenseRevision: hash, permissionDigest: hash, scopeRef: 'public-metadata' },
  owner: 'rightsholderRef', subject: 'workRef', revision: 'licenseRevision', content: 'permissionDigest', units: ['copies', 'seats', 'requests'], unitMeaning: 'usage allowance',
})
export const BATCH9_LICENSES = LICENSE_RECORD_AUDITS.filter(s => s.id !== 'license-records-condition-coverage-map').slice(0, 10)
