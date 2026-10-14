export const VALUE_BANDS = {
  1: { name: 'Micro-Audits & Receipts', minimumUnits: 10000, maximumUnits: 25000 },
  2: { name: 'Context Compression & Graph', minimumUnits: 35000, maximumUnits: 75000 },
  3: { name: 'Analytical Synthetics & Intel', minimumUnits: 100000, maximumUnits: 250000 },
} as const
export type ValueTier = keyof typeof VALUE_BANDS
export type ValuePricing = { policy: 'maha-value-staircase/1'; tier: ValueTier; label: string; rationale: string;
  assignmentBasis: 'reviewed-local-task' | 'unported-task-provisional' | 'draft-recipe-provisional' }
type Candidate = { id: string; category: string; domain: string; status: string }
// Tier follows the performed task, not an impressive domain label or a hash.
const ANALYTICAL = new Set([
  'deep-context-evaluation', 'mps-autonomous-audit', 'celestial-chart-evidence', 'celestial-vimshottari-timing',
  'paper-cluster-retrieval-comparison', 'inspection-coverage-plan', 'assembly-schedule-compare', 'automation-economics-compare',
  'public-spending-review', 'neural-experiment-metrics', 'manufacturing-yield-sensitivity', 'inspection-station-selection',
  'intention-threshold-sweep', 'dwell-release-comparison', 'synthetic-artifact-test-pack', 'confidence-calibration-report',
  'research-opportunity-comparison', 'evidence-brief-export', 'source-bound-research-microbrief', 'observing-window-planner',
  'quantum-randomized-benchmarking-fit', 'quantum-rabi-ramsey-analysis', 'quantum-surface-code-resource-scenario',
  'quantum-architecture-requirements', 'biology-research-dose-response-fit', 'biology-replicate-batch-confounding',
  'biology-design-assay-evidence-brief', 'chemistry-arrhenius-fit', 'chemistry-enzyme-kinetics-fit',
  'materials-stress-strain-analysis', 'materials-optical-bandgap-fit', 'materials-candidate-comparison',
  'materials-qualification-evidence-brief', 'weighted-calibration-fit', 'assembly-critical-path',
])
const GRAPH_CONTEXT = new Set([
  'context-compression', 'context-budget-ladder', 'evidence-retention-matrix', 'provenance-graph-integrity',
  'digital-twin-config-diff', 'retrieval-recovery-regression', 'packing-displacement-analysis', 'evidence-budget-allocation',
  'source-coverage-drift', 'workflow-dependency-validation', 'partnership-milestone-review', 'public-amendment-lineage',
  'spatial-adjacency-check', 'evidence-conflict-comparator', 'evidence-scope-check', 'evidence-version-selection-check',
  'book-reading-pack-the-maha-principle', 'cross-book-concept-pack', 'publication-pinned-brief',
  'publication-correction-impact', 'reception-lineage-retrieval', 'quantum-stabilizer-consistency',
  'quantum-readout-calibration', 'biology-pairwise-sequence-comparison', 'biology-protein-confidence-audit',
  'biology-assay-control-coverage', 'materials-deposition-compatibility', 'dataset-join-loss-preview',
  'research-funding-lineage', 'research-bibliography-resolution',
])
const GRAPH_ACTIONS = ['source-coverage-map', 'identifier-crosswalk-audit', 'reference-integrity-map', 'condition-coverage-map',
  'schema-directionality', 'record-sequence-diff', 'provenance-edge-audit', 'scope-boundary-audit', 'export-semantic-parity']
export function valueTierFor(e: Candidate): ValuePricing {
  const tier: ValueTier = ANALYTICAL.has(e.id) ? 3 : GRAPH_CONTEXT.has(e.id) || GRAPH_ACTIONS.some(a => e.id.endsWith('-' + a)) ? 2 : 1
  return { policy: 'maha-value-staircase/1', tier, label: VALUE_BANDS[tier].name,
    rationale: tier === 3 ? 'Bounded fit, simulation, clustered analysis or analytical brief; usefulness and cost are separate release gates.'
      : tier === 2 ? 'Context, relationships, graph/reference reconciliation or a composed reading task.'
      : 'Bounded deterministic metadata, arithmetic, format, integrity or single-unit check; domain name alone does not justify an analytical tier.',
    assignmentBasis: e.status === 'proposal' ? 'draft-recipe-provisional' : e.status === 'legacy-unported' ? 'unported-task-provisional' : 'reviewed-local-task' }
}
export function amountWithinBand(amount: string, tier: ValueTier) {
  const band = VALUE_BANDS[tier]
  return /^\d+$/.test(amount) && Number.isSafeInteger(Number(amount)) && Number(amount) >= band.minimumUnits && Number(amount) <= band.maximumUnits
}
