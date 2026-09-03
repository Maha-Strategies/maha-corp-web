import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'

/**
 * How substantial a page actually is, as distinct from how it is classified.
 *
 * Eight batches have tracked whether a page has an inspected source. That says
 * nothing about whether the page explains anything: a page can be
 * independently supported by one passage supporting one sentence, and be
 * thinner than a structural page carrying six sections of its family's own
 * material.
 *
 * This measures the two separately, so neither can stand in for the other.
 */

export const DEPTH_STATES = [
  'substantial-and-evidence-backed',
  'evidence-backed-but-thin',
  'structurally-substantial-but-unsupported',
  'structurally-thin',
  'blocked',
] as const
export type DepthState = (typeof DEPTH_STATES)[number]

export interface DepthMeasures {
  directAnswerChars: number
  hasMechanismOrDerivation: boolean
  hasTechnicalContext: boolean
  explanatoryClaims: number
  /** Claims whose support is an inspected passage, not a declared boundary. */
  claimsWithPassage: number
  exactLocators: number
  limitations: number
  unresolvedQuestions: number
  supportedComparisons: number
  reproducibleCalculations: number
  typedRelatedRecords: number
  typedBridges: number
  structuredDataFields: number
  renderedDimensions: number
  /** Diagnostic only. Never a gate. */
  wordCountDiagnostic: number
}

export interface DepthVerdict {
  route: string
  state: DepthState
  measures: DepthMeasures
  substantialityScore: number
  reasons: readonly string[]
  verdictDigest: string
}

/** What a page must carry before "substantial" is an honest word for it. */
const SUBSTANTIAL_FLOOR = {
  directAnswerChars: 120,
  explanatoryClaims: 3,
  limitations: 1,
  typedLinks: 2,
  renderedDimensions: 6,
} as const

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

/**
 * Grades one page.
 *
 * Evidence and substance are checked independently, and the four non-blocked
 * states are the four combinations. A page is only called substantial and
 * evidence-backed when both hold, which is a stricter bar than either alone.
 */
export function auditDepth(
  route: string, measures: DepthMeasures, classification: 'independent' | 'first-party' | 'structural' | 'blocked',
): DepthVerdict {
  const reasons: string[] = []

  if (classification === 'blocked') {
    return finish(route, 'blocked', measures, 0, ['page is blocked and carries no explanatory uplift'])
  }

  const substantial =
    measures.directAnswerChars >= SUBSTANTIAL_FLOOR.directAnswerChars
    && measures.hasMechanismOrDerivation
    && measures.explanatoryClaims >= SUBSTANTIAL_FLOOR.explanatoryClaims
    && measures.limitations >= SUBSTANTIAL_FLOOR.limitations
    && (measures.typedRelatedRecords + measures.typedBridges) >= SUBSTANTIAL_FLOOR.typedLinks
    && measures.renderedDimensions >= SUBSTANTIAL_FLOOR.renderedDimensions

  if (measures.directAnswerChars < SUBSTANTIAL_FLOOR.directAnswerChars) reasons.push('direct answer too short to answer anything')
  if (!measures.hasMechanismOrDerivation) reasons.push('no mechanism or derivation')
  if (measures.explanatoryClaims < SUBSTANTIAL_FLOOR.explanatoryClaims) reasons.push('fewer than three explanatory claims')
  if (measures.limitations < SUBSTANTIAL_FLOOR.limitations) reasons.push('no stated limitation')
  if ((measures.typedRelatedRecords + measures.typedBridges) < SUBSTANTIAL_FLOOR.typedLinks) reasons.push('fewer than two typed links')
  if (measures.renderedDimensions < SUBSTANTIAL_FLOOR.renderedDimensions) reasons.push('fewer than six rendered dimensions')

  // Evidence-backed means claims tied to passages, not merely a cited source.
  const evidenceBacked = classification === 'independent' && measures.claimsWithPassage > 0
  if (classification === 'independent' && measures.claimsWithPassage === 0) {
    reasons.push('classified independent but no claim maps to a passage')
  }
  if (measures.claimsWithPassage > measures.explanatoryClaims) {
    reasons.push('more passage-backed claims than explanatory claims, which cannot be right')
  }

  const state: DepthState = evidenceBacked
    ? (substantial ? 'substantial-and-evidence-backed' : 'evidence-backed-but-thin')
    : (substantial ? 'structurally-substantial-but-unsupported' : 'structurally-thin')

  // A score for ranking only. It never decides the state.
  const score = Number((
    Math.min(measures.directAnswerChars / 120, 2) * 1.0
    + (measures.hasMechanismOrDerivation ? 2 : 0)
    + Math.min(measures.explanatoryClaims, 8) * 0.5
    + measures.claimsWithPassage * 1.5
    + Math.min(measures.exactLocators, 6) * 0.5
    + measures.limitations * 0.4
    + measures.supportedComparisons * 0.8
    + measures.reproducibleCalculations * 1.2
    + Math.min(measures.typedRelatedRecords + measures.typedBridges, 8) * 0.3
    + Math.min(measures.renderedDimensions, 12) * 0.2
  ).toFixed(2))

  return finish(route, state, measures, score, reasons)
}

function finish(
  route: string, state: DepthState, measures: DepthMeasures, substantialityScore: number, reasons: string[],
): DepthVerdict {
  const body = { route, state, measures, substantialityScore, reasons }
  return { ...body, verdictDigest: sha(body) }
}

/** Length alone must never move a page's state. */
export function assertWordCountIsNotAGate(before: DepthVerdict, padded: DepthVerdict): void {
  if (before.state !== padded.state) {
    throw new Error('word count changed the depth state, which it must never do')
  }
}
