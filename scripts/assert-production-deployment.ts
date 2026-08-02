import { readFile } from 'node:fs/promises'

import { parseProductionDeployment } from '../lib/release-health.ts'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const deployment = parseProductionDeployment(JSON.parse(await readFile(required('VERCEL_DEPLOYMENT_JSON_PATH'), 'utf8')) as unknown, required('VERCEL_PROJECT_ID'))
if (deployment.id !== required('EXPECTED_DEPLOYMENT_ID')) throw new Error('Canonical Production deployment does not match the expected transition target.')
console.log(JSON.stringify({ deploymentId: deployment.id, readyState: deployment.readyState }))
