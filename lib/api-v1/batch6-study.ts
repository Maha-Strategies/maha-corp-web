import { z } from 'zod'
import { input, object, records, id, digest, utc, count, text, field, list, spec, hash, otherHash, time, later, finding as f, metric as m, unique, cycles, type AuditSpec } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
const prefix = 'study-notes-'
const kind = z.enum(['hypothesis', 'observation', 'quotation'])
const basis = z.enum(['declared', 'source-linked', 'unassessed'])
const projection = object({ id, notebookId: id, revision: digest, sourceId: id, sourceRevision: digest, claimKind: kind, confidenceBasis: basis, locator: text })
const row = { id: 'n1', notebookId: 'b1', revision: hash, sourceId: 's1', sourceRevision: hash, claimKind: 'quotation', confidenceBasis: 'source-linked', locator: 'page-1' }
const scalar = { name: 'locator', type: 'text', required: true, nullable: false }
export const BATCH6_STUDY: AuditSpec[] = [
  spec(prefix + 'required-field-coverage', 'Report missing source ID, revision and locator in declared source-linked study-note metadata. No note text, learner identity or assertion that the source supports a claim.',
    input({ notes: records({ sourceId: id.nullable(), sourceRevision: digest.nullable(), locator: text.nullable() }) }),
    { notes: [{ id: 'n1', sourceId: 's1', sourceRevision: hash, locator: 'page-1' }] }, { notes: [{ id: 'n1', sourceId: null, sourceRevision: hash, locator: 'page-1' }] },
    ['study-source-id-missing', 'study-source-revision-missing', 'study-locator-missing'], ['missing-source-fields'], i => {
      unique(i.notes.map(r => r.id)); const findings = i.notes.flatMap(r => [...(r.sourceId === null ? [f('study-source-id-missing', r.id)] : []), ...(r.sourceRevision === null ? [f('study-source-revision-missing', r.id)] : []), ...(r.locator === null ? [f('study-locator-missing', r.id)] : [])]); return { findings, metrics: [m('missing-source-fields', 'notebook', findings.length)] }
    }),
  spec(prefix + 'duplicate-record-identities', 'Group study-note identities by notebook and revision; distinguish matching from conflicting note digests. Different revisions are not collapsed into one identity.',
    input({ notes: records({ notebookId: id, revision: digest, contentDigest: digest }) }),
    { notes: [{ id: 'n1', notebookId: 'b1', revision: hash, contentDigest: hash }] }, { notes: [{ id: 'n1', notebookId: 'b1', revision: hash, contentDigest: hash }, { id: 'n1', notebookId: 'b1', revision: hash, contentDigest: hash }] },
    ['study-identical-duplicate', 'study-conflicting-note-digest'], ['note-identity-groups'], i => {
      const groups = new Map<string, typeof i.notes>(); for (const r of i.notes) { const k = demandDigest([r.notebookId, r.revision, r.id]); groups.set(k, [...(groups.get(k) ?? []), r]) }
      return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(new Set(g.map(r => r.contentDigest)).size === 1 ? 'study-identical-duplicate' : 'study-conflicting-note-digest', ...g.map(r => r.id))), metrics: [m('note-identity-groups', 'notebook', groups.size)] }
    }),
  spec(prefix + 'unit-label-consistency', 'Check declared study quantity/unit labels and repeated measurement identities for mismatches. No physical-value conversion or scientific validation.',
    input({ measurements: records({ measurementId: id, quantity: z.enum(['length', 'mass', 'duration']), unit: z.enum(['m', 'mm', 'g', 'kg', 's', 'ms']) }) }),
    { measurements: [{ id: 'r1', measurementId: 'length1', quantity: 'length', unit: 'mm' }] }, { measurements: [{ id: 'r1', measurementId: 'length1', quantity: 'length', unit: 'kg' }] },
    ['study-quantity-unit-mismatch', 'study-measurement-unit-conflict'], ['checked-measurements'], i => {
      unique(i.measurements.map(r => r.id)); const allowed = { length: ['m', 'mm'], mass: ['g', 'kg'], duration: ['s', 'ms'] }, findings = i.measurements.filter(r => !allowed[r.quantity].includes(r.unit)).map(r => f('study-quantity-unit-mismatch', r.id)), groups = new Map<string, typeof i.measurements>()
      for (const r of i.measurements) groups.set(r.measurementId, [...(groups.get(r.measurementId) ?? []), r]); for (const g of groups.values()) if (new Set(g.map(r => r.quantity + ':' + r.unit)).size > 1) findings.push(f('study-measurement-unit-conflict', ...g.map(r => r.id)))
      return { findings, metrics: [m('checked-measurements', 'notebook', i.measurements.length)] }
    }),
  spec(prefix + 'timestamp-order-audit', 'Check declared note creation/revision and cited-source publication times for future citations or reversed revisions. No trusted timestamp or publication lookup.',
    input({ notes: records({ createdAt: utc, revisedAt: utc, sourcePublishedAt: utc }) }),
    { notes: [{ id: 'n1', createdAt: time, revisedAt: later, sourcePublishedAt: time }] }, { notes: [{ id: 'n1', createdAt: later, revisedAt: time, sourcePublishedAt: time }] },
    ['study-revision-before-creation', 'study-source-published-after-note'], ['checked-note-times'], i => {
      unique(i.notes.map(r => r.id)); return { findings: i.notes.flatMap(r => [...(r.revisedAt < r.createdAt ? [f('study-revision-before-creation', r.id)] : []), ...(r.sourcePublishedAt > r.createdAt ? [f('study-source-published-after-note', r.id)] : [])]), metrics: [m('checked-note-times', 'notebook', i.notes.length)] }
    }),
  spec(prefix + 'revision-delta-map', 'Compare pinned study-note projections for source, locator, claim-kind and confidence-basis changes. A changed declaration does not establish improved evidence or truth.',
    input({ before: projection, after: projection }), { before: row, after: { ...row, revision: otherHash } }, { before: row, after: { ...row, revision: otherHash, claimKind: 'hypothesis' } },
    ['study-projection-fields-changed', 'study-revision-not-advanced', 'study-note-frame-changed'], ['changed-note-fields'], i => {
      const n = (['sourceId', 'sourceRevision', 'claimKind', 'confidenceBasis', 'locator'] as const).filter(k => i.before[k] !== i.after[k]).length
      return { findings: [...(n ? [f('study-projection-fields-changed', i.before.id)] : []), ...(i.before.revision === i.after.revision ? [f('study-revision-not-advanced', i.before.id)] : []), ...(i.before.id !== i.after.id || i.before.notebookId !== i.after.notebookId ? [f('study-note-frame-changed', i.before.id, i.after.id)] : [])], metrics: [m('changed-note-fields', 'notebook', n)] }
    }),
  spec(prefix + 'source-coverage-map', 'Resolve supplied study-note source revision/digest references against a source manifest. Matching metadata does not certify quotation accuracy or entailment.',
    input({ sources: records({ revision: digest, contentDigest: digest }, 0), notes: records({ sourceId: id, sourceRevision: digest, sourceDigest: digest }) }),
    { sources: [{ id: 's1', revision: hash, contentDigest: hash }], notes: [{ id: 'n1', sourceId: 's1', sourceRevision: hash, sourceDigest: hash }] }, { sources: [], notes: [{ id: 'n1', sourceId: 's1', sourceRevision: hash, sourceDigest: hash }] },
    ['study-source-binding-missing', 'study-source-pin-mismatch'], ['bound-notes'], i => {
      unique(i.sources.map(r => r.id)); unique(i.notes.map(r => r.id)); const s = new Map(i.sources.map(r => [r.id, r])); let bound = 0
      const findings = i.notes.flatMap(r => { const v = s.get(r.sourceId); if (!v) return [f('study-source-binding-missing', r.id)]; if (v.revision !== r.sourceRevision || v.contentDigest !== r.sourceDigest) return [f('study-source-pin-mismatch', r.id)]; bound++; return [] }); return { findings, metrics: [m('bound-notes', 'notebook', bound)] }
    }),
  spec(prefix + 'identifier-crosswalk-audit', 'Resolve declared study concept aliases against exact target IDs and label digests. No synonym inference, embedding or natural-language equivalence claim.',
    input({ concepts: records({ labelDigest: digest }), aliases: records({ targetId: id, expectedLabelDigest: digest }) }),
    { concepts: [{ id: 'c1', labelDigest: hash }], aliases: [{ id: 'a1', targetId: 'c1', expectedLabelDigest: hash }] }, { concepts: [{ id: 'c1', labelDigest: hash }], aliases: [{ id: 'a1', targetId: 'c1', expectedLabelDigest: otherHash }] },
    ['study-alias-label-pin-mismatch', 'study-alias-target-missing'], ['bound-concept-aliases'], i => {
      unique(i.concepts.map(r => r.id)); unique(i.aliases.map(r => r.id)); const c = new Map(i.concepts.map(r => [r.id, r])); let bound = 0
      const findings = i.aliases.flatMap(r => { const v = c.get(r.targetId); if (!v) return [f('study-alias-target-missing', r.id)]; if (v.labelDigest !== r.expectedLabelDigest) return [f('study-alias-label-pin-mismatch', r.id)]; bound++; return [] }); return { findings, metrics: [m('bound-concept-aliases', 'notebook', bound)] }
    }),
  spec(prefix + 'reference-integrity-map', 'Inspect study-note parent links for missing notes, cycles and cross-notebook references. No citation resolution or completeness guarantee.',
    input({ notes: records({ notebookId: id, parentId: id.nullable() }) }), { notes: [{ id: 'n1', notebookId: 'b1', parentId: null }] }, { notes: [{ id: 'n1', notebookId: 'b1', parentId: 'missing' }] },
    ['study-parent-missing', 'study-reference-cycle', 'study-parent-notebook-mismatch'], ['parent-link-count'], i => {
      const cyclic = cycles(i.notes), n = new Map(i.notes.map(r => [r.id, r])); return { findings: i.notes.flatMap(r => { const p = r.parentId ? n.get(r.parentId) : undefined; return [...(r.parentId && !p ? [f('study-parent-missing', r.id)] : []), ...(cyclic.has(r.id) ? [f('study-reference-cycle', r.id)] : []), ...(p && p.notebookId !== r.notebookId ? [f('study-parent-notebook-mismatch', r.id)] : [])] }), metrics: [m('parent-link-count', 'notebook', i.notes.filter(r => r.parentId !== null).length)] }
    }),
  spec(prefix + 'condition-coverage-map', 'Compare required study evidence-check IDs with supplied satisfied/unsatisfied/unknown declarations. This is an inspectable checklist, not a scientific evidence rating.',
    input({ requiredChecks: list(id, 1, 32), checks: records({ checkId: id, state: z.enum(['satisfied', 'unsatisfied', 'unknown']) }, 0) }), { requiredChecks: ['source-pin'], checks: [{ id: 'c1', checkId: 'source-pin', state: 'satisfied' }] }, { requiredChecks: ['source-pin'], checks: [] },
    ['study-check-missing', 'study-check-unknown', 'study-check-unsatisfied', 'study-check-conflicting'], ['declared-satisfied-checks'], i => {
      unique(i.requiredChecks); unique(i.checks.map(r => r.id)); const findings = []; let satisfied = 0
      for (const k of i.requiredChecks) { const states = new Set(i.checks.filter(r => r.checkId === k).map(r => r.state)); if (!states.size) findings.push(f('study-check-missing', k)); else if (states.size > 1) findings.push(f('study-check-conflicting', k)); else if (states.has('unknown')) findings.push(f('study-check-unknown', k)); else if (states.has('unsatisfied')) findings.push(f('study-check-unsatisfied', k)); else satisfied++ }
      return { findings, metrics: [m('declared-satisfied-checks', 'notebook', satisfied)] }
    }),
  spec(prefix + 'declared-bound-audit', 'Compare declared note bytes with per-note and notebook byte ceilings. No note text, tokenization or assertion that an entire evidence set is retained.',
    input({ maximumNoteBytes: count, maximumNotebookBytes: count, notes: records({ utf8Bytes: count }) }), { maximumNoteBytes: 100, maximumNotebookBytes: 100, notes: [{ id: 'n1', utf8Bytes: 100 }] }, { maximumNoteBytes: 100, maximumNotebookBytes: 200, notes: [{ id: 'n1', utf8Bytes: 101 }] },
    ['study-note-byte-bound-exceeded', 'study-notebook-byte-bound-exceeded'], ['declared-note-bytes'], i => {
      unique(i.notes.map(r => r.id)); const total = i.notes.reduce((n, r) => n + r.utf8Bytes, 0); return { findings: [...i.notes.filter(r => r.utf8Bytes > i.maximumNoteBytes).map(r => f('study-note-byte-bound-exceeded', r.id)), ...(total > i.maximumNotebookBytes ? [f('study-notebook-byte-bound-exceeded', 'notebook')] : [])], metrics: [m('declared-note-bytes', 'notebook', total)] }
    }),
  spec(prefix + 'missingness-cooccurrence', 'Count joint absence of source, locator and confidence-basis metadata in study notes without imputation or a quality score.',
    input({ notes: records({ sourceId: id.nullable(), locator: text.nullable(), confidenceBasis: basis.nullable() }) }), { notes: [{ id: 'n1', sourceId: 's1', locator: 'page-1', confidenceBasis: 'declared' }] }, { notes: [{ id: 'n1', sourceId: null, locator: null, confidenceBasis: 'declared' }] },
    ['study-joint-missingness'], ['source-locator-nulls', 'source-basis-nulls', 'locator-basis-nulls'], i => {
      unique(i.notes.map(r => r.id)); const pairs = [['sourceId', 'locator', 'source-locator-nulls'], ['sourceId', 'confidenceBasis', 'source-basis-nulls'], ['locator', 'confidenceBasis', 'locator-basis-nulls']] as const
      return { findings: i.notes.filter(r => (['sourceId', 'locator', 'confidenceBasis'] as const).filter(k => r[k] === null).length >= 2).map(r => f('study-joint-missingness', r.id)), metrics: pairs.map(([a, b, k]) => m(k, 'notebook', i.notes.filter(r => r[a] === null && r[b] === null).length)) }
    }),
  spec(prefix + 'schema-directionality', 'Compare closed note-extraction fields and allowed claim kinds for request narrowing. No model invocation, arbitrary schema execution or guarantee for undeclared fields.',
    input({ beforeKinds: list(kind, 1, 3), afterKinds: list(kind, 1, 3), before: list(field, 1, 32), after: list(field, 0, 32) }), { beforeKinds: ['quotation'], afterKinds: ['quotation'], before: [scalar], after: [scalar] }, { beforeKinds: ['quotation', 'hypothesis'], afterKinds: ['quotation'], before: [scalar], after: [scalar] },
    ['study-claim-kind-removed', 'study-field-removed', 'study-field-type-changed', 'study-nullability-narrowed', 'study-field-newly-required'], ['note-contract-breaks'], i => {
      unique(i.beforeKinds); unique(i.afterKinds); unique(i.before.map(r => r.name)); unique(i.after.map(r => r.name)); const a = new Map(i.after.map(r => [r.name, r])), b = new Map(i.before.map(r => [r.name, r])), findings = i.beforeKinds.filter(k => !i.afterKinds.includes(k)).map(k => f('study-claim-kind-removed', k))
      for (const r of i.before) { const v = a.get(r.name); if (!v) findings.push(f('study-field-removed', r.name)); else { if (r.type !== v.type) findings.push(f('study-field-type-changed', r.name)); if (r.nullable && !v.nullable) findings.push(f('study-nullability-narrowed', r.name)); if (!r.required && v.required) findings.push(f('study-field-newly-required', r.name)) } }; for (const r of i.after) if (!b.has(r.name) && r.required) findings.push(f('study-field-newly-required', r.name))
      return { findings, metrics: [m('note-contract-breaks', 'notebook', findings.length)] }
    }),
  spec(prefix + 'record-sequence-diff', 'Compare note digests and relative order of shared note identities across extracts. Insertions do not falsely reorder shared notes; no causal or learning-progress interpretation.',
    input({ before: records({ contentDigest: digest }, 0), after: records({ contentDigest: digest }, 0) }), { before: [{ id: 'n1', contentDigest: hash }], after: [{ id: 'n1', contentDigest: hash }] }, { before: [{ id: 'n1', contentDigest: hash }], after: [{ id: 'n1', contentDigest: otherHash }] },
    ['study-note-content-changed', 'study-note-added', 'study-note-removed', 'study-shared-order-changed'], ['shared-note-count'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), b = new Map(i.before.map(r => [r.id, r])), findings = [...i.before.flatMap(r => !a.has(r.id) ? [f('study-note-removed', r.id)] : a.get(r.id)!.contentDigest !== r.contentDigest ? [f('study-note-content-changed', r.id)] : []), ...i.after.filter(r => !b.has(r.id)).map(r => f('study-note-added', r.id))]
      const bs = i.before.filter(r => a.has(r.id)).map(r => r.id), as = i.after.filter(r => b.has(r.id)).map(r => r.id); if (demandDigest(bs) !== demandDigest(as)) findings.push(f('study-shared-order-changed', ...bs))
      return { findings, metrics: [m('shared-note-count', 'notebook', bs.length)] }
    }),
  spec(prefix + 'provenance-edge-audit', 'Check declared note-to-source byte spans against source revision/digest pins and byte bounds. Does not read source bytes or prove quotation support.',
    input({ notes: records({ sourceId: id }), sources: records({ revision: digest, contentDigest: digest, utf8Bytes: count }), edges: records({ noteId: id, sourceId: id, sourceRevision: digest, sourceDigest: digest, startByte: count, endByte: count }) }),
    { notes: [{ id: 'n1', sourceId: 's1' }], sources: [{ id: 's1', revision: hash, contentDigest: hash, utf8Bytes: 100 }], edges: [{ id: 'e1', noteId: 'n1', sourceId: 's1', sourceRevision: hash, sourceDigest: hash, startByte: 0, endByte: 100 }] },
    { notes: [{ id: 'n1', sourceId: 's1' }], sources: [{ id: 's1', revision: hash, contentDigest: hash, utf8Bytes: 100 }], edges: [{ id: 'e1', noteId: 'n1', sourceId: 's1', sourceRevision: hash, sourceDigest: hash, startByte: 0, endByte: 101 }] },
    ['study-edge-span-outside-source', 'study-edge-endpoint-missing', 'study-edge-pin-mismatch'], ['bound-note-spans'], i => {
      unique(i.notes.map(r => r.id)); unique(i.sources.map(r => r.id)); unique(i.edges.map(r => r.id)); const n = new Map(i.notes.map(r => [r.id, r])), s = new Map(i.sources.map(r => [r.id, r])); let bound = 0
      const findings = i.edges.flatMap(r => { const nv = n.get(r.noteId), sv = s.get(r.sourceId); if (!nv || !sv) return [f('study-edge-endpoint-missing', r.id)]; if (nv.sourceId !== r.sourceId || sv.revision !== r.sourceRevision || sv.contentDigest !== r.sourceDigest) return [f('study-edge-pin-mismatch', r.id)]; if (r.endByte <= r.startByte || r.endByte > sv.utf8Bytes) return [f('study-edge-span-outside-source', r.id)]; bound++; return [] }); return { findings, metrics: [m('bound-note-spans', 'notebook', bound)] }
    }),
  spec(prefix + 'scope-boundary-audit', 'Filter note metadata by exact notebook and allowed claim-kind declarations before selection. No inferred truth, learner profile or claim completeness.',
    input({ notebookId: id, allowedKinds: list(kind, 1, 3), notes: records({ notebookId: id, claimKind: kind }) }), { notebookId: 'b1', allowedKinds: ['quotation'], notes: [{ id: 'n1', notebookId: 'b1', claimKind: 'quotation' }] }, { notebookId: 'b1', allowedKinds: ['quotation'], notes: [{ id: 'n1', notebookId: 'b2', claimKind: 'quotation' }] },
    ['study-notebook-outside-scope', 'study-claim-kind-outside-scope'], ['in-scope-notes'], i => {
      unique(i.allowedKinds); unique(i.notes.map(r => r.id)); let inside = 0; const findings = i.notes.flatMap(r => { const issues = [...(r.notebookId !== i.notebookId ? [f('study-notebook-outside-scope', r.id)] : []), ...(!i.allowedKinds.includes(r.claimKind) ? [f('study-claim-kind-outside-scope', r.id)] : [])]; if (!issues.length) inside++; return issues }); return { findings, metrics: [m('in-scope-notes', 'notebook', inside)] }
    }),
  spec(prefix + 'export-semantic-parity', 'Compare exact typed notebook, source, revision, claim-kind, basis and locator projections by note ID. Row order is ignored; no text or semantic entailment comparison.',
    input({ before: list(projection, 0, 32), after: list(projection, 0, 32) }), { before: [row], after: [row] }, { before: [row], after: [{ ...row, sourceRevision: otherHash }] },
    ['study-export-fields-changed', 'study-export-note-missing', 'study-export-note-added'], ['identical-notes'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), b = new Map(i.before.map(r => [r.id, r])); let same = 0
      const findings = i.before.flatMap(r => { const v = a.get(r.id); if (!v) return [f('study-export-note-missing', r.id)]; if (demandDigest(r) !== demandDigest(v)) return [f('study-export-fields-changed', r.id)]; same++; return [] }); findings.push(...i.after.filter(r => !b.has(r.id)).map(r => f('study-export-note-added', r.id))); return { findings, metrics: [m('identical-notes', 'notebook', same)] }
    }),
]
