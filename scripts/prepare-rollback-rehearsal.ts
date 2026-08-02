import { appendFile, readFile } from 'node:fs/promises'

import { prepareRollbackRehearsal } from '../lib/release-health.ts'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

async function json(path: string) { return JSON.parse(await readFile(path, 'utf8')) as unknown }

const rehearsal = prepareRollbackRehearsal({
  originalDeployment: await json(required('ORIGINAL_DEPLOYMENT_JSON_PATH')),
  targetDeployment: await json(required('TARGET_DEPLOYMENT_JSON_PATH')),
  targetManifest: await json(required('RELEASE_MANIFEST_PATH')),
  targetWorkflowRun: await json(required('TARGET_WORKFLOW_RUN_JSON_PATH')),
  targetReleaseHealthRunId: required('TARGET_RELEASE_HEALTH_RUN_ID'),
  projectId: required('VERCEL_PROJECT_ID'),
  repository: required('GITHUB_REPOSITORY'),
})
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, [
    `original_id=${rehearsal.original.id}`,
    `original_url=https://${rehearsal.original.url}`,
    `target_id=${rehearsal.target.id}`,
    `target_url=https://${rehearsal.target.url}`,
    '',
  ].join('\n'))
}
console.log(JSON.stringify({ originalDeploymentId: rehearsal.original.id, targetDeploymentId: rehearsal.target.id, targetReleaseHealthRunId: rehearsal.manifest.source.workflowRunId }, null, 2))
