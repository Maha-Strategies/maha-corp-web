import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS,
  PRIVATE_SOURCE_OVERRIDE_CANARY,
  SOURCE_OVERRIDE_ACTIVATION_VERSION,
  SOURCE_OVERRIDE_REJECT_RECORD_IDS,
  SOURCE_OVERRIDE_REVISE_RECORD_IDS,
} from '../lib/frontier-source-override-activation.ts'

const artifact = {
  schemaVersion: SOURCE_OVERRIDE_ACTIVATION_VERSION,
  summary: {
    acceptedPrivateRevisions: PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.length,
    privateCanaryRecords: PRIVATE_SOURCE_OVERRIDE_CANARY.length,
    reviseBeforeActivation: SOURCE_OVERRIDE_REVISE_RECORD_IDS.length,
    rejected: SOURCE_OVERRIDE_REJECT_RECORD_IDS.length,
    activeBindingsChanged: 0,
    canonicalReleasesCreated: 0,
  },
  activations: PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS,
  canary: PRIVATE_SOURCE_OVERRIDE_CANARY,
  reviseRecordIds: SOURCE_OVERRIDE_REVISE_RECORD_IDS,
  rejectRecordIds: SOURCE_OVERRIDE_REJECT_RECORD_IDS,
}

const jsonPath = resolve('content/epistemic/frontier-source-override-activation.json')
const markdownPath = resolve('docs/epistemic/frontier-source-override-activation.md')
await mkdir(dirname(jsonPath), { recursive: true })
await mkdir(dirname(markdownPath), { recursive: true })
await writeFile(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`)
await writeFile(markdownPath, `# Frontier source-override activation\n\n` +
  `This deterministic private artifact verifies **${PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.length}** accepted replacement candidates and runs a **${PRIVATE_SOURCE_OVERRIDE_CANARY.length}-record** canary. It changes **zero** active source bindings and creates **zero** canonical releases.\n\n` +
  `## State\n\n` +
  `- Private revision-ready candidates: ${PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.length}\n` +
  `- Must revise the record first: ${SOURCE_OVERRIDE_REVISE_RECORD_IDS.length}\n` +
  `- Rejected: ${SOURCE_OVERRIDE_REJECT_RECORD_IDS.length}\n` +
  `- Remaining gates per accepted candidate: construct the full record revision, audit that exact revision, issue revision-scoped decisions and perform a governed canonical rerelease.\n\n` +
  `## Canary\n\n${PRIVATE_SOURCE_OVERRIDE_CANARY.map((entry) => `- \`${entry.recordId}\` — \`${entry.state}\`, active binding unchanged`).join('\n')}\n`)

console.log(JSON.stringify(artifact.summary))
