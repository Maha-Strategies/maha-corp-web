import { createHash } from 'node:crypto'
import { openSync, readSync, closeSync } from 'node:fs'
import { join } from 'node:path'
import { civicDigest } from '../civic/receipt.ts'
import { openBookEditions } from '../open-book-editions.ts'
import { objectSchema as o, arraySchema as a, textSchema as t, enumSchema as e,
  ID_SCHEMA as ID, HASH_SCHEMA as HASH, INTEGER_SCHEMA as INT, UTC_SCHEMA as UTC,
  schemaAccepts, type MicroSchema } from './micro-schema.ts'

/** Stateless bounded calculations; only allowlisted local original-book microexcerpt reads. */
type Spec = { amount: string; title: string; description: string; category: string;
  inputSchema: MicroSchema; sample: Record<string, unknown>; resultSchema: MicroSchema; paidContent?: true }
const n = (minimum: number, maximum: number): MicroSchema => ({ type: 'integer', minimum, maximum })
const bool: MicroSchema = { type: 'boolean' }
const yes: MicroSchema = { type: 'boolean', enum: [true] }
const no: MicroSchema = { type: 'boolean', enum: [false] }
const nullable = (s: MicroSchema): MicroSchema => ({ oneOf: [s, { type: 'null' }] })
const optional = (properties: Record<string, MicroSchema>, required: string[]): MicroSchema => ({ ...o(properties), required })
const rawText = (maxLength: number): MicroSchema => ({ type: 'string', minLength: 1, maxLength,
  pattern: '^[^\\u0000-\\u0009\\u000b-\\u001f\\u007f]+$' })
const lineText: MicroSchema = { ...rawText(4000), minLength: 0, pattern: '^[^\\u0000-\\u001f\\u007f]*$' }
const decimal: MicroSchema = { type: 'string', pattern: '^-?(0|[1-9][0-9]{0,11})(\\.[0-9]{1,9})?$', maxLength: 23 }
const expandedInteger: MicroSchema = { type: 'string', pattern: '^(0|-?[1-9][0-9]{0,20})$', maxLength: 22 }
const dateSchema: MicroSchema = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', maxLength: 10 }
const contractField = e('scope', 'amountMinor', 'currency', 'deliveryDate', 'milestone', 'publicReference')
const hex: MicroSchema = { type: 'string', pattern: '^[a-f0-9]{64}$', maxLength: 64 }
const civicId: MicroSchema = { type: 'string', pattern: '^[a-z0-9-]{1,100}$', maxLength: 100 }
const bookIds = Object.keys(openBookEditions)
const book = e(...bookIds)
const env = (fields: Record<string, MicroSchema>) => o({ dataClass: e('public', 'synthetic'), ...fields })
const result = (fields: Record<string, MicroSchema>) => o({ serviceId: ID, dataClass: e('public', 'synthetic'),
  limitations: a(t(600), 1, 8), ...fields })
const ids = (min = 0, max = 32) => a(ID, min, max)
const checkpoint = o({ ledgerId: civicId, sequence: n(0, 1_000_000_000), digest: hex })
// Safe subset of civic-ledger-1: public organizational decisions, never donor transfers.
const civicSource = optional({ citation: t(300), url: { type: 'string', pattern: '^https://[^\\s<>]+$', maxLength: 1000 }, digest: hex }, ['citation', 'url'])
const decision = optional({ id: civicId, occurredAt: UTC, description: { ...t(1000), minLength: 5 }, evidence: a(civicSource, 1, 8),
  kind: e('decision'), rationale: { ...t(2000), minLength: 5 }, supersedes: civicId,
  category: e('infrastructure', 'research', 'public-disbursement'),
  settlementChannel: e('human', 'machine-to-machine', 'unspecified') },
['id', 'occurredAt', 'description', 'evidence', 'kind', 'rationale'])
const receipt = o({ version: e('civic-ledger-1'), ledgerId: civicId, sequence: n(1, 1_000_000_000),
  previousDigest: hex, event: decision, digest: hex })
const licensing = { author: e('Mayone Maha Rajan'), license: e('original-maha-commercial-microcontent-v1'),
  originalMahaAuthored: yes, commercialUseAuthorized: yes, redistributionAuthorized: yes, thirdPartyTextIncluded: no }
const microSource = o({ id: ID, bookId: book, editionId: ID, sectionId: ID, locator: t(200), text: rawText(2000), ...licensing })
const sourceOutput = o({ id: ID, bookId: book, editionId: ID, sectionId: ID, locator: t(200), text: rawText(2000),
  author: e('Mayone Maha Rajan'), license: t(300), textSha256: HASH,
  sourceBasis: e('caller-original-microcontent', 'repository-original-microexcerpt'),
  repositoryFile: nullable(t(200)), repositoryFileSha256: nullable(HASH) })
const concept = o({ id: ID, label: t(160), sourceIds: ids(1, 8) })
const manuscriptSection = o({ id: ID, title: t(160), locator: t(200), text: rawText(4000) })
const manuscript = o({ editionId: ID, sections: a(manuscriptSection, 1, 16) })
const briefSource = o({ id: ID, citation: t(300), locator: t(200), digest: HASH })
const statement = o({ id: ID, text: t(1600), sourceIds: ids(1, 8) })
const briefDocument = o({ title: t(160), sources: a(briefSource, 1, 16), plans: a(statement, 0, 16), results: a(statement, 0, 16) })
const edition = o({ id: ID, bookId: book, format: e('declared-markdown', 'declared-epub', 'declared-pdf'), digest: HASH })
const position = o({ raMicrodeg: n(0, 359_999_999), decMicrodeg: n(-90_000_000, 90_000_000) })
// Original authorial paragraphs only; no cited third-party passages, research tables or clinical protocols.
// Selection fails closed if the paragraph/section markers disappear; exact current file/text hashes accompany delivery.
const repositorySources = {
  'volcano-frame': { bookId: 'the-volcanic-engine', sectionId: 'introduction',
    file: 'content/books/the-volcanic-engine/The-Volcanic-Engine-Introduction.md',
    heading: '## The frame we inherited', start: 'But the disaster frame has a defect, and the defect is not that it is false.' },
  'volcano-register': { bookId: 'the-volcanic-engine', sectionId: 'introduction',
    file: 'content/books/the-volcanic-engine/The-Volcanic-Engine-Introduction.md',
    heading: '## On smuggling, and a story this book had to kill', start: 'I make that division carefully, because the standing temptation in a book like this one is to smuggle' },
  'orbital-map': { bookId: 'the-orbital-mind', sectionId: 'maha-framework',
    file: 'content/books/the-orbital-mind/the-orbital-mind.md',
    heading: '## From Systems to Minds', start: 'The solar system enters the book in a different role.' },
  'orbital-boundary': { bookId: 'the-orbital-mind', sectionId: 'introduction',
    file: 'content/books/the-orbital-mind/the-orbital-mind.md',
    heading: '## IV. Why the Sky?', start: 'The honest answer begins with a concession. There is no evidentiary bridge from astronomy to psychology' },
} as const
const repositoryInput = (crossBook: boolean) => env({ commercialUseAuthorized: yes, originalMahaOnly: yes,
  repositorySourceIds: a(crossBook ? e(...Object.keys(repositorySources)) : e('volcano-frame', 'volcano-register'), crossBook ? 2 : 1, 4),
  concepts: a(concept, 1, 8), ...(crossBook ? { crosslinks: a(o({ fromConceptId: ID, toConceptId: ID, relation: e('authorial-metaphor', 'declared-comparison') }), 0, 16) } : {}) })
const spec = (amount: string, title: string, description: string, category: string,
  inputSchema: MicroSchema, sample: Record<string, unknown>, fields: Record<string, MicroSchema>): Spec =>
  ({ amount, title, description, category, inputSchema, sample: { dataClass: 'synthetic', ...sample }, resultSchema: result(fields) })

export const SPECS: Record<string, Spec> = {
  'spatial-adjacency-check': spec('29500', 'Declared spatial adjacency check',
    'Compare bounded room requirements with supplied topology; report unknown and contradictory declarations, not architectural approval.', 'architecture',
    env({ rooms: ids(1, 32), topology: a(o({ from: ID, to: ID, adjacent: bool }), 0, 64),
      requirements: a(o({ id: ID, from: ID, to: ID, relation: e('adjacent', 'separate') }), 1, 64) }),
    { rooms: ['studio', 'court'], topology: [{ from: 'studio', to: 'court', adjacent: true }],
      requirements: [{ id: 'r1', from: 'studio', to: 'court', relation: 'adjacent' }] },
    { checks: a(o({ id: ID, from: ID, to: ID, relation: e('adjacent', 'separate'),
      status: e('satisfied', 'violated', 'unknown', 'contradictory') }), 1, 64), contradictoryPairs: a(t(161), 0, 64) }),
  'experiment-plan-completeness': spec('37000', 'Experiment plan declaration completeness',
    'Check presence of baseline, primary measure, acceptance threshold and bounded stopping rule; no efficacy or statistical validation.', 'research',
    env({ baseline: nullable(t(600)), primaryMeasure: o({ name: nullable(t()), unit: nullable(t(80)) }),
      acceptance: o({ operator: e('gte', 'lte', 'eq'), threshold: nullable(decimal) }),
      stopRule: o({ maxTrials: nullable(n(1, 1_000_000)), abortCondition: nullable(t(600)) }) }),
    { baseline: 'Synthetic baseline run', primaryMeasure: { name: 'latency', unit: 'ms' },
      acceptance: { operator: 'lte', threshold: '100' }, stopRule: { maxTrials: 50, abortCondition: 'Instrument unavailable' } },
    { complete: bool, checks: a(o({ component: e('baseline', 'primaryMeasure', 'acceptance', 'stopRule'),
      status: e('declared', 'missing'), missingFields: a(t(80), 0, 2) }), 4, 4) }),
  'partnership-milestone-review': spec('61000', 'Partnership milestone declaration review',
    'Review dependency cycles, declared evidence and completion prerequisites; no partner verification or evidence entailment.', 'research',
    env({ evidence: a(o({ id: ID, reference: nullable(t(300)) }), 0, 32),
      milestones: a(o({ id: ID, dependencies: ids(0, 16), requiredEvidence: ids(0, 16),
        status: e('planned', 'claimed-complete') }), 1, 32) }),
    { evidence: [{ id: 'e1', reference: 'Synthetic meeting record' }],
      milestones: [{ id: 'm1', dependencies: [], requiredEvidence: ['e1'], status: 'claimed-complete' }] },
    { cycleIds: ids(), milestones: a(o({ id: ID, status: e('blocked', 'incomplete', 'planned', 'declared-complete'),
      missingEvidenceIds: ids(0, 16), unmetDependencyIds: ids(0, 16) }), 1, 32) }),
  'research-opportunity-comparison': spec('69000', 'Weighted research opportunity comparison',
    'Deterministic supplied-score ranking and one-criterion-at-a-time additive weight sensitivity, not research prediction.', 'research',
    env({ criteria: a(o({ id: ID, weight: n(1, 10000), direction: e('maximize', 'minimize') }), 1, 12),
      options: a(o({ id: ID, scores: a(o({ criterionId: ID, value: n(0, 1000) }), 1, 12) }), 1, 16),
      sensitivityDelta: n(0, 10000) }),
    { criteria: [{ id: 'benefit', weight: 2, direction: 'maximize' }, { id: 'cost', weight: 1, direction: 'minimize' }],
      options: [{ id: 'a', scores: [{ criterionId: 'benefit', value: 900 }, { criterionId: 'cost', value: 400 }] },
        { id: 'b', scores: [{ criterionId: 'benefit', value: 700 }, { criterionId: 'cost', value: 100 }] }], sensitivityDelta: 1 },
    { ranking: a(o({ optionId: ID, weightedSum: n(0, 240_000_000), totalWeight: n(1, 130000), score: decimal, rank: n(1, 16) }), 1, 16),
      winnerIds: ids(1, 16), sensitivity: a(o({ criterionId: ID, adjustment: e('minus', 'plus'), effectiveWeight: n(0, 20000),
        totalWeight: n(1, 130000), winnerIds: ids(1, 16) }), 2, 24) }),
  'evidence-brief-export': spec('109000', 'Source-bound evidence brief export',
    'Export caller-supplied public/synthetic plans and results as closed JSON and escaped plain-text Markdown with exact declared source references.', 'research',
    env({ title: t(160), protectedDatasetIncluded: no, sourceTextIncluded: no, sources: a(briefSource, 1, 16),
      plans: a(statement, 0, 16), results: a(statement, 0, 16) }),
    { title: 'Synthetic research brief', protectedDatasetIncluded: false, sourceTextIncluded: false,
      sources: [{ id: 's1', citation: 'Synthetic study record', locator: 'section 1', digest: 'sha256:' + '1'.repeat(64) }],
      plans: [{ id: 'p1', text: 'Compare declared alternatives', sourceIds: ['s1'] }],
      results: [{ id: 'r1', text: 'Synthetic comparison completed', sourceIds: ['s1'] }] },
    { document: briefDocument, markdown: rawText(60000), json: rawText(60000), jsonSha256: HASH }),
  'public-amendment-lineage': spec('56000', 'Public contract amendment lineage',
    'Map nonpersonal public revision IDs, declared field changes and effective dates; no legal effect or contract interpretation.', 'public-finance',
    env({ publicNonpersonalRecords: yes, contractId: ID,
      revisions: a(o({ id: ID, parentId: nullable(ID), effectiveDate: dateSchema,
        changes: a(o({ field: contractField, before: nullable(t(300)), after: nullable(t(300)) }), 0, 16) }), 1, 32) }),
    { publicNonpersonalRecords: true, contractId: 'contract-1', revisions: [
      { id: 'v1', parentId: null, effectiveDate: '2026-01-01', changes: [] },
      { id: 'v2', parentId: 'v1', effectiveDate: '2026-02-01', changes: [{ field: 'scope', before: 'A', after: 'B' }] }] },
    { contractId: ID, lineage: a(o({ id: ID, parentId: nullable(ID), effectiveDate: dateSchema,
      changedFields: a(contractField, 0, 16), issues: a(e('missing-parent', 'cycle', 'effective-date-before-parent', 'before-value-mismatch'), 0, 4) }), 1, 32) }),
  'spending-variance-bridge': spec('55000', 'Aggregate spending variance bridge',
    'Exact integer-minor-unit period arithmetic with unknown propagation; never treat missing amounts as zero.', 'public-finance',
    env({ aggregateOnly: yes, currency: e('USD', 'LKR', 'EUR'),
      periods: o({ before: ID, after: ID }), lines: a(o({ id: ID, beforeMinor: nullable(INT), afterMinor: nullable(INT) }), 1, 32) }),
    { aggregateOnly: true, currency: 'USD', periods: { before: 'q1', after: 'q2' },
      lines: [{ id: 'research', beforeMinor: '100', afterMinor: '125' }] },
    { currency: e('USD', 'LKR', 'EUR'), periods: o({ before: ID, after: ID }),
      lines: a(o({ id: ID, beforeMinor: nullable(INT), afterMinor: nullable(INT), deltaMinor: nullable(expandedInteger) }), 1, 32),
      beforeTotalMinor: nullable(expandedInteger), afterTotalMinor: nullable(expandedInteger), netDeltaMinor: nullable(expandedInteger),
      knownLineDeltaMinor: expandedInteger, unknownLineIds: ids() }),
  'transparency-hash-chain-verification': spec('38500', 'Public decision hash-chain verification',
    'Verify a bounded civic-ledger-1 public organizational decision suffix against declared checkpoints, including expected-head truncation detection. No Merkle proof or anchor.', 'public-finance',
    env({ publicNonpersonalRecords: yes, preceding: checkpoint, expectedHead: checkpoint, receipts: a(receipt, 0, 32) }),
    { publicNonpersonalRecords: true, preceding: { ledgerId: 'synthetic-ledger', sequence: 0, digest: '0'.repeat(64) },
      expectedHead: { ledgerId: 'synthetic-ledger', sequence: 0, digest: '0'.repeat(64) }, receipts: [] },
    { valid: bool, verifiedReceiptCount: n(0, 32), computedHead: checkpoint, expectedHeadMatched: bool,
      issues: a(e('chain-mismatch', 'digest-mismatch', 'duplicate-event', 'expected-head-mismatch'), 0, 2) }),
  'public-filing-amendment-resolver': spec('58000', 'Public committee filing amendment resolver',
    'Resolve declared committee-level filing IDs, duplicates and amendment chains only with explicit commercial authorization and no individual contributor information.', 'public-finance',
    env({ commercialUseAuthorized: yes, noIndividualContributorInformation: yes, committeeId: ID,
      filings: a(o({ filingId: ID, amendsId: nullable(ID), filedAt: dateSchema, digest: HASH }), 1, 32) }),
    { commercialUseAuthorized: true, noIndividualContributorInformation: true, committeeId: 'synthetic-committee',
      filings: [{ filingId: 'f1', amendsId: null, filedAt: '2026-01-01', digest: 'sha256:' + '2'.repeat(64) }] },
    { committeeId: ID, duplicateFilingIds: ids(), conflictingFilingIds: ids(), cycleIds: ids(),
      filings: a(o({ filingId: ID, amendsId: nullable(ID),
        status: e('current', 'superseded', 'unresolved'), issues: a(e('conflicting-duplicate', 'missing-parent', 'cycle', 'date-before-parent', 'branching', 'unresolved-ancestor'), 0, 6) }), 1, 32) }),
  'angular-separation-batch': spec('8500', 'Angular separation of supplied positions',
    'Great-circle angles for bounded caller-supplied right ascension and declination pairs in integer microdegrees; no ephemeris lookup.', 'celestial',
    env({ pairs: a(o({ id: ID, first: position, second: position }), 1, 64) }),
    { pairs: [{ id: 'orthogonal', first: { raMicrodeg: 0, decMicrodeg: 0 }, second: { raMicrodeg: 90_000_000, decMicrodeg: 0 } }] },
    { angles: a(o({ id: ID, separationDeg: decimal }), 1, 64), method: e('unit-vector-atan2') }),
  'observing-window-planner': spec('92000', 'Sampled geometric observing windows',
    'Deterministic approximate GMST geometry at supplied UTC samples, site and frozen equatorial positions; no refraction, weather, live data or continuous visibility claims.', 'celestial',
    env({ site: o({ latitudeMicrodeg: n(-90_000_000, 90_000_000), longitudeMicrodeg: n(-180_000_000, 180_000_000) }),
      times: a(UTC, 1, 64), targets: a(o({ id: ID, position }), 1, 12), minimumAltitudeMicrodeg: n(-90_000_000, 90_000_000) }),
    { site: { latitudeMicrodeg: 0, longitudeMicrodeg: 0 }, times: ['2000-01-01T12:00:00.000Z'],
      targets: [{ id: 'synthetic-star', position: { raMicrodeg: 280_460_618, decMicrodeg: 0 } }], minimumAltitudeMicrodeg: 30_000_000 },
    { method: e('approximate-GMST-fixed-equatorial'), targets: a(o({ id: ID,
      samples: a(o({ time: UTC, localSiderealDeg: decimal, altitudeDeg: decimal, meetsMinimum: bool }), 1, 64),
      sampledWindows: a(o({ firstSample: UTC, lastSample: UTC, sampleCount: n(1, 64) }), 0, 32) }), 1, 12) }),
  'terrain-profile-arithmetic': spec('65000', 'Supplied terrain profile arithmetic',
    'Compute exact rises/runs and rounded slopes from bounded caller samples in millimetres. Not live volcanic hazard analysis.', 'physical-ai',
    env({ samples: a(o({ id: ID, distanceMm: n(0, 1_000_000_000), elevationMm: n(-100_000_000, 100_000_000) }), 2, 64) }),
    { samples: [{ id: 'a', distanceMm: 0, elevationMm: 1000 }, { id: 'b', distanceMm: 10000, elevationMm: 2000 }] },
    { segments: a(o({ from: ID, to: ID, runMm: n(1, 1_000_000_000), riseMm: n(-200_000_000, 200_000_000),
      gradePercent: decimal, angleDeg: decimal, lengthMm: decimal }), 1, 63),
      totalRunMm: n(1, 1_000_000_000), netRiseMm: n(-200_000_000, 200_000_000),
      ascentMm: n(0, 12_600_000_000), descentMm: n(0, 12_600_000_000), sampledPathLengthMm: decimal }),
  'volcano-concept-evidence-pack': spec('89000', 'Original Maha volcano educational microcontent pack',
    'Package allowlisted current original Maha repository paragraphs or explicitly licensed original microcontent, with exact edition/section citations; no official hazard forecast.', 'books',
    { oneOf: [env({ sources: a(microSource, 1, 8), concepts: a(concept, 1, 8) }), repositoryInput(false)] },
    { dataClass: 'public', commercialUseAuthorized: true, originalMahaOnly: true, repositorySourceIds: ['volcano-frame', 'volcano-register'],
      concepts: [{ id: 'framing', label: 'Event versus process; analogy versus claim', sourceIds: ['volcano-frame', 'volcano-register'] }] },
    { sources: a(sourceOutput, 1, 8), concepts: a(concept, 1, 8), boundary: e('educational-not-official-hazard-forecast') }),
  'edition-locator-alignment': spec('67000', 'Declared edition locator crosswalk',
    'Align authorized declared edition locators for a supported Maha book, with unmapped and ambiguous states. No arbitrary PDF parsing or inferred textual equivalence.', 'books',
    env({ callerAuthorizedEditions: yes, sourceEdition: edition, targetEdition: edition,
      crosswalk: a(o({ id: ID, sectionId: ID, sourceLocator: t(200), targetLocator: nullable(t(200)) }), 1, 32) }),
    { callerAuthorizedEditions: true,
      sourceEdition: { id: 'markdown-1', bookId: 'the-orbital-mind', format: 'declared-markdown', digest: 'sha256:' + '3'.repeat(64) },
      targetEdition: { id: 'pdf-1', bookId: 'the-orbital-mind', format: 'declared-pdf', digest: 'sha256:' + '4'.repeat(64) },
      crosswalk: [{ id: 'x1', sectionId: 'introduction', sourceLocator: 'section introduction', targetLocator: 'declared page 10' }] },
    { sourceEdition: edition, targetEdition: edition, crosswalk: a(o({ id: ID, sectionId: ID, sourceLocator: t(200),
      targetLocator: nullable(t(200)), status: e('declared-mapped', 'unmapped', 'ambiguous') }), 1, 32) }),
  'manuscript-release-diff': spec('83000', 'Licensed manuscript section release diff',
    'Exact full-release and section hashes plus deterministic bounded line changes for explicitly licensed original Maha section versions; no semantic equivalence claim.', 'books',
    env({ ...licensing, before: manuscript, after: manuscript }),
    { ...licensingSample(),
      before: { editionId: 'v1', sections: [{ id: 'intro', title: 'Introduction', locator: 'section 1', text: 'First line\nOld line' }] },
      after: { editionId: 'v2', sections: [{ id: 'intro', title: 'Introduction', locator: 'section 1', text: 'First line\nNew line' }] } },
    { beforeReleaseSha256: HASH, afterReleaseSha256: HASH, releasesIdentical: bool,
      changes: a(o({ id: ID, status: e('added', 'removed', 'modified', 'unchanged'), changedFields: a(e('text', 'title', 'locator'), 0, 3),
        beforeTextSha256: nullable(HASH), afterTextSha256: nullable(HASH), beforeSectionSha256: nullable(HASH), afterSectionSha256: nullable(HASH),
        removedLines: a(lineText, 0, 64), addedLines: a(lineText, 0, 64) }), 1, 32) }),
  'cross-book-concept-pack': spec('139000', 'Original Maha cross-book concept microcontent pack',
    'Package current original Maha repository microexcerpts or licensed original microtext with caller-declared cross-book links; authorial metaphor, not clinical truth.', 'books',
    { oneOf: [env({ sources: a(microSource, 2, 8), concepts: a(concept, 1, 8),
      crosslinks: a(o({ fromConceptId: ID, toConceptId: ID, relation: e('authorial-metaphor', 'declared-comparison') }), 0, 16) }), repositoryInput(true)] },
    { dataClass: 'public', commercialUseAuthorized: true, originalMahaOnly: true, repositorySourceIds: ['volcano-register', 'orbital-map'],
      concepts: [{ id: 'metaphor-boundary', label: 'Authorial analogy is not evidence', sourceIds: ['volcano-register', 'orbital-map'] }], crosslinks: [] },
    { sources: a(sourceOutput, 2, 8), concepts: a(o({ id: ID, label: t(160), sourceIds: ids(2, 8), bookIds: a(book, 2, 7) }), 1, 8),
      crosslinks: a(o({ fromConceptId: ID, toConceptId: ID, relation: e('authorial-metaphor', 'declared-comparison') }), 0, 16),
      boundary: e('authorial-metaphor-not-clinical-truth') }),
}
// Discovery must use contract-only previews for every service that delivers licensed prose.
for (const id of ['volcano-concept-evidence-pack', 'cross-book-concept-pack', 'manuscript-release-diff']) SPECS[id].paidContent = true
for (const [id, service] of Object.entries(SPECS)) service.resultSchema.properties!.serviceId = e(id)
function licensingSample() {
  return { author: 'Mayone Maha Rajan', license: 'original-maha-commercial-microcontent-v1', originalMahaAuthored: true,
    commercialUseAuthorized: true, redistributionAuthorized: true, thirdPartyTextIncluded: false }
}

const sha = (text: string) => 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex')
const order = (x: string, y: string) => x < y ? -1 : x > y ? 1 : 0
const requireInput = (condition: unknown, message: string): void => { if (!condition) throw new TypeError(message) }
const unique = (values: string[]) => requireInput(new Set(values).size === values.length, 'Duplicate identifiers.')
const isBlank = (value: unknown) => value === null || (typeof value === 'string' && value.trim() === '')
const fixed = (value: number) => {
  requireInput(Number.isFinite(value), 'Nonfinite calculation.')
  const text = value.toFixed(6)
  return text === '-0.000000' ? '0.000000' : text
}
const instant = (value: string) => {
  const d = new Date(value)
  requireInput(Number.isFinite(d.getTime()) && d.toISOString() === value && d.getUTCFullYear() >= 1900 && d.getUTCFullYear() <= 2100, 'Invalid UTC instant (supported years 1900–2100).')
  return d.getTime()
}
const calendar = (value: string) => {
  const time = Date.parse(value + 'T00:00:00.000Z')
  requireInput(Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2100-12-31', 'Invalid calendar date.')
  return time
}

/** Bound traversal BEFORE stringify/schemaAccepts; reject getters, toJSON, cycles and non-JSON objects. */
function jsonSnapshot(input: unknown): Record<string, unknown> {
  let nodes = 0, estimatedBytes = 0
  const ancestors = new Set<object>()
  function visit(value: unknown, depth: number): void {
    requireInput(depth <= 12 && ++nodes <= 6000, 'Request traversal limit.')
    if (value === null || typeof value === 'boolean') { estimatedBytes += 5; return }
    if (typeof value === 'number') { requireInput(Number.isSafeInteger(value), 'Only safe JSON integers are supported.'); estimatedBytes += 24; return }
    if (typeof value === 'string') {
      requireInput(value.length <= 32768, 'Request string limit.')
      estimatedBytes += Buffer.byteLength(JSON.stringify(value), 'utf8')
    } else {
      requireInput(typeof value === 'object' && value !== null, 'JSON values required.')
      const obj = value as object
      requireInput(!ancestors.has(obj), 'Cyclic request.')
      const array = Array.isArray(obj)
      requireInput(array || Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null, 'Plain JSON objects required.')
      const keys = Reflect.ownKeys(obj)
      requireInput(keys.length <= (array ? 129 : 64), 'Request container limit.')
      if (array) requireInput((obj as unknown[]).length <= 128 && keys.length === (obj as unknown[]).length + 1, 'Dense bounded arrays required.')
      ancestors.add(obj)
      for (const key of keys) {
        if (array && key === 'length') continue
        requireInput(typeof key === 'string' && !['__proto__', 'prototype', 'constructor', 'toJSON'].includes(key), 'Unsafe JSON key.')
        if (array) requireInput(/^(0|[1-9][0-9]*)$/.test(key as string) && Number(key) < (obj as unknown[]).length, 'Invalid array property.')
        const descriptor = Object.getOwnPropertyDescriptor(obj, key)!
        requireInput(descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'JSON accessors are forbidden.')
        estimatedBytes += Buffer.byteLength(JSON.stringify(key), 'utf8') + 2
        requireInput(estimatedBytes <= 32768, 'Request exceeds 32 KiB.')
        visit(descriptor.value, depth + 1)
      }
      ancestors.delete(obj)
    }
    requireInput(estimatedBytes <= 32768, 'Request exceeds 32 KiB.')
  }
  visit(input, 0)
  const encoded = JSON.stringify(input)
  requireInput(Buffer.byteLength(encoded, 'utf8') <= 32768, 'Request exceeds 32 KiB.')
  return JSON.parse(encoded) as Record<string, unknown>
}

/** Transitive closure on at most 32 declared nodes; all loops have fixed input caps. */
function cycleNodes(rows: { id: string; dependencies: string[] }[]): Set<string> {
  const reach = new Map(rows.map(row => [row.id, new Set(row.dependencies)]))
  for (const k of rows) for (const i of rows) if (reach.get(i.id)!.has(k.id))
    for (const j of reach.get(k.id)!) reach.get(i.id)!.add(j)
  return new Set(rows.filter(row => reach.get(row.id)!.has(row.id)).map(row => row.id))
}
function plainMarkdown(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+\-.!|~]/g, '\\$&')
}
type MicroSource = { id: string; bookId: string; editionId: string; sectionId: string; locator: string; text: string; author: string; license: string;
  repositoryFile?: string; repositoryFileSha256?: string }
function readRepositoryMicrocontent(sourceIds: string[]): MicroSource[] {
  unique(sourceIds)
  const files = new Map<string, { text: string; digest: string }>()
  return sourceIds.map(id => {
    requireInput(Object.hasOwn(repositorySources, id), 'Unknown repository microexcerpt.')
    const source = repositorySources[id as keyof typeof repositorySources]
    let file = files.get(source.file)
    if (!file) {
      // Literal filesystem roots keep Next's server tracing bounded. These are
      // internal allowlisted sources, never a caller-supplied file path.
      const path = source.bookId === 'the-volcanic-engine'
        ? join(process.cwd(), 'content/books/the-volcanic-engine/The-Volcanic-Engine-Introduction.md')
        : join(process.cwd(), 'content/books/the-orbital-mind/the-orbital-mind.md')
      const buffer = Buffer.alloc(1_048_577), fd = openSync(path, 'r')
      let count = 0
      try {
        for (let chunk = 0; chunk < 17 && count < buffer.length; chunk++) {
          const read = readSync(fd, buffer, count, Math.min(65536, buffer.length - count), count)
          if (!read) break
          count += read
        }
      } finally { closeSync(fd) }
      requireInput(count < buffer.length, 'Repository file exceeds 1 MiB.')
      const bytes = buffer.subarray(0, count)
      file = { text: bytes.toString('utf8'), digest: 'sha256:' + createHash('sha256').update(bytes).digest('hex') }
      files.set(source.file, file)
    }
    requireInput(file.text.includes('**Mayone Maha Rajan**'), 'Repository author marker unavailable.')
    const marker = '\n' + source.start, start = file.text.indexOf(marker) + 1
    requireInput(start > 0 && file.text.indexOf(marker, start) === -1, 'Repository paragraph marker missing or ambiguous.')
    const end = file.text.indexOf('\n\n', start), text = file.text.slice(start, end < 0 ? undefined : end)
    const heading = file.text.lastIndexOf(source.heading, start), nextHeading = file.text.lastIndexOf('\n## ', start)
    requireInput(heading >= 0 && heading === nextHeading + 1 && text.length <= 2000 && schemaAccepts(rawText(2000), text), 'Repository paragraph boundary changed.')
    const line = file.text.slice(0, start).split('\n').length
    return { id, bookId: source.bookId, editionId: 'repo-' + file.digest, sectionId: source.sectionId,
      locator: `${source.file}:${line}`, text, author: 'Mayone Maha Rajan',
      license: 'Non-exclusive personal reading or internal use only; no redistribution, resale, model-training rights or copyright transfer.',
      repositoryFile: source.file, repositoryFileSha256: file.digest }
  })
}
function sourcePack(sources: MicroSource[], concepts: { id: string; label: string; sourceIds: string[] }[], crossBook: boolean) {
  unique(sources.map(s => s.id)); unique(concepts.map(c => c.id))
  const byId = new Map(sources.map(s => [s.id, s]))
  for (const c of concepts) {
    unique(c.sourceIds)
    requireInput(c.sourceIds.every(id => byId.has(id)), 'Unknown concept source.')
    if (crossBook) requireInput(new Set(c.sourceIds.map(id => byId.get(id)!.bookId)).size >= 2, 'Each cross-book concept requires two distinct books.')
  }
  if (!crossBook) requireInput(sources.every(s => s.bookId === 'the-volcanic-engine'), 'Volcano pack supports only original Maha volcano microcontent.')
  return sources.map(({ id, bookId, editionId, sectionId, locator, text, author, license, repositoryFile, repositoryFileSha256 }) =>
    ({ id, bookId, editionId, sectionId, locator, text, author, license, textSha256: sha(text),
      sourceBasis: repositoryFile ? 'repository-original-microexcerpt' : 'caller-original-microcontent',
      repositoryFile: repositoryFile ?? null, repositoryFileSha256: repositoryFileSha256 ?? null }))
}
type Section = { id: string; title: string; locator: string; text: string }
function sectionLines(text: string): string[] {
  const lines = text.split('\n')
  requireInput(lines.length <= 64, 'At most 64 lines per section.')
  return lines
}
/** LCS tie-break removes first; exact lines (including blank lines), not a semantic diff. */
function lineDiff(before: string[], after: string[]) {
  const lcs = Array.from({ length: before.length + 1 }, () => Array<number>(after.length + 1).fill(0))
  for (let i = before.length - 1; i >= 0; i--) for (let j = after.length - 1; j >= 0; j--)
    lcs[i][j] = before[i] === after[j] ? 1 + lcs[i + 1][j + 1] : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const removedLines: string[] = [], addedLines: string[] = []
  let i = 0, j = 0
  for (let step = 0; step < before.length + after.length && (i < before.length || j < after.length); step++) {
    if (i < before.length && j < after.length && before[i] === after[j]) { i++; j++ }
    else if (i < before.length && (j === after.length || lcs[i + 1][j] >= lcs[i][j + 1])) removedLines.push(before[i++])
    else addedLines.push(after[j++])
  }
  return { removedLines, addedLines }
}

/** Unknown IDs return null; known services fail closed with TypeError on invalid requests. */
export function buildResearchContentExpansion(id: string, input: Record<string, unknown>): Record<string, unknown> | null {
  if (!Object.hasOwn(SPECS, id)) return null
  const v = jsonSnapshot(input), s = SPECS[id]
  requireInput(schemaAccepts(s.inputSchema, v), 'Invalid closed service input schema.')
  let fields: Record<string, unknown> = {}, limitations: string[] = []
  switch (id) {
    case 'spatial-adjacency-check': {
      const x = v as unknown as { rooms: string[]; topology: { from: string; to: string; adjacent: boolean }[];
        requirements: { id: string; from: string; to: string; relation: string }[] }
      unique(x.rooms); unique(x.requirements.map(r => r.id))
      const rooms = new Set(x.rooms), topology = new Map<string, Set<boolean>>(), requirements = new Map<string, Set<string>>()
      const pair = (from: string, to: string) => {
        requireInput(rooms.has(from) && rooms.has(to) && from !== to, 'Unknown or self-adjacent room.')
        return [from, to].sort(order).join('|')
      }
      for (const r of x.topology) { const key = pair(r.from, r.to); if (!topology.has(key)) topology.set(key, new Set()); topology.get(key)!.add(r.adjacent) }
      for (const r of x.requirements) { const key = pair(r.from, r.to); if (!requirements.has(key)) requirements.set(key, new Set()); requirements.get(key)!.add(r.relation) }
      const contradictions = new Set([...topology].filter(([, flags]) => flags.size > 1).map(([key]) => key))
      for (const [key, relations] of requirements) if (relations.size > 1) contradictions.add(key)
      fields = { checks: x.requirements.map(r => {
        const key = pair(r.from, r.to), flags = topology.get(key)
        return { ...r, status: contradictions.has(key) ? 'contradictory' : !flags ? 'unknown' : flags.has(r.relation === 'adjacent') ? 'satisfied' : 'violated' }
      }), contradictoryPairs: [...contradictions].sort(order) }
      limitations = ['Only declared undirected room topology; absence is unknown, not separation. No geometry, egress, code compliance or architectural approval.']
      break
    }
    case 'experiment-plan-completeness': {
      const x = v as unknown as { baseline: string | null; primaryMeasure: { name: string | null; unit: string | null };
        acceptance: { threshold: string | null }; stopRule: { maxTrials: number | null; abortCondition: string | null } }
      const components = [ ['baseline', [['baseline', x.baseline]]],
        ['primaryMeasure', [['primaryMeasure.name', x.primaryMeasure.name], ['primaryMeasure.unit', x.primaryMeasure.unit]]],
        ['acceptance', [['acceptance.threshold', x.acceptance.threshold]]],
        ['stopRule', [['stopRule.maxTrials', x.stopRule.maxTrials], ['stopRule.abortCondition', x.stopRule.abortCondition]]] ] as const
      const checks = components.map(([component, entries]) => { const missingFields = entries.filter(([, value]) => isBlank(value)).map(([path]) => path)
        return { component, status: missingFields.length ? 'missing' : 'declared', missingFields } })
      fields = { complete: checks.every(c => c.status === 'declared'), checks }
      limitations = ['Presence checks only. Declared measures, acceptance and stop rules are not efficacy, statistical power, ethics approval or semantic entailment.']
      break
    }
    case 'partnership-milestone-review': {
      const x = v as unknown as { evidence: { id: string; reference: string | null }[];
        milestones: { id: string; dependencies: string[]; requiredEvidence: string[]; status: string }[] }
      unique(x.evidence.map(e => e.id)); unique(x.milestones.map(m => m.id))
      const evidence = new Map(x.evidence.map(e => [e.id, e.reference])), byId = new Map(x.milestones.map(m => [m.id, m]))
      for (const m of x.milestones) { unique(m.dependencies); unique(m.requiredEvidence); requireInput(m.dependencies.every(id => byId.has(id)), 'Unknown milestone dependency.') }
      const cycles = cycleNodes(x.milestones), complete = new Set<string>()
      const missing = (m: typeof x.milestones[number]) => m.requiredEvidence.filter(id => !evidence.has(id) || isBlank(evidence.get(id)))
      for (let pass = 0; pass < x.milestones.length; pass++) for (const m of x.milestones)
        if (!cycles.has(m.id) && m.status === 'claimed-complete' && !missing(m).length && m.dependencies.every(id => complete.has(id))) complete.add(m.id)
      fields = { cycleIds: [...cycles].sort(order), milestones: x.milestones.map(m => {
        const missingEvidenceIds = missing(m), unmetDependencyIds = m.dependencies.filter(id => !complete.has(id))
        return { id: m.id, status: cycles.has(m.id) || unmetDependencyIds.length ? 'blocked' : missingEvidenceIds.length ? 'incomplete' : complete.has(m.id) ? 'declared-complete' : 'planned', missingEvidenceIds, unmetDependencyIds }
      }) }
      limitations = ['Evidence is a declared nonblank reference, not verified content. Dependency completion requires all declared evidence and claimed-complete ancestors; no partnership approval.']
      break
    }
    case 'research-opportunity-comparison': {
      const x = v as unknown as { criteria: { id: string; weight: number; direction: string }[];
        options: { id: string; scores: { criterionId: string; value: number }[] }[]; sensitivityDelta: number }
      unique(x.criteria.map(c => c.id)); unique(x.options.map(p => p.id))
      for (const p of x.options) { unique(p.scores.map(q => q.criterionId)); requireInput(p.scores.length === x.criteria.length && x.criteria.every(c => p.scores.some(q => q.criterionId === c.id)), 'One score per criterion required.') }
      const rank = (weights: number[]) => {
        const totalWeight = weights.reduce((sum, w) => sum + w, 0)
        requireInput(totalWeight > 0, 'Sensitivity must retain a positive total weight.')
        const ranking = x.options.map(p => ({ optionId: p.id, totalWeight, weightedSum: x.criteria.reduce((sum, c, i) => {
          const score = p.scores.find(q => q.criterionId === c.id)!.value
          return sum + weights[i] * (c.direction === 'maximize' ? score : 1000 - score)
        }, 0) })).sort((p, q) => q.weightedSum - p.weightedSum || order(p.optionId, q.optionId))
        return { ranking: ranking.map((p, i) => ({ ...p, score: fixed(p.weightedSum / totalWeight), rank: i + 1 })),
          winnerIds: ranking.filter(p => p.weightedSum === ranking[0].weightedSum).map(p => p.optionId), totalWeight }
      }
      const weights = x.criteria.map(c => c.weight), baseline = rank(weights)
      const sensitivity = x.criteria.flatMap((c, i) => ['minus', 'plus'].map(adjustment => {
        const changed = [...weights]
        changed[i] = Math.max(0, c.weight + (adjustment === 'plus' ? x.sensitivityDelta : -x.sensitivityDelta))
        // A single criterion cannot be normalized at zero: retain one weight unit.
        if (changed.reduce((sum, w) => sum + w, 0) === 0) changed[i] = 1
        const scenario = rank(changed)
        return { criterionId: c.id, adjustment, effectiveWeight: changed[i], totalWeight: scenario.totalWeight, winnerIds: scenario.winnerIds }
      }))
      fields = { ranking: baseline.ranking, winnerIds: baseline.winnerIds, sensitivity }
      limitations = ['Scores are supplied integers 0–1000; minimize uses 1000 minus score. Additive one-at-a-time weight perturbation, clamped at zero (one unit if all zero). Ties sorted by ID; no research prediction.']
      break
    }
    case 'evidence-brief-export': {
      const x = v as unknown as { title: string; sources: { id: string; citation: string; locator: string; digest: string }[];
        plans: { id: string; text: string; sourceIds: string[] }[]; results: { id: string; text: string; sourceIds: string[] }[] }
      unique(x.sources.map(s => s.id)); unique([...x.plans, ...x.results].map(r => r.id))
      const sourceIds = new Set(x.sources.map(s => s.id))
      requireInput(x.plans.length + x.results.length > 0, 'At least one plan or result required.')
      for (const r of [...x.plans, ...x.results]) { unique(r.sourceIds); requireInput(r.sourceIds.every(id => sourceIds.has(id)), 'Unbound source reference.') }
      const document = { title: x.title, sources: x.sources, plans: x.plans, results: x.results }
      const json = JSON.stringify(document)
      const lines = [`# ${plainMarkdown(x.title)}`, '', 'Declared source references only; no semantic entailment or factual certification.', '', '## Sources']
      for (const source of x.sources) lines.push(`- ${plainMarkdown(source.id)}: ${plainMarkdown(source.citation)}; ${plainMarkdown(source.locator)}; ${plainMarkdown(source.digest)}`)
      for (const [heading, rows] of [['Plans', x.plans], ['Results', x.results]] as const) {
        lines.push('', `## ${heading}`)
        for (const r of rows) lines.push(`- ${plainMarkdown(r.id)}: ${plainMarkdown(r.text)} (declared sources: ${r.sourceIds.map(plainMarkdown).join(', ')})`)
      }
      fields = { document, markdown: lines.join('\n'), json, jsonSha256: sha(json) }
      limitations = ['No source full text or protected dataset redistribution. References and hashes are caller declarations, not verification, support or entailment. Markdown uses escaped plain text; JSON must be rendered as text, never executable HTML.']
      break
    }
    case 'public-amendment-lineage': {
      const x = v as unknown as { contractId: string; revisions: { id: string; parentId: string | null; effectiveDate: string;
        changes: { field: string; before: string | null; after: string | null }[] }[] }
      unique(x.revisions.map(r => r.id))
      const byId = new Map(x.revisions.map(r => [r.id, r]))
      for (const r of x.revisions) { calendar(r.effectiveDate); unique(r.changes.map(c => c.field)) }
      const cycles = cycleNodes(x.revisions.map(r => ({ id: r.id, dependencies: r.parentId && byId.has(r.parentId) ? [r.parentId] : [] })))
      fields = { contractId: x.contractId, lineage: [...x.revisions].sort((r, q) => order(r.effectiveDate, q.effectiveDate) || order(r.id, q.id)).map(r => {
        const issues: string[] = [], parent = r.parentId ? byId.get(r.parentId) : undefined
        if (r.parentId && !parent) issues.push('missing-parent')
        if (cycles.has(r.id)) issues.push('cycle')
        if (parent && r.effectiveDate < parent.effectiveDate) issues.push('effective-date-before-parent')
        // Look backward through declared ancestor changes, never assuming absent fields are null.
        if (!cycles.has(r.id) && r.changes.some(c => {
          let ancestor = parent
          for (let step = 0; step < x.revisions.length && ancestor; step++) {
            const previous = ancestor.changes.find(p => p.field === c.field)
            if (previous) return previous.after !== c.before
            ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined
          }
          return false
        })) issues.push('before-value-mismatch')
        return { id: r.id, parentId: r.parentId, effectiveDate: r.effectiveDate, changedFields: r.changes.map(c => c.field), issues }
      }) }
      limitations = ['Caller-declared public nonpersonal contract records only. Effective dates and field lineage are not legal effect, validity, enforceability or contract interpretation; absent ancestor values remain unknown.']
      break
    }
    case 'spending-variance-bridge': {
      const x = v as unknown as { currency: string; periods: { before: string; after: string }; lines: { id: string; beforeMinor: string | null; afterMinor: string | null }[] }
      unique(x.lines.map(r => r.id)); requireInput(x.periods.before !== x.periods.after, 'Distinct period IDs required.')
      const lines = x.lines.map(r => ({ ...r, deltaMinor: r.beforeMinor === null || r.afterMinor === null ? null : (BigInt(r.afterMinor) - BigInt(r.beforeMinor)).toString() }))
      const total = (side: 'beforeMinor' | 'afterMinor') => lines.some(r => r[side] === null) ? null : lines.reduce((sum, r) => sum + BigInt(r[side]!), BigInt(0)).toString()
      const beforeTotalMinor = total('beforeMinor'), afterTotalMinor = total('afterMinor')
      fields = { currency: x.currency, periods: x.periods, lines, beforeTotalMinor, afterTotalMinor,
        netDeltaMinor: beforeTotalMinor === null || afterTotalMinor === null ? null : (BigInt(afterTotalMinor) - BigInt(beforeTotalMinor)).toString(),
        knownLineDeltaMinor: lines.reduce((sum, r) => sum + (r.deltaMinor === null ? BigInt(0) : BigInt(r.deltaMinor)), BigInt(0)).toString(),
        unknownLineIds: lines.filter(r => r.deltaMinor === null).map(r => r.id) }
      limitations = ['Aggregate supplied integer minor units only. Known-line delta is a partial subtotal, not the net delta. Missing values propagate as unknown; no audit, financial advice or individual/donor information.']
      break
    }
    case 'transparency-hash-chain-verification': {
      type Head = { ledgerId: string; sequence: number; digest: string }
      const x = v as unknown as { preceding: Head; expectedHead: Head; receipts: { version: string; ledgerId: string; sequence: number; previousDigest: string;
        event: { id: string; occurredAt: string; evidence: { url: string }[] }; digest: string }[] }
      for (const head of [x.preceding, x.expectedHead]) requireInput(head.sequence !== 0 || head.digest === '0'.repeat(64), 'Empty checkpoint requires genesis digest.')
      for (const r of x.receipts) { instant(r.event.occurredAt); for (const source of r.event.evidence) requireInput(new URL(source.url).protocol === 'https:', 'HTTPS evidence required.') }
      let head = { ...x.preceding }, verifiedReceiptCount = 0
      const issues: string[] = [], eventIds = new Set<string>()
      for (const r of x.receipts) {
        if (r.ledgerId !== head.ledgerId || r.sequence !== head.sequence + 1 || r.previousDigest !== head.digest) { issues.push('chain-mismatch'); break }
        const { digest, ...payload } = r
        if (digest !== civicDigest(payload)) { issues.push('digest-mismatch'); break }
        if (eventIds.has(r.event.id)) { issues.push('duplicate-event'); break }
        eventIds.add(r.event.id); verifiedReceiptCount++
        head = { ledgerId: r.ledgerId, sequence: r.sequence, digest }
      }
      const expectedHeadMatched = head.ledgerId === x.expectedHead.ledgerId && head.sequence === x.expectedHead.sequence && head.digest === x.expectedHead.digest
      if (!expectedHeadMatched) issues.push('expected-head-mismatch')
      fields = { valid: issues.length === 0, verifiedReceiptCount, computedHead: head, expectedHeadMatched, issues }
      limitations = ['Matches civic-ledger-1 RFC 8785 receipt digests for a safe public organizational decision subset only; donor/contribution/expense transfer records and counterparty labels refused.',
        'Caller-supplied preceding and expected checkpoints must be trusted independently. A self-consistent chain is not factual truth, a Merkle proof, on-chain confirmation or an automatic anchor.']
      break
    }
    case 'public-filing-amendment-resolver': {
      const x = v as unknown as { committeeId: string; filings: { filingId: string; amendsId: string | null; filedAt: string; digest: string }[] }
      for (const f of x.filings) calendar(f.filedAt)
      const groups = new Map<string, typeof x.filings>()
      for (const f of x.filings) { if (!groups.has(f.filingId)) groups.set(f.filingId, []); groups.get(f.filingId)!.push(f) }
      const duplicates = [...groups].filter(([, fs]) => fs.length > 1).map(([id]) => id)
      const conflicts = new Set([...groups].filter(([, fs]) => new Set(fs.map(f => civicDigest(f))).size > 1).map(([id]) => id))
      const canonical = [...groups.values()].map(fs => [...fs].sort((a, b) => order(civicDigest(a), civicDigest(b)))[0])
      const byId = new Map(canonical.map(f => [f.filingId, f])), children = new Map<string, string[]>()
      for (const f of canonical) if (f.amendsId) { if (!children.has(f.amendsId)) children.set(f.amendsId, []); children.get(f.amendsId)!.push(f.filingId) }
      const cycles = cycleNodes(canonical.map(f => ({ id: f.filingId, dependencies: f.amendsId && byId.has(f.amendsId) ? [f.amendsId] : [] })))
      const problem = new Map<string, Set<string>>()
      for (const f of canonical) {
        const issues = new Set<string>(), parent = f.amendsId ? byId.get(f.amendsId) : undefined
        if (conflicts.has(f.filingId)) issues.add('conflicting-duplicate')
        if (f.amendsId && !parent) issues.add('missing-parent')
        if (cycles.has(f.filingId)) issues.add('cycle')
        if (parent && f.filedAt < parent.filedAt) issues.add('date-before-parent')
        if ((children.get(f.filingId)?.length ?? 0) > 1 || (f.amendsId && (children.get(f.amendsId)?.length ?? 0) > 1)) issues.add('branching')
        problem.set(f.filingId, issues)
      }
      for (let pass = 0; pass < canonical.length; pass++) for (const f of canonical)
        if (f.amendsId && problem.get(f.amendsId)?.size) problem.get(f.filingId)!.add('unresolved-ancestor')
      fields = { committeeId: x.committeeId, duplicateFilingIds: duplicates.sort(order), conflictingFilingIds: [...conflicts].sort(order), cycleIds: [...cycles].sort(order),
        filings: canonical.sort((p, q) => order(p.filingId, q.filingId)).map(f => ({ filingId: f.filingId, amendsId: f.amendsId,
          status: problem.get(f.filingId)!.size ? 'unresolved' : (children.get(f.filingId) ?? []).some(id => !problem.get(id)!.size) ? 'superseded' : 'current',
          issues: [...problem.get(f.filingId)!].sort(order) })) }
      limitations = ['Public committee-level IDs and declared filing digests only. Explicit commercial-use and no-individual-contributor declarations required; contributor fields refused. No donor information, political targeting, legal effect or live filing retrieval.']
      break
    }
    case 'angular-separation-batch': {
      const x = v as unknown as { pairs: { id: string; first: { raMicrodeg: number; decMicrodeg: number }; second: { raMicrodeg: number; decMicrodeg: number } }[] }
      unique(x.pairs.map(p => p.id))
      const vector = (p: typeof x.pairs[number]['first']) => {
        const ra = p.raMicrodeg / 1e6 * Math.PI / 180, dec = p.decMicrodeg / 1e6 * Math.PI / 180
        return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
      }
      fields = { method: 'unit-vector-atan2', angles: x.pairs.map(p => {
        const u = vector(p.first), w = vector(p.second)
        const cross = Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0])
        return { id: p.id, separationDeg: fixed(Math.atan2(cross, u.reduce((sum, value, i) => sum + value * w[i], 0)) * 180 / Math.PI) }
      }) }
      limitations = ['Spherical angular separation of supplied positions only. Same coordinate frame/epoch must be supplied; no ephemerides, proper motion, uncertainty propagation or astrological/clinical interpretation.']
      break
    }
    case 'observing-window-planner': {
      const x = v as unknown as { site: { latitudeMicrodeg: number; longitudeMicrodeg: number }; times: string[];
        targets: { id: string; position: { raMicrodeg: number; decMicrodeg: number } }[]; minimumAltitudeMicrodeg: number }
      unique(x.targets.map(t => t.id))
      const times = x.times.map(instant)
      requireInput(times.every((time, i) => i === 0 || time > times[i - 1]), 'Times must be strictly increasing.')
      requireInput(times[times.length - 1] - times[0] <= 7 * 86400000, 'At most seven days of samples.')
      const rad = Math.PI / 180, latitude = x.site.latitudeMicrodeg / 1e6 * rad
      const sidereal = times.map(time => {
        const jd = time / 86400000 + 2440587.5, d = jd - 2451545, centuries = d / 36525
        const angle = 280.46061837 + 360.98564736629 * d + 0.000387933 * centuries ** 2 - centuries ** 3 / 38710000 + x.site.longitudeMicrodeg / 1e6
        return ((angle % 360) + 360) % 360
      })
      fields = { method: 'approximate-GMST-fixed-equatorial', targets: x.targets.map(target => {
        const dec = target.position.decMicrodeg / 1e6 * rad
        const samples = x.times.map((time, i) => {
          const hourAngle = (sidereal[i] - target.position.raMicrodeg / 1e6) * rad
          const sinAlt = Math.sin(latitude) * Math.sin(dec) + Math.cos(latitude) * Math.cos(dec) * Math.cos(hourAngle)
          const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad
          return { time, localSiderealDeg: fixed(sidereal[i]), altitudeDeg: fixed(altitude), meetsMinimum: altitude + 1e-9 >= x.minimumAltitudeMicrodeg / 1e6 }
        })
        const sampledWindows: { firstSample: string; lastSample: string; sampleCount: number }[] = []
        let window: typeof sampledWindows[number] | null = null
        for (const sample of samples) {
          if (sample.meetsMinimum) {
            if (!window) { window = { firstSample: sample.time, lastSample: sample.time, sampleCount: 0 }; sampledWindows.push(window) }
            window.lastSample = sample.time; window.sampleCount++
          } else window = null
        }
        return { id: target.id, samples, sampledWindows }
      }) }
      limitations = ['Approximate mean sidereal-time geometry, east-positive longitude, frozen caller positions and supplied UTC as a UT1 approximation. No precession/nutation, refraction, weather, terrain horizon, daylight, ephemeris lookup or observatory-grade pointing.',
        'Windows are runs of qualifying supplied samples, not continuous rise/set times or visibility between samples; maximum seven-day span, years 1900–2100.']
      break
    }
    case 'terrain-profile-arithmetic': {
      const x = v as unknown as { samples: { id: string; distanceMm: number; elevationMm: number }[] }
      unique(x.samples.map(p => p.id))
      requireInput(x.samples.every((p, i) => !i || p.distanceMm > x.samples[i - 1].distanceMm), 'Distances must be strictly increasing.')
      let ascent = 0, descent = 0, length = 0
      const segments = x.samples.slice(1).map((p, i) => {
        const previous = x.samples[i], run = p.distanceMm - previous.distanceMm, rise = p.elevationMm - previous.elevationMm
        ascent += Math.max(0, rise); descent += Math.max(0, -rise); const segmentLength = Math.hypot(run, rise); length += segmentLength
        return { from: previous.id, to: p.id, runMm: run, riseMm: rise, gradePercent: fixed(100 * rise / run),
          angleDeg: fixed(Math.atan2(rise, run) * 180 / Math.PI), lengthMm: fixed(segmentLength) }
      })
      fields = { segments, totalRunMm: x.samples[x.samples.length - 1].distanceMm - x.samples[0].distanceMm,
        netRiseMm: x.samples[x.samples.length - 1].elevationMm - x.samples[0].elevationMm,
        ascentMm: ascent, descentMm: descent, sampledPathLengthMm: fixed(length) }
      limitations = ['Caller-supplied sampled profile arithmetic only; millimetres and piecewise straight segments. No live volcano hazard, terrain retrieval, geological inference or travel/safety recommendation.']
      break
    }
    case 'volcano-concept-evidence-pack': {
      const x = v as unknown as { sources: MicroSource[]; concepts: { id: string; label: string; sourceIds: string[] }[] }
      const sources = Array.isArray(v.repositorySourceIds) ? readRepositoryMicrocontent(v.repositorySourceIds as string[]) : x.sources
      fields = { sources: sourcePack(sources, x.concepts, false), concepts: x.concepts, boundary: 'educational-not-official-hazard-forecast' }
      limitations = ['Only allowlisted current original Maha repository paragraphs or explicitly licensed original caller microcontent. Exact file/edition, section, locator and text hashes retained; caller rights/author declarations not independently verified.',
        'Repository excerpts are personal/internal-use delivery, not redistribution rights. No third-party/noncommercial text or protected datasets. Concept-source links are declared, not semantic entailment. Educational text, not an official hazard forecast or safety advice.']
      break
    }
    case 'edition-locator-alignment': {
      const x = v as unknown as { sourceEdition: { id: string; bookId: keyof typeof openBookEditions }; targetEdition: { id: string; bookId: keyof typeof openBookEditions };
        crosswalk: { id: string; sectionId: string; sourceLocator: string; targetLocator: string | null }[] }
      unique(x.crosswalk.map(r => r.id))
      requireInput(x.sourceEdition.bookId === x.targetEdition.bookId && x.sourceEdition.id !== x.targetEdition.id, 'Two distinct declared editions of the same supported book required.')
      const sections = new Set(openBookEditions[x.sourceEdition.bookId].sections.map(s => s.slug))
      requireInput(x.crosswalk.every(r => sections.has(r.sectionId)), 'Unknown supported book section.')
      fields = { sourceEdition: x.sourceEdition, targetEdition: x.targetEdition, crosswalk: x.crosswalk.map(r => {
        const sameSource = x.crosswalk.filter(q => q.sourceLocator === r.sourceLocator), sameTarget = x.crosswalk.filter(q => r.targetLocator !== null && q.targetLocator === r.targetLocator)
        const ambiguous = new Set(sameSource.map(q => JSON.stringify([q.sectionId, q.targetLocator]))).size > 1
          || new Set(sameTarget.map(q => JSON.stringify([q.sectionId, q.sourceLocator]))).size > 1
        return { ...r, status: ambiguous ? 'ambiguous' : r.targetLocator === null ? 'unmapped' : 'declared-mapped' }
      }) }
      limitations = ['Supported Maha section metadata only. Locators, edition digests and authorization are caller-declared; no arbitrary PDF parser, manuscript reads, page extraction or inferred edition/text equivalence.']
      break
    }
    case 'manuscript-release-diff': {
      const x = v as unknown as { before: { editionId: string; sections: Section[] }; after: { editionId: string; sections: Section[] } }
      for (const release of [x.before, x.after]) { unique(release.sections.map(s => s.id)); for (const section of release.sections) sectionLines(section.text) }
      const before = new Map(x.before.sections.map(s => [s.id, s])), after = new Map(x.after.sections.map(s => [s.id, s]))
      const beforeReleaseSha256 = 'sha256:' + civicDigest(x.before), afterReleaseSha256 = 'sha256:' + civicDigest(x.after)
      fields = { beforeReleaseSha256, afterReleaseSha256, releasesIdentical: beforeReleaseSha256 === afterReleaseSha256,
        changes: [...new Set([...before.keys(), ...after.keys()])].sort(order).map(id => {
          const b = before.get(id), q = after.get(id), changedFields = (['text', 'title', 'locator'] as const).filter(key => b?.[key] !== q?.[key])
          return { id, status: !b ? 'added' : !q ? 'removed' : changedFields.length ? 'modified' : 'unchanged', changedFields,
            beforeTextSha256: b ? sha(b.text) : null, afterTextSha256: q ? sha(q.text) : null,
            beforeSectionSha256: b ? 'sha256:' + civicDigest(b) : null, afterSectionSha256: q ? 'sha256:' + civicDigest(q) : null,
            ...lineDiff(b ? sectionLines(b.text) : [], q ? sectionLines(q.text) : []) }
        }) }
      limitations = ['Full-release hashes cover edition ID, section order and exact section fields using RFC 8785; text hashes cover exact UTF-8 bytes. Line LCS preserves whitespace, with removal-first ties; at most 64 lines per section.',
        'Explicit original Maha commercial/redistribution licensing declarations only, not independently verified rights. No arbitrary PDF parsing, semantic equivalence, clinical truth or third-party/noncommercial text redistribution.']
      break
    }
    case 'cross-book-concept-pack': {
      const x = v as unknown as { sources: MicroSource[]; concepts: { id: string; label: string; sourceIds: string[] }[];
        crosslinks: { fromConceptId: string; toConceptId: string; relation: string }[] }
      const suppliedSources = Array.isArray(v.repositorySourceIds) ? readRepositoryMicrocontent(v.repositorySourceIds as string[]) : x.sources
      const sources = sourcePack(suppliedSources, x.concepts, true), conceptIds = new Set(x.concepts.map(c => c.id)), byId = new Map(sources.map(s => [s.id, s]))
      requireInput(x.crosslinks.every(l => l.fromConceptId !== l.toConceptId && conceptIds.has(l.fromConceptId) && conceptIds.has(l.toConceptId)), 'Invalid concept crosslink.')
      unique(x.crosslinks.map(l => JSON.stringify([l.fromConceptId, l.toConceptId, l.relation])))
      fields = { sources, concepts: x.concepts.map(c => ({ ...c, bookIds: [...new Set(c.sourceIds.map(id => byId.get(id)!.bookId))].sort(order) })),
        crosslinks: x.crosslinks, boundary: 'authorial-metaphor-not-clinical-truth' }
      limitations = ['Only allowlisted current original Maha repository paragraphs or explicitly licensed original caller microcontent; exact sources/hashes retained. Repository delivery grants personal/internal use, not redistribution, resale or training rights. No third-party/noncommercial text or protected datasets; caller rights declarations not independently verified.',
        'Crosslinks are caller-declared authorial metaphors/comparisons, not semantic entailment, empirical validation, clinical truth or medical advice.']
      break
    }
  }
  const output = { serviceId: id, dataClass: v.dataClass, limitations, ...fields }
  requireInput(Buffer.byteLength(JSON.stringify(output), 'utf8') <= 65536, 'Response exceeds 64 KiB.')
  requireInput(schemaAccepts(s.resultSchema, output), 'Calculation exceeds the closed result schema.')
  return output
}
