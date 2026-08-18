import { createHash } from 'node:crypto'

import {
  compileContextPack,
  estimateTokens,
  normalizeContextSource,
  sha256,
  splitContextSourcePassages,
  type ContextPackRequest,
} from './context-compiler.ts'

export const CONTEXT_PROOF_FIXTURE_SCHEMA = 'maha-context-proof-fixture-v1' as const
export const CONTEXT_PROOF_CONTRACT_VERSION = 3
export const CONTEXT_PROOF_MAX_RETAINED_PASSAGES = 128
export const CONTEXT_PROOF_PROTOTYPE_GUEST_DIGEST = 'sha256:594ea38106c0f305b1293749b4357c52f6833f594ea66ab706e07b9c056465d0'
export const CONTEXT_PROOF_PROTOTYPE_VERIFYING_KEY = '0x005b383d68ba6c851fee4a93b4fefb1abce146318dbb2041dbc1f785a1f24b6d'

type ProofStatus = 'success' | 'unsupported_passage_count' | 'rejected_invalid_retained_set'

export type ProofFixtureSource = {
  sourceId: string
  title: string
  normalizedBytesLen: number
  sourceHash: string
  normalizedText: string
}

export type ProofFixturePassage = {
  passageId: string
  sourceId: string
  sourceStartByte: number
  sourceEndByte: number
  text: string
  passageHash: string
  reportedEstimatedTokens: number
  dedupStatus: 'unique' | 'duplicate'
  duplicateOf: string | null
  retained: boolean
  dropReason: 'duplicate' | 'budget_or_render_limit' | null
}

export type ContextProofFixture = {
  schemaVersion: typeof CONTEXT_PROOF_FIXTURE_SCHEMA
  proofContractVersion: typeof CONTEXT_PROOF_CONTRACT_VERSION
  fixtureId: string
  description: string
  privacyClassification: 'sanitized_synthetic_or_published_source'
  normalizationBasis: 'normalized_source_v1'
  offsetEncoding: 'utf8'
  offsetRange: 'half_open'
  hashEncoding: 'sha256:<64_lowercase_hex>'
  tokenAccounting: {
    tokenEstimatorVersion: 'maha_model_neutral_v1'
    budgetMode: 'estimated' | 'guaranteed'
    declaredTokenBudget: number
    compilerSelectionBudget: number
    retainedPassageReportedTokens: number
    compiledContextReportedTokens: number
    reportedTokenArithmeticValid: boolean
    tokenEstimatorVerified: false
    providerTokenBudgetGuaranteed: false
  }
  proofDecision: {
    status: ProofStatus
    shouldAttemptProof: boolean
    retainedPassageCount: number
    maximumSupportedRetainedPassages: typeof CONTEXT_PROOF_MAX_RETAINED_PASSAGES
    chargePermitted: boolean
  }
  compilerCommitments: {
    inputHash: string
    outputHash: string
    originalEstimatedTokens: number
    compiledEstimatedTokens: number
    sourceCoveragePercent: number
    duplicatePassagesRemoved: number
  }
  claimBoundaries: {
    provesNormalizedSourceHashBinding: true
    provesRetainedPassageByteRangeBinding: true
    provesRetainedSetHashUniqueness: true
    provesSourceCoverageArithmetic: true
    provesReportedTokenArithmetic: true
    provesCandidateSetCompleteness: false
    provesRankingCorrectness: false
    provesTokenEstimatorCorrectness: false
    provesProviderTokenizerCompatibility: false
    provesSemanticCompleteness: false
  }
  privateWitness: {
    request: Omit<ContextPackRequest, 'clientRequestId'>
    sources: ProofFixtureSource[]
    candidatePassages: ProofFixturePassage[]
    retainedPassageIdsInOutputOrder: string[]
    compiledContext: string
  }
  expectedPublicValues: null | {
    proofContractVersion: typeof CONTEXT_PROOF_CONTRACT_VERSION
    status: 'success'
    sources: Array<{ sourceId: string; sourceHash: string }>
    retainedPassages: Array<{
      passageId: string
      sourceId: string
      sourceStartByte: number
      sourceEndByte: number
      passageHash: string
    }>
    inputHash: string
    outputHash: string
    tokenBudget: number
    compilerSelectionBudget: number
    retainedPassageReportedTokens: number
    compiledContextReportedTokens: number
    includedPassageCount: number
    coverageNumerator: number
    coverageDenominator: number
    coveragePercentageBps: number
    reportedTokenArithmeticValid: boolean
    tokenEstimatorVerified: false
    providerTokenBudgetGuaranteed: false
    tokenEstimatorVersion: 'maha_model_neutral_v1'
  }
  prototypeCompatibility: {
    guestDigestAssessed: typeof CONTEXT_PROOF_PROTOTYPE_GUEST_DIGEST
    verifyingKeyAssessed: typeof CONTEXT_PROOF_PROTOTYPE_VERIFYING_KEY
    compatible: false
    blockers: string[]
  }
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function passageOffsets(normalizedText: string, passages: Array<{ text: string }>): Array<{ start: number; end: number }> {
  let cursor = 0
  return passages.map((passage) => {
    const startCodeUnit = normalizedText.indexOf(passage.text, cursor)
    if (startCodeUnit < 0) throw new Error('Compiler passage cannot be located in its normalized source.')
    const endCodeUnit = startCodeUnit + passage.text.length
    cursor = endCodeUnit
    return {
      start: Buffer.byteLength(normalizedText.slice(0, startCodeUnit), 'utf8'),
      end: Buffer.byteLength(normalizedText.slice(0, endCodeUnit), 'utf8'),
    }
  })
}

function selectionBudget(request: ContextPackRequest): number {
  return (request.budgetMode ?? 'guaranteed') === 'guaranteed'
    ? Math.max(1, Math.floor(request.tokenBudget * 0.72))
    : request.tokenBudget
}

export function buildContextProofFixture(options: {
  fixtureId: string
  description: string
  request: ContextPackRequest
}): ContextProofFixture {
  const { fixtureId, description, request } = options
  const compiled = compileContextPack(request)
  const retainedIds = compiled.includedPassages.map((passage) => passage.passageId)
  const retainedIdSet = new Set(retainedIds)
  const firstPassageByHash = new Map<string, string>()

  const sources: ProofFixtureSource[] = []
  const candidatePassages: ProofFixturePassage[] = []

  for (const document of request.documents) {
    const title = document.title ?? document.id
    const normalizedText = normalizeContextSource(document.text)
    const passages = splitContextSourcePassages(document.id, title, document.text)
    const offsets = passageOffsets(normalizedText, passages)

    sources.push({
      sourceId: document.id,
      title,
      normalizedBytesLen: Buffer.byteLength(normalizedText, 'utf8'),
      sourceHash: sha256(normalizedText),
      normalizedText,
    })

    passages.forEach((passage, index) => {
      const passageId = `${passage.sourceId}:${passage.index}`
      const duplicateOf = firstPassageByHash.get(passage.hash) ?? null
      const retained = retainedIdSet.has(passageId)
      if (!duplicateOf) firstPassageByHash.set(passage.hash, passageId)
      candidatePassages.push({
        passageId,
        sourceId: passage.sourceId,
        sourceStartByte: offsets[index].start,
        sourceEndByte: offsets[index].end,
        text: passage.text,
        passageHash: passage.hash,
        reportedEstimatedTokens: passage.estimatedTokens,
        dedupStatus: duplicateOf ? 'duplicate' : 'unique',
        duplicateOf,
        retained,
        dropReason: retained ? null : duplicateOf ? 'duplicate' : 'budget_or_render_limit',
      })
    })
  }

  const retainedPassages = retainedIds.map((passageId) => {
    const passage = candidatePassages.find((candidate) => candidate.passageId === passageId)
    if (!passage) throw new Error(`Compiled passage ${passageId} is absent from the candidate manifest.`)
    return passage
  })
  const retainedSourceIds = new Set(retainedPassages.map((passage) => passage.sourceId))
  const coverageNumerator = retainedSourceIds.size
  const coverageDenominator = sources.length
  const coveragePercentageBps = coverageDenominator === 0
    ? 0
    : Math.floor((coverageNumerator * 10_000) / coverageDenominator)
  const retainedPassageReportedTokens = retainedPassages.reduce((total, passage) => total + passage.reportedEstimatedTokens, 0)
  const compilerSelectionBudget = selectionBudget(request)
  const reportedTokenArithmeticValid = retainedPassageReportedTokens <= compilerSelectionBudget
    && compiled.metrics.compiledEstimatedTokens <= compilerSelectionBudget
  const supported = retainedPassages.length <= CONTEXT_PROOF_MAX_RETAINED_PASSAGES
  const proofStatus: ProofStatus = supported ? 'success' : 'unsupported_passage_count'

  const privateRequest: Omit<ContextPackRequest, 'clientRequestId'> = {
    task: request.task,
    tokenBudget: request.tokenBudget,
    documents: request.documents.map((document, index) => ({
      id: document.id,
      title: document.title,
      text: sources[index].normalizedText,
    })),
    provenance: request.provenance,
    scoring: request.scoring,
    budgetMode: request.budgetMode,
  }

  const expectedPublicValues = supported ? {
    proofContractVersion: CONTEXT_PROOF_CONTRACT_VERSION,
    status: 'success' as const,
    sources: sources.map((source) => ({ sourceId: source.sourceId, sourceHash: source.sourceHash })),
    retainedPassages: retainedPassages.map((passage) => ({
      passageId: passage.passageId,
      sourceId: passage.sourceId,
      sourceStartByte: passage.sourceStartByte,
      sourceEndByte: passage.sourceEndByte,
      passageHash: passage.passageHash,
    })),
    inputHash: compiled.inputHash,
    outputHash: compiled.outputHash,
    tokenBudget: request.tokenBudget,
    compilerSelectionBudget,
    retainedPassageReportedTokens,
    compiledContextReportedTokens: compiled.metrics.compiledEstimatedTokens,
    includedPassageCount: retainedPassages.length,
    coverageNumerator,
    coverageDenominator,
    coveragePercentageBps,
    reportedTokenArithmeticValid,
    tokenEstimatorVerified: false as const,
    providerTokenBudgetGuaranteed: false as const,
    tokenEstimatorVersion: 'maha_model_neutral_v1' as const,
  } : null

  return {
    schemaVersion: CONTEXT_PROOF_FIXTURE_SCHEMA,
    proofContractVersion: CONTEXT_PROOF_CONTRACT_VERSION,
    fixtureId,
    description,
    privacyClassification: 'sanitized_synthetic_or_published_source',
    normalizationBasis: 'normalized_source_v1',
    offsetEncoding: 'utf8',
    offsetRange: 'half_open',
    hashEncoding: 'sha256:<64_lowercase_hex>',
    tokenAccounting: {
      tokenEstimatorVersion: 'maha_model_neutral_v1',
      budgetMode: request.budgetMode ?? 'guaranteed',
      declaredTokenBudget: request.tokenBudget,
      compilerSelectionBudget,
      retainedPassageReportedTokens,
      compiledContextReportedTokens: compiled.metrics.compiledEstimatedTokens,
      reportedTokenArithmeticValid,
      tokenEstimatorVerified: false,
      providerTokenBudgetGuaranteed: false,
    },
    proofDecision: {
      status: proofStatus,
      shouldAttemptProof: supported,
      retainedPassageCount: retainedPassages.length,
      maximumSupportedRetainedPassages: CONTEXT_PROOF_MAX_RETAINED_PASSAGES,
      chargePermitted: supported,
    },
    compilerCommitments: {
      inputHash: compiled.inputHash,
      outputHash: compiled.outputHash,
      originalEstimatedTokens: compiled.metrics.originalEstimatedTokens,
      compiledEstimatedTokens: compiled.metrics.compiledEstimatedTokens,
      sourceCoveragePercent: compiled.metrics.sourceCoveragePercent,
      duplicatePassagesRemoved: compiled.metrics.duplicatePassagesRemoved,
    },
    claimBoundaries: {
      provesNormalizedSourceHashBinding: true,
      provesRetainedPassageByteRangeBinding: true,
      provesRetainedSetHashUniqueness: true,
      provesSourceCoverageArithmetic: true,
      provesReportedTokenArithmetic: true,
      provesCandidateSetCompleteness: false,
      provesRankingCorrectness: false,
      provesTokenEstimatorCorrectness: false,
      provesProviderTokenizerCompatibility: false,
      provesSemanticCompleteness: false,
    },
    privateWitness: {
      request: privateRequest,
      sources,
      candidatePassages,
      retainedPassageIdsInOutputOrder: retainedIds,
      compiledContext: compiled.context,
    },
    expectedPublicValues,
    prototypeCompatibility: {
      guestDigestAssessed: CONTEXT_PROOF_PROTOTYPE_GUEST_DIGEST,
      verifyingKeyAssessed: CONTEXT_PROOF_PROTOTYPE_VERIFYING_KEY,
      compatible: false,
      blockers: [
        'Prototype guest recomputes whitespace token counts; v1 must prove arithmetic over Maha-reported counts without claiming estimator verification.',
        'Prototype guest derives different inputHash and outputHash values instead of validating Maha production hashes.',
        'Prototype guest reselects passages in source/offset order; v1 must validate the compiler-retained set without claiming BM25 ranking correctness.',
        'Prototype guest computes byte coverage; Maha production coverage is the number of represented sources over total sources.',
        'Prototype guest has no unsupported_passage_count preflight for retained passage counts above 128.',
        'Prototype public values omit the explicit token-estimator non-claims required by proof contract v3.',
      ],
    },
  }
}

function assertHash(value: string, field: string): void {
  if (!/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(`${field} must use sha256:<64_lowercase_hex>.`)
}

export function validateContextProofFixture(fixture: ContextProofFixture): void {
  if (fixture.schemaVersion !== CONTEXT_PROOF_FIXTURE_SCHEMA) throw new Error('Unsupported fixture schema.')
  if (fixture.proofContractVersion !== CONTEXT_PROOF_CONTRACT_VERSION) throw new Error('Unsupported proof contract version.')
  if (fixture.normalizationBasis !== 'normalized_source_v1' || fixture.offsetEncoding !== 'utf8' || fixture.offsetRange !== 'half_open') {
    throw new Error('Unsupported normalization or offset convention.')
  }

  const sourceById = new Map(fixture.privateWitness.sources.map((source) => [source.sourceId, source]))
  for (const source of fixture.privateWitness.sources) {
    assertHash(source.sourceHash, `${source.sourceId}.sourceHash`)
    if (normalizeContextSource(source.normalizedText) !== source.normalizedText) throw new Error(`${source.sourceId} is not normalized_source_v1.`)
    if (Buffer.byteLength(source.normalizedText, 'utf8') !== source.normalizedBytesLen) throw new Error(`${source.sourceId} byte length is incorrect.`)
    if (sha256(source.normalizedText) !== source.sourceHash) throw new Error(`${source.sourceId} source hash is incorrect.`)
  }

  const retainedIds = new Set(fixture.privateWitness.retainedPassageIdsInOutputOrder)
  const retainedHashes = new Set<string>()
  for (const passage of fixture.privateWitness.candidatePassages) {
    assertHash(passage.passageHash, `${passage.passageId}.passageHash`)
    const source = sourceById.get(passage.sourceId)
    if (!source) throw new Error(`${passage.passageId} references an unknown source.`)
    const sourceBytes = Buffer.from(source.normalizedText, 'utf8')
    if (passage.sourceStartByte < 0 || passage.sourceEndByte <= passage.sourceStartByte || passage.sourceEndByte > sourceBytes.length) {
      throw new Error(`${passage.passageId} has an invalid half-open byte range.`)
    }
    const sliced = sourceBytes.subarray(passage.sourceStartByte, passage.sourceEndByte).toString('utf8')
    if (sliced !== passage.text) throw new Error(`${passage.passageId} byte range does not reproduce its text.`)
    if (sha256(passage.text) !== passage.passageHash) throw new Error(`${passage.passageId} passage hash is incorrect.`)
    if (passage.reportedEstimatedTokens !== estimateTokens(passage.text)) throw new Error(`${passage.passageId} reported token count differs from Maha.`)
    if (passage.retained !== retainedIds.has(passage.passageId)) throw new Error(`${passage.passageId} retained flag disagrees with output order.`)
    if (passage.retained) {
      if (retainedHashes.has(passage.passageHash)) throw new Error('Retained passage hashes are not unique.')
      retainedHashes.add(passage.passageHash)
    }
  }

  const rebuilt = compileContextPack({
    clientRequestId: `proof_validation_${sha256Hex(fixture.fixtureId).slice(0, 16)}`,
    ...fixture.privateWitness.request,
  })
  if (rebuilt.context !== fixture.privateWitness.compiledContext) throw new Error('Compiled context is not reproducible.')
  if (rebuilt.inputHash !== fixture.compilerCommitments.inputHash) throw new Error('inputHash is not reproducible.')
  if (rebuilt.outputHash !== fixture.compilerCommitments.outputHash) throw new Error('outputHash is not reproducible.')
  if (JSON.stringify(rebuilt.includedPassages.map((passage) => passage.passageId)) !== JSON.stringify(fixture.privateWitness.retainedPassageIdsInOutputOrder)) {
    throw new Error('Retained passage order is not reproducible.')
  }

  const retained = fixture.privateWitness.candidatePassages.filter((passage) => passage.retained)
  const coveredSources = new Set(retained.map((passage) => passage.sourceId))
  const expectedSupported = retained.length <= CONTEXT_PROOF_MAX_RETAINED_PASSAGES
  if (fixture.proofDecision.shouldAttemptProof !== expectedSupported) throw new Error('Proof decision disagrees with retained passage cap.')
  if (fixture.proofDecision.chargePermitted !== expectedSupported) throw new Error('Unsupported fixtures must not be chargeable.')
  if (!expectedSupported) {
    if (fixture.proofDecision.status !== 'unsupported_passage_count' || fixture.expectedPublicValues !== null) throw new Error('N>128 must be a no-proof, no-charge decision.')
    return
  }

  const publicValues = fixture.expectedPublicValues
  if (!publicValues || publicValues.status !== 'success') throw new Error('Supported fixture must define successful public values.')
  if (publicValues.includedPassageCount !== retained.length) throw new Error('Public passage count is incorrect.')
  if (publicValues.compilerSelectionBudget !== fixture.tokenAccounting.compilerSelectionBudget
    || publicValues.retainedPassageReportedTokens !== fixture.tokenAccounting.retainedPassageReportedTokens
    || publicValues.compiledContextReportedTokens !== fixture.tokenAccounting.compiledContextReportedTokens) {
    throw new Error('Public reported-token arithmetic inputs are incorrect.')
  }
  if (publicValues.coverageNumerator !== coveredSources.size || publicValues.coverageDenominator !== sourceById.size) throw new Error('Public source coverage is incorrect.')
  if (publicValues.coveragePercentageBps !== Math.floor((coveredSources.size * 10_000) / sourceById.size)) throw new Error('Public coverage basis points are incorrect.')
  if (publicValues.tokenEstimatorVerified || publicValues.providerTokenBudgetGuaranteed) throw new Error('Proof contract must preserve token-estimator non-claims.')
  if (!publicValues.reportedTokenArithmeticValid) throw new Error('Reported token arithmetic is invalid.')
}
