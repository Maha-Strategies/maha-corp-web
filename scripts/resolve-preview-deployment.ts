import { appendFile } from 'node:fs/promises'

import { previewOrigin, selectNewestReadyPreview } from '../lib/preview-deployment.ts'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const token = required('VERCEL_TOKEN')
const projectId = required('VERCEL_PROJECT_ID')
const teamId = required('VERCEL_TEAM_ID')

// Ask Vercel to filter as well, but never rely on it: selectNewestReadyPreview
// re-checks target, readiness, and project ownership on every entry.
const query = new URLSearchParams({ projectId, teamId, target: 'preview', state: 'READY', limit: '20' })
const response = await fetch(`https://api.vercel.com/v6/deployments?${query}`, {
  headers: { Authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(15_000),
})
// The body can contain deployment metadata; report only the status.
if (!response.ok) throw new Error(`Vercel deployment listing failed with HTTP ${response.status}.`)

const deployment = selectNewestReadyPreview(await response.json(), projectId)
const origin = previewOrigin(deployment)

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, [
    `origin=${origin}`,
    `deployment_id=${deployment.id}`,
    `commit_sha=${deployment.commitSha ?? ''}`,
    '',
  ].join('\n'))
}
console.log(JSON.stringify({ origin, deploymentId: deployment.id, commitSha: deployment.commitSha, createdAt: new Date(deployment.createdAt).toISOString() }, null, 2))
