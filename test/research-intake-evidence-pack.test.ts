import assert from 'node:assert/strict'
import test from 'node:test'

import { auditInputHash, type MpsAuditResult } from '../lib/mps-audit-engine.ts'
import {
  RESEARCH_INTAKE_MAX_SECTIONS,
  ResearchIntakeSectionFailure,
  auditResearchIntakeSections,
  assembleResearchIntakeEvidencePack,
  parseResearchIntakeInput,
  researchIntakeInputHash,
  type ResearchIntakeSectionCheckpoint,
} from '../lib/research-intake-evidence-pack.ts'

const input = () => parseResearchIntakeInput({
  clientRequestId: 'research-intake-test-001',
  question: 'Should a governed gateway pilot proceed to a human research engagement?',
  intendedAudience: 'AI risk owner',
  intendedDecision: 'Whether to commission the next phase',
  sections: [
    { sourceId: 'source-a', sectionId: 'findings', title: 'Findings', text: 'The gateway reduced selected context by 40 percent in a synthetic test. No production result has established the same reduction.' },
    { sourceId: 'source-b', sectionId: 'limits', title: 'Limits', text: 'The gateway reduced selected context by 15 percent in a separate trial. The acceptable failure threshold remains undecided.' },
  ],
})

function audits(value = input()): MpsAuditResult[] {
  return value.sections.map((section, index) => ({
    mps_version: '0.1',
    input_hash: auditInputHash(section.text),
    claims: index === 0 ? [
      { excerpt: 'The gateway reduced selected context by 40 percent in a synthetic test', tag: 'UNVERIFIED', rationale: 'The supplied section contains no identifiable evidence.', action: 'verify' },
      { excerpt: 'No production result has established the same reduction', tag: 'BOUNDARY', rationale: 'States the limit of the evidence.', action: 'none' },
    ] : [
      { excerpt: 'The gateway reduced selected context by 15 percent in a separate trial', tag: 'UNVERIFIED', rationale: 'The supplied section contains no trial locator.', action: 'cite' },
      { excerpt: 'The acceptable failure threshold remains undecided', tag: 'BOUNDARY', rationale: 'Names an unresolved decision criterion.', action: 'none' },
    ],
  }))
}

test('parses one to ten ordered supplied sections and refuses unknown fields', () => {
  assert.equal(input().sections.length, 2)
  const eleven = Array.from({ length: RESEARCH_INTAKE_MAX_SECTIONS + 1 }, (_, i) => ({ sourceId: `s-${i}`, sectionId: 'one', text: 'A sufficiently long source section for validation.' }))
  assert.throws(() => parseResearchIntakeInput({ clientRequestId: 'request-001', question: 'What should happen next?', sections: eleven }), /1-10/)
  assert.throws(() => parseResearchIntakeInput({ ...input(), extra: true }), /Unknown request field/)
  assert.throws(() => parseResearchIntakeInput({ ...input(), sections: [{ sourceId: 'a', sectionId: 'b', text: 'Valid source section content for one.' }, { sourceId: 'a', sectionId: 'b', text: 'Valid source section content for two.' }] }), /Duplicate/)
})

test('input digest excludes request identity but binds question, metadata, order, identifiers, and text', () => {
  const original = input()
  assert.equal(researchIntakeInputHash(original), researchIntakeInputHash({ ...original, clientRequestId: 'different-request-id' }))
  assert.notEqual(researchIntakeInputHash(original), researchIntakeInputHash({ ...original, question: `${original.question} Changed.` }))
  assert.notEqual(researchIntakeInputHash(original), researchIntakeInputHash({ ...original, sections: [...original.sections].reverse() }))
})

test('assembles the required intake outputs with capacity-based economics', () => {
  const value = input()
  const pack = assembleResearchIntakeEvidencePack(value, audits(value))
  assert.equal(pack.economicBasis.priceBaseUnits, '1000000')
  assert.equal(pack.economicBasis.includedSectionAuditCapacity, 10)
  assert.equal(pack.economicBasis.auditsPerformed, 2)
  assert.equal(pack.economicBasis.unusedCapacity, 8)
  assert.equal(pack.sectionAudits.length, 2)
  assert.equal(pack.orderedSourceSectionManifest.length, 2)
  assert.equal(pack.consolidatedClaimInventory.length, 4)
  assert.equal(pack.citationGaps.length, 2)
  assert.equal(pack.potentialConflicts.length, 1)
  assert.match(pack.boundaries.join(' '), /not a research brief/i)
  assert.match(pack.boundaries.join(' '), /no new research/i)
  assert.match(pack.boundaries.join(' '), /recommendation/i)
  assert.match(pack.proposedHumanResearchScope.objective, /governed gateway pilot/)
  assert.match(pack.receiptDigest, /^sha256:[a-f0-9]{64}$/)
  assert.match(pack.manifestDigest, /^sha256:[a-f0-9]{64}$/)
})

test('receipt and manifest digests are deterministic and tamper-evident', () => {
  const value = input()
  const first = assembleResearchIntakeEvidencePack(value, audits(value))
  const second = assembleResearchIntakeEvidencePack(value, audits(value))
  assert.deepEqual(second, first)
  const changed = parseResearchIntakeInput({ ...value, intendedAudience: 'Procurement owner' })
  const mutated = assembleResearchIntakeEvidencePack(changed, audits(changed))
  assert.notEqual(mutated.receiptDigest, first.receiptDigest)
  assert.equal(mutated.manifestDigest, first.manifestDigest, 'manifest covers question and supplied sections, not optional intake metadata')
})

test('fails closed when an audit is missing or bound to different bytes', () => {
  const value = input()
  assert.throws(() => assembleResearchIntakeEvidencePack(value, audits(value).slice(0, 1)), /exactly one MPS audit/)
  const wrong = audits(value)
  wrong[0] = { ...wrong[0]!, input_hash: auditInputHash('Different source section bytes.') }
  assert.throws(() => assembleResearchIntakeEvidencePack(value, wrong), /not bound/)
})

test('the machine packet does not reproduce complete supplied sections', () => {
  const value = input()
  const pack = assembleResearchIntakeEvidencePack(value, audits(value))
  const serialized = JSON.stringify(pack)
  for (const section of value.sections) assert.equal(serialized.includes(section.text), false)
  assert.equal(pack.retentionBoundaries.fullSourceSectionsStored, false)
  assert.equal(pack.retentionBoundaries.verbatimClaimExcerptsRetained, true)
})

test('recovery retries only the failed section and reuses persisted successful siblings', async () => {
  const value = input()
  const persisted: ResearchIntakeSectionCheckpoint[] = []
  let initialCalls = 0
  await assert.rejects(
    auditResearchIntakeSections(value, async (prompt) => {
      initialCalls += 1
      if (prompt.includes(value.sections[1]!.text)) throw new Error('synthetic provider failure')
      return JSON.stringify({ claims: [{ excerpt: 'The gateway reduced selected context by 40 percent in a synthetic test', tag: 'UNVERIFIED', rationale: 'Requires verification.', action: 'verify' }] })
    }, { concurrency: 1, persist: async (checkpoint) => { persisted.push(checkpoint) } }),
    ResearchIntakeSectionFailure,
  )
  assert.equal(initialCalls, 2)
  assert.equal(persisted.length, 1)
  assert.equal(persisted[0]!.order, 1)

  let recoveryCalls = 0
  const recovered = await auditResearchIntakeSections(value, async (prompt) => {
    recoveryCalls += 1
    assert.match(prompt, /15 percent/)
    return JSON.stringify({ claims: [{ excerpt: 'The gateway reduced selected context by 15 percent in a separate trial', tag: 'UNVERIFIED', rationale: 'Requires a trial locator.', action: 'cite' }] })
  }, { existing: persisted, concurrency: 1 })
  assert.equal(recoveryCalls, 1, 'the completed first section must never be rerun')
  assert.equal(recovered.length, 2)
  assert.equal(recovered[0]!.input_hash, persisted[0]!.inputHash)
})
