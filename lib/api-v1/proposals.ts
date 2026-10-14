import { z } from 'zod'
import type { Domain, Endpoint } from './types.ts'
/** Planning taxonomy, not 816 implemented services. Each recipe needs an
 * independent usefulness/overlap review and a domain-specific contract before release. */
const FAMILIES: Record<Domain, string[]> = {
  context: ['contract-amendments', 'policy-excerpts', 'technical-manuals', 'meeting-records', 'study-notes', 'incident-notes', 'source-packs', 'tool-context'],
  verify: ['payment-quotes', 'settlement-receipts', 'recovery-manifests', 'api-contracts', 'tool-schemas', 'tabular-records', 'identity-records', 'provenance-manifests', 'license-records', 'package-manifests'],
  compute: ['quantum-circuit-records', 'quantum-calibrations', 'biology-assays', 'genomic-records', 'protein-measurements', 'ecology-observations', 'reaction-records', 'spectrometry-records', 'catalyst-measurements', 'polymer-measurements', 'alloy-measurements', 'ceramic-measurements', 'battery-measurements', 'optical-measurements', 'thermal-measurements', 'robotics-telemetry', 'neural-interface-records'],
  celestial: ['sky-observations', 'orbital-records', 'ephemeris-snapshots', 'telescope-calibrations', 'planetary-measurements'],
  intel: ['publication-records', 'trial-registry-records', 'grant-records', 'procurement-notices', 'campaign-disclosures', 'market-catalogues', 'scientific-dataset-records'],
  library: ['bibliographies', 'reading-plans', 'edition-records', 'glossary-records'],
}
const ACTIONS = [
  ['required-field-coverage', 'Required-field coverage', 'Report missing declared fields and coverage counts', 8000],
  ['duplicate-record-identities', 'Duplicate record identities', 'Group repeated stable IDs without conflating versions', 9000],
  ['unit-label-consistency', 'Unit-label consistency', 'Find conflicting declared units; do not infer physical equivalence', 11000],
  ['timestamp-order-audit', 'Timestamp order audit', 'Find invalid or out-of-order declared observation timestamps', 14000],
  ['revision-delta-map', 'Revision delta map', 'Compare two pinned revisions and enumerate changed fields', 20000],
  ['source-coverage-map', 'Source coverage map', 'Map records to supplied source anchors and report uncovered records', 27000],
  ['identifier-crosswalk-audit', 'Identifier crosswalk audit', 'Find missing or many-to-one mappings in a supplied crosswalk', 22000],
  ['reference-integrity-map', 'Reference integrity map', 'Find unresolved references within the supplied record set', 17000],
  ['condition-coverage-map', 'Condition coverage map', 'Report coverage of explicitly declared applicability conditions', 24000],
  ['declared-bound-audit', 'Declared-bound audit', 'Check numeric fields against caller-declared bounds, not scientific safety limits', 30000],
  ['missingness-cooccurrence', 'Missingness co-occurrence', 'Report which required fields are jointly missing', 19000],
  ['schema-directionality', 'Schema directionality', 'Compare old/new declared field contracts for directional breaks', 26000],
  ['record-sequence-diff', 'Record sequence diff', 'Distinguish reordered records from added, removed and changed records', 31000],
  ['provenance-edge-audit', 'Provenance edge audit', 'Find broken, cyclic or undeclared edges in supplied provenance records', 44000],
  ['scope-boundary-audit', 'Scope boundary audit', 'Compare record scope labels with an explicit allowed scope, without inferring completeness', 37000],
  ['export-semantic-parity', 'Export semantic parity', 'Compare parsed before/after exports while preserving types, units and record identities', 38000],
] as const
const title = (s: string) => s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
const flat = z.record(z.string().min(1).max(64), z.union([z.string().max(512), z.number().finite(), z.boolean(), z.null()])).refine(r => Object.keys(r).length <= 64)
const draftInput = z.object({ dataClass: z.enum(['public', 'synthetic']), records: z.array(flat).max(500),
  comparisonRecords: z.array(flat).max(500).optional(), declaredFields: z.array(z.string().min(1).max(64)).min(1).max(64),
  sourceScope: z.string().min(1).max(400) }).strict()
const draftOutput = z.object({ recordCount: z.number().int().nonnegative(), findings: z.array(z.object({ recordIndex: z.number().int().nonnegative(),
  field: z.string().max(64), code: z.string().max(80) }).strict()).max(64), truncated: z.boolean(),
  completenessEstablished: z.literal(false), domainValidationEstablished: z.literal(false) }).strict()
export function proposedRecipes(): Omit<Endpoint, 'amount' | 'price_usdc'>[] {
  return Object.entries(FAMILIES).flatMap(([domain, categories]) => categories.flatMap(category => ACTIONS.map(([action, label, task]) => ({
    id: `${category}-${action}`, name: `${title(category)} — ${label}`,
    description: `${task} for ${category.replaceAll('-', ' ')}. Caller-supplied public/synthetic records only. Draft recipe; domain-specific fields, usefulness and overlap are not yet validated. No scientific, medical, legal or delivery certification.`,
    path: `/api/v1/${domain}/${category}/${action}`, method: 'POST' as const, domain: domain as Domain, category,
    tags: [domain, category, action, 'planned-recipe', 'record-quality'], schema: { input: z.toJSONSchema(draftInput), output: z.toJSONSchema(draftOutput) },
    estimated_compute_cost: action.includes('provenance') || action.includes('parity') ? .0015 : .0005,
    cost_basis: 'unmeasured-planning-assumption' as const, status: 'proposal' as const, schema_status: 'draft' as const,
    productionApproved: false, sourceReview: 'pending' as const,
  }))))
}
export function proposedPriceBase(id: string) {
  return (ACTIONS.find(([action]) => id.endsWith('-' + action))?.[3] ?? 25000) + 1292
}
