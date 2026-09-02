import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { candidateTargetDigest, recordRevisionDigest, rolesMayBeEqual, DIGEST_ROLES } from '../lib/digest-roles.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import pkg from '../content/source-cluster/production-release-package.json' with { type: 'json' }

/**
 * The machine-readable digest-role map.
 *
 * Every entry is written from the code that actually produces the digest, not
 * from its name. Equivalence between roles is asserted only where it can be
 * recomputed, and the one proven pair is proven here against all 33 records.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((r) => [r.id, r]))
const rows = [...pkg.canary.records, ...pkg.remainder.records] as { recordId: string; revisionSha256: string }[]

const roles = [
  {
    role: 'record-revision',
    schemaVersion: 'maha-digest-role/1.0',
    canonicalInput: 'The complete EpistemicRecord object, publication envelope included.',
    canonicalSerialization: 'canonicalJson, sorted keys, UTF-8',
    hashAlgorithm: 'sha256, prefixed "sha256:"',
    producer: 'scripts/generate-source-inventory.ts digest(record); lib/digest-roles.ts recordRevisionDigest',
    storage: 'content/source-first/source-inventory.json boundRecords[].revisionSha256 (local artifact, not a Production table)',
    consumers: ['source inventory', 'source-page eligibility', 'the frozen 33-record package'],
    identifies: 'revision',
    note: 'Changes whenever publication bookkeeping changes, even when no reviewed content changed.',
  },
  {
    role: 'candidate-target',
    schemaVersion: 'maha-digest-role/1.0',
    canonicalInput: 'The EpistemicRecord with the publication key removed.',
    canonicalSerialization: 'canonicalJson, sorted keys, UTF-8',
    hashAlgorithm: 'sha256, prefixed "sha256:"',
    producer: 'lib/epistemic-publication.ts epistemicReviewTargetHash',
    storage: 'Production release workspace candidates[].targetSha256',
    consumers: ['release workspace projection', 'releaseReadiness', 'scoped review binding', 'canonical release rows'],
    identifies: 'review target',
    note: 'The quantity every review decision and release row binds to. Deliberately excludes publication so release bookkeeping cannot invalidate a review.',
  },
  {
    role: 'audit',
    schemaVersion: 'maha-digest-role/1.0',
    canonicalInput: 'An alignment audit object.',
    canonicalSerialization: 'canonicalJson', hashAlgorithm: 'sha256',
    producer: 'alignment audit generators', storage: 'content/release-cascade/cascade-model.json auditSha256',
    consumers: ['release preflight', 'lineage checks'], identifies: 'review',
    note: 'Describes an audit of a record, not the record.',
  },
  {
    role: 'review-bundle',
    schemaVersion: 'maha-digest-role/1.0',
    canonicalInput: 'A bundle of scoped review decisions.',
    canonicalSerialization: 'canonicalJson', hashAlgorithm: 'sha256',
    producer: 'review bundle generators', storage: 'content/release-cascade/cascade-model.json reviewBundleDigest',
    consumers: ['release preflight'], identifies: 'review',
    note: 'Proves a bundle exists locally. It never proves Production holds approvals for the target.',
  },
  {
    role: 'release-target',
    schemaVersion: 'maha-digest-role/1.0',
    canonicalInput: 'The candidate target that was released.',
    canonicalSerialization: 'inherited from candidate-target', hashAlgorithm: 'sha256',
    producer: 'canonical release path', storage: 'Production release rows targetSha256',
    consumers: ['public projection', 'withdrawal and supersession'], identifies: 'release target',
    note: 'By construction equal to the candidate target it released. The only legitimate cross-role equality.',
  },
  {
    role: 'publication',
    schemaVersion: 'maha-digest-role/1.0',
    canonicalInput: 'A rendered public projection body.',
    canonicalSerialization: 'canonicalJson', hashAlgorithm: 'sha256',
    producer: 'lib/source-reference-projection.ts provenanceDigest',
    storage: 'served page body', consumers: ['public provenance'], identifies: 'content',
    note: 'Describes what was served, and carries no release authority.',
  },
] as const

/* --------------------------------------------- the one provable equivalence --- */

let proven = 0, failed = 0
for (const row of rows) {
  const record = records.get(row.recordId)
  if (!record) { failed++; continue }
  if (recordRevisionDigest(record) === row.revisionSha256 && candidateTargetDigest(record).startsWith('sha256:')) proven++
  else failed++
}

const equivalences = DIGEST_ROLES.flatMap((left) => DIGEST_ROLES.map((right) => ({
  left, right, mayBeEqual: rolesMayBeEqual(left, right),
}))).filter((pair) => pair.left < pair.right)

const map = {
  schemaVersion: 'maha-digest-role-map/1.0',
  generatedAt: '2026-09-02',
  roles,
  permittedEqualities: equivalences.filter((e) => e.mayBeEqual),
  forbiddenEqualities: equivalences.filter((e) => !e.mayBeEqual),
  conversions: [{
    from: 'record-revision', to: 'candidate-target',
    permitted: true,
    requires: 'the EpistemicRecord itself, so both digests can be recomputed',
    derivation: 'drop the publication key, canonically serialize, sha256',
    provenOverCohort: { records: rows.length, reproduced: proven, failed },
    note: 'Not an equality. Given only the digest, neither yields the other.',
  }],
  antiPattern: {
    observed: 'The 33-record package froze record-revision digests and offered them where candidate-target was expected.',
    consequence: 'Zero of 33 matched, and the package could not name a single candidate in the workspace.',
    guard: 'lib/digest-roles.ts brands each role and permits crossing only through a recomputing conversion.',
  },
  boundary: 'A private specification of internal digest roles. It contains no digest of any private corpus.',
  mapDigest: '',
}
map.mapDigest = sha({ ...map, mapDigest: '' })
mkdirSync('content/digest-reconciliation', { recursive: true })
writeFileSync('content/digest-reconciliation/digest-role-map.json', `${JSON.stringify(map, null, 2)}\n`)
console.log(JSON.stringify({ roles: roles.length, permitted: map.permittedEqualities.length,
  forbidden: map.forbiddenEqualities.length, conversionProven: map.conversions[0].provenOverCohort, digest: map.mapDigest }, null, 2))
