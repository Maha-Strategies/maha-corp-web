import { readFile, writeFile } from 'node:fs/promises'

import { checkProductionRelease, createProductionReleaseManifest, parseProductionDeployment } from '../lib/release-health.ts'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const outputPath = required('RELEASE_HEALTH_OUTPUT')
const deploymentJson = JSON.parse(await readFile(required('VERCEL_DEPLOYMENT_JSON_PATH'), 'utf8')) as unknown
const deployment = parseProductionDeployment(deploymentJson, required('VERCEL_PROJECT_ID'))
const result = await checkProductionRelease({
  baseUrl: required('PRODUCTION_BASE_URL'), revenueControlToken: required('PRODUCTION_REVENUE_CONTROL_TOKEN'),
  bypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim(), allowDeploymentUrl: process.env.ALLOW_VERCEL_DEPLOYMENT_URL === 'true',
})

const report = { generatedAt: new Date().toISOString(), readOnly: true, state: result.state, deployment, checks: result.checks }
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
if (result.state !== 'ready') throw new Error(`Production release health failed: ${result.checks.filter((check) => check.state !== 'ready').map((check) => check.code).join(', ')}.`)

if (process.env.RELEASE_MANIFEST_OUTPUT) {
  const manifest = createProductionReleaseManifest({
    canonicalUrl: required('PRODUCTION_CANONICAL_URL'), deployment, checks: result.checks,
    repository: required('GITHUB_REPOSITORY'), workflowRunId: required('GITHUB_RUN_ID'), commitSha: required('GITHUB_SHA'),
  })
  await writeFile(process.env.RELEASE_MANIFEST_OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
}

console.log(JSON.stringify({ state: result.state, deploymentId: deployment.id, checks: result.checks.map(({ name, status, latencyMs, state }) => ({ name, status, latencyMs, state })) }, null, 2))
