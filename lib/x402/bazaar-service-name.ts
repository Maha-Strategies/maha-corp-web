import { isValidServiceName, sanitizeTags } from '@x402/extensions/bazaar'

/** Human-facing catalogue titles stay intact; Bazaar requires 1-32 printable ASCII characters. */
export const BAZAAR_SERVICE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  'live-x402-payment-preflight': 'Live x402 Payment Preflight',
  'source-bound-research-microbrief': 'Source Bound Research Microbrief',
  'quantum-architecture-requirements': 'Qubit Architecture Requirements',
  'biology-accession-version-check': 'Biological Accession Versions',
  'biology-qpcr-relative-expression': 'qPCR Relative Expression',
  'biology-replicate-batch-confounding': 'Replicate Batch Confounding',
  'biology-translation-boundary-check': 'Biology Translation Boundaries',
  'chemistry-concentration-basis': 'Concentration Basis Reconcile',
  'chemistry-electrochemical-normalizer': 'Electrochemical Normalizer',
  'materials-particle-size-summary': 'Particle Size Summary',
  'materials-sheet-resistance': 'Thin Film Sheet Resistance',
  'materials-deposition-compatibility': 'Deposition Compatibility Map',
  'materials-qualification-evidence-brief': 'Materials Qualification Brief',
  'governed-context-verification-pack': 'Maha Governed Context Pack',
  'book-section-the-imagined-life': 'The Imagined Life - Section',
  'book-section-the-volcanic-engine': 'The Volcanic Engine - Section',
  'tiruvaymoli-context-packet': 'Tiruvaymoli Context Packet',
  'bracketed-polynomial-root': 'Bracketed Polynomial Root',
  'covariance-uncertainty': 'Covariance Uncertainty',
  'reception-lineage-retrieval': 'Tamil Reception Lineage',
  'policy-version-comparison': 'Policy Version Comparison',
  'control-evidence-gaps': 'Control Evidence Gaps',
  'mcp-contract-compatibility': 'MCP Contract Compatibility',
  'celestial-result-compatibility': 'Celestial Compatibility Check',
  'evidence-frame-compatibility': 'Evidence Frame Compatibility',
  'panel-packing-estimate': 'Rectangular Panel Packing',
  'paper-cluster-retrieval-comparison': 'Paper Cluster Retrieval Compare',
  'settlement-delivery-reconciliation': 'Settlement Delivery Reconcile',
  'idempotency-trace-audit': 'Idempotency Trace Audit',
  'machine-license-permission-match': 'License Permission Match',
  'intention-threshold-sweep': 'Intention Threshold Sweep',
  'synthetic-artifact-test-pack': 'Synthetic Artifact Test Pack',
  'confidence-calibration-report': 'Confidence Calibration Report',
  'experiment-plan-completeness': 'Experiment Plan Completeness',
  'partnership-milestone-review': 'Partnership Milestone Review',
  'research-opportunity-comparison': 'Research Opportunity Comparison',
  'evidence-brief-export': 'Evidence Brief Export',
  'public-amendment-lineage': 'Public Amendment Lineage',
  'spending-variance-bridge': 'Spending Variance Bridge',
  'transparency-hash-chain-verification': 'Decision Hash Chain Verification',
  'public-filing-amendment-resolver': 'Public Filing Amendment Resolver',
  'angular-separation-batch': 'Angular Separation Batch',
  'observing-window-planner': 'Geometric Observing Windows',
  'terrain-profile-arithmetic': 'Terrain Profile Arithmetic',
  'volcano-concept-evidence-pack': 'Volcano Concept Evidence Pack',
  'edition-locator-alignment': 'Edition Locator Alignment',
  'manuscript-release-diff': 'Manuscript Release Diff',
  'cross-book-concept-pack': 'Cross Book Concept Pack',
  'book-reading-pack-the-maha-principle': 'Maha Principle Reading Pack',
  'book-epub-the-maha-principle': 'The Maha Principle - EPUB PDF',
  'book-epub-the-orbital-mind': 'The Orbital Mind - EPUB PDF',
  'book-section-the-maha-principle': 'The Maha Principle - Section',
  'book-section-the-orbital-mind': 'The Orbital Mind - Section',
})

export function bazaarServiceNameForOffer(offer: { id: string; serviceName: string }): string {
  const name = BAZAAR_SERVICE_NAMES[offer.id] ?? offer.serviceName
  if (!isValidServiceName(name)) throw new Error(`Invalid Bazaar name for offer ${offer.id}; provide a short ASCII catalogue alias.`)
  return name
}

const GENERIC_TAGS = new Set(['bounded-computation', 'evidence', 'deterministic', 'microproduct', 'x402'])

/** Keep specific task/domain tags when the index's five-tag limit would drop them. */
export function bazaarTagsForOffer(offer: { tags: readonly string[] }): string[] {
  const authored = [...offer.tags]
  const prioritized = authored.length <= 5 ? authored
    : [...authored.filter(tag => !GENERIC_TAGS.has(tag)), ...authored.filter(tag => GENERIC_TAGS.has(tag))]
  return sanitizeTags(prioritized) ?? []
}
