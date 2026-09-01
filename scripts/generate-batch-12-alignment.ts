import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import { alignmentBlockers, alignmentFor } from '../lib/frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import { hasMalformedJoin, repairIsFormattingOnly, repairScopeJoin } from '../lib/scope-join-repair.ts'
import projection from '../content/review/exact-revision-projection.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }

/**
 * Batch 12 selection, and the scope-join impact.
 *
 * Selection is scored rather than quota'd: a domain quota would pick records
 * that balance a table, and what actually matters is which records unlock other
 * work. The score is deterministic and its components are reported, so a reader
 * can disagree with the weighting rather than with an opaque ranking.
 */

const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`

const active = observation.releases.filter((entry) => entry.status === 'active')
const released = new Set(active.map((entry) => entry.recordId))
const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((record) => [record.id, record]))
const clear = (id: string) => pilotAlignmentFor(id) ? isPilotAlignmentClear(id) : alignmentBlockers(id).length === 0

const rows = projection.projections as { recordId: string; classification: string }[]
/**
 * The release-ready set as it stood before this sprint's reclassification.
 *
 * Frozen as a literal rather than read from the environment or recomputed, so
 * an upgrade is named against a fixed baseline and regeneration is byte-stable.
 * These thirty stay release-ready; the sprint adds to them and demotes none.
 */
const PRIOR_READY: ReadonlySet<string> = new Set([
  'urn:maha:record:agentic-systems-mcp-mcp-session-lifecycle',
  'urn:maha:record:biomolecular-engineering-crude-extract-cell-free-systems',
  'urn:maha:record:biomolecular-engineering-phage-assisted-continuous-evolution',
  'urn:maha:record:biomolecular-engineering-purified-component-expression-systems',
  'urn:maha:record:biomolecular-engineering-selection-pressure-coupling',
  'urn:maha:record:critical-supply-chains-gallium-bauxite-byproduct-flow',
  'urn:maha:record:critical-supply-chains-gallium-zinc-processing-byproduct',
  'urn:maha:record:critical-supply-chains-germanium-zinc-refining-flow',
  'urn:maha:record:critical-supply-chains-niobium-ferroniobium-production',
  'urn:maha:record:fusion-plasma-systems-laser-target-coupling',
  'urn:maha:record:fusion-plasma-systems-shattered-pellet-injection',
  'urn:maha:record:fusion-plasma-systems-stellarator-field-optimization',
  'urn:maha:record:fusion-plasma-systems-stellarator-magnetic-coils',
  'urn:maha:record:longevity-metabolism-apoptosis-in-senescent-cells',
  'urn:maha:record:longevity-metabolism-atp-linked-respiration',
  'urn:maha:record:longevity-metabolism-cellular-senescence-markers',
  'urn:maha:record:longevity-metabolism-lifespan-versus-healthspan-endpoints',
  'urn:maha:record:longevity-metabolism-nad-consumption-by-parps',
  'urn:maha:record:longevity-metabolism-nampt-rate-limiting-step',
  'urn:maha:record:longevity-metabolism-nmn-and-nr-precursors',
  'urn:maha:record:longevity-metabolism-nmnat-compartmentalization',
  'urn:maha:record:longevity-metabolism-oxygen-consumption-rate',
  'urn:maha:record:longevity-metabolism-senescent-cell-clearance',
  'urn:maha:record:longevity-metabolism-sirtuin-nad-dependence',
  'urn:maha:record:longevity-metabolism-translation-to-human-outcomes',
  'urn:maha:record:mechanistic-interpretability-feature-activation-maximization',
  'urn:maha:record:neurotechnology-bci-channelrhodopsin-photocurrent-kinetics',
  'urn:maha:record:neurotechnology-bci-motor-intention-decoding',
  'urn:maha:record:neurotechnology-bci-opsin-spectral-sensitivity',
  'urn:maha:record:neurotechnology-bci-optogenetic-channelrhodopsin',
])
const reviseIds = rows.filter((row) => row.classification === 'revise-and-rereview').map((row) => row.recordId).sort()
const readyIds = rows.filter((row) => row.classification === 'release-ready').map((row) => row.recordId).sort()

/* -------------------------------------------- Part 6: scope-join impact -- */

const scopeImpact = [...records.values()]
  .map((record) => {
    const claims = (record.claims ?? []) as { scope?: string }[]
    const affected = claims.filter((claim) => hasMalformedJoin(String(claim.scope ?? '')))
    if (affected.length === 0) return null
    const repaired = {
      ...record,
      claims: claims.map((claim) => ({ ...claim, scope: repairScopeJoin(String(claim.scope ?? '')) })),
    }
    const formattingOnly = claims.every((claim) =>
      repairIsFormattingOnly(String(claim.scope ?? ''), repairScopeJoin(String(claim.scope ?? ''))))
    const current = digest(record)
    const after = digest(repaired)
    return {
      recordId: record.id,
      claimsRepaired: affected.length,
      formattingOnly,
      currentRevisionSha256: current,
      repairedRevisionSha256: after,
      digestChanges: current !== after,
      invalidates: [
        ...(readyIds.includes(record.id) ? ['exact-revision-review' as const] : []),
        ...(released.has(record.id) ? ['active-canonical-release' as const] : []),
      ],
    }
  })
  .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  .sort((a, b) => a.recordId.localeCompare(b.recordId))

/* ------------------------------------------ Part 3: deterministic scoring */

/**
 * What a record unlocks if its alignment is repaired.
 *
 * Every component is a property of the record itself, so the ranking is
 * reproducible and arguable. Nothing here scores a record for belonging to an
 * under-represented domain: that would select for table balance rather than for
 * consequence. Domain spread is reported after the fact instead.
 */
const DOMAIN_CLUSTER = new Map<string, number>()
for (const record of records.values()) {
  DOMAIN_CLUSTER.set(record.domainSlug, (DOMAIN_CLUSTER.get(record.domainSlug) ?? 0) + 1)
}

function unlockScore(recordId: string) {
  const record = records.get(recordId)!
  const audit = alignmentFor(recordId)
  const evidence = (audit?.evidence ?? {}) as Record<string, unknown>
  const bridges = (record.bridges ?? []) as unknown[]
  const sections = (record.sections ?? []) as unknown[]
  const claims = (record.claims ?? []) as { boundary?: string }[]

  const components = {
    // A record other records already point at repairs a link neighbourhood,
    // not just itself.
    bridgeEndpoints: Math.min(bridges.length, 5) * 4,
    // Depth the substantial-page compiler can actually use.
    sectionDepth: Math.min(sections.length, 4) * 3,
    // A large domain means the repair lands inside an existing cluster.
    domainClusterSize: Math.min(DOMAIN_CLUSTER.get(record.domainSlug) ?? 0, 30) / 3,
    // Already inspected: the remaining work is smaller.
    contentInspected: evidence.sourceContentInspected === true ? 6 : 0,
    // A registered identifier makes independent confirmation possible at all.
    resolvableIdentifier: String((audit as Record<string, unknown> | null)?.sourceIdentifier ?? '').length > 0 ? 5 : 0,
    // Boundaries already written are review work not repeated.
    boundedClaims: claims.every((claim) => String(claim.boundary ?? '').trim().length > 0) ? 4 : 0,
    // A record whose subject is already partly supported is nearer to clear.
    subjectPartlySupported: evidence.subjectAligned === 'partially-supported' ? 5
      : evidence.subjectAligned === 'supported' ? 8 : 0,
  }
  const total = Object.values(components).reduce((sum, value) => sum + value, 0)
  return { components, total: Math.round(total * 100) / 100 }
}

const blocked = [...records.keys()]
  .filter((id) => !clear(id) && !released.has(id))
  .sort()
const scored = blocked
  .map((recordId) => ({ recordId, domainSlug: records.get(recordId)!.domainSlug, ...unlockScore(recordId) }))
  // Ties broken by record id, so the ranking is total and reproducible.
  .sort((a, b) => b.total - a.total || a.recordId.localeCompare(b.recordId))

const selected = scored.slice(0, 43)

/* ------------------------------------------------------------- artifacts */

mkdirSync('content/batch-12', { recursive: true })
const write = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

write('content/batch-12/scope-join-impact.json', {
  schemaVersion: 'maha-scope-join-impact/1.0',
  generator: 'lib/frontier-domain-graphs.ts builds claim scope by interpolating an already-terminated exactLocator before " in “".',
  applied: false,
  affectedRecords: scopeImpact.length,
  totalRecords: records.size,
  formattingOnly: scopeImpact.every((entry) => entry.formattingOnly),
  digestChanges: scopeImpact.filter((entry) => entry.digestChanges).length,
  wouldInvalidate: {
    exactRevisionReviews: scopeImpact.filter((entry) => entry.invalidates.includes('exact-revision-review')).length,
    activeCanonicalReleases: scopeImpact.filter((entry) => entry.invalidates.includes('active-canonical-release')).length,
  },
  requiresExactRevisionReevaluation: scopeImpact.filter((entry) => entry.digestChanges).map((entry) => entry.recordId),
  whyNotApplied: 'Applying the correction moves every affected revision digest. A digest is what an exact-revision review and an active canonical release are both bound to, so applying it would invalidate the reviews of the release-ready cohort and desync live releases from the records they name. Activation is a governed migration that must re-review what it touches.',
  impact: scopeImpact,
  boundary: 'A computed correction, not an applied one. No record, review or release was changed.',
})

write('content/batch-12/cohort-manifest.json', {
  schemaVersion: 'maha-batch-12-cohort/1.0',
  selectionBasis: 'Deterministic unlock score over record properties. No domain quota; spread is reported, not enforced. Ties broken by record id.',
  scoreComponents: {
    bridgeEndpoints: 'min(bridges,5) x 4 - a record others point at repairs a neighbourhood',
    sectionDepth: 'min(sections,4) x 3 - depth the page compiler can use',
    domainClusterSize: 'min(domain size,30) / 3 - lands inside an existing cluster',
    contentInspected: '6 if source content was already inspected',
    resolvableIdentifier: '5 if the audit carries a registered identifier',
    boundedClaims: '4 if every claim already states a boundary',
    subjectPartlySupported: '8 supported, 5 partially-supported, else 0',
  },
  // The depth cohort started at seven. Three were upgraded by reclassifying
  // evidence their audits already held, so four still need a full text. Both
  // numbers are carried: reporting only the four would lose the work done.
  depthRemediation: {
    cohortAtStart: 7,
    upgraded: readyIds.filter((id) => !PRIOR_READY.has(id)).length,
    remaining: reviseIds.length,
    recordIds: reviseIds,
  },
  alignmentAudit: { count: selected.length, records: selected },
  combinedCohort: 7 + selected.length,
  blockedPoolSize: blocked.length,
  domainSpread: Object.fromEntries([...selected.reduce((map, entry) => map.set(entry.domainSlug, (map.get(entry.domainSlug) ?? 0) + 1), new Map<string, number>())].sort()),
  inspected: 0,
  proposalsGenerated: 0,
  boundary: 'A selection. No source has been re-inspected, no binding proposed, and no decision produced for these records in this sprint.',
})

/* ------------------------------ Part 2: depth remediation of the seven --- */

write('content/batch-12/depth-remediation.json', {
  schemaVersion: 'maha-depth-remediation/1.0',
  cohortAtStart: 7,
  method: 'Re-evaluated the recorded inspection depth of each record. No new document was retrieved, and no record was upgraded for having found one.',
  finding: 'The prior classifier matched /abstract|metadata only/ anywhere in the recorded inspection location, so an audit reading "abstract, Methods, Discussion, in-vivo results" - a list of sections that were read - was classified as having read only the abstract. Three records were sent back for work their own audit records as already done.',
  correction: 'Depth is now read from an explicit limitation ("abstract only", "metadata only", "landing page", "publisher-served abstract", "indexed abstract") rather than from keyword presence. A keyword list was tried and rejected: it missed "SS2.1-2.3 and SS3, pp. 311-347" and "What Is Ignition, milestones", which are more precise locators than any list would hold.',
  upgraded: readyIds.filter((id) => !PRIOR_READY.has(id)),
  remainInRevise: rows.filter((row) => row.classification === 'revise-and-rereview').map((row) => row.recordId),
  remainInReviseReason: 'Each records an explicitly abstract-only or landing-page inspection. Claim-to-passage support cannot be approved on an abstract, and no full text was retrieved in this sprint, so they stay in revise.',
  boundary: 'A reclassification of existing evidence. No source was newly retrieved, inspected or rebound.',
})

process.stdout.write(`${JSON.stringify({
  scopeJoin: {
    affected: scopeImpact.length,
    formattingOnly: scopeImpact.every((entry) => entry.formattingOnly),
    wouldInvalidateReviews: scopeImpact.filter((entry) => entry.invalidates.includes('exact-revision-review')).length,
    wouldDesyncReleases: scopeImpact.filter((entry) => entry.invalidates.includes('active-canonical-release')).length,
    applied: false,
  },
  batch12: { blockedPool: blocked.length, selected: selected.length, depthRemediation: reviseIds.length, combined: reviseIds.length + selected.length },
}, null, 2)}\n`)
