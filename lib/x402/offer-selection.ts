import {
  BASE_MAINNET_CAIP2,
  USDC_DECIMALS,
  offerById,
  offerPriceUsd,
  payableOffers,
  type X402Offer,
} from './offers.ts'
import { BASE_USDC, MAHA_PAYEE } from './discovery-payment-recipe.ts'

/**
 * A machine-readable selection contract: which offer an autonomous buyer
 * should call, or that it should call neither.
 *
 * This is not marketing copy and not a paid endpoint. It exists because an
 * autonomous buyer has no human to ask, and the two compression offers are
 * genuinely easy to confuse -- both compile a context pack, and only one
 * measures anything. The expensive mistake is an agent reading "evaluation" as
 * "fact-checking" and paying $0.01 for a job this platform does not do.
 *
 * Everything commercial is derived from the catalog in offers.ts. Nothing here
 * restates a price, path, network, asset, limit or status, because a
 * hand-maintained second copy of those is exactly how a published guide starts
 * recommending an offer at a price that no longer exists.
 *
 * Selection is advisory. The buyer-policy package remains the signing
 * authorization boundary; a decision from here has never authorized anything.
 */

export const OFFER_SELECTION_SCHEMA_VERSION = '1.0.0'
export const OFFER_SELECTION_PATH = '/.well-known/maha/offer-selection.json'
export const SITE_ORIGIN = 'https://www.mahastrategies.com'
export const OFFER_SELECTION_CANONICAL_URL = `${SITE_ORIGIN}${OFFER_SELECTION_PATH}`

/** Accepted networks and assets. Anything else fails closed. */
export const SUPPORTED_NETWORKS = [BASE_MAINNET_CAIP2] as const
export const SUPPORTED_ASSETS = [BASE_USDC] as const

// --- Selection inputs ------------------------------------------------------

/**
 * What the buyer is trying to do. An explicit enumeration rather than inferred
 * intent: `compile-and-evaluate` is the only way to ask for the two-stage
 * flow, so a sequence is never something the selector decides on the buyer's
 * behalf.
 */
export type SelectionObjective =
  | 'compile-context-pack'
  | 'evaluate-context-quality'
  | 'compile-and-evaluate'
  | 'summarize'
  | 'verify-facts'
  | 'other'

export type LatencyPreference = 'low' | 'balanced' | 'thorough'

/** Accepted request encoding. Binary payloads are not a supported input. */
export type InputEncoding = 'utf8-text' | 'binary'

export type OfferSelectionInput = {
  objective: SelectionObjective
  estimatedInputBytes?: number
  estimatedInputTokens?: number
  documentCount?: number
  requiredTokenBudget?: number
  needsQualityEvaluation?: boolean
  needsRetentionMeasurement?: boolean
  needsSourceCoverageMeasurement?: boolean
  needsCitationTraceability?: boolean
  needsDeduplication?: boolean
  latencyPreference?: LatencyPreference
  /**
   * Ceiling in USDC **base units**, as a decimal integer string.
   *
   * A string of base units rather than a dollar number on purpose: $0.01 is
   * not representable in binary floating point, and a rounding error in a
   * spending ceiling is a rounding error in an authorization. `'5000'` is
   * $0.005. Every comparison below is BigInt.
   */
  maximumPriceUsdc?: string
  network?: string
  asset?: string
  /** Beyond the brief's list, because "unsupported binary input" is a stated non-fit. */
  inputEncoding?: InputEncoding
  /** Beyond the brief's list, because guaranteed completeness is a stated non-fit. */
  requiresGuaranteedCompleteness?: boolean
}

// --- Decision --------------------------------------------------------------

export type RejectedAlternative = { offerId: string; reason: string }

export type OfferDecision = {
  decision: 'select' | 'sequence' | 'reject'
  selectedOfferIds: string[]
  /** Sum of the selected offers' prices, in base units, as a decimal string. */
  estimatedOfferCostBaseUnits: string
  reasons: string[]
  constraintsChecked: string[]
  rejectedAlternatives: RejectedAlternative[]
  warnings: string[]
}

const COMPRESSION_ID = 'context-compression'
const DEEP_ID = 'deep-context-evaluation'

/** Published request limits that the catalog does not carry as fields. */
export const DEEP_CONTEXT_DOCUMENT_LIMIT = 8
export const DEEP_CONTEXT_EVIDENCE_SPAN_LIMIT = 32

function reject(
  reasons: string[],
  constraintsChecked: string[],
  rejectedAlternatives: RejectedAlternative[] = [],
  warnings: string[] = [],
): OfferDecision {
  return {
    decision: 'reject',
    selectedOfferIds: [],
    estimatedOfferCostBaseUnits: '0',
    reasons,
    constraintsChecked,
    rejectedAlternatives,
    warnings,
  }
}

function totalBaseUnits(offers: X402Offer[]): string {
  return offers.reduce((sum, offer) => sum + BigInt(offer.amount), BigInt(0)).toString()
}

/**
 * Deterministic, model-free offer selection.
 *
 * Fails closed on every axis it can: an unrecognised network or asset, a
 * ceiling it cannot parse as an integer, an offer that is not payable, or a
 * capability this platform does not provide. When the affordable offer is not
 * the one that does the job, it rejects rather than substituting -- a buyer
 * that asked to measure retention and silently received a compression pack has
 * been sold the wrong product and has no way to notice.
 */
export function selectMahaOffer(
  input: OfferSelectionInput,
  catalog: readonly X402Offer[] = payableOffers(),
): OfferDecision {
  const constraintsChecked: string[] = []
  const warnings: string[] = []

  const available = (id: string): X402Offer | undefined =>
    catalog.find((offer) => offer.id === id && offer.status === 'available')

  // --- Settlement compatibility, before anything about capability ---------
  if (input.network !== undefined) {
    constraintsChecked.push('network')
    if (!SUPPORTED_NETWORKS.includes(input.network as typeof SUPPORTED_NETWORKS[number])) {
      return reject(
        [`Network ${input.network} is not supported. These offers settle only on ${BASE_MAINNET_CAIP2}.`],
        constraintsChecked,
      )
    }
  }
  if (input.asset !== undefined) {
    constraintsChecked.push('asset')
    const asset = input.asset.toLowerCase()
    if (!SUPPORTED_ASSETS.some((supported) => supported.toLowerCase() === asset)) {
      return reject(
        [`Asset ${input.asset} is not supported. These offers settle only in Base USDC (${BASE_USDC}).`],
        constraintsChecked,
      )
    }
  }

  let ceiling: bigint | null = null
  if (input.maximumPriceUsdc !== undefined) {
    constraintsChecked.push('maximumPriceUsdc')
    // Rejected rather than coerced. A ceiling that does not parse is not a
    // permissive ceiling.
    if (!/^\d+$/.test(input.maximumPriceUsdc)) {
      return reject(
        ['maximumPriceUsdc must be a decimal integer string of USDC base units; $0.005 is "5000".'],
        constraintsChecked,
      )
    }
    ceiling = BigInt(input.maximumPriceUsdc)
  }

  // --- Capabilities this platform does not have ---------------------------
  constraintsChecked.push('capability')
  if (input.objective === 'summarize') {
    return reject(
      ['Both offers are extractive: they select and rank existing passages. Neither produces an abstractive summary or rewrites text.'],
      constraintsChecked,
    )
  }
  if (input.objective === 'verify-facts') {
    return reject(
      ['Neither offer verifies claims, checks facts, or prevents hallucination. Deep Context Evaluation measures whether a caller-labelled span survived selection, which is not a statement about whether the span is true.'],
      constraintsChecked,
    )
  }
  if (input.requiresGuaranteedCompleteness === true) {
    return reject(
      ['Neither offer guarantees semantic completeness. Both are budget-bound: passages that do not fit the token budget are dropped and reported.'],
      constraintsChecked,
    )
  }
  if (input.inputEncoding === 'binary') {
    return reject(
      ['Both offers accept UTF-8 text. Binary payloads (PDF, images, archives) are not a supported input and must be extracted to text first.'],
      constraintsChecked,
    )
  }

  // --- Which offer does the job -------------------------------------------
  const wantsMeasurement = input.objective === 'evaluate-context-quality'
    || input.needsRetentionMeasurement === true
    || input.needsSourceCoverageMeasurement === true
    || input.needsQualityEvaluation === true

  const wantsSequence = input.objective === 'compile-and-evaluate'

  const targetIds = wantsSequence
    ? [COMPRESSION_ID, DEEP_ID]
    : wantsMeasurement
      ? [DEEP_ID]
      : [COMPRESSION_ID]

  // --- Availability --------------------------------------------------------
  constraintsChecked.push('availability')
  const selected: X402Offer[] = []
  for (const id of targetIds) {
    const offer = available(id)
    if (!offer) {
      // The supplied catalog first, then the global one. An injected catalog is
      // how a caller asks "what would this decide against those terms", and
      // answering with the *live* offer's blockers would describe a different
      // world than the one it asked about.
      const known = catalog.find((candidate) => candidate.id === id) ?? offerById(id)
      return reject(
        [known
          ? `${id} is not payable today (status: ${known.status}).`
          : `${id} is not a published offer.`],
        constraintsChecked,
        [],
        known ? [...known.availability.blockedBy] : [],
      )
    }
    selected.push(offer)
  }

  // --- Published request limits -------------------------------------------
  constraintsChecked.push('requestLimits')
  const largest = selected.reduce((max, offer) => Math.max(max, offer.maxRequestBytes), 0)
  if (input.estimatedInputBytes !== undefined && input.estimatedInputBytes > largest) {
    return reject(
      [`An estimated ${input.estimatedInputBytes} bytes exceeds the largest published request limit (${largest} bytes). Split the payload across calls.`],
      constraintsChecked,
    )
  }
  if (
    input.documentCount !== undefined
    && selected.some((offer) => offer.id === DEEP_ID)
    && input.documentCount > DEEP_CONTEXT_DOCUMENT_LIMIT
  ) {
    return reject(
      [`Deep Context Evaluation accepts ${DEEP_CONTEXT_DOCUMENT_LIMIT} documents per call; ${input.documentCount} were declared.`],
      constraintsChecked,
      [{
        offerId: COMPRESSION_ID,
        reason: 'Context Compression accepts more documents, but it does not measure retention, so it is not a substitute for this request.',
      }],
    )
  }

  // --- Budget --------------------------------------------------------------
  const cost = BigInt(totalBaseUnits(selected))
  if (ceiling !== null && cost > ceiling) {
    const priced = selected.map((offer) => `${offer.id} (${offer.amount})`).join(' + ')
    return reject(
      [`The offer that does this job costs ${cost} base units (${priced}), above the declared ceiling of ${ceiling}.`],
      constraintsChecked,
      selected.map((offer) => ({
        offerId: offer.id,
        reason: `Priced at ${offer.amount} base units (${offerPriceUsd(offer)}).`,
      })),
      // The load-bearing warning. A buyer that asked to measure retention and
      // received a compression pack instead has been sold a different product.
      wantsMeasurement || wantsSequence
        ? ['No cheaper substitute is offered: Context Compression does not measure retention, so selecting it here would answer a different question than the one asked.']
        : [],
    )
  }

  if (input.latencyPreference === 'low' && selected.some((offer) => offer.id === DEEP_ID)) {
    warnings.push('Deep Context Evaluation compiles and then measures, so it is the slower of the two offers.')
  }
  if (input.needsCitationTraceability === true || input.needsDeduplication === true) {
    warnings.push('Source-linked provenance and deduplication are provided by both offers; they are not a reason to choose the dearer one.')
  }

  const reasons = wantsSequence
    ? [
        'Context Compression compiles the pack at the lower price.',
        'Deep Context Evaluation then measures retention of the caller-labelled spans.',
        `Total ${cost} base units.`,
      ]
    : wantsMeasurement
      ? ['Deep Context Evaluation is the only offer that measures required-fact retention, source coverage and citation traceability.']
      : ['Context Compression provides token-budgeted, deduplicated, source-linked passage selection without an independent evaluation step.']

  const rejectedAlternatives: RejectedAlternative[] = []
  for (const offer of catalog) {
    if (selected.some((chosen) => chosen.id === offer.id)) continue
    rejectedAlternatives.push({
      offerId: offer.id,
      reason: offer.id === DEEP_ID
        ? 'No measurement of retention or source coverage was requested, so its evaluation step would be paid for and unused.'
        : 'Compilation alone does not answer the measurement question that was asked.',
    })
  }

  return {
    decision: wantsSequence ? 'sequence' : 'select',
    selectedOfferIds: selected.map((offer) => offer.id),
    estimatedOfferCostBaseUnits: cost.toString(),
    reasons,
    constraintsChecked,
    rejectedAlternatives,
    warnings,
  }
}

// --- The published document ------------------------------------------------

const OFFER_LINKS: Record<string, Record<string, string>> = {
  [COMPRESSION_ID]: {
    openapi: `${SITE_ORIGIN}/api/docs/openapi`,
    declaration: `${SITE_ORIGIN}/api/discovery/x402-offers/${COMPRESSION_ID}`,
    executableRecipe: `${SITE_ORIGIN}/recipes/bazaar-discovery-to-payment`,
    largeDocumentRecipe: `${SITE_ORIGIN}/recipes/context-compiler-large-document`,
    benchmark: `${SITE_ORIGIN}/benchmarks/context-retention`,
    humanDocumentation: `${SITE_ORIGIN}/context-compiler`,
  },
  [DEEP_ID]: {
    openapi: `${SITE_ORIGIN}/api/docs/openapi`,
    declaration: `${SITE_ORIGIN}/api/discovery/x402-offers/${DEEP_ID}`,
    executableRecipe: `${SITE_ORIGIN}/recipes/bazaar-discovery-to-payment`,
    benchmark: `${SITE_ORIGIN}/benchmarks/context-retention`,
    humanDocumentation: `${SITE_ORIGIN}/context-pack-evaluator`,
  },
}

const OFFER_FIT: Record<string, { fit: string[]; nonFit: string[]; requiredInputFields: string[]; producedEvidence: string[] }> = {
  [COMPRESSION_ID]: {
    fit: [
      'Token-budgeted passage selection against an explicit budget.',
      'Deduplication of repeated passages across documents.',
      'Source-linked provenance for every included passage.',
      'A compiled context pack for a downstream inference call.',
      'A low-cost preprocessing step ahead of a dearer model call.',
      'No independent evaluation of an already compiled output is needed.',
    ],
    nonFit: [
      'You need to measure whether specific facts survived compilation.',
      'You need source-coverage or retention percentages for a release decision.',
    ],
    requiredInputFields: ['task', 'tokenBudget', 'documents'],
    producedEvidence: [
      'context pack with included passages and per-source provenance',
      'originalEstimatedTokens, compiledEstimatedTokens, tokensSaved',
      'estimatedReductionPercent, sourceCoveragePercent, duplicatePassagesRemoved',
      'inputHash and outputHash',
    ],
  },
  [DEEP_ID]: {
    fit: [
      'Measuring required-fact retention against caller-labelled evidence spans.',
      'Measuring source coverage across the supplied documents.',
      'Checking citation traceability from pack back to source.',
      'Deciding whether a compiled context preserved important evidence.',
      'Comparing candidate context-pack quality between configurations.',
      'Producing an evaluation result for a release or routing decision.',
    ],
    nonFit: [
      'You only need a compiled pack and will not read the measurements.',
      'You expect a judgement about whether the evidence is true, rather than whether it survived selection.',
    ],
    requiredInputFields: ['clientRequestId', 'task', 'tokenBudget', 'documents', 'requiredEvidence'],
    producedEvidence: [
      'everything Context Compression returns, plus:',
      'per-span retention results for 1-32 caller-labelled evidence spans',
      'requiredEvidenceRetentionPercent',
      'retentionBoundaries and warningCodes',
    ],
  },
}

function offerEntry(offer: X402Offer): Record<string, unknown> {
  const fit = OFFER_FIT[offer.id]
  return {
    offerId: offer.id,
    name: offer.serviceName === 'Maha Context Compiler' && offer.id === DEEP_ID
      ? 'Deep Context Evaluation'
      : offer.id === COMPRESSION_ID ? 'Context Compression' : offer.serviceName,
    resource: `${SITE_ORIGIN}${offer.path}`,
    method: offer.method,
    price: {
      // Base units are authoritative; the display string exists for logs and
      // human review and must never be parsed for an authorization.
      baseUnits: offer.amount,
      decimalDisplay: offerPriceUsd(offer),
      assetDecimals: USDC_DECIMALS,
      note: 'baseUnits is authoritative. decimalDisplay is for humans and must not be parsed for authorization.',
    },
    network: BASE_MAINNET_CAIP2,
    asset: BASE_USDC,
    payTo: MAHA_PAYEE,
    status: offer.status,
    availability: {
      payableInProduction: offer.availability.payableInProduction,
      blockedBy: [...offer.availability.blockedBy],
    },
    requestLimits: {
      maxRequestBytes: offer.maxRequestBytes,
      concurrencyCap: offer.concurrencyCap,
      ...(offer.id === DEEP_ID
        ? { maxDocuments: DEEP_CONTEXT_DOCUMENT_LIMIT, maxRequiredEvidenceSpans: DEEP_CONTEXT_EVIDENCE_SPAN_LIMIT }
        : {}),
    },
    requiresIdempotency: offer.requiresIdempotency,
    requiredInputFields: fit?.requiredInputFields ?? [],
    producedEvidence: fit?.producedEvidence ?? [],
    fitConditions: fit?.fit ?? [],
    nonFitConditions: fit?.nonFit ?? [],
    capabilityBoundaries: [...offer.capabilityBoundaries],
    retention: {
      fullSourceTextStored: offer.retention.fullSourceTextStored,
      verbatimExcerptsRetained: offer.retention.verbatimExcerptsRetained,
      retainedFields: [...offer.retention.retainedFields],
      note: offer.retention.note,
    },
    flow: offer.id === COMPRESSION_ID
      ? { successor: DEEP_ID, successorOptional: true, predecessor: null }
      : { successor: null, predecessor: COMPRESSION_ID, predecessorOptional: true },
    links: OFFER_LINKS[offer.id] ?? {},
  }
}

/** The five deterministic examples, each replayed against the selector in tests. */
export const OFFER_SELECTION_EXAMPLES: ReadonlyArray<{
  name: string
  input: OfferSelectionInput
  expected: { decision: OfferDecision['decision']; selectedOfferIds: string[]; estimatedOfferCostBaseUnits: string }
  note: string
}> = Object.freeze([
  {
    name: 'RAG agent, large multi-document payload, $0.005 ceiling',
    input: {
      objective: 'compile-context-pack',
      documentCount: 24,
      estimatedInputBytes: 400_000,
      requiredTokenBudget: 4_000,
      needsDeduplication: true,
      needsCitationTraceability: true,
      maximumPriceUsdc: '5000',
      network: BASE_MAINNET_CAIP2,
      asset: BASE_USDC,
    },
    expected: { decision: 'select', selectedOfferIds: [COMPRESSION_ID], estimatedOfferCostBaseUnits: '1000' },
    note: 'Compilation only, and $0.001 sits inside a $0.005 ceiling.',
  },
  {
    name: 'Release pipeline checking required-fact retention, $0.02 ceiling',
    input: {
      objective: 'evaluate-context-quality',
      documentCount: 4,
      needsRetentionMeasurement: true,
      needsSourceCoverageMeasurement: true,
      maximumPriceUsdc: '20000',
      network: BASE_MAINNET_CAIP2,
      asset: BASE_USDC,
    },
    expected: { decision: 'select', selectedOfferIds: [DEEP_ID], estimatedOfferCostBaseUnits: '10000' },
    note: 'Only Deep Context Evaluation measures retention, and $0.01 fits a $0.02 ceiling.',
  },
  {
    name: 'Summarization request, $0.005 ceiling',
    input: { objective: 'summarize', maximumPriceUsdc: '5000' },
    expected: { decision: 'reject', selectedOfferIds: [], estimatedOfferCostBaseUnits: '0' },
    note: 'Capability mismatch: both offers are extractive, never abstractive. The budget is beside the point, and a cheaper offer would still be the wrong product.',
  },
  {
    name: 'Evaluation request, $0.005 ceiling',
    input: {
      objective: 'evaluate-context-quality',
      needsRetentionMeasurement: true,
      maximumPriceUsdc: '5000',
    },
    expected: { decision: 'reject', selectedOfferIds: [], estimatedOfferCostBaseUnits: '0' },
    note: 'Budget mismatch only: Deep Context Evaluation costs 10000 base units. Context Compression is deliberately NOT substituted, because it does not measure retention.',
  },
  {
    name: 'Two-stage workflow, $0.02 total ceiling',
    input: {
      objective: 'compile-and-evaluate',
      documentCount: 6,
      needsRetentionMeasurement: true,
      maximumPriceUsdc: '20000',
      network: BASE_MAINNET_CAIP2,
      asset: BASE_USDC,
    },
    expected: { decision: 'sequence', selectedOfferIds: [COMPRESSION_ID, DEEP_ID], estimatedOfferCostBaseUnits: '11000' },
    note: '1000 + 10000 = 11000 base units ($0.011), inside a $0.02 ceiling.',
  },
])

/**
 * Builds the published document from the catalog.
 *
 * Only payable offers appear. A withheld offer is described elsewhere in
 * discovery, but a *selection* contract that named it would be telling an
 * autonomous buyer to call something that cannot be paid for.
 */
export function buildOfferSelectionDocument(
  catalog: readonly X402Offer[] = payableOffers(),
): Record<string, unknown> {
  return {
    schemaVersion: OFFER_SELECTION_SCHEMA_VERSION,
    canonicalUrl: OFFER_SELECTION_CANONICAL_URL,
    generatedFrom: 'https://www.mahastrategies.com/api/discovery/x402-offers/{offerId}',
    provider: {
      name: 'Maha Strategies LLC',
      website: SITE_ORIGIN,
    },
    advisory: 'Selection is advisory. The live PAYMENT-REQUIRED challenge is authoritative for terms, and the buyer-policy package is the signing authorization boundary.',
    settlement: {
      protocol: 'x402',
      version: 2,
      scheme: 'exact',
      supportedNetworks: [...SUPPORTED_NETWORKS],
      supportedAssets: [...SUPPORTED_ASSETS],
      payTo: MAHA_PAYEE,
      assetDecimals: USDC_DECIMALS,
      priceUnits: 'USDC base units, as decimal integer strings. Never parse decimalDisplay for an authorization.',
    },
    selectionInputs: {
      objective: {
        type: 'string',
        enum: ['compile-context-pack', 'evaluate-context-quality', 'compile-and-evaluate', 'summarize', 'verify-facts', 'other'],
        required: true,
      },
      estimatedInputBytes: { type: 'integer', required: false },
      estimatedInputTokens: { type: 'integer', required: false },
      documentCount: { type: 'integer', required: false },
      requiredTokenBudget: { type: 'integer', required: false },
      needsQualityEvaluation: { type: 'boolean', required: false },
      needsRetentionMeasurement: { type: 'boolean', required: false },
      needsSourceCoverageMeasurement: { type: 'boolean', required: false },
      needsCitationTraceability: { type: 'boolean', required: false },
      needsDeduplication: { type: 'boolean', required: false },
      latencyPreference: { type: 'string', enum: ['low', 'balanced', 'thorough'], required: false },
      maximumPriceUsdc: {
        type: 'string',
        format: 'decimal-integer-base-units',
        required: false,
        note: 'USDC base units, not dollars. $0.005 is "5000". Integer arithmetic only.',
      },
      network: { type: 'string', enum: [...SUPPORTED_NETWORKS], required: false },
      asset: { type: 'string', enum: [...SUPPORTED_ASSETS], required: false },
      inputEncoding: { type: 'string', enum: ['utf8-text', 'binary'], required: false },
      requiresGuaranteedCompleteness: { type: 'boolean', required: false },
    },
    decisionPolicy: {
      defaultOfferId: COMPRESSION_ID,
      failClosed: true,
      substitutionPolicy: 'An offer is never substituted for a different one. If the offer that answers the request is unaffordable or unavailable, the decision is reject.',
      rules: [
        {
          id: 'unsupported-network-or-asset',
          when: 'network is not in supportedNetworks, or asset is not in supportedAssets',
          then: 'reject',
          because: 'Settlement terms that do not match cannot be authorized, so proceeding would produce a signature that can never settle.',
        },
        {
          id: 'unparseable-ceiling',
          when: 'maximumPriceUsdc is not a decimal integer string',
          then: 'reject',
          because: 'A ceiling that cannot be parsed is not a permissive ceiling.',
        },
        {
          id: 'abstractive-summary',
          when: 'objective is summarize',
          then: 'reject',
          because: 'Both offers are extractive passage selectors and neither rewrites or summarizes text.',
        },
        {
          id: 'factual-verification',
          when: 'objective is verify-facts',
          then: 'reject',
          because: 'Neither offer verifies claims or prevents hallucination. Retention measures whether a span survived selection, not whether it is true.',
        },
        {
          id: 'guaranteed-completeness',
          when: 'requiresGuaranteedCompleteness is true',
          then: 'reject',
          because: 'Both offers are budget-bound; passages that exceed the token budget are dropped and reported.',
        },
        {
          id: 'binary-input',
          when: 'inputEncoding is binary',
          then: 'reject',
          because: 'Both offers accept UTF-8 text. Extract binary formats to text first.',
        },
        {
          id: 'measurement-required',
          when: 'objective is evaluate-context-quality, or any of needsRetentionMeasurement, needsSourceCoverageMeasurement, needsQualityEvaluation is true',
          then: `select ${DEEP_ID}`,
          because: 'It is the only offer that measures required-fact retention, source coverage and citation traceability.',
        },
        {
          id: 'two-stage',
          when: 'objective is compile-and-evaluate',
          then: `sequence ${COMPRESSION_ID} then ${DEEP_ID}`,
          because: 'The buyer asked for both stages explicitly. Cost is the sum of both offers.',
        },
        {
          id: 'compilation-only',
          when: 'no measurement is requested',
          then: `select ${COMPRESSION_ID}`,
          because: 'Token-budgeted, deduplicated, source-linked selection without an evaluation step is the cheaper offer and does the job.',
        },
        {
          id: 'over-ceiling',
          when: 'the selected offer or sequence costs more than maximumPriceUsdc',
          then: 'reject',
          because: 'Substituting a cheaper offer would answer a different question than the one asked.',
        },
        {
          id: 'exceeds-published-limits',
          when: 'estimatedInputBytes exceeds maxRequestBytes, or documentCount exceeds maxDocuments for the selected offer',
          then: 'reject',
          because: 'The request would be refused by the endpoint after payment.',
        },
        {
          id: 'offer-unavailable',
          when: 'the offer that answers the request is not status available',
          then: 'reject',
          because: 'An offer that is not payable cannot be called, and naming it would invite a signature against a resource that will not serve.',
        },
      ],
    },
    flow: {
      description: 'Context Compression → optionally Deep Context Evaluation → downstream LLM or model call.',
      stages: [
        { offerId: COMPRESSION_ID, optional: false, note: 'Produces the compiled context pack.' },
        { offerId: DEEP_ID, optional: true, note: 'Measures retention of caller-labelled spans. Not required for every compression call, and it compiles the pack itself when called alone.' },
        { offerId: null, optional: false, note: 'The buyer\'s own downstream inference call. Not a Maha offer.' },
      ],
    },
    offers: catalog.filter((offer) => offer.status === 'available').map(offerEntry),
    nonFitConditions: [
      'You need an abstractive summary rather than extractive passage selection.',
      'You expect factual verification, claim checking, or hallucination prevention.',
      'The workload exceeds the published request limits for the offer that fits.',
      'The required network, asset, or maximum price is incompatible with the published settlement terms.',
      'The offer that answers your request is not currently available.',
      'You require guaranteed semantic completeness rather than budget-bound selection.',
      'The request carries binary input rather than UTF-8 text.',
    ],
    examples: OFFER_SELECTION_EXAMPLES.map((example) => ({
      name: example.name,
      note: example.note,
      input: example.input,
      decision: example.expected,
    })),
  }
}
