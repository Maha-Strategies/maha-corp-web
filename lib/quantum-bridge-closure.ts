import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { QUANTUM_BRIDGE_AUDIT, buildGapReport, type BlockerCode } from './quantum-bridge-audit-package.ts'

export const QUANTUM_BRIDGE_CLOSURE_VERSION = 'maha-quantum-bridge-closure/1.0' as const

export type BridgeClosureDisposition = 'REVISE' | 'REJECT'

export interface QuantumBridgeClosureRecord {
  bridgeId: string
  submittedAuditDigest: string
  submittedVerdict: 'BLOCK'
  finalDisposition: BridgeClosureDisposition
  blockerSnapshot: readonly BlockerCode[]
  rationale: string
  requiredNextAction: string
  reconsiderationRule: string
  remediationArtifacts: readonly string[]
  promotionEligible: false
  closureDigest: string
}

const ARTIFACTS = [
  'content/bridges/endpoint-resolution-plan.json',
  'content/bridges/endpoint-candidate-inventory.json',
  'content/bridges/quantum-bridge-gap-report.json',
] as const

const REVISE_ACTIONS: Readonly<Record<string, string>> = {
  'Q-BR-001': 'Split the compound coding-theory endpoint, create canonical CSS and classical-code records, and bind exact locators before submitting a new bridge revision.',
  'Q-BR-002': 'Create the named dielectric-loss and transmon-relaxation records, then bind each bounded mechanism to an inspected passage with rights metadata.',
  'Q-BR-004': 'Create separately scoped phase-estimation and metalloenzyme records and narrow the bridge to a computational candidate rather than a chemistry-performance claim.',
  'Q-BR-005': 'Create canonical helium-3 refinement and cryogenic-base records and supply exact source locators before rereview.',
  'Q-BR-006': 'Replace the misaligned REBCO source binding with an inspected, approved revision before relying on the existing structural alias.',
  'Q-BR-007': 'Resolve the advanced-materials duplicate-risk decision, create or select the exact topological-mode endpoint, and bind inspected locators.',
  'Q-BR-008': 'Split the population-code endpoint from its incompatible record class and narrow the analogy so it cannot be read as mechanistic equivalence.',
  'Q-BR-009': 'Create canonical silicon-28 purification and spin-qubit hyperfine-limit records and supply exact locators for both sides.',
  'Q-BR-012': 'Create canonical refractory-metallurgy and cavity-loss records, establish rights bases, and bind exact locators before rereview.',
}

const invalid = new Map(buildGapReport().conceptuallyInvalid.map((entry) => [entry.id, entry.reason]))

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

function closeBridge(bridge: (typeof QUANTUM_BRIDGE_AUDIT)[number]): QuantumBridgeClosureRecord {
  const rejectionReason = invalid.get(bridge.id)
  const finalDisposition: BridgeClosureDisposition = rejectionReason ? 'REJECT' : 'REVISE'
  const withoutDigest = {
    bridgeId: bridge.id,
    submittedAuditDigest: bridge.auditDigest,
    submittedVerdict: bridge.verdict as 'BLOCK',
    finalDisposition,
    blockerSnapshot: bridge.blockerCodes,
    rationale: rejectionReason ?? 'The submitted bridge is not promotable, but its defects are bounded and may be addressed only through a new audited revision.',
    requiredNextAction: rejectionReason
      ? 'Preserve this specification as rejected. Any reconsideration must be a new specification with a new identifier, new evidence bindings, and a fresh audit.'
      : REVISE_ACTIONS[bridge.id],
    reconsiderationRule: rejectionReason
      ? 'The rejected specification is immutable and cannot be reopened in place.'
      : 'The original BLOCK verdict remains immutable; remediation creates a new version and does not inherit clearance.',
    remediationArtifacts: ARTIFACTS,
    promotionEligible: false as const,
  }
  if (!withoutDigest.requiredNextAction) throw new Error(`No closure action declared for ${bridge.id}.`)
  return { ...withoutDigest, closureDigest: sha256(withoutDigest) }
}

export const QUANTUM_BRIDGE_CLOSURE: readonly QuantumBridgeClosureRecord[] = QUANTUM_BRIDGE_AUDIT.map(closeBridge)

if (QUANTUM_BRIDGE_CLOSURE.length !== 12) throw new Error('Quantum bridge closure must cover all twelve specifications.')
if (QUANTUM_BRIDGE_CLOSURE.filter((entry) => entry.finalDisposition === 'REVISE').length !== 9) {
  throw new Error('Quantum bridge closure must contain exactly nine revision dispositions.')
}
const rejectedIds = QUANTUM_BRIDGE_CLOSURE.filter((entry) => entry.finalDisposition === 'REJECT').map((entry) => entry.bridgeId)
if (canonicalJson(rejectedIds) !== canonicalJson(['Q-BR-003', 'Q-BR-010', 'Q-BR-011'])) {
  throw new Error(`Quantum bridge rejection set drifted: ${rejectedIds.join(', ')}.`)
}
if (QUANTUM_BRIDGE_CLOSURE.some((entry) => entry.submittedVerdict !== 'BLOCK' || entry.promotionEligible)) {
  throw new Error('Closure cannot convert a blocked specification into a promotable bridge.')
}

export function quantumBridgeClosureDigest(): string {
  return sha256({ version: QUANTUM_BRIDGE_CLOSURE_VERSION, records: QUANTUM_BRIDGE_CLOSURE })
}
