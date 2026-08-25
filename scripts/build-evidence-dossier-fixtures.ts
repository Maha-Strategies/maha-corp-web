import { mkdirSync, writeFileSync } from 'node:fs'

import { DEMONSTRATION_DOSSIER } from '../lib/evidence-dossier/demonstration.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { DOSSIER_PACKAGE_VERSION, evidentiaryProjection, type DossierPackage } from '../lib/evidence-dossier/package.ts'
import { DOSSIER_SCHEMA_VERSION } from '../lib/evidence-dossier/schema.ts'

/**
 * Generates the operator fixtures from the committed v0.2 dossier so the valid
 * fixture cannot drift from the source of truth. Invalid fixtures are derived
 * from it by a single deliberate defect each, which keeps the failure isolated.
 */

const DIR = 'content/evidence-dossier/fixtures'
mkdirSync(DIR, { recursive: true })

function seal(pkg: Omit<DossierPackage, 'canonicalPayloadDigest'>): DossierPackage {
  const withDigest = { ...pkg, canonicalPayloadDigest: '' } as DossierPackage
  withDigest.canonicalPayloadDigest = provenanceDigest(evidentiaryProjection(withDigest))
  return withDigest
}

const BASE = seal({
  packageVersion: DOSSIER_PACKAGE_VERSION,
  schemaVersion: DOSSIER_SCHEMA_VERSION,
  packageId: 'pkg-euv-resist-stochastics',
  dossierId: DEMONSTRATION_DOSSIER.dossierId,
  revisionId: 'rev-0002',
  parentDigest: null,
  reviewState: DEMONSTRATION_DOSSIER.reviewState,
  submitted: {
    inquiry: DEMONSTRATION_DOSSIER.inquiry,
    intendedUse: DEMONSTRATION_DOSSIER.intendedUse,
    prohibitedUses: DEMONSTRATION_DOSSIER.prohibitedUses,
  },
  dossier: DEMONSTRATION_DOSSIER,
  attribution: { operatorHandle: 'maha-editorial', role: 'internal-editorial' },
  timestamps: { submittedAt: '2026-08-25T00:00:00Z', validatedAt: null, revisedAt: null },
  presentation: { showComparisonMatrix: true, showPriorRevisions: true, printLayout: 'full' },
})

const write = (name: string, value: unknown) =>
  writeFileSync(`${DIR}/${name}.json`, `${JSON.stringify(value, null, 2)}\n`)

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

// 1. Valid current revision.
write('valid-v0-2', BASE)

// 2. Malformed: not a package at all.
write('malformed', { packageVersion: DOSSIER_PACKAGE_VERSION, note: 'missing every required field' })

// 3. Missing locator on a supporting passage.
const missingLocator = clone(BASE)
missingLocator.revisionId = 'rev-0002-missing-locator'
missingLocator.dossier.passages[0].locator = null
write('missing-locator', seal(missingLocator))

// 4. Invalid parent digest.
const badParent = clone(BASE)
badParent.revisionId = 'rev-0003-bad-parent'
badParent.parentDigest = 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
// Sealed with the wrong parent baked in, so the payload digest is self-consistent
// and the only defect the pipeline can find is the broken lineage.
write('invalid-parent-digest', seal(badParent))

// 5. Prohibited certification wording.
const certifying = clone(BASE)
certifying.revisionId = 'rev-0002-certifying'
certifying.dossier.disclaimer =
  'Maha Strategies LLC certifies these findings and guarantees regulatory approval of the described process.'
write('prohibited-certification-wording', seal(certifying))

// 6. Attempted canonical promotion.
const canonical = clone(BASE)
canonical.revisionId = 'rev-0003-canonical'
canonical.reviewState = 'canonical'
canonical.dossier.reviewState = 'canonical'
write('attempted-canonical-promotion', seal(canonical))

// 7. Legitimate v0.3 revision: an editorial limitation change, no new science.
const v03 = clone(BASE)
v03.revisionId = 'rev-0003'
v03.parentDigest = BASE.canonicalPayloadDigest
v03.timestamps = { submittedAt: '2026-08-26T00:00:00Z', validatedAt: null, revisedAt: '2026-08-26T00:00:00Z' }
v03.dossier.limitations = [
  ...v03.dossier.limitations,
  'Neither inspected source was read in full: only the sections, tables and figures listed in each source record were examined, so statements elsewhere in either document are unassessed.',
]
const sealedV03 = seal(v03)
write('valid-v0-3-revision', sealedV03)

console.log(
  JSON.stringify(
    {
      wrote: 7,
      baseDigest: BASE.canonicalPayloadDigest,
      v03Digest: sealedV03.canonicalPayloadDigest,
      digestsDiffer: BASE.canonicalPayloadDigest !== sealedV03.canonicalPayloadDigest,
    },
    null,
    2,
  ),
)
