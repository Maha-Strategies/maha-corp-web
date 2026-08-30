/**
 * Frozen release-scale cohort selected from the 102 alignment-clear,
 * substantial-quality-eligible records that had no active canonical release
 * in the public registry snapshot captured on 2026-08-30.
 *
 * The first ten records form the canary. The cohort is immutable: later audit
 * improvements enter another batch rather than changing this membership.
 */
export const SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS = [
  'urn:maha:record:transmon-qubit',
  'urn:maha:record:circuit-quantum-electrodynamics',
  'urn:maha:record:josephson-junction-nonlinearity',
  'urn:maha:record:trapped-ion-qccd-architecture',
  'urn:maha:record:neutral-atom-optical-tweezer-arrays',
  'urn:maha:record:rydberg-blockade-entangling-gates',
  'urn:maha:record:linear-optical-quantum-computation',
  'urn:maha:record:silicon-spin-qubits',
  'urn:maha:record:physical-and-logical-qubits',
  'urn:maha:record:quantum-error-correction',
  'urn:maha:record:surface-code-error-correction',
  'urn:maha:record:stabilizer-syndrome-measurement',
  'urn:maha:record:logical-error-suppression',
  'urn:maha:record:randomized-benchmarking',
  'urn:maha:record:interleaved-randomized-benchmarking',
  'urn:maha:record:dispersive-qubit-readout',
  'urn:maha:record:cryogenic-superconducting-control-stack',
  'urn:maha:record:quantum-volume-benchmark',
  'urn:maha:record:random-circuit-sampling',
  'urn:maha:record:quantum-error-mitigation',
  'urn:maha:record:error-mitigation-versus-correction',
  'urn:maha:record:hardware-benchmark-scope',
  'urn:maha:record:fault-tolerance-threshold-condition',
  'urn:maha:record:prime-editing',
  'urn:maha:record:crispr-cas9-nuclease-editing',
  'urn:maha:record:guide-rna-and-pam-recognition',
  'urn:maha:record:double-strand-break-repair-outcomes',
  'urn:maha:record:cytosine-base-editing',
  'urn:maha:record:adenine-base-editing',
  'urn:maha:record:prime-editing-guide-rna-mechanism',
  'urn:maha:record:genome-editor-delivery-systems',
  'urn:maha:record:ex-vivo-genome-editing-workflow',
  'urn:maha:record:in-vivo-genome-editing-workflow',
  'urn:maha:record:guide-seq-off-target-detection',
  'urn:maha:record:change-seq-off-target-nomination',
  'urn:maha:record:targeted-amplicon-sequencing',
  'urn:maha:record:editing-efficiency-and-byproduct-measurement',
  'urn:maha:record:off-target-nomination-versus-confirmation',
  'urn:maha:record:cell-line-versus-primary-cell-evidence',
  'urn:maha:record:in-vitro-versus-in-vivo-evidence',
  'urn:maha:record:pooled-crispr-screening',
  'urn:maha:record:single-cell-perturbation-readout',
  'urn:maha:record:genetic-toggle-switch',
  'urn:maha:record:repressilator-gene-oscillator',
  'urn:maha:record:cell-free-gene-expression',
  'urn:maha:record:directed-evolution-workflows',
  'urn:maha:record:somatic-versus-germline-editing',
  'urn:maha:record:fusion-plasma-systems-divertor-heat-exhaust',
  'urn:maha:record:fusion-plasma-systems-plasma-diagnostics',
  'urn:maha:record:fusion-plasma-systems-tritium-fuel-cycle',
  'urn:maha:record:fusion-plasma-systems-cryogenic-magnet-cooling',
  'urn:maha:record:advanced-materials-correlated-insulating-states',
  'urn:maha:record:advanced-materials-magic-angle-superconductivity',
  'urn:maha:record:biomolecular-engineering-sequence-design-with-proteinmpnn',
  'urn:maha:record:biomolecular-engineering-experimental-fold-validation',
  'urn:maha:record:biomolecular-engineering-directed-enzyme-evolution',
  'urn:maha:record:longevity-metabolism-senolytic-selectivity',
  'urn:maha:record:longevity-metabolism-nad-salvage-pathway',
  'urn:maha:record:neurotechnology-bci-micro-ecog-arrays',
  'urn:maha:record:neurotechnology-bci-intracortical-bci',
  'urn:maha:record:mechanistic-interpretability-induction-head-circuits',
  'urn:maha:record:mechanistic-interpretability-sparse-autoencoder-dictionaries',
  'urn:maha:record:agentic-systems-mcp-mcp-resource-discovery',
  'urn:maha:record:critical-supply-chains-critical-mineral-import-reliance',
] as const

export const SUBSTANTIAL_SCALE_RELEASE_CANARY_IDS = SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS.slice(0, 10)

if (SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS.length !== 64
  || new Set(SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS).size !== 64
  || SUBSTANTIAL_SCALE_RELEASE_CANARY_IDS.length !== 10) {
  throw new Error('The substantial release-scale cohort drifted.')
}
