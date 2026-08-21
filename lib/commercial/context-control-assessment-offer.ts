import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The Context-Control Evidence Assessment offer, as data.
 *
 * The prices are gated on the evidence package being publicly reachable. That
 * is not a formality: at $12,500 a prospect is buying a method, and the only
 * honest way to ask for it is to let them read the method first. The gate is
 * keyed to artifacts on disk rather than a flag, so it cannot be opened by
 * deciding it is open.
 */
export const REQUIRED_PUBLIC_ARTIFACTS = [
  'public/benchmarks/wso2/live-evaluation-evidence.json',
  'public/assessments/context-control-evidence-assessment-sample.pdf',
  'public/security/context-control-security-boundary.pdf',
  'public/benchmarks/mcrb-1/dense/results.json',
] as const

export function missingPublicArtifacts(root = join(import.meta.dirname, '..', '..')): string[] {
  return REQUIRED_PUBLIC_ARTIFACTS.filter((path) => !existsSync(join(root, path)))
}

export const ASSESSMENT_TIERS = [
  {
    id: 'standard',
    name: 'Standard Context-Control Evidence Assessment',
    price: '$12,500',
    summary: 'One customer-supplied workload, three paths, a written recommendation.',
  },
  {
    id: 'extended',
    name: 'Extended Assessment',
    price: '$25,000',
    summary: 'Multiple workloads or a second gateway configuration, with per-workload findings for each.',
  },
] as const

/**
 * Not a discount. A discount is a lower price for the same thing; this is a
 * different transaction, and the copy has to say what is being exchanged.
 */
export const FOUNDING_PARTNER = {
  price: '$2,500',
  limit: 'the first two signed customers',
  requirement: 'agreeing in advance to act as a named reference and to permit an anonymized integration note',
  notADiscount: 'This is not a general or negotiable discount. It is a fixed exchange for reference participation, and it closes after two customers.',
} as const

export const ASSESSMENT_SCOPE = [
  'A customer-supplied, sanitized document or RAG workload. No production credentials and no personal data.',
  'Configuration and workload frozen and digest-recorded before anything runs, so the scoring target cannot move after results are seen.',
  'Three paths compared: your baseline, your gateway-native compression, and Maha.',
  'Token and cost measurement, evidence retention, citations and provenance, latency, and failure-path behaviour.',
  'Sanitized per-workload findings and a written proceed, revise, or stop recommendation.',
] as const

export const ASSESSMENT_EXCLUSIONS = [
  'No production deployment. The assessment measures; it does not install.',
  'No performance or savings guarantee. Nothing is promised before measurement.',
  'No certification or compliance opinion of any kind.',
  'No WSO2 partnership, endorsement, or customer validation claim. This is independent compatibility work.',
] as const

/**
 * What Maha is asked to be judged on. Retention is deliberately absent: the
 * published dense baseline scores higher on it than the production scorer, and
 * a positioning line the company's own benchmark contradicts is worse than no
 * positioning line.
 */
export const POSITIONING = [
  'Deterministic selection: the same inputs produce the same pack, with no model in the path.',
  'Hard budgets: the declared token budget is enforced rather than advised.',
  'Source-linked provenance: every retained passage carries its source and passage identifier.',
  'Stable hashes: input and output commitments a reviewer can recompute.',
  'Reproducible evidence: per-workload rows and a one-command check, not a headline.',
] as const
