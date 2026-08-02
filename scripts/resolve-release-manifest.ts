import { appendFile, readFile } from 'node:fs/promises'

import { parseProductionReleaseManifest } from '../lib/release-health.ts'

const path = process.env.RELEASE_MANIFEST_PATH?.trim()
if (!path) throw new Error('RELEASE_MANIFEST_PATH is required.')
const manifest = parseProductionReleaseManifest(JSON.parse(await readFile(path, 'utf8')))
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `deployment_id=${manifest.deployment.id}\ndeployment_url=https://${manifest.deployment.url}\nsource_run_id=${manifest.source.workflowRunId}\n`)
}
console.log(JSON.stringify({ deploymentId: manifest.deployment.id, deploymentUrl: `https://${manifest.deployment.url}`, generatedAt: manifest.generatedAt, sourceRunId: manifest.source.workflowRunId }, null, 2))
