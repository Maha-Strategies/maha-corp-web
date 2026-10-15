import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { artifactSchema, publicationHandler, PUBLICATION_INPUTS } from '../lib/api-v1/publishing/products.ts'
import { publicationSamples, SYNTHETIC_PUBLICATION } from '../scripts/lib/api-v1-final42-fixtures.ts'
import { compileRelease } from '../lib/agent-publishing/contracts.ts'
import { auditMpsContract, MPS_CONTRACT_INPUT } from '../lib/api-v1/mps-contract.ts'
import { batch20PortSpec, batch20Port } from '../lib/api-v1/batch20-ports.ts'
import { ENDPOINTS } from '../lib/api-v1/endpoints.registry.ts'
import { PREVIOUS_958_PRODUCTION_ENDPOINTS as PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'

test('publication pin audit validates supplied commitments without text, database or publication permission', async () => {
  const sample = publicationSamples()['publication-pinned-brief'], h = publicationHandler('publication-pinned-brief')
  const result = h.output.parse(await h.execute(h.input.parse(sample))) as Record<string, unknown>
  assert.equal(result.pinMatches, true); assert.deepEqual(result.mismatchedFields, [])
  assert.equal(result.publicPublicationAuthorized, false); assert.equal(result.artifactTextReturned, false)
  assert.ok(!JSON.stringify(result).includes(SYNTHETIC_PUBLICATION.markdown))
  assert.equal(h.recoverCorrection, undefined); assert.equal(h.beforeSettlement, undefined)
  const mismatch = await h.execute({ ...sample, pin: { ...sample.pin, releaseId: '9.9.9' } }) as Record<string, unknown>
  assert.equal(mismatch.pinMatches, false); assert.deepEqual(mismatch.mismatchedFields, ['releaseId'])
  assert.throws(() => h.input.parse({ ...sample, artifact: { ...sample.artifact, markdown: sample.artifact.markdown + 'tampering' } }))
  assert.throws(() => h.input.parse({ ...sample, artifact: { ...sample.artifact, licenseSha256: 'sha256:' + 'f'.repeat(64) } }))
  assert.throws(() => h.input.parse({ ...sample, dataClass: 'private' }))
  assert.throws(() => h.input.parse(sample.pin))
})
test('publication comparison reports only deterministic field and ID changes from two supplied artifacts', async () => {
  const sample = publicationSamples()['publication-release-comparison'], h = publicationHandler('publication-release-comparison')
  const result = h.output.parse(await h.execute(h.input.parse(sample))) as Record<string, unknown>
  assert.deepEqual(result.changedFields, ['title']); assert.equal(result.causalExplanationProvided, false)
  assert.deepEqual(result.addedFindingIds, []); assert.ok(!JSON.stringify(result).includes(sample.before.markdown))
  const identical = h.output.parse(await h.execute({ ...sample, after: 'same-as-before' })) as Record<string, unknown>
  assert.deepEqual(identical.changedFields, []); assert.deepEqual(identical.before, identical.after)
  const other = compileRelease({ ...SYNTHETIC_PUBLICATION, publicationId: 'other-publication' })
  assert.throws(() => PUBLICATION_INPUTS['publication-release-comparison'].parse({ ...sample, after: other }))
  assert.throws(() => artifactSchema.parse({ ...sample.before, artifactSha256: 'sha256:' + '0'.repeat(64) }))
  const code = readFileSync('lib/api-v1/publishing/products.ts', 'utf8')
  assert.doesNotMatch(code, /LocalReleaseJournal|withLocalReleases|node:sqlite|supabase|zizka|process\.env/i)
})
test('MPS replacement checks declared references/actions but never confirms truth or invokes a model', async () => {
  const spec = batch20PortSpec('mps-autonomous-audit')!, h = batch20Port(spec.id, '100002', { model: {
    policy: { mode: 'external-model', expected_usdc: .1, expectedBasis: 'unmeasured-planning-assumption', maximum_external_cost_usdc: null, costEnvelopeReviewed: false, liveModelSpendApproved: false },
    maximumCallCostUsd: 100, run: async () => { throw Error('must_never_run') },
  } })!
  const out = h.output.parse(await h.execute(spec.sample)) as { result: { modelCalls: number; factualVerificationPerformed: boolean } }
  assert.equal(out.result.modelCalls, 0); assert.equal(out.result.factualVerificationPerformed, false)
  const input = MPS_CONTRACT_INPUT.parse(spec.sample.request), claim = input.claims[0]
  const bad = auditMpsContract({ ...input, claims: [{ ...claim, excerpt: 'Not in the passage', tag: 'VERIFIED', sourceIds: ['missing'] }] })
  assert.deepEqual(bad.findings.map(f => f.code), ['excerpt-not-in-passage', 'unknown-source', 'verified-without-declared-record'])
  const unsupported = auditMpsContract({ ...input, claims: [{ ...claim, action: 'none' }] })
  assert.deepEqual(unsupported.findings.map(f => f.code), ['unverified-without-remedial-action'])
  const e = ENDPOINTS.find(e => e.id === spec.id)!
  assert.equal(e.amount, '100002'); assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.match(e.name, /Provenance-Contract/)
})
test('existing production contracts remain frozen and the final cohort preserves the approved cap', () => {
  const released = new Set(PRODUCTION_ENDPOINTS.map(e => e.id)), remaining = ENDPOINTS.filter(e => !released.has(e.id))
  assert.equal(released.size, 958); assert.equal(remaining.length, 42)
  assert.equal(remaining.reduce((n, e) => n + BigInt(e.amount), 0n), 2592940n)
  assert.ok(remaining.every(e => e.execution_cost?.mode !== 'external-model' && !e.execution_cost?.liveModelSpendApproved))
})
