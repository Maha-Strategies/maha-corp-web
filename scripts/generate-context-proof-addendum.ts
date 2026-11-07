import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  CONTEXT_PROOF_CANONICALIZATION_ADDENDUM,
  fixtureFileDigest,
  recomputeContextCompilerInputHash,
  recomputeContextCompilerOutputHash,
} from '../lib/context-proof-canonicalization.ts'
import { buildContextProofFixture, validateContextProofFixture } from '../lib/context-proof-fixture.ts'
import type { ContextPackRequest } from '../lib/context-compiler.ts'

const root = join(import.meta.dirname, '..')
const frozenRoot = join(root, 'test', 'fixtures', 'context-proof')
const outputRoot = join(root, 'test', 'fixtures', 'context-proof-addendum-v3.1')

const frozenFiles = [
  'index.json',
  'representative-n70/fixture.json',
  'boundary-n128/fixture.json',
  'unsupported-n129/fixture.json',
  'duplicate-retained-set/fixture.json',
  'duplicate-retained-set/adversarial-retained-duplicate.json',
] as const

const frozenDigests = Object.fromEntries(frozenFiles.map((path) => [
  path,
  fixtureFileDigest(readFileSync(join(frozenRoot, path))),
]))

function partialCoverageRequest(): ContextPackRequest {
  return {
    clientRequestId: 'proof_fixture_partial_coverage',
    task: 'Retain the signed canary threshold, credential rotation evidence, and rollback trigger.',
    tokenBudget: 128,
    provenance: 'compact',
    scoring: 'bm25',
    budgetMode: 'guaranteed',
    documents: [
      {
        id: 'release',
        title: 'Release control',
        text: 'The signed canary threshold requires success in every production region before release.',
      },
      {
        id: 'rotation',
        title: 'Credential rotation',
        text: 'Credential rotation evidence must include reviewer identity and a stable evidence digest.',
      },
      {
        id: 'rollback',
        title: 'Rollback control',
        text: 'Rollback begins when error rate exceeds two percent for five consecutive minutes.',
      },
      {
        id: 'irrelevant',
        title: 'Office note',
        text: 'The office garden receives water on Tuesday and the kitchen inventory is counted monthly.',
      },
    ],
  }
}

const partialCoverage = buildContextProofFixture({
  fixtureId: 'partial-coverage-3-of-4',
  description: 'Sanitized four-source fixture retaining three relevant sources and omitting one irrelevant source.',
  request: partialCoverageRequest(),
})
validateContextProofFixture(partialCoverage)

if (!partialCoverage.expectedPublicValues) throw new Error('Partial-coverage fixture must be supported.')
if (partialCoverage.expectedPublicValues.coverageNumerator !== 3
  || partialCoverage.expectedPublicValues.coverageDenominator !== 4
  || partialCoverage.expectedPublicValues.coveragePercentageBps !== 7_500) {
  throw new Error('Partial-coverage fixture must exercise exact 3/4 source coverage.')
}
if (partialCoverage.compilerCommitments.inputHash !== recomputeContextCompilerInputHash(partialCoverage.privateWitness.request)) {
  throw new Error('Partial-coverage inputHash does not follow the documented production preimage.')
}
if (partialCoverage.compilerCommitments.outputHash !== recomputeContextCompilerOutputHash(partialCoverage.privateWitness.compiledContext)) {
  throw new Error('Partial-coverage outputHash does not follow the documented production preimage.')
}

mkdirSync(join(outputRoot, 'partial-coverage-3-of-4'), { recursive: true })
const partialPath = join(outputRoot, 'partial-coverage-3-of-4', 'fixture.json')
writeFileSync(partialPath, `${JSON.stringify(partialCoverage, null, 2)}\n`)

const rejectionPublicValues = {
  unsupportedPassageCount: {
    proofContractVersion: 3,
    status: 'unsupported_passage_count',
    reasonCode: 'retained_passage_count_exceeds_limit',
    observedRetainedPassageCount: 129,
    maximumSupportedRetainedPassages: 128,
    proofAttempted: false,
    chargePermitted: false,
  },
  invalidRetainedSet: {
    proofContractVersion: 3,
    status: 'rejected_invalid_retained_set',
    reasonCode: 'retained_passage_hash_not_unique',
    proofAttempted: false,
    chargePermitted: false,
  },
} as const

const partialBytes = readFileSync(partialPath)
const index = {
  addendumVersion: CONTEXT_PROOF_CANONICALIZATION_ADDENDUM,
  wireContractVersion: 3,
  compatibility: 'backward-compatible clarification; frozen v3 fixture bytes are unchanged',
  frozenCheckpointSha256: frozenDigests,
  bundles: [{
    id: partialCoverage.fixtureId,
    path: 'partial-coverage-3-of-4/fixture.json',
    sha256: fixtureFileDigest(partialBytes),
    expectedStatus: 'success',
    expectedCoverage: { numerator: 3, denominator: 4, basisPoints: 7_500 },
  }],
  rejectionPublicValues,
}
writeFileSync(join(outputRoot, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)

console.log(JSON.stringify({
  outputRoot,
  addendumVersion: index.addendumVersion,
  partialFixtureSha256: index.bundles[0].sha256,
  frozenCheckpointFiles: frozenFiles.length,
  coverage: index.bundles[0].expectedCoverage,
}, null, 2))
