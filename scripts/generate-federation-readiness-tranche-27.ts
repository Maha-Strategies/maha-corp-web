import { readFileSync, writeFileSync } from 'node:fs'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })

type Candidate = {
  candidateId: string
  siteId: string
  groupId: string
  routeRole: string
  path: string
  url: string
  title: string
  conceptId: string
  conceptAuthority: { canonicalOwner: string; role: string; boundary: string }
  typedRelationships: { type: string; target: string }[]
  routeContract: { allowedContent: string[]; mustNotClaim: string[] }
}

const map = read('federation-route-candidates-v5.json') as { provenanceDigest: string; candidates: Candidate[] }
const ledger = read('federation-unified-readiness-ledger-v7.json') as { provenanceDigest: string; entries: { candidateId: string; implementationState: string }[] }
type SemanticReview = { candidateId: string; disposition: string; answerBoundary: string; nonOverlapFinding: string }
type DependencyReview = { candidateId: string; dependencies: unknown[]; methodAnchorsComplete?: boolean; hubDependencyCorrect?: boolean; missing?: unknown[]; structurallyResolved: boolean }
const semantic11 = read('federation-tranche-11-mythology-semantic-validation-v1.json') as { provenanceDigest: string; entries: SemanticReview[] }
const semantic12 = read('federation-tranche-12-mythology-semantic-validation-v1.json') as { provenanceDigest: string; entries: SemanticReview[] }
const dependencies11 = read('federation-tranche-11-mythology-dependency-validation-v1.json') as { provenanceDigest: string; entries: DependencyReview[] }
const dependencies12 = read('federation-tranche-12-mythology-dependency-validation-v1.json') as { provenanceDigest: string; entries: DependencyReview[] }

const unresolved = new Set(ledger.entries.filter((row) => row.implementationState === 'unresolved').map((row) => row.candidateId))
const roles = new Set(['source-identity', 'epithet-and-cult', 'reception-and-comparison'])
const selected = map.candidates
  .filter((row) => unresolved.has(row.candidateId) && row.groupId === 'mythology-greek-roman' && roles.has(row.routeRole))
  .sort((a, b) => a.path.localeCompare(b.path))
if (selected.length !== 36 || new Set(selected.map((row) => row.conceptId)).size !== 12) throw new Error('t27-cohort-invalid')

const entryLocators: Record<string, { entry: string; printedPages: string; scanPages: number[]; scope: string }> = {
  'aphrodite-venus': { entry: 'Aphrodite, called Venus', printedPages: 'pp. 41–42', scanPages: [51, 52], scope: 'Names the Greek and Roman figures, narrates the dictionary’s genealogy and attributes, and locates worship and selected associations.' },
  apollo: { entry: 'Apollo', printedPages: 'pp. 42–43', scanPages: [52, 53], scope: 'Describes Apollo’s attributed powers, titles, cult centers, and the dictionary’s account of Greek and Roman reception.' },
  'ares-mars': { entry: 'Ares, called Mars', printedPages: 'pp. 48–49', scanPages: [58, 59], scope: 'Contrasts the dictionary’s Greek Ares and Roman Mars framing and records attributed relationships and iconography.' },
  'artemis-diana': { entry: 'Artemis, called Diana', printedPages: 'pp. 59–60', scanPages: [69, 70], scope: 'Names the Greek and Roman figures and records selected local cult, mythic, and iconographic associations.' },
  'athena-minerva': { entry: 'Athena, called Minerva', printedPages: 'pp. 65–66', scanPages: [75, 76], scope: 'Names the Greek and Roman figures and records selected functions, epithets, festivals, and places of worship.' },
  'demeter-ceres': { entry: 'Demeter, called Ceres', printedPages: 'pp. 140–141', scanPages: [150, 151], scope: 'Names the Greek and Roman figures and records the dictionary’s agricultural, mystery-cult, and iconographic framing.' },
  'dionysus-bacchus': { entry: 'Dionysus', printedPages: 'pp. 147–149', scanPages: [157, 158, 159], scope: 'Records Dionysus/Bacchus names, narratives, cultic associations, festivals, and the dictionary’s comparative synthesis.' },
  'hades-pluto': { entry: 'Hades or Aides or Pluto', printedPages: 'pp. 183–184', scanPages: [193, 194], scope: 'Names Hades/Pluto, distinguishes name usage in the dictionary, and records selected underworld, cult, and iconographic associations.' },
  'hera-juno': { entry: 'Hera, called Juno', printedPages: 'pp. 193–194', scanPages: [203, 204], scope: 'Names the Greek and Roman figures and records selected local worship, festivals, attributes, and narratives.' },
  'hermes-mercury': { entry: 'Hermes, called Mercurius', printedPages: 'pp. 201–202', scanPages: [211, 212], scope: 'Names the Greek and Roman figures and records functions, inventions, worship, attributes, and later identification.' },
  'poseidon-neptune': { entry: 'Poseidon, called Neptunus', printedPages: 'pp. 337–338', scanPages: [347, 348], scope: 'Names the Greek and Roman figures and records sea, horse, earthquake, cult, and iconographic associations.' },
  'zeus-jupiter': { entry: 'Zeus, called Jupiter', printedPages: 'pp. 462–463', scanPages: [472, 473], scope: 'Names the Greek and Roman figures and records selected powers, epithets, places, attributes, and genealogical narratives.' },
}

const work = {
  identity: 'William Smith, A Smaller Classical Dictionary of Biography, Mythology, and Geography (London, 1873)',
  sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/A_smaller_classical_dictionary_of_biography%2C_mythology%2C_and_geography_%28IA_smallerclassical00smit%29.pdf',
  archiveIdentity: 'Internet Archive scan distributed through Wikimedia Commons',
  sourceSha256: 'sha256:2701bc665deefddd1934d0d314bc790a293aeb4e2d32f594dad4fc67369f7c31',
  rightsBasis: 'public-domain-historical-work; bounded original paraphrase only',
  inspectionMethod: 'Downloaded public-domain scan; OCR was used to locate entries and page images were checked against printed page headers.',
  boundary: 'This is a nineteenth-century reference synthesis, not a primary ancient text, modern classical consensus, proof of equivalence, common origin, or living theological authority. Every route must attribute the frame to Smith and preserve Greek evidence, Roman reception, and later comparison as different propositions.',
}

const sources = Object.entries(entryLocators).map(([topic, locator]) => ({
  sourceId: `t27-smith-1873-${topic}`,
  topic,
  ...work,
  locator: `s.v. “${locator.entry},” ${locator.printedPages}; scan PDF pages ${locator.scanPages.join('–')}`,
  inspectedDepth: 'complete-entry',
  contentIdentityVerified: true,
  locatorVerified: true,
  scope: locator.scope,
  supportsRoles: [...roles],
  passageStored: false,
}))

const cohortBody = {
  schemaVersion: 'maha-federation-readiness-tranche/27.0',
  frozenOn: '2026-09-07',
  sourceLedger: { provenanceDigest: ledger.provenanceDigest },
  sourceCandidateMap: { provenanceDigest: map.provenanceDigest },
  sourceSemanticReviews: [semantic11.provenanceDigest, semantic12.provenanceDigest],
  sourceDependencyReviews: [dependencies11.provenanceDigest, dependencies12.provenanceDigest],
  selectionRule: 'All 36 unresolved Greek/Roman mythology candidates in the source-identity, epithet-and-cult, and reception-and-comparison roles.',
  counts: { candidates: selected.length, concepts: 12, rolesPerConcept: 3 },
  candidates: selected.map((row, index) => ({ selectionOrder: index + 1, candidateId: row.candidateId, candidateDigest: digest(row), conceptId: row.conceptId, routeRole: row.routeRole, path: row.path })),
  execution: { publicRoutesGenerated: 0, buildRun: false, deployed: false },
}
writeFileSync(`${F}/federation-readiness-tranche-27-cohort-v1.json`, `${JSON.stringify(signed(cohortBody), null, 2)}\n`)
writeFileSync(`${F}/federation-readiness-tranche-27-source-inspections-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-27-sources/1.0', inspectedOn: '2026-09-07', counts: { works: 1, entryInspections: sources.length }, inspections: sources, privacyBoundary: 'Bibliographic, locator, rights, scope, and boundary metadata only; no scanned pages or source passages are stored.' }), null, 2)}\n`)

const semanticById = new Map([...semantic11.entries, ...semantic12.entries].map((row) => [row.candidateId, row]))
const dependencyById = new Map([...dependencies11.entries, ...dependencies12.entries].map((row) => [row.candidateId, row]))
const sourceByTopic = new Map(sources.map((row) => [row.topic, row]))
const decisions = selected.map((candidate) => {
  const topic = candidate.conceptId.split(':').at(-1)!
  const source = sourceByTopic.get(topic)
  const semanticReview = semanticById.get(candidate.candidateId)
  const dependency = dependencyById.get(candidate.candidateId)
  const methodAnchorsComplete = Boolean(dependency?.structurallyResolved && (dependency.methodAnchorsComplete ?? dependency.dependencies.length >= 3))
  const hubDependencyCorrect = Boolean(dependency?.structurallyResolved && (dependency.hubDependencyCorrect ?? (dependency.missing?.length ?? 0) === 0))
  const ready = Boolean(source && semanticReview?.disposition === 'retain-distinct' && dependency?.structurallyResolved && methodAnchorsComplete && hubDependencyCorrect)
  return {
    candidateId: candidate.candidateId,
    candidateDigest: digest(candidate),
    conceptId: candidate.conceptId,
    siteId: candidate.siteId,
    routeRole: candidate.routeRole,
    path: candidate.path,
    sourceAssessment: { sourceIds: source ? [source.sourceId] : [], exactLocator: source?.locator ?? null, roleSupported: ready },
    semanticAssessment: semanticReview ? { disposition: semanticReview.disposition, answerBoundary: semanticReview.answerBoundary, nonOverlapFinding: semanticReview.nonOverlapFinding } : null,
    dependencyAssessment: dependency ? { dependencies: dependency.dependencies, methodAnchorsComplete, hubDependencyCorrect, structurallyResolved: dependency.structurallyResolved } : null,
    axes: { sourceIdentity: source ? 'verified' : 'missing', locator: source ? 'exact-printed-pages-and-scan-pages' : 'missing', rights: source ? 'public-domain' : 'missing', scope: source ? 'source-specific-historical-synthesis' : 'missing', boundary: source ? 'nineteenth-century-frame-required' : 'missing', dependency: dependency?.structurallyResolved ? 'validated' : 'incomplete' },
    decision: ready ? 'evidence-ready' : 'revise',
    finding: ready ? `The exact ${candidate.routeRole} route is distinct, dependency-complete, and supportable as an explicitly attributed reading of Smith’s 1873 entry; no ancient-source, modern-consensus, equivalence, or theological claim is inherited.` : 'The exact route lacks a complete source, semantic, or dependency assessment.',
    noInheritance: 'Evidence does not transfer among sibling roles. The same inspected entry is separately bounded to each route’s reviewed answer contract.',
    activeBindingChanged: false,
  }
})
const counts = { candidates: decisions.length, evidenceReady: decisions.filter((row) => row.decision === 'evidence-ready').length, revise: decisions.filter((row) => row.decision === 'revise').length, blocked: 0 }
if (counts.evidenceReady + counts.revise !== 36) throw new Error('t27-decision-partition')
writeFileSync(`${F}/federation-readiness-tranche-27-decisions-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-27-decisions/1.0', frozenOn: '2026-09-07', appendOnly: true, counts, decisions }), null, 2)}\n`)

const sourceById = new Map(sources.map((row) => [row.sourceId, row]))
const specifications = decisions.filter((row) => row.decision === 'evidence-ready').map((decision) => {
  const candidate = selected.find((row) => row.candidateId === decision.candidateId)!
  const source = sourceById.get(decision.sourceAssessment.sourceIds[0])!
  return {
    candidateId: candidate.candidateId,
    candidateDigest: decision.candidateDigest,
    canonicalUrl: candidate.url,
    title: candidate.title,
    conceptId: candidate.conceptId,
    routeRole: candidate.routeRole,
    requiredSections: ['Direct answer', 'Smith’s historical framing', 'Located evidence', 'Greek and Roman relationship', 'Limits and later scholarship', 'Related concepts'],
    boundedQuestions: [`What does Smith’s 1873 entry say about ${candidate.title.split(' — ')[0]}?`, 'Which printed pages support this answer?', 'Does a paired Greek and Roman name establish identity?', 'What is specific to cult, place, or period?', 'What requires primary ancient texts or modern scholarship?'],
    sourceBindings: [{ sourceId: source.sourceId, identity: source.identity, locator: source.locator, rightsBasis: source.rightsBasis, scope: source.scope, boundary: source.boundary }],
    requiredDisclosure: 'Historical reference frame: William Smith (1873). This page does not present the entry as modern consensus or proof of theological identity.',
    decisionDigest: digest(decision),
    implementationState: 'specification-only',
    publicRouteCreated: false,
  }
})
writeFileSync(`${F}/federation-readiness-tranche-27-page-specifications-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-27-page-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: specifications.length, boundedQuestions: specifications.length * 5 }, specifications }), null, 2)}\n`)

const deltaBody = {
  schemaVersion: 'maha-federation-readiness-ledger-delta/27.0',
  frozenOn: '2026-09-07',
  baseLedger: { provenanceDigest: ledger.provenanceDigest, implementationReady: 1426, unresolved: 202 },
  priorMergedDeltas: { tranche26: 4, prerequisiteClosure: 1 },
  counts: { reviewed: 36, newlyImplementationReady: counts.evidenceReady, remainUnresolvedInTranche: counts.revise, projectedImplementationReady: 1426 + 4 + 1 + counts.evidenceReady, projectedUnresolved: 202 - 4 - 1 - counts.evidenceReady },
  readyCandidateIds: decisions.filter((row) => row.decision === 'evidence-ready').map((row) => row.candidateId).sort(),
  execution: { unifiedLedgerApplied: false, publicRoutesGenerated: 0, buildRun: false, deployed: false },
}
writeFileSync(`${F}/federation-readiness-tranche-27-ledger-delta-v1.json`, `${JSON.stringify(signed(deltaBody), null, 2)}\n`)
writeFileSync('docs/operations/federation-readiness-tranche-27-v1.md', `# Federation readiness Tranche 27 — Greek/Roman historical-source closure\n\n- Candidates reviewed: ${counts.candidates}\n- Concepts: 12\n- Evidence-ready specifications: ${counts.evidenceReady}\n- Remaining in tranche: ${counts.revise}\n- Projected unified readiness: ${deltaBody.counts.projectedImplementationReady} / 1,628\n- Projected unresolved: ${deltaBody.counts.projectedUnresolved}\n\nThe source is William Smith’s public-domain 1873 dictionary, inspected at twelve complete entries with exact printed and scan-page locators. It licenses only attributed historical-reference answers. It does not become a primary ancient source, modern scholarly consensus, proof of Greek/Roman identity, common origin, or theological authority.\n\nNo route was generated, no build ran, no release changed, and nothing was deployed.\n`)

console.log(JSON.stringify({ cohort: cohortBody.counts, decisions: counts, specifications: specifications.length, delta: deltaBody.counts }))
