import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })
type Candidate = { candidateId: string; conceptId: string; siteId: string; routeRole: string; path: string; url: string; title: string; conceptAuthority: { canonicalOwner: string; role: string; boundary: string }; typedRelationships: { type: string; target: string }[] }
type Decision = { candidateId: string; state: string; reason: string; sourceIds: string[] }
type Source = { sourceId: string; identity: string; locator: string; rightsBasis: string; scope: string; boundary: string; roles: string[]; kind: string; passageStored: boolean }

const map = read('federation-route-candidates-v5.json') as { provenanceDigest: string; candidates: Candidate[] }
const priority = read('federation-readiness-recovery-priority-v1.json') as { provenanceDigest: string; priorities: { candidateId: string; priorityScore: number }[] }
const ledger = read('federation-unified-readiness-ledger-v7.json') as { provenanceDigest: string; entries: (Candidate & { implementationState: string; state: string })[] }
const t24 = read('federation-readiness-tranche-24-decisions-v1.json') as { provenanceDigest: string; decisions: { candidateId: string; decision: string; finding: string }[] }
const byId = new Map(map.candidates.map((row) => [row.candidateId, row]))
const ledgerById = new Map(ledger.entries.map((row) => [row.candidateId, row]))
const unresolved = new Set(ledger.entries.filter((row) => row.implementationState === 'unresolved').map((row) => row.candidateId))
const t24Ids = new Set(t24.decisions.map((row) => row.candidateId))
const carried = t24.decisions.filter((row) => row.decision === 'revise' && ledgerById.get(row.candidateId)?.routeRole !== 'definition').map((row) => ({ candidateId: row.candidateId, priorityScore: null, selectionBasis: 'tranche-24-revision-requirement' }))
const next = priority.priorities.filter((row) => unresolved.has(row.candidateId) && !t24Ids.has(row.candidateId) && ledgerById.get(row.candidateId)?.routeRole !== 'definition').slice(0, 49).map((row) => ({ ...row, selectionBasis: 'next-untouched-unresolved-non-definition' }))
const selected = [...carried, ...next].map((selection, index) => {
  const candidate = byId.get(selection.candidateId)
  if (!candidate) throw new Error(`t25-candidate-missing:${selection.candidateId}`)
  return { selectionOrder: index + 1, ...selection, candidate, candidateDigest: digest(candidate) }
})
if (carried.length !== 51 || next.length !== 49 || selected.length !== 100 || selected.some((row) => row.candidate.routeRole === 'definition') || new Set(selected.map((row) => row.candidate.candidateId)).size !== 100) throw new Error('t25-cohort-invalid')

const cohortBody = {
  schemaVersion: 'maha-federation-readiness-tranche/25.0',
  frozenOn: '2026-09-07',
  sourceLedger: { provenanceDigest: ledger.provenanceDigest },
  sourcePriorityLedger: { provenanceDigest: priority.provenanceDigest },
  sourceTranche24: { provenanceDigest: t24.provenanceDigest },
  selectionRule: 'All 51 Tranche 24 revise decisions whose route role is not definition, then the first 49 unresolved priority rows absent from Tranche 24 whose route role is not definition. Every unresolved definition is reserved for the parallel prerequisite-definition lane.',
  exclusion: { routeRoles: ['definition'], reason: 'Claude owns the prerequisite-definition cohort; ordinary review may not modify or count it.' },
  counts: { candidates: 100, priorRevisionRequirements: 51, newUnreviewed: 49, excludedDefinitions: ledger.entries.filter((row) => row.implementationState === 'unresolved' && row.routeRole === 'definition').length, distinctConcepts: new Set(selected.map((row) => row.candidate.conceptId)).size },
  candidates: selected.map((row) => ({ selectionOrder: row.selectionOrder, selectionBasis: row.selectionBasis, priorityScore: row.priorityScore, candidateId: row.candidate.candidateId, candidateDigest: row.candidateDigest, conceptId: row.candidate.conceptId, siteId: row.candidate.siteId, routeRole: row.candidate.routeRole, path: row.candidate.path })),
  execution: { publicRoutesGenerated: 0, buildRun: false, deployed: false },
}
writeFileSync(`${F}/federation-readiness-tranche-25-cohort-v1.json`, `${JSON.stringify(signed(cohortBody), null, 2)}\n`)

const sources: Source[] = [
  { sourceId: 'perseus-rights-policy', identity: 'Perseus copyright and reuse policy — Perseus Digital Library, Tufts University', locator: 'https://www.perseus.tufts.edu/hopper/help/copyright.jsp — Copyrighted materials; Public-domain materials; XML downloads and item-level credits', rightsBasis: 'reference-only; item-level authorization remains necessary unless the item is public domain or separately licensed', scope: 'Explains repository item-level rights and reuse checks.', boundary: 'Repository access is not a blanket reuse license; editions, translations, commentary, images, and XML may have different rights.', roles: ['source-identity'], kind: 'repository-rights-policy', passageStored: false },
  { sourceId: 't25-smith-athena', identity: 'Athena — A Dictionary of Greek and Roman Biography and Mythology, William Smith, ed. (1873)', locator: 'https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.04.0104%3Aentry%3Dathena-bio-1 — Athena entry', rightsBasis: 'reference-only bounded paraphrase; Perseus item-level rights policy applies', scope: 'Historical lexicographic account of Greek Athena traditions and names.', boundary: 'A nineteenth-century dictionary is not current scholarly consensus and does not by itself establish Roman Minerva, cult continuity, or original identity.', roles: ['source-identity'], kind: 'historical-scholarship', passageStored: false },
  { sourceId: 't25-smith-minerva', identity: 'Minerva — A Dictionary of Greek and Roman Biography and Mythology, William Smith, ed. (1873)', locator: 'https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.04.0104%3Aentry%3Dminerva-bio-1 — Minerva entry; paragraphs distinguishing Roman Minerva from later identification with Athena', rightsBasis: 'reference-only bounded paraphrase; Perseus item-level rights policy applies', scope: 'Historical lexicographic account distinguishing Roman Minerva and later Greek identification or attribute transfer.', boundary: 'Does not prove that Athena and Minerva were originally identical, supply balanced primary passages, or establish current scholarly consensus.', roles: ['source-identity'], kind: 'historical-scholarship', passageStored: false },
  { sourceId: 't25-smith-aphrodite', identity: 'Aphrodite — A Dictionary of Greek and Roman Biography and Mythology, William Smith, ed. (1873)', locator: 'https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.04.0104%3Aentry%3Daphrodite-bio-1 — Aphrodite entry', rightsBasis: 'reference-only bounded paraphrase; Perseus item-level rights policy applies', scope: 'Historical lexicographic account of Greek Aphrodite traditions and cult descriptions.', boundary: 'Does not by itself establish Roman Venus, original identity, or current scholarly consensus.', roles: ['source-identity'], kind: 'historical-scholarship', passageStored: false },
  { sourceId: 't25-smith-venus', identity: 'Venus — A Dictionary of Greek and Roman Biography and Mythology, William Smith, ed. (1873)', locator: 'https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.04.0104%3Aentry%3Dvenus-bio-1 — Venus entry; opening account of early Roman Venus and later identification with Aphrodite', rightsBasis: 'reference-only bounded paraphrase; Perseus item-level rights policy applies', scope: 'Historical lexicographic account distinguishing early Roman Venus from later Greek identification and transferred attributes.', boundary: 'Does not prove original equivalence, supply a Roman primary passage, or establish current scholarly consensus.', roles: ['source-identity'], kind: 'historical-scholarship', passageStored: false },
]
writeFileSync(`${F}/federation-readiness-tranche-25-source-inspections-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-25-sources/1.0', inspectedOn: '2026-09-07', counts: { inspections: sources.length }, inspections: sources, privacyBoundary: 'Only source identity, locator, rights, scope, and boundary metadata are retained; no source passage is stored.' }), null, 2)}\n`)

const priorExact = new Map<string, Decision>()
for (const name of readdirSync(F).filter((name) => /(?:tranche|readiness-tranche)-\d+.*decisions.*\.json$/.test(name) && name !== 'federation-readiness-tranche-25-decisions-v1.json').sort()) {
  const artifact = read(name) as { entries?: { candidateId: string; disposition: string; reason: string; sourceIds?: string[] }[]; decisions?: { candidateId: string; decision?: string; finalState?: string; finding?: string; reason?: string; sourceAssessment?: { sourceIds?: string[] } }[] }
  for (const row of artifact.entries ?? []) priorExact.set(row.candidateId, { candidateId: row.candidateId, state: row.disposition, reason: row.reason, sourceIds: row.sourceIds ?? [] })
  for (const row of artifact.decisions ?? []) priorExact.set(row.candidateId, { candidateId: row.candidateId, state: row.decision ?? row.finalState ?? 'revise', reason: row.finding ?? row.reason ?? 'Prior exact-candidate decision remains unresolved.', sourceIds: row.sourceAssessment?.sourceIds ?? [] })
}
const partialEvidence = new Map([
  ['cand_c12add199249649d20ce777c', ['perseus-rights-policy', 't25-smith-athena', 't25-smith-minerva']],
  ['cand_d16bd0aeeef4d38b1bfb0f2d', ['perseus-rights-policy', 't25-smith-aphrodite', 't25-smith-venus']],
])
const decisions = selected.map((row) => {
  const candidate = row.candidate
  const prior = priorExact.get(candidate.candidateId)
  const sourceIds = partialEvidence.get(candidate.candidateId) ?? prior?.sourceIds ?? []
  const sourceRows = sourceIds.map((id) => sources.find((source) => source.sourceId === id)).filter((source): source is Source => Boolean(source))
  const dependencyValid = candidate.typedRelationships.length >= 3 && candidate.typedRelationships.some((item) => item.target === candidate.conceptId)
  const decision: 'revise' | 'blocked' = prior?.state === 'blocked' || ledgerById.get(candidate.candidateId)?.state === 'blocked' ? 'blocked' : 'revise'
  let finding = prior ? `Prior exact-candidate decision remains controlling: ${prior.reason}` : `The exact ${candidate.routeRole} role remains unresolved; adjacent sources and sibling roles do not transfer.`
  if (partialEvidence.has(candidate.candidateId)) finding = 'Balanced historical lexicographic entries now document distinction and later identification, but the existing exact-candidate requirement for balanced Greek and Roman primary passages plus current scholarship remains unmet.'
  return {
    selectionOrder: row.selectionOrder,
    selectionBasis: row.selectionBasis,
    candidateId: candidate.candidateId,
    candidateDigest: row.candidateDigest,
    conceptId: candidate.conceptId,
    siteId: candidate.siteId,
    routeRole: candidate.routeRole,
    path: candidate.path,
    dependency: { canonicalOwner: candidate.conceptAuthority.canonicalOwner, authorityRole: candidate.conceptAuthority.role, authorityBoundary: candidate.conceptAuthority.boundary, typedRelationships: candidate.typedRelationships, valid: dependencyValid },
    sourceAssessment: { sourceIds, locators: sourceRows.map((source) => source.locator), roleSupported: false, evidenceState: sourceRows.length ? 'partial-inspected' : 'missing-or-prior-only' },
    axes: { sourceIdentity: sourceRows.length ? 'inspected-partial' : 'missing-or-prior-only', locator: sourceRows.length ? 'exact' : 'missing-or-prior-only', rights: sourceRows.length ? 'recorded' : 'missing-or-prior-only', scope: 'not-established-for-exact-role', boundary: sourceRows.length ? 'recorded' : 'missing-or-prior-only', dependency: dependencyValid ? 'validated' : 'incomplete' },
    decision,
    finding,
    noInheritance: 'No source, sibling role, paired deity, tradition, policy, product, or authorial concept transfers authority to another route role.',
    activeBindingChanged: false,
  }
})
const counts = { candidates: 100, evidenceReady: 0, revise: decisions.filter((row) => row.decision === 'revise').length, blocked: decisions.filter((row) => row.decision === 'blocked').length }
if (counts.revise + counts.blocked !== 100 || decisions.some((row) => row.dependency.valid !== true)) throw new Error('t25-review-invalid')
writeFileSync(`${F}/federation-readiness-tranche-25-decisions-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-25-decisions/1.0', frozenOn: '2026-09-07', appendOnly: true, counts, decisions }), null, 2)}\n`)

const specifications: unknown[] = []
writeFileSync(`${F}/federation-readiness-tranche-25-page-specifications-v1.json`, `${JSON.stringify(signed({ schemaVersion: 'maha-federation-readiness-tranche-25-page-specifications/1.0', frozenOn: '2026-09-07', counts: { specifications: 0, boundedQuestions: 0 }, specifications, reason: 'No candidate met all exact evidence, locator, rights, scope, boundary, and dependency requirements.' }), null, 2)}\n`)

const deltaBody = { schemaVersion: 'maha-federation-readiness-ledger-delta/25.0', frozenOn: '2026-09-07', baseLedger: { provenanceDigest: ledger.provenanceDigest, implementationReady: 1426, unresolved: 202 }, ownershipBoundary: 'Non-definition ordinary candidate-review lane only. This delta is not a unified ledger and does not incorporate or modify Claude’s prerequisite-definition work.', counts: { reviewed: 100, newlyImplementationReady: 0, remainUnresolved: 100, excludedDefinitions: cohortBody.counts.excludedDefinitions }, readyCandidateIds: [], execution: { ledgerApplied: false, publicRoutesGenerated: 0, buildRun: false, deployed: false } }
writeFileSync(`${F}/federation-readiness-tranche-25-ledger-delta-v1.json`, `${JSON.stringify(signed(deltaBody), null, 2)}\n`)
writeFileSync('docs/operations/federation-readiness-tranche-25-v1.md', `# Federation readiness Tranche 25 — ordinary lane\n\n- Carried non-definition revisions: 51\n- Next untouched non-definition candidates: 49\n- Definition candidates excluded for Claude: ${cohortBody.counts.excludedDefinitions}\n- Evidence-ready: 0\n- Revise: ${counts.revise}\n- Blocked: ${counts.blocked}\n- Specifications: 0\n\nThe historical Perseus dictionary entries for Athena/Minerva and Aphrodite/Venus close part of the source-identity gap, but they do not replace the required balanced Greek and Roman primary passages or current scholarship. Both routes remain revise. All other exact prior decisions remain controlling.\n\nThis tranche emits a non-conflicting delta only. It does not update the unified ledger, create routes, run a build, alter a release, or deploy.\n`)
console.log(JSON.stringify({ cohort: cohortBody.counts, decisions: counts, inspections: sources.length, specifications: 0, delta: deltaBody.counts }))
