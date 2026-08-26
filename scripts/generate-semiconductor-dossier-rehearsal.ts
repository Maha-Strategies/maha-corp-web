import { resolve } from 'node:path'

import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { buildEvidenceDossierPackage, writeEvidenceDossierPackage } from '../lib/evidence-dossier/package.ts'
import { adaptSubstantialPageToDossier } from '../lib/evidence-dossier/substantial-page-adapter.ts'
import { compilePilots } from '../lib/substantial-page-pilots.ts'

const output = process.argv[2]
if (!output || !output.startsWith('/')) throw new Error('Provide one absolute output directory.')
if (process.argv.length !== 3) throw new Error('Only one output argument is accepted.')

const slug = 'advanced-materials-hexagonal-boron-nitride-dielectrics'
const record = EPISTEMIC_RECORDS.find((entry) => entry.slug === slug)
const compiledPage = compilePilots().find((entry) => entry.slug === slug)
if (!record || !compiledPage) throw new Error('The bounded semiconductor-materials rehearsal record is unavailable.')
const source = record.sources[0]
const claim = record.claims[0]

const dossier = adaptSubstantialPageToDossier({
  record,
  compiledPage,
  dossierId: 'internal-rehearsal-hbn-dielectrics-001',
  generatedAt: '2026-08-26T00:00:00Z',
  corpusRevision: compiledPage.contract.recordRevisionSha256,
  reviewState: 'illustrative-draft',
  intendedUse: 'Exercise the substantial-page-to-dossier delivery path using a bounded semiconductor-materials record.',
  methodology: 'The existing internal substantial-page contract was checked first. The declared source abstract and locator were then bound explicitly to the record claim.',
  prohibitedUses: [
    'Do not infer wafer-scale manufacturability or commercial qualification.',
    'Do not infer a dielectric constant or breakdown field not reported by the bounded source.',
    'Do not treat internal editorial inspection as external expert review or independent reproduction.',
  ],
  limitations: [
    'This rehearsal contains one bounded record, one claim, and one inspected source; it is not a literature review.',
    'The source concerns exfoliated devices and does not establish wafer-scale manufacturing performance.',
    'No second inspected source is present, so corroboration and replication cannot be assessed.',
    'The package demonstrates workflow integrity, not fixed-fee commercial readiness.',
  ],
  disclaimer: 'Internal rehearsal only. This package does not establish scientific truth, commercial readiness, external endorsement, or independent reproduction.',
  attestations: [{
    sourceId: source.id,
    verifiedAt: '2026-08-26',
    metadataProvenance: 'Crossref metadata resolved and the publisher abstract identified in the source-correction audit recorded by PR #215.',
    extractionMethod: 'publisher-html-read',
    passages: [{
      passageId: 'passage-hbn-abstract-001',
      claimIds: [claim.id],
      locator: source.exactLocator,
      locatorKind: 'section',
      excerpt: source.establishes,
      isParaphrase: true,
      sourceRevision: source.identifiers[0]?.value ?? source.url,
    }],
  }],
})

const bundle = buildEvidenceDossierPackage(dossier, {
  mode: 'internal-rehearsal',
  listPriceUsd: 5_000,
  contractedPriceUsd: 0,
  cashReceivedUsd: 0,
  requestedAt: '2026-08-26T00:00:00Z',
  deliveryTargetDays: 10,
  customerReference: null,
})
writeEvidenceDossierPackage(bundle, resolve(output))
process.stdout.write(JSON.stringify({
  dossierId: dossier.dossierId,
  dossierDigest: dossier.provenanceBundle.dossierDigest,
  packageDigest: bundle.manifest.packageDigest,
  offerReadiness: bundle.manifest.offerReadiness,
  engagement: bundle.manifest.engagement.mode,
  files: bundle.files.length + 1,
}) + '\n')
