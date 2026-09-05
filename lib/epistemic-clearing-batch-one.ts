import artifact from '../content/scaling/epistemic-clearing-batch-1.json' with { type: 'json' }
import batchTwoArtifact from '../content/scaling/epistemic-clearing-batch-2.json' with { type: 'json' }
import batchThreeArtifact from '../content/scaling/epistemic-clearing-batch-3.json' with { type: 'json' }
import batchFourArtifact from '../content/scaling/epistemic-clearing-batch-4.json' with { type: 'json' }
import batchFiveArtifact from '../content/scaling/epistemic-clearing-batch-5.json' with { type: 'json' }
import batchSixArtifact from '../content/scaling/epistemic-clearing-batch-6.json' with { type: 'json' }

export type ClearingGuideLane = 'machine-integrations' | 'tamil-religion' | 'astrology-infrastructure' | 'evidence-clearing' | 'mathematics-astronomy' | 'cross-domain-synthesis'
export type ClearingGuideLink = {
  title: string
  path: string
  role: 'operational-source' | 'inspected-source-projection' | 'conceptual-lens' | 'related-guide'
}
export type ClearingGuideQuestion = { question: string; answer: string }
export type ClearingGuide = {
  schemaVersion: 'maha-epistemic-clearing-guide/1.0'
  preparedOn: string
  candidateId: string
  candidateRank: number
  lane: ClearingGuideLane
  path: string
  searchIntent: string
  publicationState: 'prepared-not-deployed'
  canonicalRecordRequired: false
  releaseBoundary: string
  contentMode?: 'bounded-method-guide'
  resultStatus?: 'no-subject-specific-result-claimed'
  family: string
  title: string
  summary: string
  question: string
  directAnswer: string
  evidenceFrame: string
  methodBoundary?: string
  sourceLinks: ClearingGuideLink[]
  requiredInputs: string[]
  orderedSteps: string[]
  expectedOutputs: string[]
  refusalConditions: string[]
  limitations: string[]
  decisionRecord?: {
    subject: string
    question: string
    minimumEvidence: string
    orderedDecision: string
    passCondition: string
    refusalCondition: string
    resultStatus: string
  }
  questions: ClearingGuideQuestion[]
  commercialAction: { label: string; path: string; state: string }
  sourceBoundaryInspection?: {
    sourceId: string
    sourceUrl: string
    sourceFileSha256: `sha256:${string}`
    locator: string
    inspectionDepth: 'edition-structure-and-unit-boundary'
    interpretationInspected: false
    sourceAnomaly: string | null
    inspectionEntryDigest: `sha256:${string}`
  }
  provenanceDigest: `sha256:${string}`
}

export type ClearingBatch = {
  schemaVersion: 'maha-epistemic-clearing-batch/1.0'
  preparedOn: string
  objective: string
  deploymentGate: { state: 'build-withheld'; minimumPreparedSitePages: number; instruction: string }
  counts: {
    total: number
    bookConceptMachineApplications: number
    tamilReligion: number
    astrologyInfrastructure: number
    evidenceClearing: number
    boundedQuestions: number
  }
  publicationBoundary: string
  pages: ClearingGuide[]
  provenanceDigest: `sha256:${string}`
}

export const EPISTEMIC_CLEARING_BATCH_ONE = artifact as ClearingBatch
export const EPISTEMIC_CLEARING_BATCH_ONE_PAGES = EPISTEMIC_CLEARING_BATCH_ONE.pages
export const EPISTEMIC_CLEARING_BATCH_TWO = batchTwoArtifact as unknown as {
  schemaVersion: 'maha-epistemic-clearing-batch/1.0'
  preparedOn: string
  objective: string
  deploymentGate: {
    state: 'build-withheld'
    lastOperatorAuthorizedStaticPageCount: number
    priorPreparedRoutes: number
    thisBatchRoutes: number
    projectedPreparedSitePages: number
    exactBuildCountMeasured: false
    instruction: string
  }
  counts: {
    total: number
    boundedQuestions: number
    byLane: Record<ClearingGuideLane, number>
    bookConceptPriority: number
  }
  publicationBoundary: string
  pages: ClearingGuide[]
  provenanceDigest: `sha256:${string}`
}
export const EPISTEMIC_CLEARING_BATCH_TWO_PAGES = EPISTEMIC_CLEARING_BATCH_TWO.pages

type SubsequentClearingBatch = {
  schemaVersion: 'maha-epistemic-clearing-batch/1.0'
  preparedOn: string
  batchNumber: 3 | 4 | 5 | 6
  objective: string
  deploymentGate: {
    state: 'build-withheld'
    lastOperatorAuthorizedStaticPageCount: number
    priorPreparedRoutes: number
    thisBatchRoutes: number
    cumulativePreparedRoutes: number
    projectedPreparedSitePages: number
    exactBuildCountMeasured: false
    instruction: string
  }
  counts: {
    total: number
    boundedQuestions: number
    byLane: Partial<Record<ClearingGuideLane, number>>
    sourceBoundaryInspected: number
    subjectSpecificResultsClaimed: number
  }
  publicationBoundary: string
  pages: ClearingGuide[]
  provenanceDigest: `sha256:${string}`
}

export const EPISTEMIC_CLEARING_BATCH_THREE = batchThreeArtifact as unknown as SubsequentClearingBatch
export const EPISTEMIC_CLEARING_BATCH_FOUR = batchFourArtifact as unknown as SubsequentClearingBatch
export const EPISTEMIC_CLEARING_BATCH_FIVE = batchFiveArtifact as unknown as SubsequentClearingBatch
export const EPISTEMIC_CLEARING_BATCH_SIX = batchSixArtifact as unknown as SubsequentClearingBatch
export const EPISTEMIC_CLEARING_BATCH_THREE_PAGES = EPISTEMIC_CLEARING_BATCH_THREE.pages
export const EPISTEMIC_CLEARING_BATCH_FOUR_PAGES = EPISTEMIC_CLEARING_BATCH_FOUR.pages
export const EPISTEMIC_CLEARING_BATCH_FIVE_PAGES = EPISTEMIC_CLEARING_BATCH_FIVE.pages
export const EPISTEMIC_CLEARING_BATCH_SIX_PAGES = EPISTEMIC_CLEARING_BATCH_SIX.pages

if (EPISTEMIC_CLEARING_BATCH_ONE.counts.total !== 100 || EPISTEMIC_CLEARING_BATCH_ONE_PAGES.length !== 100) {
  throw new Error('Epistemic clearing Batch 1 must contain exactly 100 prepared routes.')
}
if (new Set(EPISTEMIC_CLEARING_BATCH_ONE_PAGES.map((page) => page.path)).size !== 100) {
  throw new Error('Epistemic clearing Batch 1 contains duplicate paths.')
}
if (EPISTEMIC_CLEARING_BATCH_TWO.counts.total !== 407 || EPISTEMIC_CLEARING_BATCH_TWO_PAGES.length !== 407) {
  throw new Error('Epistemic clearing Batch 2 must contain exactly 407 prepared routes.')
}
if (new Set(EPISTEMIC_CLEARING_BATCH_TWO_PAGES.map((page) => page.path)).size !== 407) {
  throw new Error('Epistemic clearing Batch 2 contains duplicate paths.')
}

for (const [batch, expected] of [
  [EPISTEMIC_CLEARING_BATCH_THREE, 140],
  [EPISTEMIC_CLEARING_BATCH_FOUR, 200],
  [EPISTEMIC_CLEARING_BATCH_FIVE, 90],
  [EPISTEMIC_CLEARING_BATCH_SIX, 63],
] as const) {
  if (batch.counts.total !== expected || batch.pages.length !== expected) {
    throw new Error(`Epistemic clearing Batch ${batch.batchNumber} must contain exactly ${expected} prepared routes.`)
  }
  if (new Set(batch.pages.map((page) => page.path)).size !== expected) {
    throw new Error(`Epistemic clearing Batch ${batch.batchNumber} contains duplicate paths.`)
  }
}

export const EPISTEMIC_CLEARING_PAGES: readonly ClearingGuide[] = [
  ...EPISTEMIC_CLEARING_BATCH_ONE_PAGES,
  ...EPISTEMIC_CLEARING_BATCH_TWO_PAGES,
  ...EPISTEMIC_CLEARING_BATCH_THREE_PAGES,
  ...EPISTEMIC_CLEARING_BATCH_FOUR_PAGES,
  ...EPISTEMIC_CLEARING_BATCH_FIVE_PAGES,
  ...EPISTEMIC_CLEARING_BATCH_SIX_PAGES,
]
if (EPISTEMIC_CLEARING_PAGES.length !== 1_000) {
  throw new Error(`Epistemic clearing batches must contain exactly 1,000 prepared routes; received ${EPISTEMIC_CLEARING_PAGES.length}.`)
}
// Checks the property the error describes, rather than a pinned total. The
// previous form compared the count to 507, so a legitimate 508th page failed
// with a message about an overlapping path that did not exist.
const clearingPathCounts = new Map<string, number>()
for (const page of EPISTEMIC_CLEARING_PAGES) {
  clearingPathCounts.set(page.path, (clearingPathCounts.get(page.path) ?? 0) + 1)
}
const overlappingClearingPaths = [...clearingPathCounts].filter(([, n]) => n > 1).map(([path]) => path)
if (overlappingClearingPaths.length > 0) {
  throw new Error(`Epistemic clearing batches contain an overlapping path: ${overlappingClearingPaths.join(', ')}`)
}

export const clearingGuidesForLane = (lane: ClearingGuideLane): readonly ClearingGuide[] =>
  EPISTEMIC_CLEARING_PAGES.filter((page) => page.lane === lane)

export const getClearingGuide = (path: string): ClearingGuide | undefined =>
  EPISTEMIC_CLEARING_PAGES.find((page) => page.path === path)
