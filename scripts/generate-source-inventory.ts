import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import { alignmentFor } from '../lib/frontier-source-alignment.ts'
import { classifyInspectionDepth } from '../lib/inspection-depth.ts'
import {
  GOVERNANCE_MODEL, INFORMATION_DIMENSIONS, evaluateSourcePage,
  type BoundClaim, type InspectionDepth, type SourcePageCandidate,
} from '../lib/source-evidence-reference.ts'
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import batch12a from '../content/batch-12a/source-investigations.json' with { type: 'json' }
import batch12b from '../content/batch-12b/source-investigations.json' with { type: 'json' }

/**
 * The inspected-source inventory, and what it can honestly publish.
 *
 * Sources are the unit here rather than records, because a source is what was
 * actually opened. Forty of the 48 back exactly five records each, which is the
 * fingerprint of a template assignment rather than of five separate readings -
 * so the aggregate a source page can offer is bounded by what one reading of
 * one source supports, not by how many records point at it.
 */

const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
const active = observation.releases.filter((entry) => entry.status === 'active')
const releasedIds = new Set(active.map((entry) => entry.recordId))
const releasedPaths = new Set(active.map((entry) => entry.canonicalPath))
const records = [...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS]

/** Depth findings carried forward from the two research batches. */
const researched = new Map<string, { depth: InspectionDepth; mismatch: boolean; locator: string; rights: string }>()
for (const entry of batch12a.investigations as Record<string, unknown>[]) {
  const replacement = entry.candidateReplacement as Record<string, string> | null
  researched.set(String(entry.recordId), {
    depth: 'section-or-full-text',
    mismatch: entry.subjectAlignmentVerdict === 'mismatched',
    locator: String(entry.exactLocator ?? replacement?.exactLocator ?? ''),
    rights: String(entry.rightsBasis ?? replacement?.rightsBasis ?? ''),
  })
}
for (const source of batch12b.sources as Record<string, unknown>[]) {
  for (const recordId of source.records as string[]) {
    researched.set(recordId, {
      depth: source.inspectionDepth === 'section-or-full-text' ? 'section-or-full-text' : 'abstract-only',
      mismatch: source.verdict === 'subject-mismatch',
      locator: String(source.exactLocator ?? ''),
      rights: String(source.rightsBasis ?? ''),
    })
  }
}

interface SourceEntry {
  sourceId: string
  title: string
  authors: readonly string[]
  publisher: string | null
  publishedAt: string | null
  versionRelationship: string
  rightsBasis: string
  inspectionDepth: InspectionDepth
  exactLocators: readonly string[]
  boundRecords: readonly { recordId: string; revisionSha256: string; activeRelease: boolean; locator: string; statement: string }[]
  releasedRecordCount: number
  fullTextAccessible: boolean
  candidateSearchIntent: string
  duplicationRisk: 'none' | 'overlaps-record-page' | 'overlaps-sibling-source'
  identityConflicted: boolean
}

const byId = new Map<string, SourceEntry>()
for (const record of records) {
  const audit = alignmentFor(record.id)
  const evidence = (audit?.evidence ?? {}) as Record<string, unknown>
  if (evidence.sourceContentInspected !== true) continue
  const source = (record.sources ?? [])[0] as Record<string, unknown> | undefined
  if (!source) continue
  const sourceId = String(((source.identifiers ?? []) as Record<string, string>[])[0]?.value ?? source.url ?? source.title)
  const research = researched.get(record.id)
  const auditDepth = classifyInspectionDepth(String(evidence.inspectedContentLocation ?? ''))
  const depth: InspectionDepth = research?.depth
    ?? (auditDepth === 'section-or-full-text' ? 'section-or-full-text' : 'abstract-only')
  const rights = (source.rights ?? {}) as Record<string, unknown>

  const existing = byId.get(sourceId)
  const bound = {
    recordId: record.id,
    revisionSha256: digest(record),
    activeRelease: releasedIds.has(record.id),
    locator: research?.locator || String(source.exactLocator ?? ''),
    statement: String(((record.claims ?? []) as Record<string, string>[])[0]?.statement ?? ''),
  }
  if (existing) {
    existing.boundRecords = [...existing.boundRecords, bound]
    // The shallowest reading governs: one deep record does not make the source
    // deeply read for the others bound to it.
    if (depth !== 'section-or-full-text') existing.inspectionDepth = depth
    if (research?.mismatch) existing.identityConflicted = true
    continue
  }
  byId.set(sourceId, {
    sourceId,
    title: String(source.title ?? ''),
    authors: (source.authors ?? []) as string[],
    publisher: (source.publisher as string) ?? null,
    publishedAt: (source.publishedAt as string) ?? null,
    versionRelationship: research ? 'recorded in batch research' : 'version of record as cited',
    rightsBasis: research?.rights || String(rights.basis ?? ''),
    inspectionDepth: research?.mismatch ? 'source-mismatched' : depth,
    exactLocators: [String(source.exactLocator ?? '')].filter(Boolean),
    boundRecords: [bound],
    releasedRecordCount: 0,
    fullTextAccessible: depth === 'section-or-full-text',
    candidateSearchIntent: `What ${String(source.title ?? '').slice(0, 70)} establishes, and what it does not`,
    duplicationRisk: 'none',
    identityConflicted: Boolean(research?.mismatch),
  })
}

for (const entry of byId.values()) {
  entry.releasedRecordCount = entry.boundRecords.filter((bound) => bound.activeRelease).length
  entry.duplicationRisk = entry.releasedRecordCount === 1 ? 'overlaps-record-page' : 'none'
  // Derived from the settled depth, not from the first record seen. The depth
  // can be downgraded as shallower records join, and a stale accessibility flag
  // would then claim full text for a source only read at its abstract.
  entry.fullTextAccessible = entry.inspectionDepth === 'section-or-full-text'
}
const inventory = [...byId.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId))

/* ------------------------------------------------------- eligibility ----- */

const takenRoutes = new Set<string>()
const takenIntents = new Set<string>()
const sourceRoute = (sourceId: string) => `/knowledge/sources/${sourceId.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`

const verdicts = inventory.map((entry) => {
  // Only released claims are ever offered to the gate: an unreleased record is
  // not shrunk out of the page, it makes the page ineligible.
  const claims: BoundClaim[] = entry.boundRecords.map((bound) => ({
    recordId: bound.recordId, revisionSha256: bound.revisionSha256,
    activeRelease: bound.activeRelease, locator: bound.locator, statement: bound.statement,
  }))
  const deep = entry.inspectionDepth === 'section-or-full-text'
  const satisfies = deep && entry.releasedRecordCount >= 2 && entry.rightsBasis && entry.exactLocators.length > 0
    ? [...INFORMATION_DIMENSIONS]
    : [...INFORMATION_DIMENSIONS].filter((dimension) =>
      !(dimension === 'inspected-passages' && !deep)
      && !(dimension === 'claim-level-locators' && entry.exactLocators.length === 0)
      && !(dimension === 'rights-and-quotation-boundary' && !entry.rightsBasis)
      && !(dimension === 'supported-findings' && entry.releasedRecordCount < 2))
  const candidate: SourcePageCandidate = {
    sourceId: entry.sourceId,
    identityVerified: !entry.identityConflicted,
    inspectionDepth: entry.inspectionDepth,
    exactLocators: entry.exactLocators,
    rightsBasis: entry.rightsBasis,
    claims,
    satisfies,
    route: sourceRoute(entry.sourceId),
    searchIntent: entry.candidateSearchIntent,
    alignmentMismatch: entry.identityConflicted,
  }
  const verdict = evaluateSourcePage(candidate, takenRoutes, takenIntents, releasedPaths)
  if (verdict.eligible) { takenRoutes.add(candidate.route); takenIntents.add(candidate.searchIntent.toLowerCase()) }
  return { ...verdict, route: candidate.route, depth: entry.inspectionDepth, releasedRecordCount: entry.releasedRecordCount }
})

const blockedBy = (refusal: string) => verdicts.filter((verdict) => verdict.refusals.includes(refusal as never)).length
const eligible = verdicts.filter((verdict) => verdict.eligible)

/* ------------------------------------------------------------- pilot ----- */

const pilot = eligible
  .map((verdict) => {
    const entry = byId.get(verdict.sourceId)!
    return {
      sourceId: entry.sourceId, route: verdict.route, title: entry.title,
      releasedClaimsUsed: verdict.releasedClaimCount,
      exactLocators: entry.exactLocators,
      relatedReleasedRoutes: entry.boundRecords.filter((bound) => bound.activeRelease)
        .map((bound) => active.find((release) => release.recordId === bound.recordId)?.canonicalPath).filter(Boolean),
      informationDimensions: INFORMATION_DIMENSIONS.length,
      searchIntent: entry.candidateSearchIntent,
      duplicationCheck: entry.duplicationRisk,
      limitations: 'A projection of released record claims. It asserts nothing beyond them and claims no independent replication.',
      publicationBlockers: [],
      evidenceCoverage: `${verdict.releasedClaimCount} released claim(s) over ${entry.exactLocators.length} recorded locator(s)`,
    }
  })
  .sort((a, b) => b.releasedClaimsUsed - a.releasedClaimsUsed || a.sourceId.localeCompare(b.sourceId))
  .slice(0, 20)

mkdirSync('content/source-first', { recursive: true })
const write = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

write('content/source-first/source-inventory.json', {
  schemaVersion: 'maha-source-inventory/1.0',
  contentInspectedRecords: records.filter((record) =>
    ((alignmentFor(record.id)?.evidence ?? {}) as Record<string, unknown>).sourceContentInspected === true).length,
  uniqueSources: inventory.length,
  byDepth: inventory.reduce((counts: Record<string, number>, entry) => {
    counts[entry.inspectionDepth] = (counts[entry.inspectionDepth] ?? 0) + 1
    return counts
  }, {}),
  recordsPerSource: inventory.reduce((counts: Record<string, number>, entry) => {
    const key = String(entry.boundRecords.length)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {}),
  sources: inventory,
  boundary: 'A private inventory. Metadata verification is never recorded as inspected content, and no entry here is public.',
})
write('content/source-first/eligibility-report.json', {
  schemaVersion: 'maha-source-eligibility/1.0',
  governance: GOVERNANCE_MODEL,
  uniqueInspectedSources: inventory.length,
  eligibleNow: eligible.length,
  blocked: {
    onRelease: blockedBy('no-active-released-record') + blockedBy('unreleased-claim-present'),
    onShallowInspection: blockedBy('not-inspected-beyond-metadata'),
    onRights: blockedBy('no-rights-basis'),
    onMismatch: blockedBy('unresolved-alignment-mismatch') + blockedBy('identity-unverified'),
    duplicativeOrThin: blockedBy('duplicate-route') + blockedBy('duplicate-search-intent')
      + blockedBy('duplicates-an-existing-record-page') + blockedBy('missing-information-dimension'),
  },
  verdicts,
  note: 'One source does not equal one eligible page. A source backing a single released record duplicates that record page and is refused.',
})
write('content/source-first/pilot-contracts.json', {
  schemaVersion: 'maha-source-page-contract/1.0', public: false, released: false,
  pilotSize: pilot.length, requested: 20, contracts: pilot,
  boundary: 'Private page contracts. Nothing here is compiled, routed or public.',
})

process.stdout.write(`${JSON.stringify({
  contentInspectedRecords: records.filter((r) => ((alignmentFor(r.id)?.evidence ?? {}) as Record<string, unknown>).sourceContentInspected === true).length,
  uniqueSources: inventory.length,
  byDepth: inventory.reduce((c: Record<string, number>, e) => { c[e.inspectionDepth] = (c[e.inspectionDepth] ?? 0) + 1; return c }, {}),
  eligibleNow: eligible.length,
  pilot: pilot.length,
  blocked: {
    release: blockedBy('no-active-released-record') + blockedBy('unreleased-claim-present'),
    shallow: blockedBy('not-inspected-beyond-metadata'),
    rights: blockedBy('no-rights-basis'),
    mismatch: blockedBy('unresolved-alignment-mismatch') + blockedBy('identity-unverified'),
    thinOrDuplicate: blockedBy('duplicates-an-existing-record-page') + blockedBy('missing-information-dimension'),
  },
}, null, 2)}\n`)

/* ------------------------------- Part 7: source-first record candidates -- */

/**
 * Candidates the sources demonstrably support and the corpus does not hold.
 *
 * Each is drawn from a passage that was actually read in Batch 12A or 12B, and
 * each must survive a duplication check against every existing record title and
 * slug. A keyword match is not evidence that a record exists; a near-identical
 * subject is, and those are dropped.
 */
const CANDIDATES = [
  { slug: 'context-position-primacy-recency-curve', domainSlug: 'agentic-systems-mcp', kind: 'measurement',
    sourceId: '10.1162/tacl_a_00638', locator: 'Section 2.3 Results and Discussion; Figure 5',
    claim: 'In the multi-document question answering evaluation of Liu and colleagues, accuracy follows a U-shaped curve against the position of the relevant document, highest at the start and end of the context.',
    uncertainty: 'Observed in the models and task evaluated. The paper describes its mechanistic investigations as preliminary and establishes no cause.',
    rights: 'arXiv open access; short quotation with attribution' },
  { slug: 'pace-selection-coupled-to-phage-infectivity', domainSlug: 'biomolecular-engineering', kind: 'mechanism',
    sourceId: '10.1038/nature09929', locator: 'Main text statement of selection coupling to pIII expression',
    claim: 'In the PACE system described by Esvelt and colleagues, the activity being evolved is coupled to pIII expression, so that phage infectivity is the selection pressure.',
    uncertainty: 'Bounded to the described system. No claim is made about other continuous-evolution architectures.',
    rights: 'Nature author-manuscript terms; short quotation with attribution' },
  { slug: 'proteinmpnn-native-sequence-recovery-benchmark', domainSlug: 'biomolecular-engineering', kind: 'measurement',
    sourceId: '10.1126/science.add2187', locator: 'Abstract, reported native sequence recovery figures',
    claim: 'On the benchmark reported by Dauparas and colleagues, ProteinMPNN recovers 52.4 per cent of native sequence against 32.9 per cent for Rosetta.',
    uncertainty: 'A benchmark recovery figure, not an experimental success rate. The inspected passage states no single experimental success percentage.',
    rights: 'bioRxiv CC-BY-NC-ND 4.0; short quotation with attribution' },
  { slug: 'access-control-as-content-provenance-measure', domainSlug: 'agentic-systems-mcp', kind: 'concept',
    sourceId: '10.6028/NIST.AI.600-1', locator: 'Suggested Actions MS-2.7-004 and MS-2.7-005',
    claim: 'NIST AI 600-1 lists access controls among content-authentication measures supporting content provenance, alongside watermarking and cryptographic signatures.',
    uncertainty: 'The document treats access control as a provenance-verification measure. It does not address agent capability scoping or token delegation.',
    rights: 'US Government publication; short quotation with attribution' },
  { slug: 'magic-angle-bilayer-graphene-superconductivity', domainSlug: 'advanced-materials', kind: 'observation',
    sourceId: '10.1038/nature26160', locator: 'Abstract; reported zero-resistance states',
    claim: 'Cao and colleagues report tunable zero-resistance states in magic-angle twisted bilayer graphene with a critical temperature up to 1.7 kelvin.',
    uncertainty: 'Bounded to the twisted bilayer graphene devices measured. No claim is extended to other superlattices.',
    rights: 'arXiv nonexclusive distribution licence; short quotation with attribution' },
  { slug: 'senolytic-cell-type-selectivity', domainSlug: 'longevity-metabolism', kind: 'comparison',
    sourceId: '10.1111/acel.12344', locator: "Section 'The senescent transcriptome and anti-apoptotic pathways'; Figure 1A-C",
    claim: 'In the models reported by Zhu and colleagues, dasatinib preferentially eliminated senescent fat cell progenitors while quercetin was more effective against senescent endothelial cells.',
    uncertainty: 'Reported in mouse and cell models. The authors state no human clinical outcomes are established.',
    rights: 'Creative Commons Attribution; short quotation with attribution' },
  { slug: 'feature-visualization-high-frequency-artefacts', domainSlug: 'mechanistic-interpretability', kind: 'method',
    sourceId: '10.23915/distill.00007', locator: 'Feature visualization by optimization sections',
    claim: 'Olah and colleagues report that naive optimization for feature visualization produces high-frequency adversarial patterns rather than interpretable images.',
    uncertainty: 'A property of unregularised optimization as described. It establishes nothing about inactive or dead units.',
    rights: 'Creative Commons Attribution CC-BY 4.0; short paraphrase with attribution' },
  { slug: 'interlayer-exciton-density-phase-transitions', domainSlug: 'advanced-materials', kind: 'observation',
    sourceId: '2001.03812', locator: 'Abstract and reported density thresholds',
    claim: 'Wang and colleagues report that interlayer excitons in a MoSe2/WSe2 heterobilayer pass through density-dependent phases, with a Mott transition confirmed by photoconductivity.',
    uncertainty: 'Bounded to the measured stack. Sustained exciton condensates are explicitly not established.',
    rights: 'arXiv nonexclusive distribution licence; short quotation with attribution' },
]

const existingSlugs = new Set(records.map((record) => String(record.slug ?? '')))
const existingTitles = new Set(records.map((record) => String(record.title ?? '').toLowerCase()))
const tokens = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3))
const overlaps = (slug: string) => {
  const candidate = tokens(slug)
  for (const record of records) {
    const against = tokens(String(record.slug ?? ''))
    const shared = [...candidate].filter((token) => against.has(token)).length
    // A near-identical subject, not a shared keyword. Three or more distinctive
    // tokens in common with an existing slug is treated as a restatement.
    if (shared >= 3) return String(record.id)
  }
  return null
}

const recordCandidates = CANDIDATES.map((candidate) => {
  const duplicateOf = existingSlugs.has(candidate.slug) || existingTitles.has(candidate.claim.toLowerCase().slice(0, 40))
    ? 'exact-slug-or-title' : overlaps(candidate.slug)
  const body = { ...candidate, active: false, canonical: false, duplicateOf }
  return { ...body, candidateRevisionSha256: digest(body) }
})
const admissible = recordCandidates.filter((candidate) => candidate.duplicateOf === null)

write('content/source-first/record-candidates.json', {
  schemaVersion: 'maha-source-first-candidate/1.0', public: false, canonical: false, active: false,
  proposed: recordCandidates.length, admissible: admissible.length,
  rejectedAsDuplicate: recordCandidates.length - admissible.length,
  candidates: recordCandidates,
  duplicationRule: 'An exact slug or title match, or three or more distinctive tokens shared with an existing record slug, is treated as a restatement rather than a new record.',
  boundary: 'Private, noncanonical candidates bound to passages that were actually read. None is a record, none is released, and none is public.',
})
process.stdout.write(`${JSON.stringify({ recordCandidates: recordCandidates.length, admissible: admissible.length }, null, 2)}\n`)
