import { arraySchema as a, objectSchema as o, enumSchema as e, ID_SCHEMA as id, HASH_SCHEMA as hash, UTC_SCHEMA as utc, type MicroSchema } from './micro-schema.ts'

export const EVIDENCE_CHECK_PRODUCTS = {
  'evidence-scope-check': { amount: '41000', title: 'Declared Evidence Scope Check', description: 'Compare up to 80 expected and 80 observed document descriptors against one declared tenant and scope. Flags missing, unexpected and cross-tenant documents; incomplete scope stays undetermined. Public/synthetic metadata only. Not access-control enforcement, corpus completeness or legal verification.' },
  'evidence-version-selection-check': { amount: '63000', title: 'Evidence Version Selection Check', description: 'Check selected versions of up to 40 declared documents against up to 100 effective-date records at one assessment time. Flags inactive, unknown and missing selections; overlapping active versions remain ambiguous. Public/synthetic metadata only. No inferred amendment graph, legal effect or source validation.' },
  'context-manifest-check': { amount: '87000', title: 'Context Passage Manifest Check', description: 'Compare up to 128 expected passage bindings with up to 128 retained descriptors by passage ID, parent document, version hash and chunk hash. Flags omissions, substitutions, repeats and ordering gaps. Public/synthetic metadata only; does not inspect prompts or prove what a model saw or used.' },
} as const
export type EvidenceCheckId = keyof typeof EVIDENCE_CHECK_PRODUCTS
export const EVIDENCE_CHECK_IDS = Object.keys(EVIDENCE_CHECK_PRODUCTS) as EvidenceCheckId[]
export const isEvidenceCheck = (s: string): s is EvidenceCheckId => Object.hasOwn(EVIDENCE_CHECK_PRODUCTS, s)
const bool: MicroSchema = { type: 'boolean' }
const nullable = (s: MicroSchema): MicroSchema => ({ oneOf: [s, { type: 'null' }] })
const env = (fields: Record<string, MicroSchema>) => o({ dataClass: e('public', 'synthetic'), ...fields })
const doc = o({ documentId: id, tenantId: id })
const binding = { passageId: id, parentDocumentId: id, versionHash: hash, chunkHash: hash }
export const EVIDENCE_CHECK_INPUT_SCHEMAS: Record<EvidenceCheckId, MicroSchema> = {
  'evidence-scope-check': env({ tenantId: id, scopeComplete: bool, expectedDocuments: a(doc, 1, 80), observedDocuments: a(doc, 0, 80) }),
  'evidence-version-selection-check': env({ assessedAt: utc, metadataComplete: bool, documentIds: a(id, 1, 40), versions: a(o({ documentId: id, versionId: id, versionHash: hash, effectiveFrom: utc, effectiveTo: nullable(utc) }), 0, 100), selections: a(o({ documentId: id, versionId: id, versionHash: hash }), 0, 100) }),
  'context-manifest-check': env({ expected: a(o(binding), 1, 128), retained: a(o({ ...binding, ordinal: { type: 'integer', minimum: 0, maximum: 127 } }), 0, 128) }),
}
const ids = a(id, 0, 128)
const state = e('consistent-declarations', 'mismatch', 'undetermined')
const no: MicroSchema = { type: 'boolean', enum: [false] }
export const EVIDENCE_CHECK_RESULT_SCHEMAS: Record<EvidenceCheckId, MicroSchema> = {
  'evidence-scope-check': o({ state, missingDocumentIds: ids, unexpectedDocumentIds: ids, crossTenantDocumentIds: ids, scopeComplete: bool, accessControlEnforced: no, sourcesVerified: no }),
  'evidence-version-selection-check': o({ state, checks: a(o({ documentId: id, state, activeVersionIds: ids, selectedVersionIds: ids, issues: a(e('missing-selection', 'unknown-selection', 'inactive-selection', 'version-hash-mismatch', 'multiple-selections', 'ambiguous-active-versions', 'no-active-version', 'incomplete-metadata'), 0, 8) }), 1, 40), legalEffectVerified: no, sourcesVerified: no }),
  'context-manifest-check': o({ state, missingPassageIds: ids, unexpectedPassageIds: ids, repeatedPassageIds: ids, substitutedPassageIds: ids, orderingGaps: a({ type: 'integer', minimum: 0, maximum: 127 }, 0, 128), promptInspected: no, modelUseVerified: no }),
}
const h = (s: string) => 'sha256:' + s.repeat(64)
const passage = { passageId: 'passage-1', parentDocumentId: 'document-1', versionHash: h('1'), chunkHash: h('2') }
export const EVIDENCE_CHECK_SAMPLES: Record<EvidenceCheckId, Record<string, unknown>> = {
  'evidence-scope-check': { dataClass: 'synthetic', tenantId: 'tenant-a', scopeComplete: true, expectedDocuments: [{ documentId: 'agreement', tenantId: 'tenant-a' }, { documentId: 'amendment', tenantId: 'tenant-a' }], observedDocuments: [{ documentId: 'agreement', tenantId: 'tenant-a' }] },
  'evidence-version-selection-check': { dataClass: 'synthetic', assessedAt: '2026-10-09T00:00:00.000Z', metadataComplete: true, documentIds: ['document-1'], versions: [{ documentId: 'document-1', versionId: 'v1', versionHash: h('1'), effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: null }], selections: [{ documentId: 'document-1', versionId: 'v1', versionHash: h('1') }] },
  'context-manifest-check': { dataClass: 'synthetic', expected: [passage], retained: [{ ...passage, ordinal: 0 }] },
}
