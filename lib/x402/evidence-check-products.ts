import type { EvidenceCheckId } from './evidence-check-contracts.ts'
type Row = Record<string, unknown>
type Document = { documentId: string; tenantId: string }
type Version = { documentId: string; versionId: string; versionHash: string; effectiveFrom: string; effectiveTo: string | null }
type Selection = Pick<Version, 'documentId' | 'versionId' | 'versionHash'>
type Passage = { passageId: string; parentDocumentId: string; versionHash: string; chunkHash: string; ordinal?: number }
const sorted = (values: string[]) => [...new Set(values)].sort()
function unique(values: string[]) { if (new Set(values).size !== values.length) throw new Error('duplicate-declaration') }
function utc(value: string) { if (new Date(value).toISOString() !== value) throw new Error('non-canonical-time') }

/** Input shape is enforced by the shared microproduct parser before this pure check. */
export function buildEvidenceCheck(id: EvidenceCheckId, input: Row): Row {
  if (id === 'evidence-scope-check') {
    const expected = input.expectedDocuments as Document[], observed = input.observedDocuments as Document[]
    unique(expected.map(x => x.documentId)); unique(observed.map(x => x.documentId))
    if (expected.some(x => x.tenantId !== input.tenantId)) throw new Error('contradictory-scope')
    const missingDocumentIds = sorted(expected.filter(x => !observed.some(y => y.documentId === x.documentId && y.tenantId === input.tenantId)).map(x => x.documentId))
    const unexpectedDocumentIds = sorted(observed.filter(x => !expected.some(y => y.documentId === x.documentId)).map(x => x.documentId))
    const crossTenantDocumentIds = sorted(observed.filter(x => x.tenantId !== input.tenantId).map(x => x.documentId))
    return { state: missingDocumentIds.length || unexpectedDocumentIds.length || crossTenantDocumentIds.length ? 'mismatch' : input.scopeComplete ? 'consistent-declarations' : 'undetermined', missingDocumentIds, unexpectedDocumentIds, crossTenantDocumentIds, scopeComplete: input.scopeComplete, accessControlEnforced: false, sourcesVerified: false }
  }
  if (id === 'evidence-version-selection-check') {
    const documents = input.documentIds as string[], versions = input.versions as Version[], selections = input.selections as Selection[]
    utc(input.assessedAt as string); unique(documents)
    unique(versions.map(x => JSON.stringify([x.documentId, x.versionId])))
    unique(selections.map(x => JSON.stringify([x.documentId, x.versionId])))
    if ([...versions, ...selections].some(x => !documents.includes(x.documentId))) throw new Error('undeclared-document')
    for (const v of versions) { utc(v.effectiveFrom); if (v.effectiveTo !== null) { utc(v.effectiveTo); if (v.effectiveTo <= v.effectiveFrom) throw new Error('invalid-effective-interval') } }
    const checks = documents.slice().sort().map(documentId => {
      const known = versions.filter(x => x.documentId === documentId), selected = selections.filter(x => x.documentId === documentId)
      // Half-open effective intervals: the ending instant belongs to the next version.
      const active = known.filter(v => v.effectiveFrom <= (input.assessedAt as string) && (v.effectiveTo === null || (input.assessedAt as string) < v.effectiveTo))
      const issues: string[] = []
      if (!selected.length) issues.push('missing-selection')
      if (selected.length > 1) issues.push('multiple-selections')
      if (selected.some(s => !known.some(v => v.versionId === s.versionId))) issues.push('unknown-selection')
      if (selected.some(s => known.some(v => v.versionId === s.versionId) && !active.some(v => v.versionId === s.versionId))) issues.push('inactive-selection')
      if (selected.some(s => known.some(v => v.versionId === s.versionId && v.versionHash !== s.versionHash))) issues.push('version-hash-mismatch')
      if (!active.length) issues.push('no-active-version')
      if (active.length > 1) issues.push('ambiguous-active-versions')
      if (!input.metadataComplete) issues.push('incomplete-metadata')
      const mismatch = issues.some(x => ['missing-selection', 'multiple-selections', 'unknown-selection', 'inactive-selection', 'version-hash-mismatch'].includes(x))
      return { documentId, state: mismatch ? 'mismatch' : issues.length ? 'undetermined' : 'consistent-declarations', activeVersionIds: sorted(active.map(x => x.versionId)), selectedVersionIds: sorted(selected.map(x => x.versionId)), issues }
    })
    return { state: checks.some(x => x.state === 'mismatch') ? 'mismatch' : checks.some(x => x.state === 'undetermined') ? 'undetermined' : 'consistent-declarations', checks, legalEffectVerified: false, sourcesVerified: false }
  }
  const expected = input.expected as Passage[], retained = input.retained as Passage[]
  unique(expected.map(x => x.passageId)); unique(retained.map(x => String(x.ordinal)))
  const missingPassageIds = sorted(expected.filter(x => !retained.some(y => y.passageId === x.passageId)).map(x => x.passageId))
  const unexpectedPassageIds = sorted(retained.filter(x => !expected.some(y => y.passageId === x.passageId)).map(x => x.passageId))
  const repeatedPassageIds = sorted(retained.filter(x => retained.filter(y => y.passageId === x.passageId).length > 1).map(x => x.passageId))
  const substitutedPassageIds = sorted(retained.filter(x => expected.some(y => y.passageId === x.passageId && ['parentDocumentId', 'versionHash', 'chunkHash'].some(k => x[k as keyof Passage] !== y[k as keyof Passage]))).map(x => x.passageId))
  const ordinals = new Set(retained.map(x => x.ordinal)), max = retained.length ? Math.max(...retained.map(x => x.ordinal!)) : -1
  const orderingGaps = Array.from({ length: max + 1 }, (_, i) => i).filter(i => !ordinals.has(i))
  return { state: [missingPassageIds, unexpectedPassageIds, repeatedPassageIds, substitutedPassageIds, orderingGaps].some(x => x.length) ? 'mismatch' : 'consistent-declarations', missingPassageIds, unexpectedPassageIds, repeatedPassageIds, substitutedPassageIds, orderingGaps, promptInspected: false, modelUseVerified: false }
}
