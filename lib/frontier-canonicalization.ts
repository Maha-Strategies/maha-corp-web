import {
  FRONTIER_DOMAIN_GRAPH_RECORDS,
  FRONTIER_DOMAIN_GRAPH_RECORDS_BY_DOMAIN,
  FRONTIER_EPISTEMIC_DOMAINS,
} from './frontier-domain-graphs.ts'
import { epistemicRecordPath, epistemicReviewTargetHash } from './epistemic-publication.ts'

export const FRONTIER_CANARY_VERSION = 'frontier-canonicalization-canary/1.0' as const
export const FRONTIER_CANARY_RECORDS_PER_DOMAIN = 5 as const

export const FRONTIER_CANARY_RECORDS = FRONTIER_EPISTEMIC_DOMAINS.flatMap((domain) => (
  [...FRONTIER_DOMAIN_GRAPH_RECORDS_BY_DOMAIN[domain.slug]].slice(0, FRONTIER_CANARY_RECORDS_PER_DOMAIN)
))

const canaryIds = new Set(FRONTIER_CANARY_RECORDS.map((record) => record.id))

export const FRONTIER_CANARY_CONTROL_RECORDS = FRONTIER_DOMAIN_GRAPH_RECORDS.filter((record) => !canaryIds.has(record.id))

export const FRONTIER_CANARY_MANIFEST = {
  schemaVersion: FRONTIER_CANARY_VERSION,
  domains: FRONTIER_EPISTEMIC_DOMAINS.map((domain) => ({
    domainSlug: domain.slug,
    canary: FRONTIER_CANARY_RECORDS
      .filter((record) => record.domainSlug === domain.slug)
      .map((record) => ({
        recordId: record.id,
        title: record.title,
        targetSha256: epistemicReviewTargetHash(record),
        publicPath: epistemicRecordPath(record),
        sourceIds: record.sources.map((source) => source.id),
      })),
    controls: FRONTIER_CANARY_CONTROL_RECORDS.filter((record) => record.domainSlug === domain.slug).length,
  })),
  counts: {
    domains: FRONTIER_EPISTEMIC_DOMAINS.length,
    records: FRONTIER_CANARY_RECORDS.length,
    controls: FRONTIER_CANARY_CONTROL_RECORDS.length,
  },
  boundary: 'This manifest preselects five exact-hash records per frontier domain. Selection is fixed before review and publication outcomes; the remaining 200 records are negative publication controls.',
} as const

if (FRONTIER_CANARY_MANIFEST.counts.domains !== 8 || FRONTIER_CANARY_MANIFEST.counts.records !== 40 || FRONTIER_CANARY_MANIFEST.counts.controls !== 200) {
  throw new Error('The frontier canary must remain an exact 8 × 5 cohort with 200 controls.')
}

for (const domain of FRONTIER_CANARY_MANIFEST.domains) {
  if (domain.canary.length !== FRONTIER_CANARY_RECORDS_PER_DOMAIN) throw new Error(`${domain.domainSlug} must contribute exactly five canary records.`)
}

export const FRONTIER_CANARY_BOUNDARY = 'Canonical means the declared machine verification, internal editorial protocol, and separate owner release decision passed for one exact hash. It does not mean external expert endorsement, scientific consensus, or demonstrated commercial readiness.'
