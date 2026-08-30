import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  SUBSTANTIAL_BATCH_4_PAGES,
  SUBSTANTIAL_BATCH_4_READINESS,
  SUBSTANTIAL_PUBLICATION_BATCH_4_VERSION,
} from '../lib/substantial-page-publication-batch-4.ts'

const artifact = {
  publicationVersion: SUBSTANTIAL_PUBLICATION_BATCH_4_VERSION,
  summary: {
    candidateSourceCorrections: SUBSTANTIAL_BATCH_4_READINESS.length,
    priorReleasesMadeStaleByCorrection: SUBSTANTIAL_BATCH_4_READINESS.filter((entry) => entry.releaseState === 'prior-release-will-be-stale').length,
    candidatesWithoutCanonicalRelease: SUBSTANTIAL_BATCH_4_READINESS.filter((entry) => entry.releaseState === 'no-canonical-release').length,
    pagesPublished: SUBSTANTIAL_BATCH_4_PAGES.length,
    gateStatus: 'closed-pending-revision-audit-and-release',
  },
  readiness: SUBSTANTIAL_BATCH_4_READINESS,
  pages: SUBSTANTIAL_BATCH_4_PAGES,
}

const jsonPath = resolve('content/substantial-pages/publication-batch-4-readiness.json')
const markdownPath = resolve('docs/substantial-pages/publication-batch-4-readiness.md')
await mkdir(dirname(jsonPath), { recursive: true })
await mkdir(dirname(markdownPath), { recursive: true })
await writeFile(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`)
await writeFile(markdownPath, `# Substantial-page Batch 4 readiness\n\n` +
  `Batch 4 publishes **zero** pages. All currently released and alignment-clear records are already represented in the 55-page substantial projection. Publishing any of the ${SUBSTANTIAL_BATCH_4_READINESS.length} corrected-source candidates now would attach explanatory prose to an unreleased or stale revision.\n\n` +
  `- Prior releases that will become stale when the correction is applied: ${artifact.summary.priorReleasesMadeStaleByCorrection}\n` +
  `- Candidates with no canonical release: ${artifact.summary.candidatesWithoutCanonicalRelease}\n` +
  `- Required next gates: construct full revisions, audit exact revisions, issue revision-scoped decisions and release canonically.\n`)

console.log(JSON.stringify(artifact.summary))
