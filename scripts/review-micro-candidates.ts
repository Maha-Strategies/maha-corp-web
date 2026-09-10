import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { microDigest } from '../lib/x402/micro-products.ts'
import { NEXT_PRODUCTS } from '../lib/x402/micro-next-contracts.ts'

const root = resolve(import.meta.dirname, '..'), read = (p: string) => JSON.parse(readFileSync(resolve(root, p), 'utf8'))
const freeze = read('content/discovery/micro-candidate-freeze-v1.json'), costs = read('content/discovery/micro-next12-cost-observation-v3.json')
const omitDigest = (o: object) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'digest'))
if (microDigest(omitDigest(freeze)) !== freeze.digest || microDigest(omitDigest(costs)) !== costs.digest) throw new Error('unbound-input')
// Every candidate receives an explicit semantic adjudication, not URL/token similarity.
const decisions: [number, string, string, string][] = [
  [1, 'unit-uncertainty-conversion', 'dimensional-consistency-check', 'Numeric affine conversion and uncertainty scaling, not dimension-vector algebra.'],
  [2, 'covariance-uncertainty', 'evidence-conflict-comparator', 'Quantitative c^T C c with PSD checks, not caller-labelled evidence directions.'],
  [3, 'defer', 'micro60-02', 'Calibration estimates coefficients from measurements; not propagation. Acquisition assumptions and cost unmeasured.'],
  [4, 'defer', 'micro60-02', 'Compatibility requires declared correlation and a decision convention beyond propagated uncertainty.'],
  [5, 'defer', 'micro60-01', 'Presentation operation could be bundled with conversion; no standalone buyer utility measured.'],
  [6, 'defer', 'astrology-experiment-plan-check', 'Observed data diagnostics differ from prospective missing-data declarations; data limits not yet reviewed.'],
  [7, 'defer', 'sampled-series-integration', 'Sampling validity is not integration; signal assumptions and fixtures outstanding.'],
  [8, 'merge', 'micro60-43', 'Generic and celestial reference-frame candidates overlap; define one frame-explicit transformation contract first.'],
  [9, 'defer', 'micro60-07', 'Spectral output is distinct; sampling/window conventions and capped workload not measured.'],
  [10, 'defer', 'micro60-16', 'General convergence analysis exceeds one bracketed root solver; revisit as an extension, not a duplicate receipt.'],
  [11, 'exact-linear-system', 'dimensional-consistency-check', 'Solve rational coefficient equations; existing dimensional checker cannot supply a solution space.'],
  [12, 'merge', 'micro60-11', 'Selected solver already returns rank, pivot/free columns and a null-space basis for the same bounded matrix.'],
  [13, 'defer', 'micro60-14', 'Factorization is not identity comparison; algorithm and resource bounds unmeasured.'],
  [14, 'defer', 'micro60-16', 'Formal polynomial equality differs from root isolation; expression grammar review outstanding.'],
  [15, 'defer', 'micro60-14', 'Excluded-domain bookkeeping needs a separate symbolic grammar and tests.'],
  [16, 'bracketed-polynomial-root', 'exact-interpolation-receipt', 'Isolate a polynomial zero with a sign bracket, not interpolate two observations.'],
  [17, 'defer', 'micro60-16', 'General interval evaluation is broader than a polynomial root enclosure.'],
  [18, 'defer', 'astrology-experiment-plan-check', 'Compute finite probabilities, not validate experiment declarations; sample-space contract absent.'],
  [19, 'merge', 'micro60-54', 'Graph traversal and workflow dependency traversal share a buyer operation; retain one dependency product design.'],
  [20, 'defer', 'gpu-tensor-network', 'Continuous bounded LP differs from the existing heuristic optimization family; solver and cost proofs missing.'],
  [21, 'divine-name-disambiguation', 'tiruvaymoli-context-packet', 'Name-to-typed-identity resolution is not retrieval of a known passage. Exact small alias index only.'],
  [22, 'edition-verse-resolution', 'tiruvaymoli-context-packet', 'Inverse verse-to-unit lookup; existing packet requires the unit slug already known.'],
  [23, 'defer', 'micro60-22', 'Cross-edition alignment needs inspected paired editions and commercially usable content.'],
  [24, 'merge', 'micro60-23', 'Variant comparison needs the same paired-edition alignment; one combined buyer task until differentiated demand exists.'],
  [25, 'defer', 'micro60-21', 'Exhaustive concordance is broader than alias resolution and needs occurrence-level coverage.'],
  [26, 'rights-review', 'micro60-21', 'Several central landscape anchors use NC TextGrid representation; no paid text reuse authorized.'],
  [27, 'defer', '/api/geocoding/places', 'Religious/historical place disambiguation is not present-day geocoding; locality evidence missing.'],
  [28, 'defer', 'micro60-29', 'Frame attribution overlaps reception packet metadata; arbitrary-passage classification would require new research.'],
  [29, 'reception-lineage-retrieval', 'tiruvaymoli-context-packet', 'Cross-corpus attributed reception comparison, not one unit context. Only fully rights-eligible existing topics.'],
  [30, 'defer', 'micro60-21', 'Cross-tradition mapping needs reviewed relationship evidence beyond the Tamil name index.'],
  [31, 'extend-existing', 'release-bound-evidence-packet', 'Clause retrieval is an extension of the release-pinned packet, not a new release/binding product; clause rights review still needed.'],
  [32, 'policy-version-comparison', 'revision-lineage-check', 'Compare clause text and scope; existing lineage tool checks identifiers, not policy content.'],
  [33, 'defer', 'micro60-35', 'Creating an obligation/control crosswalk requires interpretation; selected gap check only consumes explicit mappings.'],
  [34, 'defer', 'micro60-32', 'Jurisdiction/effective-date applicability requires maintained authority, not sequence comparison.'],
  [35, 'control-evidence-gaps', 'governed-context-verification-pack', 'Version-bound control coverage, not contextual extraction quality or a claim of control effectiveness.'],
  [36, 'defer', 'micro60-35', 'Role/accountability consistency is distinct but needs a bounded responsibility model.'],
  [37, 'defer', 'micro60-35', 'Policy exceptions require authority, expiry and scope contracts not supplied by evidence matching.'],
  [38, 'defer', 'evidence-retention-matrix', 'Data-flow analysis overlaps existing retention decisions but introduces paths and processing purposes; contract unreviewed.'],
  [39, 'defer', 'micro60-33', 'Cross-standard semantics cannot be inferred from matching control names; source/license inspection missing.'],
  [40, 'defer', 'micro60-35', 'Executable policy needs separately approved rules; declarations are not machine-enforceable law.'],
  [41, 'defer', 'celestial-position-snapshot', 'Dedicated time-scale conversion overlaps internal celestial operations but needs versioned leap-second/time-scale inputs.'],
  [42, 'extend-existing', 'celestial-position-snapshot', 'Julian-date arithmetic is an existing celestial calculation component; do not multiply offers without a distinct workflow.'],
  [43, 'defer', 'celestial-chart-evidence', 'Frame transformation should be coordinated with existing celestial conventions and merged generic candidate 08.'],
  [44, 'defer', 'celestial-position-snapshot', 'Pairwise separation differs from a single position; bounded precision/edge-case tests not yet measured.'],
  [45, 'defer', 'micro60-43', 'Proper motion needs epoch and covariance conventions, not merely a coordinate transform.'],
  [46, 'extend-existing', 'celestial-chart-evidence', 'Horizontal-coordinate calculation belongs with the current chart/reference conventions unless standalone demand is demonstrated.'],
  [47, 'defer', 'micro60-46', 'Time-window search adds horizon, weather exclusion and iteration costs; not benchmarked.'],
  [48, 'defer', 'micro60-02', 'Spatial catalog crossmatching needs datasets, epoch conventions and match-risk evaluation beyond covariance arithmetic.'],
  [49, 'defer', 'celestial-chart-evidence', 'Convention comparisons overlap current evidence conventions; scope/cost unreviewed.'],
  [50, 'defer', 'astrology-experiment-plan-check', 'Outcome evaluation is separate from preregistration triage and needs a locked analysis/data contract.'],
  [51, 'mcp-contract-compatibility', 'enterprise-mcp-gateway; agent-infrastructure-compatibility-pack', 'Compare supplied tool-contract digests without forwarding calls or contacting servers. Unlike the $49 compatibility pack, performs no live A2A/MCP exercise. Narrow exact-match mode only.'],
  [52, 'defer', 'micro60-51', 'Arbitrary JSON-schema instance validation overlaps free validators; distinct paid utility not demonstrated.'],
  [53, 'tool-permission-diff', 'enterprise-mcp-gateway', 'Compare explicit permission changes without executing tools; no IAM inference or inherited policy evaluation.'],
  [54, 'defer', 'micro60-19', 'Combined workflow/graph traversal remains one retained candidate with no benchmark yet.'],
  [55, 'defer', 'audit-export-normalizer', 'Provenance connectivity and dangling references exceed event ordering; graph contract unreviewed.'],
  [56, 'defer', 'micro60-21', 'Cross-property entity resolution needs identity authority beyond the narrow religion registry.'],
  [57, 'defer', 'citation-binding-check', 'Coverage relates each claim to citations; exact citation identity checks alone do not establish coverage or support.'],
  [58, 'defer', 'citation-binding-check', 'Citation rendering differs from binding but may be a free/bundled feature rather than a paid product.'],
  [59, 'defer', 'enterprise-mcp-gateway', 'License-scope matching needs exact grant/rights semantics and may overlap existing licensed delivery controls.'],
  [60, 'publication-bundle-consistency', 'release-bound-evidence-packet', 'Compare multiple declared views; existing packet retrieves one verified repository binding. No active release is created.'],
]
const packets: Record<string, { utility: number; evidence: number; basis: string; locator: string }> = {
  'unit-uncertainty-conversion': { utility: 3, evidence: 3, basis: 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors', locator: 'B.3 conversion factors; fixed supported SI prefixes and affine temperature definitions; numerical inverse/uncertainty tests' },
  'covariance-uncertainty': { utility: 3, evidence: 3, basis: 'https://physics.nist.gov/cuu/Uncertainty/combination.html', locator: 'Equation (6), sensitivity coefficients and covariance; exact PSD and cross-term tests' },
  'exact-linear-system': { utility: 3, evidence: 3, basis: 'https://dlmf.nist.gov/3.2', locator: 'Linear equations and elimination; independent A*x=b and A*N=0 fixtures' },
  'bracketed-polynomial-root': { utility: 3, evidence: 3, basis: 'https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.bisect.html', locator: 'Continuous sign-changing bracket and termination; own rational polynomial implementation, no SciPy dependency' },
  'divine-name-disambiguation': { utility: 2, evidence: 2, basis: 'lib/mayon-knowledge.ts', locator: 'MAYON_CONNECTIONS, source-scoped scholarly links and MAYON_MODERN_BRIDGES; exact aliases only' },
  'edition-verse-resolution': { utility: 2, evidence: 2, basis: 'lib/tiruvaymoli-passage-atlas.ts', locator: '46 inspected unit ranges in the named Project Madurai/Hart edition; no new verse-text inspection' },
  'reception-lineage-retrieval': { utility: 2, evidence: 2, basis: 'lib/tamil-source-atlas.ts', locator: 'Existing reception-lineage topics and source locators; refuse any topic requiring NC representation' },
  'policy-version-comparison': { utility: 3, evidence: 3, basis: 'lib/x402/micro-next-products.ts', locator: 'Version sequence, stable clause IDs, exact text/scope changes; synthetic policy only, no legal-source claim' },
  'control-evidence-gaps': { utility: 3, evidence: 3, basis: 'test/x402-micro-next12.test.ts', locator: 'Independent refusal on wrong policy/content/scope/rejected evidence; metadata comparison not compliance' },
  'mcp-contract-compatibility': { utility: 3, evidence: 2, basis: 'https://modelcontextprotocol.io/specification/2025-06-18/server/tools', locator: 'Tool name, inputSchema, outputSchema; pinned exact digests, not complete MCP conformance' },
  'tool-permission-diff': { utility: 3, evidence: 3, basis: 'test/x402-micro-next12.test.ts', locator: 'Allow-only exact set difference, duplicate refusal, wildcard disclosure; no IAM semantics' },
  'publication-bundle-consistency': { utility: 3, evidence: 3, basis: 'test/x402-micro-next12.test.ts', locator: 'Independent canonical/revision/release/source/status refusal for article/registry/API declarations' },
}
const rows = decisions.map(([number, decision, comparedWith, reason]) => {
  const candidate = freeze.candidates[number - 1], selected = Object.hasOwn(NEXT_PRODUCTS, decision), packet = packets[decision]
  const measurement = costs.observations.find((o: { id: string }) => o.id === decision)
  if (selected && (!packet || !measurement || measurement.cappedWorkloadP95Ms > 100 || measurement.responseBytes > 65536 || measurement.requestBytes > 32768)) throw new Error(`selection-refused:${decision}`)
  const costScore = measurement ? measurement.cappedWorkloadP95Ms <= 5 ? 3 : measurement.cappedWorkloadP95Ms <= 25 ? 2 : 1 : null
  return { ...candidate, disposition: selected ? 'selected-local-only' : decision, productId: selected ? decision : null, comparedWith, reason,
    utilityScore: packet?.utility ?? null, evidenceScore: packet?.evidence ?? null, localCostScore: costScore,
    score: packet && costScore !== null ? packet.utility * 4 + packet.evidence * 4 + costScore * 2 : null,
    evidencePacket: packet ? { ...packet, rights: decision.includes('lineage') || decision.includes('verse') || decision.includes('divine') ? 'Metadata and existing Maha paraphrases only; NC/full-text requests refused; launch rights review remains required' : 'Own bounded algorithms/fixtures; external references cited, not copied', boundary: reason } : null,
    costObservation: measurement ?? null, demand: null, cloudCostUsd: null }
})
if (rows.length !== 60 || new Set(rows.map(r => r.candidateId)).size !== 60 || rows.filter(r => r.productId).length !== 12) throw new Error('cohort-partition-refused')
const comparedFiles = ['content/discovery/micro-candidate-freeze-v1.json', 'lib/x402/celestial-products.ts', 'lib/x402/offers.ts', 'lib/agent-infrastructure-compatibility-pack.ts', 'lib/openapi.ts']
const body = { version: 'micro60-selection/1', freezeDigest: freeze.digest, costObservationDigest: costs.digest,
  method: 'Manual semantic task comparison. Utility 2=bounded public corpus lookup, 3=demonstrated transformation/check fixture. Evidence 2=existing attributed corpus or narrow protocol snapshot; 3=independently checked arithmetic/structural rules. Cost 3<=5ms, 2<=25ms, 1<=100ms capped-fixture p95. Score 4U+4E+2C.',
  qualification: 'Twelve evidence-ready, locally measured shortlist entries; not a global ranking over unimplemented candidates. Unmeasured candidates retain null scores. Demonstrated fixture utility is not customer demand or revenue. Cloud cost remains unknown.',
  comparedFiles: comparedFiles.map(path => ({ path, digest: microDigest(readFileSync(resolve(root, path), 'utf8')) })),
  selected: rows.filter(r => r.productId).sort((a, b) => b.score! - a.score! || a.candidateId.localeCompare(b.candidateId)).map(r => r.productId), rows }
const target = resolve(root, 'content/discovery/micro60-selection-v1.json'), text = JSON.stringify({ ...body, digest: microDigest(body) }, null, 2) + '\n'
const args = process.argv.slice(2)
if (args.length !== 1 || !['--write', '--check'].includes(args[0])) throw new Error('Local --write or --check only')
if (args[0] === '--write') writeFileSync(target, text)
else if (readFileSync(target, 'utf8') !== text) throw new Error('selection-stale')
console.log(JSON.stringify({ candidates: rows.length, selected: body.selected, counts: Object.fromEntries([...new Set(rows.map(r => r.disposition))].map(d => [d, rows.filter(r => r.disposition === d).length])) }))
