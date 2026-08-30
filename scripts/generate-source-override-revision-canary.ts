import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  PRIVATE_REVISION_RELEASE_CANARY,
  SOURCE_OVERRIDE_REVISED_RECORDS,
  SOURCE_OVERRIDE_REVISION_AUDITS,
  SOURCE_OVERRIDE_REVISION_CANARY_VERSION,
  SOURCE_OVERRIDE_REVISION_DECISIONS,
} from '../lib/source-override-revision-canary.ts'

const summary = {
  revisedRecords: SOURCE_OVERRIDE_REVISED_RECORDS.length,
  exactRevisionAudits: SOURCE_OVERRIDE_REVISION_AUDITS.length,
  revisionScopedInternalDecisions: SOURCE_OVERRIDE_REVISION_DECISIONS.length,
  initialReleaseCandidates: PRIVATE_REVISION_RELEASE_CANARY.filter((entry) => entry.releaseKind === 'initial').length,
  supersedingReleaseCandidates: PRIVATE_REVISION_RELEASE_CANARY.filter((entry) => entry.releaseKind === 'superseding').length,
  substantialPageEligible: PRIVATE_REVISION_RELEASE_CANARY.filter((entry) => entry.substantialPageEligible).length,
  canonicalMutations: 0,
  releasesCreated: 0,
}

const artifact = {
  schemaVersion: SOURCE_OVERRIDE_REVISION_CANARY_VERSION,
  summary,
  revisedRecords: SOURCE_OVERRIDE_REVISED_RECORDS,
  audits: SOURCE_OVERRIDE_REVISION_AUDITS,
  decisions: SOURCE_OVERRIDE_REVISION_DECISIONS,
  privateReleaseCanary: PRIVATE_REVISION_RELEASE_CANARY,
}

const jsonPath = resolve('content/epistemic/source-override-revision-canary.json')
const markdownPath = resolve('docs/epistemic/source-override-revision-canary.md')
await mkdir(dirname(jsonPath), { recursive: true })
await mkdir(dirname(markdownPath), { recursive: true })
await writeFile(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`)
await writeFile(markdownPath, `# Source-override revision canary\n\n` +
  `This deterministic, private preflight constructs **${summary.revisedRecords}** corrected records, audits each exact revision, records **${summary.revisionScopedInternalDecisions}** scoped internal decisions, and verifies substantial-page eligibility without creating a release or changing an active source binding.\n\n` +
  `## Release topology\n\n` +
  `- Initial candidates: ${summary.initialReleaseCandidates}\n` +
  `- Superseding candidates: ${summary.supersedingReleaseCandidates}\n` +
  `- Substantial-page eligible after exact-revision audit: ${summary.substantialPageEligible}\n` +
  `- Canonical mutations: ${summary.canonicalMutations}\n` +
  `- Releases created: ${summary.releasesCreated}\n\n` +
  `## Private canary\n\n${PRIVATE_REVISION_RELEASE_CANARY.map((entry) =>
    `- \`${entry.recordId}\` — \`${entry.releaseKind}\`, \`${entry.state}\`, target \`${entry.targetSha256}\``).join('\n')}\n\n` +
  `Internal review is not external expert endorsement or independent reproduction. Release authority remains absent.\n`)

console.log(JSON.stringify(summary))
