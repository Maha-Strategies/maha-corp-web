/**
 * Candidate map v3: the 32 definitions the map never contained.
 *
 * Tranches 13-17 left 94 dependency records blocked on 32 distinct definitions,
 * every one on maha-research. They are not mislabelled and not reviewed out of
 * order — they simply are not in the map. No review can reach them, so closing
 * the gap needs a new map version rather than another tranche.
 *
 * v2 is not edited. Its digest is bound into every tranche artifact including
 * Codex's Tranches 1-12, and rewriting it would invalidate those bindings. This
 * follows the v1 -> v2 precedent: a successor map plus a lineage artifact
 * recording what was retained, superseded and added.
 *
 * Every added candidate is constructed from a requirement the map already
 * states. The concept id and its canonical owner come from the dependents that
 * declared them; the shape follows the existing maha-research definitions. No
 * concept is invented, and nothing about the new routes is asserted beyond
 * identity: evidencePlan is not-started on all six axes, exactly as every other
 * candidate in the map, so a new definition is a candidate for review and not a
 * page that has been reviewed.
 *
 *   node --experimental-strip-types scripts/generate-federation-candidate-map-v3.ts
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const OUT = 'content/federation'
const digest = (s: string) => `sha256:${createHash('sha256').update(s, 'utf8').digest('hex')}`

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

type Candidate = Record<string, unknown> & {
  candidateId: string
  siteId: string
  conceptId: string
  routeRole: string
  conceptAuthority: { canonicalOwner: string; role: string; boundary: string }
}

const v2 = JSON.parse(readFileSync(`${OUT}/federation-route-candidates-v2.json`, 'utf8')) as
  { candidates: Candidate[] } & Record<string, unknown>

/* -- what is genuinely absent --------------------------------------------- */

const required = new Map<string, { conceptId: string; owner: string; dependents: string[] }>()
for (const t of ['13', '14', '15', '16', '17']) {
  const deps = JSON.parse(readFileSync(`${OUT}/federation-tranche-${t}-dependency-validation-v1.json`, 'utf8')) as
    { dependencies: { candidateId: string; conceptId: string; declaredOwner: string; state: string }[] }
  for (const d of deps.dependencies) {
    if (d.state !== 'missing') continue
    const key = `${d.conceptId}|${d.declaredOwner}`
    const entry = required.get(key) ?? { conceptId: d.conceptId, owner: d.declaredOwner, dependents: [] }
    entry.dependents.push(d.candidateId)
    required.set(key, entry)
  }
}

/**
 * Only concepts with no definition on the declared owner.
 *
 * Redundant given how `required` is built: a record reaches it only in state
 * `missing`, which already means no such definition exists — a definition that
 * exists but is unreviewed is `awaiting-definition-review`. Removing this
 * filter therefore changes nothing today, and a behavioural test cannot catch
 * its removal. It is kept as the check that still holds if the upstream state
 * vocabulary changes, and annotated so it is not mistaken for the thing doing
 * the work. What does the work is `dependencyGapIsGenuine`, which is tested
 * directly.
 */
const absent = [...required.values()]
  .filter((r) => !v2.candidates.some(
    (c) => c.conceptId === r.conceptId && c.routeRole === 'definition' && c.siteId === r.owner))
  .sort((a, b) => a.conceptId.localeCompare(b.conceptId))

/* -- construction ---------------------------------------------------------- */

const HOST: Record<string, string> = { 'maha-research': 'research.mahastrategies.com' }
const GROUP: Record<string, string> = { 'maha-research': 'research-objects' }

const titleFor = (conceptId: string) =>
  conceptId.split(':').pop()!.split('-')
    .map((w) => (w.length <= 3 && w === w.toLowerCase() && ['doi', 'api'].includes(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ')

/**
 * A deterministic id derived from the concept and owner.
 *
 * Random ids would make the map non-reproducible; deriving from the concept
 * means regenerating produces the same candidate, and two runs cannot disagree
 * about what was added.
 */
const idFor = (conceptId: string, owner: string) =>
  `cand_${digest(`${conceptId}|${owner}|definition|v3`).slice(7, 31)}`

const added: Candidate[] = absent.map((r) => {
  const family = r.conceptId.split(':')[3]
  const slug = r.conceptId.split(':').pop()!
  const path = `/federation/research/${slug}/definition`
  return {
    candidateId: idFor(r.conceptId, r.owner),
    siteId: r.owner,
    canonicalHost: HOST[r.owner] ?? 'research.mahastrategies.com',
    groupId: GROUP[r.owner] ?? 'research-objects',
    routeRole: 'definition',
    path,
    url: `https://${HOST[r.owner] ?? 'research.mahastrategies.com'}${path}`,
    title: `${titleFor(r.conceptId)} — Definition`,
    searchIntent:
      `Understand ${titleFor(r.conceptId)} through the definition lens in Research Objects on ${HOST[r.owner] ?? 'research.mahastrategies.com'}.`,
    demandEvidence: {
      basis: 'category-prior-not-observed',
      observedQueries: 0,
      observedImpressions: null,
      warning: 'This score orders research only. It is not route-specific search evidence or a publication claim.',
    },
    conceptId: r.conceptId,
    conceptFamilyId: family,
    conceptAuthority: {
      canonicalOwner: r.owner,
      role: 'canonical-owner',
      boundary:
        `This route is the canonical definition of ${family} for ${r.owner}. It owns the concept on this property ` +
        'and does not govern how other properties apply it. Owning a definition is not evidence for it: the ' +
        'definition still requires an inspected source like any other claim.',
    },
    typedRelationships: [
      { type: 'defines', target: r.conceptId },
      { type: 'governed-by', target: 'urn:maha:concept:governance' },
    ],
    // Not-started on all six axes, as every candidate in the map is. Adding a
    // definition creates something to review, never something reviewed.
    evidencePlan: {
      sourceIdentity: 'not-started',
      contentInspection: 'not-started',
      locatorInspection: 'not-started',
      rightsReview: 'not-started',
      alignmentAudit: 'not-started',
      exactRevisionReview: 'not-started',
    },
    routeContract: {
      selfCanonical: true,
      canonicalOwner: r.owner,
      allowedContent: ['definition of the concept', 'scope and boundary', 'inspected source citations'],
      prohibitedContent: ['application guidance owned by another property', 'unsourced assertion'],
    },
    duplicateScreen: {
      screenedAgainst: 'v2 definitions for the same concept on the same property',
      result: 'no existing definition found; this candidate supplies the missing one',
    },
    scores: { weighted: 0 },
    publication: { state: 'candidate-not-published' },
    // Rank and tranche are unassigned: v3 additions have not been ranked or
    // allocated, and inventing values would imply an ordering nothing produced.
    rank: null,
    tranche: null,
    addedIn: 'v3',
    unlocksDependents: r.dependents.length,
  }
})

/* -- emit ------------------------------------------------------------------ */

const v3Candidates = [...v2.candidates, ...added]
  .sort((a, b) => a.candidateId.localeCompare(b.candidateId))

const v3Body = {
  ...v2,
  schemaVersion: 'maha-federation-route-candidates/3.0',
  frozenOn: '2026-09-06',
  previousCandidateMapDigest: digest(canonicalJson(v2.candidates)),
  supersedes: 'federation-route-candidates-v2.json',
  additionPurpose:
    'Supplies the 32 canonical definitions that Tranches 13-17 found absent from v2. Every one was required by a ' +
    'dependent already in the map and blocked 94 dependency records between them.',
  counts: {
    retained: v2.candidates.length,
    added: added.length,
    total: v3Candidates.length,
    dependentsUnblocked: added.reduce((n, c) => n + ((c.unlocksDependents as number) ?? 0), 0),
  },
  candidates: v3Candidates,
}
writeFileSync(`${OUT}/federation-route-candidates-v3.json`,
  `${JSON.stringify({ ...v3Body, provenanceDigest: digest(canonicalJson(v3Body)) }, null, 2)}\n`)

const lineageBody = {
  schemaVersion: 'maha-federation-candidate-lineage/3.0',
  previousCandidateMapDigest: digest(canonicalJson(v2.candidates)),
  migrationPurpose:
    'Add the canonical definitions that v2 never contained. v2 is retained unchanged: its digest is bound into ' +
    'every tranche artifact including Tranches 1-12, and editing it would invalidate those bindings.',
  rules: [
    'A definition is added only where no definition for that concept exists on the declared owner in v2.',
    'A concept whose definition exists but is unreviewed is awaiting review, not absent, and is not duplicated here.',
    'Candidate ids are derived from the concept and owner, so regeneration is reproducible.',
    'Added candidates carry evidencePlan not-started on all six axes. They are candidates for review, not reviewed pages.',
    'rank and tranche are null: nothing has ranked or allocated them.',
  ],
  counts: {
    retainedCandidates: v2.candidates.length,
    supersededCandidates: 0,
    addedCandidates: added.length,
    dependentsUnblocked: added.reduce((n, c) => n + ((c.unlocksDependents as number) ?? 0), 0),
  },
  supersededCandidates: [] as unknown[],
  addedCandidates: added.map((c) => ({
    candidateId: c.candidateId,
    candidateObjectDigest: digest(canonicalJson(c)),
    conceptId: c.conceptId,
    siteId: c.siteId,
    path: c.path,
    unlocksDependents: c.unlocksDependents,
  })),
}
writeFileSync(`${OUT}/federation-candidate-lineage-v3.json`,
  `${JSON.stringify({ ...lineageBody, provenanceDigest: digest(canonicalJson(lineageBody)) }, null, 2)}\n`)

console.log(`absent definitions found: ${absent.length}`)
console.log(`v2 ${v2.candidates.length} -> v3 ${v3Candidates.length} (added ${added.length})`)
console.log(`dependency records unblocked: ${lineageBody.counts.dependentsUnblocked}`)
console.log(`by family: ${JSON.stringify(added.reduce<Record<string, number>>((a, c) => ({ ...a, [c.conceptFamilyId as string]: (a[c.conceptFamilyId as string] ?? 0) + 1 }), {}))}`)
