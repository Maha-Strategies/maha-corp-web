/**
 * Shared claim-evidence primitive for every Maha knowledge layer.
 *
 * Evidence is recorded on two independent axes.
 *
 * A single axis cannot express a claim that is faithfully transcribed from a
 * source that is itself weak evidence — a supplier's own product page, say.
 * Collapsing the axes forces a choice between overstating the evidence and
 * understating the sourcing, and the difference then survives only as free-text
 * prose that no consumer can query.
 *
 * The two axes answer different questions:
 *
 *   provenance — are we representing the cited sources accurately?
 *   empirical  — what actually supports the proposition itself?
 *
 * They are genuinely independent. A rule quoted precisely from a respected
 * historical text scores well on provenance and not at all on empirical
 * support, and a layer that cannot say both things will eventually say the
 * wrong one.
 */

/** Axis 1: how faithfully a claim represents the sources it cites. */
export const CLAIM_PROVENANCE = ['restates-source', 'combines-sources', 'maha-inference'] as const
export type ClaimProvenance = typeof CLAIM_PROVENANCE[number]

/**
 * Axis 2: what supports the proposition itself, ordered strongest to weakest.
 *
 * The union spans domains deliberately: `direct-observation` and
 * `model-dependent` come from the astronomy layer, `interested-party` and
 * `bounded-inference` from the semiconductor layer. Sharing one axis is what
 * stops each new layer from inventing a private vocabulary.
 */
export const CLAIM_EMPIRICAL = [
  'direct-observation',
  'calibrated-measurement',
  'established',
  'consensus-summary',
  'method-basis',
  'model-dependent',
  'bounded-inference',
  'interested-party',
  'open-question',
] as const
export type ClaimEmpiricalStatus = typeof CLAIM_EMPIRICAL[number]

export interface ClaimEvidence {
  provenance: ClaimProvenance
  empirical: ClaimEmpiricalStatus
}

export const CLAIM_PROVENANCE_META: Record<ClaimProvenance, { label: string; description: string }> = {
  'restates-source': { label: 'Restates source', description: 'The claim asserts what a cited source directly states.' },
  'combines-sources': { label: 'Combines sources', description: 'A faithful composite of what several cited sources state.' },
  'maha-inference': { label: 'Maha inference', description: 'Maha Strategies reasoning that goes beyond what the cited sources assert.' },
}

export const CLAIM_EMPIRICAL_META: Record<ClaimEmpiricalStatus, { label: string; description: string }> = {
  'direct-observation': { label: 'Direct observation', description: 'Recorded instrument output, before model-dependent interpretation.' },
  'calibrated-measurement': { label: 'Calibrated measurement', description: 'An observable produced by a documented calibration pipeline, with stated uncertainty.' },
  established: { label: 'Established', description: 'Supported by authoritative technical documentation or peer-reviewed work.' },
  'consensus-summary': { label: 'Consensus summary', description: 'A summary of present scientific consensus rather than a single result.' },
  'method-basis': { label: 'Method basis', description: 'A framework or model that is valid as method, not as a prediction of outcomes.' },
  'model-dependent': { label: 'Model dependent', description: 'Holds only under an explicitly named model, its priors, and its selection function.' },
  'bounded-inference': { label: 'Bounded inference', description: 'Reasonable given the evidence, but scope-limited.' },
  'interested-party': { label: 'Interested party', description: 'Asserted by a party with a commercial stake, without independent verification.' },
  'open-question': { label: 'Open question', description: 'Contested, unresolved, or beyond what present evidence settles.' },
}

/**
 * Maps a two-axis record onto the published MPS/0.1 tag vocabulary.
 *
 * MPS/0.1 is a DOI-archived public specification, so this layer derives its
 * tags rather than redefining them. The mapping is deliberately lossy: MPS/0.1
 * is itself single-axis, which is why a well-sourced but empirically
 * unsupported claim collapses onto BOUNDARY here. That loss is the concrete
 * argument for a two-axis MPS/0.2 — see docs/mps-two-axis-evidence.md.
 */
export function toMpsTag(evidence: ClaimEvidence): 'VERIFIED' | 'SOURCED' | 'BOUNDARY' | 'UNVERIFIED' {
  const { provenance, empirical } = evidence

  if (empirical === 'open-question' || empirical === 'bounded-inference') return 'BOUNDARY'
  if (empirical === 'interested-party') return provenance === 'maha-inference' ? 'UNVERIFIED' : 'SOURCED'
  if (provenance === 'maha-inference') return 'BOUNDARY'
  if (empirical === 'direct-observation' || empirical === 'calibrated-measurement') return 'VERIFIED'
  return 'SOURCED'
}

/**
 * True when a claim needs a `boundary` note to be honestly readable.
 *
 * Maha inference and every empirical status weaker than a documented
 * measurement carry a caveat the reader cannot reconstruct from the statement
 * alone, so the layer integrity checks require one.
 */
export function requiresBoundary(evidence: ClaimEvidence): boolean {
  return evidence.provenance === 'maha-inference'
    || ['method-basis', 'model-dependent', 'bounded-inference', 'interested-party', 'open-question'].includes(evidence.empirical)
}

const PROVENANCE_SET = new Set<string>(CLAIM_PROVENANCE)
const EMPIRICAL_SET = new Set<string>(CLAIM_EMPIRICAL)

export function assertClaimEvidence(evidence: ClaimEvidence, claimId: string): void {
  if (!PROVENANCE_SET.has(evidence.provenance)) throw new Error(`${claimId} has unknown provenance ${evidence.provenance}`)
  if (!EMPIRICAL_SET.has(evidence.empirical)) throw new Error(`${claimId} has unknown empirical status ${evidence.empirical}`)
}

/** JSON Schema fragment so published registries expose both axes to machine readers. */
export const CLAIM_EVIDENCE_SCHEMA = {
  provenance: { enum: CLAIM_PROVENANCE, description: 'How faithfully the claim represents its cited sources.' },
  empirical: { enum: CLAIM_EMPIRICAL, description: 'What supports the proposition itself, independent of sourcing fidelity.' },
} as const
