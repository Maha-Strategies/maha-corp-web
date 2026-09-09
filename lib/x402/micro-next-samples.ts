import type { NextProductId } from './micro-next-contracts.ts'
const h = (c: string) => `sha256:${c.repeat(64)}`
const tool = { name: 'synthetic-tool', inputSchemaDigest: h('1'), outputSchemaDigest: h('2') }
const publication = { canonicalUrl: 'https://www.mahastrategies.com/synthetic-not-a-live-page', contentDigest: h('1'), releaseDigest: h('2'), sourceSetDigest: h('3') }
export const NEXT_SAMPLES: Record<NextProductId, Record<string, unknown>> = {
  'unit-uncertainty-conversion': { dataClass: 'synthetic', value: '32', standardUncertainty: '1.8', from: 'degF', to: 'degC', quantity: 'absolute' },
  'exact-linear-system': { dataClass: 'synthetic', matrix: [['2', '1'], ['1', '-1']], rhs: ['5', '1'] },
  'bracketed-polynomial-root': { dataClass: 'synthetic', coefficientsAscending: ['-2', '0', '1'], lower: '1', upper: '2', tolerance: '0.000001', maxIterations: 32 },
  'covariance-uncertainty': { dataClass: 'synthetic', sensitivities: ['1', '2'], covariance: [['4', '1'], ['1', '9']], outputUnit: 'm' },
  'divine-name-disambiguation': { dataClass: 'public', name: 'Mayon', expectedRegistryDigest: 'sha256:43e894685dfb4d8ca91ce6069cc182f273af4398e739bb388740f4dfd1f9a56a' },
  'edition-verse-resolution': { dataClass: 'public', editionId: 'project-madurai-divya-prabandham-part-4', pasuram: 2791, expectedRegistryDigest: 'sha256:98f42d289673bcd6e8c4499377fc1599d8e3f62a416cf4ced02ecbb4f3f98274' },
  'reception-lineage-retrieval': { dataClass: 'public', slug: 'tirumal-from-hymn-title-to-reception', expectedRegistryDigest: 'sha256:ed0c6c8e7743d8af485a0d4d3426cddeef89b8eabc507dc56e8988d164c0a642' },
  'policy-version-comparison': { dataClass: 'synthetic', policyId: 'example-policy', beforeVersion: 'v1', afterVersion: 'v2', beforeSequence: 1, afterSequence: 2, before: [{ clauseId: 'retain', text: 'Retain for seven days.', scope: 'sandbox' }], after: [{ clauseId: 'retain', text: 'Retain for three days.', scope: 'sandbox' }] },
  'control-evidence-gaps': { dataClass: 'synthetic', policyDigest: h('1'), requirements: [{ controlId: 'audit', requiredContentDigest: h('2'), scope: 'sandbox' }], evidence: [{ evidenceId: 'fixture', controlId: 'audit', policyDigest: h('1'), contentDigest: h('2'), scope: 'sandbox', status: 'accepted' }] },
  'mcp-contract-compatibility': { dataClass: 'synthetic', required: { protocolVersion: '2025-06-18', transport: 'stdio', tools: [tool] }, offered: { protocolVersion: '2025-06-18', transport: 'stdio', tools: [tool] } },
  'tool-permission-diff': { dataClass: 'synthetic', before: [{ tool: 'files', action: 'read', resource: 'public/example' }], after: [{ tool: 'files', action: 'read', resource: '*' }] },
  'publication-bundle-consistency': { dataClass: 'synthetic', ...publication, views: ['article', 'registry', 'api'].map(kind => ({ viewId: kind, kind, ...publication, status: 'active' })) },
}
