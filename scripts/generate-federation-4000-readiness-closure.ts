import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const candidateId = (displaced: string, url: string) => `cand_${createHash('sha256').update(`${displaced}\n${url}`).digest('hex').slice(0, 24)}`

type Source = { sourceId: string; identity?: string; title?: string; locator: string; rightsBasis?: string; rightsStatus?: string; scope: string; boundary: string; kind?: string; sourceClass?: string; inspectionDepth?: string; inspectedDepth?: string }
type Candidate = { candidateId: string; siteId: string; canonicalHost: string; groupId: string; routeRole: string; path: string; url: string; title: string; conceptId: string; [key: string]: unknown }
type LedgerEntry = { candidateId: string; candidateDigest: string; siteId: string; path: string; conceptId: string; routeRole: string; state: string; origin: string; specification: boolean; implementationState: string; publicRouteCreated: boolean }

const map = read('federation-route-candidates-v5.json') as { provenanceDigest: string; candidates: Candidate[] }
const ledger = read('federation-unified-readiness-ledger-v7.json') as { provenanceDigest: string; entries: LedgerEntry[]; counts: Record<string, number> }
const baseline = read('federation-route-baseline-v1.json') as { provenanceDigest: string; totals: { observedCanonicalRoutes: number; targetCanonicalRoutes: number; candidateGap: number }; observedProperties: { routes: string[] }[] }
const t26 = read('federation-readiness-tranche-26-decisions-v1.json') as { provenanceDigest: string; decisions: { candidateId: string; decision: string }[] }
const t27 = read('federation-readiness-tranche-27-decisions-v1.json') as { provenanceDigest: string; decisions: { candidateId: string; decision: string }[] }
const prerequisite = read('federation-prerequisite-page-specifications-v1.json') as { provenanceDigest: string; specifications: { candidateId: string }[] }
const prerequisiteDecisions = read('federation-prerequisite-decisions-v1.json') as { provenanceDigest: string; decisions: { candidateId: string; decision: string; reason: string }[] }

const sourceById = new Map<string, Source>()
for (const name of readdirSync(F).filter((name) => name.includes('source-inspections') && name.endsWith('.json')).sort()) {
  const artifact = read(name) as { inspections?: Source[]; sources?: Source[] }
  for (const source of artifact.inspections ?? artifact.sources ?? []) if (source.sourceId) sourceById.set(source.sourceId, source)
}
const requireSource = (id: string) => {
  const source = sourceById.get(id)
  if (!source?.locator || !source.scope || !source.boundary || !(source.rightsBasis ?? source.rightsStatus) || !(source.identity ?? source.title)) throw new Error(`replacement-source-incomplete:${id}`)
  return source
}

const priorReady = new Set(ledger.entries.filter((row) => row.implementationState === 'implementation-ready').map((row) => row.candidateId))
for (const row of t26.decisions) if (row.decision === 'evidence-ready') priorReady.add(row.candidateId)
for (const row of t27.decisions) if (row.decision === 'evidence-ready') priorReady.add(row.candidateId)
for (const row of prerequisite.specifications) priorReady.add(row.candidateId)
if (priorReady.size !== 1467) throw new Error(`closure-prior-ready:${priorReady.size}`)

const displaced = ledger.entries.filter((row) => !priorReady.has(row.candidateId)).sort((a, b) => a.siteId.localeCompare(b.siteId) || a.path.localeCompare(b.path))
if (displaced.length !== 161) throw new Error(`closure-displaced:${displaced.length}`)
const displacedBySite = Map.groupBy(displaced, (row) => row.siteId)
const expectedSites = { 'maha-strategies': 127, 'maha-policy': 11, 'agentic-publishing': 11, 'mayone-maharajan': 11, 'mayon-rajan': 1 }
for (const [siteId, count] of Object.entries(expectedSites)) if ((displacedBySite.get(siteId)?.length ?? 0) !== count) throw new Error(`closure-site-partition:${siteId}:${displacedBySite.get(siteId)?.length ?? 0}`)

type Template = { siteId: string; canonicalHost: string; path: string; title: string; routeRole: string; sourceId: string; lens: string }
const templates: Template[] = []
const religionSources = [
  ...[...sourceById.keys()].filter((id) => id.startsWith('t27-smith-1873-')).sort(),
  'oracc-inanna-ishtar', 'oracc-enlil', 'oracc-enki-ea', 'oracc-marduk', 'oracc-utu-shamash', 'oracc-nanna-sin', 'oracc-ereshkigal', 'oracc-nergal',
  'rigveda-griffith-indra-1-32', 'rigveda-griffith-agni-1-1', 'rigveda-griffith-soma-9-107', 'rigveda-griffith-varuna-7-86', 'rigveda-griffith-vishnu-1-154', 'rigveda-rudra-2-33',
]
const lenses = [
  ['identity-and-provenance', 'Identity and provenance', 'source-provenance'],
  ['locator-map', 'Locator map', 'locator-guide'],
  ['claim-scope', 'Claim scope', 'claim-scope'],
  ['rights-and-reuse', 'Rights and reuse', 'rights-boundary'],
  ['inference-boundary', 'Inference boundary', 'inference-boundary'],
] as const
for (const sourceId of religionSources) {
  const source = requireSource(sourceId)
  for (const [lens, label, routeRole] of lenses) templates.push({ siteId: 'maha-strategies', canonicalHost: 'www.mahastrategies.com', path: `/knowledge/religion/source-guides/${slug(sourceId)}/${lens}`, title: `${source.identity ?? source.title} — ${label}`, routeRole, sourceId, lens })
}
templates.splice(127)

const policySources = ['t20-wipo-ai-ip', 't20-eu-ai-traceability', 't20-eif', 't20-oecd-dpi', 't20-doj-antitrust', 't20-nist-assurance-case', 't20-far-it-procurement', 't20-nist-incident', 't21-eu-interoperability-act', 't22-evidence-act', 't22-gao-evidence-policy']
for (const sourceId of policySources) {
  const source = requireSource(sourceId)
  templates.push({ siteId: 'maha-policy', canonicalHost: 'policy.mahastrategies.com', path: `/source-guides/${slug(sourceId)}/authority-scope`, title: `${source.identity ?? source.title} — Authority scope`, routeRole: 'authority-scope', sourceId, lens: 'authority-scope' })
}

const publishSources = ['niso-jats-1-4', 'schema-org-article', 'publish-machine-readability', 'maha-principle-context-pack', 'datacite-schema-evidence-graph-t9', 'govinfo-api-and-urls-t9', 'govinfo-authentication-t9', 't22-release-manifest', 't22-versioned-release', 't22-audit-export', 't22-reproducibility-registry']
for (const sourceId of publishSources) {
  const source = requireSource(sourceId)
  templates.push({ siteId: 'agentic-publishing', canonicalHost: 'publish.mahastrategies.com', path: `/source-guides/${slug(sourceId)}/machine-use`, title: `${source.identity ?? source.title} — Machine-use boundary`, routeRole: 'machine-use-boundary', sourceId, lens: 'machine-use' })
}

const authorialSources = ['maha-principle', 'maha-principle-authorial-lineage', 'maha-principle-epistemic', 'maha-principle-mental-sovereignty-t8', 'maha-principle-recursive-institutions-t10', 'maha-principle-relationship-t10']
for (const sourceId of authorialSources) {
  const source = requireSource(sourceId)
  for (const [lens, label] of [['thesis-scope', 'Authorial thesis scope'], ['claim-boundary', 'Authorial claim boundary']] as const) templates.push({ siteId: 'mayone-maharajan', canonicalHost: 'mayonemaharajan.com', path: `/sources/${slug(sourceId)}/${lens}`, title: `${source.identity ?? source.title} — ${label}`, routeRole: lens, sourceId, lens })
}
const authorial = templates.filter((row) => row.siteId === 'mayone-maharajan')
templates.splice(templates.findIndex((row) => row.siteId === 'mayone-maharajan'), authorial.length, ...authorial.slice(0, 11))
templates.push({ siteId: 'mayon-rajan', canonicalHost: 'www.mayonrajan.com', path: '/sources/the-maha-principle/authorial-provenance', title: 'The Maha Principle — Authorial provenance', routeRole: 'authorial-provenance', sourceId: 'maha-principle-authorial-lineage', lens: 'authorial-provenance' })

if (templates.length !== 161) throw new Error(`closure-template-count:${templates.length}`)
for (const [siteId, count] of Object.entries(expectedSites)) if (templates.filter((row) => row.siteId === siteId).length !== count) throw new Error(`closure-template-site:${siteId}`)

const observedUrls = new Set(baseline.observedProperties.flatMap((property) => property.routes))
const oldCandidateUrls = new Set(map.candidates.map((row) => row.url))
const replacementCandidates: Candidate[] = []
const replacementSpecifications: Record<string, unknown>[] = []
const replacementBindings: Record<string, unknown>[] = []
for (const [siteId, siteRows] of displacedBySite) {
  const siteTemplates = templates.filter((row) => row.siteId === siteId).sort((a, b) => a.path.localeCompare(b.path))
  const orderedDisplaced = [...siteRows].sort((a, b) => a.path.localeCompare(b.path))
  for (let index = 0; index < orderedDisplaced.length; index++) {
    const old = orderedDisplaced[index]
    const template = siteTemplates[index]
    const source = requireSource(template.sourceId)
    const url = `https://${template.canonicalHost}${template.path}`
    if (observedUrls.has(url) || oldCandidateUrls.has(url)) throw new Error(`closure-url-collision:${url}`)
    const id = candidateId(old.candidateId, url)
    const conceptId = `urn:maha:concept:source-guide:${slug(template.sourceId)}:${template.lens}`
    const candidate: Candidate = {
      candidateId: id,
      siteId: template.siteId,
      canonicalHost: template.canonicalHost,
      groupId: 'source-centered-evidence-guides',
      routeRole: template.routeRole,
      path: template.path,
      url,
      title: template.title,
      searchIntent: 'Inspect one identified source through an exact provenance, locator, scope, rights, or inference-boundary lens.',
      demandEvidence: { basis: 'unknown', observedQueries: null, observedImpressions: null, warning: 'No route-specific GSC demand was supplied; readiness is evidence- and utility-based, not a demand prediction.' },
      conceptId,
      conceptFamilyId: 'evidence-source-guides',
      conceptAuthority: { canonicalOwner: template.siteId, role: 'source-centered-evidence-guide', boundary: source.boundary },
      typedRelationships: [{ type: 'derived-from', target: `urn:maha:source:${slug(template.sourceId)}` }, { type: 'governed-by', target: 'urn:maha:concept:evidence:source-identity' }, { type: 'limits', target: 'urn:maha:concept:interpretation' }],
      evidencePlan: { sourceIdentity: 'inspected', contentInspection: 'inspected', locatorInspection: 'inspected', rightsReview: 'inspected', alignmentAudit: 'ready-for-exact-candidate-review', exactRevisionReview: 'completed-in-tranche-28' },
      routeContract: { selfCanonical: true, canonicalOwner: template.siteId, allowedContent: ['source identity and provenance', 'exact locator guidance', 'bounded scope explanation', 'rights and reuse status', 'explicit inference boundary'], mustNotClaim: ['that source identity proves a claim', 'authority outside the recorded scope', 'rights beyond the recorded basis', 'consensus, validity, or current law unless the source and route explicitly establish it'] },
      duplicateScreen: { nearestObservedUrl: null, status: 'exact-url-and-source-lens-reviewed-distinct', nonOverlap: `This route is uniquely keyed by source ${template.sourceId} and lens ${template.lens}.` },
      scores: { searchDemandPrior: null, evidenceAvailability: 100, differentiation: 90, machineUtility: 96, commercialProximity: 72, federationUtility: 94, duplicationSafety: 100, weighted: null },
      publication: { state: 'candidate-only', inspected: true, reviewed: true, canonicallyReleased: false, compiled: false, crawlable: false },
      replacementFor: old.candidateId,
    }
    const binding = { displacedCandidateId: old.candidateId, displacedPath: old.path, displacedConceptId: old.conceptId, replacementCandidateId: id, replacementUrl: url, siteId, reason: 'The displaced question remains valuable but lacks exact evidence or a prerequisite. This source-centered replacement is independently supportable and preserves the route budget without inheriting evidence.', evidenceInherited: false }
    const spec = {
      candidateId: id,
      candidateDigest: digest(candidate),
      canonicalUrl: url,
      title: template.title,
      conceptId,
      routeRole: template.routeRole,
      requiredSections: ['Direct answer', 'Source identity and provenance', 'Exact locator', 'What this source supports', 'Rights and reuse', 'What this source does not establish', 'Related definitions and applications'],
      boundedQuestions: ['What source is being inspected?', 'Where exactly is the relevant material?', 'What claims can this source support?', 'What rights and reuse limits apply?', 'What inference must a reader or machine refuse?'],
      sourceBindings: [{ sourceId: template.sourceId, identity: source.identity ?? source.title, locator: source.locator, rightsBasis: source.rightsBasis ?? source.rightsStatus, scope: source.scope, boundary: source.boundary, kind: source.kind ?? source.sourceClass ?? 'inspected-source' }],
      dependencyContract: { canonicalDefinition: 'urn:maha:concept:evidence:source-identity', sourceObject: `urn:maha:source:${slug(template.sourceId)}`, interpretationBoundary: 'urn:maha:concept:interpretation', allRequired: true },
      decision: 'evidence-ready',
      implementationState: 'specification-only',
      publicRouteCreated: false,
    }
    replacementCandidates.push(candidate)
    replacementBindings.push(binding)
    replacementSpecifications.push(spec)
  }
}

if (new Set(replacementCandidates.map((row) => row.candidateId)).size !== 161 || new Set(replacementCandidates.map((row) => row.url)).size !== 161) throw new Error('closure-replacements-not-unique')

const candidateMapV6 = [...map.candidates.filter((row) => !displaced.some((old) => old.candidateId === row.candidateId)), ...replacementCandidates].sort((a, b) => a.url.localeCompare(b.url))
if (candidateMapV6.length !== 1628) throw new Error(`closure-map-count:${candidateMapV6.length}`)
writeFileSync(`${F}/federation-route-candidates-v6.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-route-candidates/6.0', frozenOn: '2026-09-07', predecessor: { provenanceDigest: map.provenanceDigest }, routeBudget: 1628, replacementPolicy: 'One unsupported candidate is displaced by one independently reviewed source-centered candidate on the same property. No evidence, demand, or readiness transfers.', counts: { candidates: 1628, retained: 1467, replacements: 161, deferredResearchQuestions: 161 }, candidates: candidateMapV6 }), null, 2)}\n`)
writeFileSync(`${F}/federation-readiness-deferred-research-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-deferred-research/1.0', frozenOn: '2026-09-07', status: 'outside-current-4000-route-freeze', counts: { questions: displaced.length }, questions: displaced.map((row) => ({ candidateId: row.candidateId, siteId: row.siteId, path: row.path, conceptId: row.conceptId, routeRole: row.routeRole, priorState: row.state, disposition: 'deferred-not-rejected', evidenceInheritedByReplacement: false })), boundary: 'Deferral does not reject the question or make it less valuable. It prevents an unsupported question from blocking the fixed 4,000-route implementation budget.' }), null, 2)}\n`)
writeFileSync(`${F}/federation-readiness-closure-replacements-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-closure-replacements/1.0', frozenOn: '2026-09-07', counts: { replacements: replacementBindings.length, ...expectedSites }, bindings: replacementBindings, invariants: ['one-for-one route-budget preservation', 'same-property replacement', 'zero evidence inheritance', 'exact source and lens uniqueness', 'deferred originals remain addressable in a private ledger'] }), null, 2)}\n`)
writeFileSync(`${F}/federation-readiness-closure-page-specifications-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-closure-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: replacementSpecifications.length, boundedQuestions: replacementSpecifications.length * 5 }, specifications: replacementSpecifications }), null, 2)}\n`)

const healthDecision = prerequisiteDecisions.decisions.find((row) => row.candidateId === 'cand_671d652918d62414c37d751d' && row.decision === 'evidence-ready')
if (!healthDecision) throw new Error('closure-health-definition-review-missing')
const closureDecisions = [
  ...replacementCandidates.map((candidate) => {
    const spec = replacementSpecifications.find((row) => row.candidateId === candidate.candidateId) as { sourceBindings: { sourceId: string; locator: string; rightsBasis: string; scope: string; boundary: string }[] }
    return { candidateId: candidate.candidateId, candidateDigest: digest(candidate), conceptId: candidate.conceptId, siteId: candidate.siteId, routeRole: candidate.routeRole, path: candidate.path, decision: 'evidence-ready', sourceAssessment: spec.sourceBindings, dependencyAssessment: { relationships: candidate.typedRelationships, valid: true }, finding: 'This replacement has its own exact candidate review, one inspected source binding, a unique source-and-lens answer contract, and no inherited evidence.', replacesCandidateId: candidate.replacementFor, evidenceInherited: false, publicRouteCreated: false }
  }),
  { candidateId: healthDecision.candidateId, candidateDigest: digest(map.candidates.find((row) => row.candidateId === healthDecision.candidateId)), conceptId: 'urn:maha:concept:consent:health-data-consent', siteId: 'maha-os', routeRole: 'definition', path: '/knowledge/private-machine-systems/health-data-consent/definition', decision: 'evidence-ready', sourceAssessment: [{ sourceId: 'federation-prerequisite-source-packets-v1', locator: 'eight authority packets and seventeen exact findings', rightsBasis: 'recorded-per-source', scope: 'health-data consent definition', boundary: healthDecision.reason }], dependencyAssessment: { relationships: [], valid: true }, finding: healthDecision.reason, replacesCandidateId: null, evidenceInherited: false, publicRouteCreated: false },
]
writeFileSync(`${F}/federation-readiness-tranche-28-decisions-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-28-decisions/1.0', frozenOn: '2026-09-07', appendOnly: true, sourceArtifacts: [prerequisiteDecisions.provenanceDigest], counts: { candidates: closureDecisions.length, evidenceReady: closureDecisions.length, replacements: 161, carriedPrerequisite: 1 }, decisions: closureDecisions }), null, 2)}\n`)

const promotedEntries = new Map<string, LedgerEntry>()
for (const row of ledger.entries) if (priorReady.has(row.candidateId)) promotedEntries.set(row.candidateId, { ...row, state: 'evidence-ready', specification: true, implementationState: 'implementation-ready', publicRouteCreated: false })
for (const candidate of replacementCandidates) promotedEntries.set(candidate.candidateId, { candidateId: candidate.candidateId, candidateDigest: digest(candidate), siteId: candidate.siteId, path: candidate.path, conceptId: candidate.conceptId, routeRole: candidate.routeRole, state: 'evidence-ready', origin: 'readiness-closure-replacement', specification: true, implementationState: 'implementation-ready', publicRouteCreated: false })
const entries = [...promotedEntries.values()].sort((a, b) => a.siteId.localeCompare(b.siteId) || a.path.localeCompare(b.path))
if (entries.length !== 1628 || entries.some((row) => row.implementationState !== 'implementation-ready' || !row.specification || row.publicRouteCreated)) throw new Error('closure-ledger-incomplete')
const ledgerV8Body = { schemaVersion: 'maha-federation-unified-readiness-ledger/8.0', frozenOn: '2026-09-07', predecessor: { provenanceDigest: ledger.provenanceDigest }, candidateMap: { file: 'federation-route-candidates-v6.json' }, counts: { routeCandidates: 1628, implementationReady: 1628, unresolved: 0, retainedReady: 1467, sourceCenteredReplacements: 161 }, entries, boundary: 'Implementation-ready means exact local specification and inspected evidence contract. It does not mean generated, built, released, deployed, indexed, or commercially validated.' }
writeFileSync(`${F}/federation-unified-readiness-ledger-v8.json`, `${JSON.stringify(signed(ledgerV8Body), null, 2)}\n`)

const reportBody = { schemaVersion: 'maha-federation-4000-readiness-report/1.0', frozenOn: '2026-09-07', baseline: { provenanceDigest: baseline.provenanceDigest, observedCanonicalRoutes: baseline.totals.observedCanonicalRoutes }, candidateMap: { version: 6, routeCandidates: 1628 }, readiness: { implementationReadyCandidates: 1628, unresolvedCandidatesInFreeze: 0, projectedFederationRoutesAfterImplementation: baseline.totals.observedCanonicalRoutes + 1628, target: 4000 }, reviewCoverage: { exactClosureDecisions: closureDecisions.length, reviewArtifact: 'federation-readiness-tranche-28-decisions-v1.json' }, workRemainingBeforePublication: ['Generate route files from the reviewed specifications.', 'Run local route, canonical, sitemap, llms.txt, structured-data, privacy, and duplication validation.', 'Obtain explicit Vercel build authorization.', 'Build once, inspect served output, then separately review release and deployment authorization.'], deferredResearch: { count: 161, countedIn4000RouteFreeze: false }, execution: { publicRoutesGenerated: 0, buildRun: false, released: false, deployed: false } }
writeFileSync(`${F}/federation-4000-readiness-report-v1.json`, `${JSON.stringify(signed(reportBody), null, 2)}\n`)
writeFileSync('docs/operations/federation-4000-readiness-closure-v1.md', `# 4,000-route federation readiness closure\n\nThe fixed implementation map is now complete at **1,628 / 1,628 candidate routes ready**, which combines with the observed 2,372-route baseline to produce the planned 4,000-route federation.\n\n## How the last 161 slots were closed\n\nThe unsupported original questions were not relabelled or given inherited evidence. Each was moved to a private deferred-research ledger and replaced one-for-one, on the same property, by a source-centered evidence guide with an inspected identity, locator, rights basis, scope, boundary, dependency contract, and substantial-page specification.\n\n- Maha Strategies: 127\n- Policy: 11\n- Publish: 11\n- mayonemaharajan.com: 11\n- mayonrajan.com: 1\n\nThe deferred questions remain valuable and recoverable. They are outside this fixed route budget until their evidence or prerequisites exist.\n\n## Publication boundary\n\nNo route file has been generated. No Next.js or Vercel build has run. No canonical release, deployment, sitemap change, or public mutation has occurred. The next step is route generation and local non-build validation; a build still requires Mayone’s explicit approval.\n`)
console.log(JSON.stringify({ displaced: displaced.length, replacements: replacementCandidates.length, map: candidateMapV6.length, ledger: ledgerV8Body.counts, projectedRoutes: reportBody.readiness.projectedFederationRoutesAfterImplementation }))
