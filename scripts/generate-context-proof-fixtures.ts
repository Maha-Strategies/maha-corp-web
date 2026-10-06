import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildContextProofFixture,
  CONTEXT_PROOF_CONTRACT_VERSION,
  CONTEXT_PROOF_FIXTURE_SCHEMA,
  CONTEXT_PROOF_MAX_RETAINED_PASSAGES,
  validateContextProofFixture,
  type ContextProofFixture,
} from '../lib/context-proof-fixture.ts'
import type { ContextPackRequest } from '../lib/context-compiler.ts'

const root = join(import.meta.dirname, '..')
const outputDirectory = join(root, 'test', 'fixtures', 'context-proof')

function syntheticRequest(passageCount: number, suffix: string): ContextPackRequest {
  const documentCount = Math.min(8, Math.max(1, Math.ceil(passageCount / 16)))
  const documents = Array.from({ length: documentCount }, (_, documentIndex) => {
    const passages = Array.from({ length: passageCount }, (_, passageIndex) => passageIndex)
      .filter((passageIndex) => passageIndex % documentCount === documentIndex)
      .map((passageIndex) => `Control record ${String(passageIndex + 1).padStart(3, '0')} contains deterministic provenance signal ${suffix}-${String(passageIndex + 1).padStart(3, '0')} for the retained passage boundary test.`)
    return {
      id: `boundary-${suffix}-${documentIndex + 1}`,
      title: `Boundary ${suffix.toUpperCase()} Source ${documentIndex + 1}`,
      text: passages.join('\n\n'),
    }
  })
  return {
    clientRequestId: `proof_fixture_${suffix}_${passageCount}`,
    task: 'Retain every deterministic provenance control record for proof-contract validation.',
    tokenBudget: 16_000,
    documents,
    provenance: 'none',
    scoring: 'bm25',
    budgetMode: 'guaranteed',
  }
}

function representativeRequest(): ContextPackRequest {
  const documents = JSON.parse(readFileSync(join(root, 'content', 'recipes', 'context-compiler-playground-workload.json'), 'utf8')) as ContextPackRequest['documents']
  return {
    clientRequestId: 'proof_fixture_representative_n70',
    task: 'Compare how these works describe cognition, adaptation, imagination, agency, and the construction of a self.',
    tokenBudget: 16_000,
    documents,
    provenance: 'compact',
    scoring: 'bm25',
    budgetMode: 'guaranteed',
  }
}

function duplicateRequest(): ContextPackRequest {
  const duplicate = 'A release requires signed credential-rotation evidence and a passing canary in every production region.'
  return {
    clientRequestId: 'proof_fixture_duplicate_case',
    task: 'Retain the release condition, rollback trigger, and audit evidence without duplicate passages.',
    tokenBudget: 1_024,
    documents: [
      {
        id: 'release-plan',
        title: 'Release Plan',
        text: `${duplicate}\n\nRollback begins if API errors exceed two percent for five minutes.\n\nThe audit record stores metadata and hashes, never source payloads.`,
      },
      {
        id: 'review-notes',
        title: 'Review Notes',
        text: `${duplicate}\n\nThe reviewer approved the bounded deployment after checking the evidence digest.`,
      },
    ],
    provenance: 'compact',
    scoring: 'bm25',
    budgetMode: 'guaranteed',
  }
}

function writeBundle(name: string, fixture: ContextProofFixture, extraFiles: Record<string, unknown> = {}): void {
  validateContextProofFixture(fixture)
  const directory = join(outputDirectory, name)
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'fixture.json'), `${JSON.stringify(fixture, null, 2)}\n`)
  for (const [filename, value] of Object.entries(extraFiles)) {
    writeFileSync(join(directory, filename), `${JSON.stringify(value, null, 2)}\n`)
  }
}

mkdirSync(outputDirectory, { recursive: true })

const representative = buildContextProofFixture({
  fixtureId: 'representative-n70',
  description: 'Published four-document workload at the 16,000-token tier; expected to retain 70 passages.',
  request: representativeRequest(),
})
if (representative.proofDecision.retainedPassageCount !== 70) throw new Error('Representative fixture no longer retains exactly 70 passages.')

const boundary128 = buildContextProofFixture({
  fixtureId: 'boundary-n128',
  description: 'Sanitized synthetic boundary workload with exactly 128 retained passages.',
  request: syntheticRequest(128, 'n128'),
})
if (boundary128.proofDecision.retainedPassageCount !== 128) throw new Error('Boundary fixture no longer retains exactly 128 passages.')

const unsupported129 = buildContextProofFixture({
  fixtureId: 'unsupported-n129',
  description: 'Sanitized synthetic negative workload with 129 retained passages; proof must not be attempted or charged.',
  request: syntheticRequest(129, 'n129'),
})
if (unsupported129.proofDecision.status !== 'unsupported_passage_count') throw new Error('N=129 fixture must be unsupported.')

const duplicate = buildContextProofFixture({
  fixtureId: 'duplicate-retained-set',
  description: 'Sanitized exact-duplicate workload proving that the retained set contains unique passage hashes.',
  request: duplicateRequest(),
})
if (duplicate.compilerCommitments.duplicatePassagesRemoved !== 1) throw new Error('Duplicate fixture must remove exactly one passage.')

const adversarialDuplicate = structuredClone(duplicate)
const duplicateCandidate = adversarialDuplicate.privateWitness.candidatePassages.find((passage) => passage.dedupStatus === 'duplicate')
if (!duplicateCandidate) throw new Error('Duplicate fixture has no duplicate candidate.')
duplicateCandidate.retained = true
duplicateCandidate.dedupStatus = 'unique'
duplicateCandidate.duplicateOf = null
duplicateCandidate.dropReason = null
adversarialDuplicate.privateWitness.retainedPassageIdsInOutputOrder.push(duplicateCandidate.passageId)
adversarialDuplicate.proofDecision = {
  ...adversarialDuplicate.proofDecision,
  status: 'rejected_invalid_retained_set',
  shouldAttemptProof: false,
  retainedPassageCount: adversarialDuplicate.privateWitness.retainedPassageIdsInOutputOrder.length,
  chargePermitted: false,
}
adversarialDuplicate.expectedPublicValues = null

writeBundle('representative-n70', representative)
writeBundle('boundary-n128', boundary128)
writeBundle('unsupported-n129', unsupported129)
writeBundle('duplicate-retained-set', duplicate, { 'adversarial-retained-duplicate.json': adversarialDuplicate })

const index = {
  schemaVersion: CONTEXT_PROOF_FIXTURE_SCHEMA,
  proofContractVersion: CONTEXT_PROOF_CONTRACT_VERSION,
  maximumSupportedRetainedPassages: CONTEXT_PROOF_MAX_RETAINED_PASSAGES,
  bundles: [
    { id: representative.fixtureId, path: 'representative-n70/fixture.json', expectedStatus: representative.proofDecision.status },
    { id: boundary128.fixtureId, path: 'boundary-n128/fixture.json', expectedStatus: boundary128.proofDecision.status },
    { id: unsupported129.fixtureId, path: 'unsupported-n129/fixture.json', expectedStatus: unsupported129.proofDecision.status },
    {
      id: duplicate.fixtureId,
      path: 'duplicate-retained-set/fixture.json',
      adversarialPath: 'duplicate-retained-set/adversarial-retained-duplicate.json',
      adversarialExpectedStatus: 'rejected_invalid_retained_set',
      adversarialExpectedError: 'retained_passage_hash_not_unique',
      expectedStatus: duplicate.proofDecision.status,
    },
  ],
}
writeFileSync(join(outputDirectory, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)

console.log(JSON.stringify({
  outputDirectory,
  bundles: index.bundles.map((bundle) => ({ id: bundle.id, status: bundle.expectedStatus })),
}, null, 2))
