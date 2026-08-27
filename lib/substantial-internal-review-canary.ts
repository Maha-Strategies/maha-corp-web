import { createHash } from 'node:crypto'

import { EXPERT_REVIEW_CRITERIA, type ExpertReviewInput } from './epistemic-review.ts'
import type { ExpertReviewScope } from './epistemic-schema.ts'
import {
  BATCH_2_INTERNAL_REVIEW_CANARY_IDS,
  BATCH_2_INTERNAL_REVIEW_PACKETS,
  type InternalReviewPacket,
} from './substantial-internal-review-batch-2.ts'

export const INTERNAL_REVIEW_CANARY_VERSION = 'maha-internal-review-canary/1.0' as const

interface RecordSpecificFinding {
  recordId: string
  scopes: Record<ExpertReviewScope, string>
}

/**
 * Five record-specific reviews performed from the inspected evidence recorded
 * in the alignment ledger and reproduced in each packet. These are deliberately
 * written one record at a time. No fallback or generated approval exists: a
 * sixth record cannot enter the canary without a new finding in this table.
 */
const FINDINGS: readonly RecordSpecificFinding[] = [
  {
    recordId: 'urn:maha:record:advanced-materials-hexagonal-boron-nitride-dielectrics',
    scopes: {
      'source-fidelity': 'Dean et al. directly reports graphene devices fabricated on single-crystal hBN substrates. The repaired claim stays at that substrate-supported mechanism and expressly withholds dielectric constant, breakdown field, and wafer-scale conclusions.',
      'domain-fidelity': 'The record uses hBN as an advanced-material substrate/dielectric mechanism and does not transfer graphene transport results into a general hBN materials-performance claim.',
      'boundary-adequacy': 'The record discloses single-study maturity, no compiled independent replication, and prohibits system performance, safety, manufacturability, scalability, economics, clinical benefit, and readiness inferences.',
      'rights-and-locator': 'The reviewed source is DOI 10.1038/nnano.2010.172 at the abstract. The record retains original paraphrase only under citation-with-paraphrase and reproduces no passage, figure, or table.',
    },
  },
  {
    recordId: 'urn:maha:record:agentic-systems-mcp-context-window-position-effects',
    scopes: {
      'source-fidelity': 'Lost in the Middle directly measures answer accuracy as relevant information moves through long contexts in multi-document QA and key-value retrieval. The record does not extend that result to every model, task, or context length.',
      'domain-fidelity': 'The record treats positional degradation as an agent/context-system constraint, retaining the paper’s task and model dependence rather than presenting it as a universal law of MCP systems.',
      'boundary-adequacy': 'The limitations distinguish measured retrieval and QA behavior from general reasoning quality, production reliability, commercial readiness, or a guarantee that any placement strategy succeeds.',
      'rights-and-locator': 'The inspected artifact is identified as arXiv:2307.03172 with the abstract, multi-document QA, key-value retrieval, and position-effect results named as the locator; only original paraphrase is retained.',
    },
  },
  {
    recordId: 'urn:maha:record:biomolecular-engineering-cell-free-transcription-translation',
    scopes: {
      'source-fidelity': 'Lu’s open-access review directly covers cell-free protein synthesis plus protein, metabolic, and artificial-cell engineering. The record limits itself to engineering outside living cells and does not convert a review into a new experimental result.',
      'domain-fidelity': 'The terminology and mechanism stay within cell-free transcription/translation and synthetic-biology platforms; no in-vivo efficacy, clinical transfer, or organism-level behavior is inferred.',
      'boundary-adequacy': 'The record preserves single-source maturity, absent pooled intervals and absent independent reproduction, while prohibiting safety, scale, manufacturability, economics, and clinical-benefit conclusions.',
      'rights-and-locator': 'The source is DOI 10.1016/j.synbio.2017.02.003 at the open-access abstract and protein-, metabolic-, and artificial-cell-engineering sections. Citation and paraphrase are retained without copied source text or figures.',
    },
  },
  {
    recordId: 'urn:maha:record:fusion-plasma-systems-disruption-mitigation',
    scopes: {
      'source-fidelity': 'The ITER publisher page describes disruptions as plasma instabilities that can degrade or lose magnetic confinement and describes the mitigation system, including shattered-pellet injection. The record stays within that system overview.',
      'domain-fidelity': 'The record correctly treats disruption mitigation as a fusion-plasma operational mechanism and does not infer plant availability, complete protection, regulatory safety, or commercial viability.',
      'boundary-adequacy': 'The boundary language prevents a mitigation-system description from becoming a claim of guaranteed disruption prevention, component survivability, economic performance, or deployment readiness.',
      'rights-and-locator': 'The authoritative ITER living page is located at its system-overview and shattered-pellet-injection sections. The record links and paraphrases the page without reproducing protected passages, diagrams, or tables.',
    },
  },
  {
    recordId: 'urn:maha:record:mechanistic-interpretability-causal-scrubbing',
    scopes: {
      'source-fidelity': 'The Causal Scrubbing article defines a mechanically derived test of an interpretability hypothesis using correspondences and resampling interventions. The record does not claim that passing such a test proves the hypothesis uniquely true.',
      'domain-fidelity': 'The method remains an interpretability-hypothesis test with declared interventions and examples; it is not transferred into a general causal-identification or model-safety guarantee.',
      'boundary-adequacy': 'The record carries the article’s method limitations and prohibits conclusions about complete model understanding, safety, robustness, deployment fitness, or exclusive causal explanation.',
      'rights-and-locator': 'The author publication page and linked article were inspected at the method definition, correspondence, resampling intervention, examples, and limitations. Only source-linked original paraphrase is retained.',
    },
  },
] as const

const ALL_DOMAINS = [...new Set(BATCH_2_INTERNAL_REVIEW_PACKETS.map((packet) => packet.domainSlug))].sort()

function idempotencyKey(recordId: string, targetSha256: string, scope: string): string {
  return `batch2-internal-canary:${createHash('sha256').update(`${recordId}|${targetSha256}|${scope}|${INTERNAL_REVIEW_CANARY_VERSION}`).digest('hex')}`
}

function criterionRationale(packet: InternalReviewPacket, scope: ExpertReviewScope, criterionId: string, finding: string): string {
  const source = packet.sources.map((entry) => `${entry.sourceId} at ${entry.exactLocator}`).join('; ')
  const claim = packet.claims.map((entry) => entry.claimId).join(', ')
  const emphasis: Record<string, string> = {
    'claim-source-alignment': `Claim ${claim} binds only ${source}.`,
    'source-context': `Source identity, artifact context, and locator remain visible: ${source}.`,
    'transcription-and-paraphrase': 'No quotation is retained; the claim, establishes statement, and source boundary constrain the paraphrase.',
    terminology: `The terminology is limited to ${packet.title} in ${packet.domainSlug}.`,
    'mechanism-and-method': `The mechanism is bounded by ${packet.claims.map((entry) => entry.scope).join(' | ')}.`,
    'scope-transfer': `The explicit claim boundary is ${packet.claims.map((entry) => entry.boundary).join(' | ')}.`,
    'uncertainty-and-replication': `${packet.claims.map((entry) => `${entry.uncertainty} ${entry.replication}`).join(' | ')}`,
    'non-claims': `The record boundaries are ${packet.boundaries.join(' | ')}.`,
    'high-stakes-use': `The prohibited inferences are ${packet.prohibitedInferences.join(' | ')}.`,
    locator: `The exact reviewed location is ${source}.`,
    'rights-basis': `The retained rights basis is ${packet.sources.map((entry) => `${entry.sourceId}: ${entry.rightsBasis}`).join('; ')}.`,
    'identifier-and-version': `The decision binds exact target ${packet.targetSha256} and sources ${packet.sources.map((entry) => entry.url).join('; ')}.`,
  }
  return `${finding} ${emphasis[criterionId]}`
}

export function canaryInternalReviewInputs(): readonly ExpertReviewInput[] {
  return FINDINGS.flatMap((finding) => {
    const packet = BATCH_2_INTERNAL_REVIEW_PACKETS.find((entry) => entry.recordId === finding.recordId)
    if (!packet || !BATCH_2_INTERNAL_REVIEW_CANARY_IDS.includes(packet.recordId as typeof BATCH_2_INTERNAL_REVIEW_CANARY_IDS[number])) {
      throw new Error(`${finding.recordId}: canary finding does not resolve to the frozen canary cohort.`)
    }
    return (Object.keys(EXPERT_REVIEW_CRITERIA) as ExpertReviewScope[]).map((scope) => ({
      recordId: packet.recordId,
      domainSlug: packet.domainSlug,
      targetSha256: packet.targetSha256,
      scope,
      reviewer: {
        reviewerId: 'expert_maha-internal-editorial-v2',
        profileVersion: 2,
        displayName: 'Maha Internal Editorial Protocol',
        qualifications: ['AI-assisted internal source, scope, boundary, rights, and locator review. This is an organizational editorial method, not an external subject-matter credential.'],
        affiliation: 'Maha Strategies',
        identityUrl: 'https://www.mahastrategies.com/knowledge/epistemic-system',
        domains: ALL_DOMAINS,
        conflicts: [packet.publisherConflict],
        reviewerKind: 'internal-editorial' as const,
        reviewMethod: 'Record-specific exact-revision review against the inspected source location, bounded claim, non-claims, rights basis, and source identity. No external reviewer participated.',
      },
      criteria: EXPERT_REVIEW_CRITERIA[scope].map((criterion) => ({
        criterionId: criterion.id,
        verdict: 'satisfied' as const,
        rationale: criterionRationale(packet, scope, criterion.id, finding.scopes[scope]),
      })),
      disagreements: [packet.publisherConflict],
      rationale: `${finding.scopes[scope]} This approval is limited to ${scope}, record ${packet.recordId}, and exact target ${packet.targetSha256}; it is internal editorial review rather than external expert endorsement.`,
      supersedesReviewId: null,
      idempotencyKey: idempotencyKey(packet.recordId, packet.targetSha256, scope),
    }))
  })
}

export const INTERNAL_REVIEW_CANARY_SUMMARY = {
  schemaVersion: INTERNAL_REVIEW_CANARY_VERSION,
  records: FINDINGS.map((entry) => entry.recordId),
  decisions: canaryInternalReviewInputs(),
  counts: { records: FINDINGS.length, scopedDecisions: FINDINGS.length * 4, criterionDecisions: FINDINGS.length * 12 },
  boundary: 'These are record-specific AI-assisted internal editorial decisions. The publisher conflict is disclosed on every decision. They do not constitute external expert review, peer review, consensus, scientific validation, or independent reproduction.',
} as const

