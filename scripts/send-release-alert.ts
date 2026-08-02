import { readFile } from 'node:fs/promises'

import { signOpsAlert } from '../lib/observability/contracts.ts'
import { createReleaseAlert } from '../lib/observability/release-alerts.ts'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

async function deploymentId() {
  const path = process.env.VERCEL_DEPLOYMENT_JSON_PATH?.trim()
  if (!path) return undefined
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as { id?: unknown }
    return typeof value.id === 'string' ? value.id : undefined
  } catch { return undefined }
}

const baseUrl = new URL(required('PRODUCTION_BASE_URL'))
if (baseUrl.origin !== 'https://www.mahastrategies.com' || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) throw new Error('Production alert base URL is invalid.')
const secret = required('MAHA_OPS_WEBHOOK_SECRET')
if (Buffer.byteLength(secret, 'utf8') < 32 || Buffer.byteLength(secret, 'utf8') > 4_096) throw new Error('Operations alert secret is invalid.')
const payload = createReleaseAlert({
  event: required('RELEASE_ALERT_EVENT'),
  incidentAnchor: process.env.RELEASE_ALERT_INCIDENT_ANCHOR,
  runId: required('GITHUB_RUN_ID'),
  runUrl: `${required('GITHUB_SERVER_URL')}/${required('GITHUB_REPOSITORY')}/actions/runs/${required('GITHUB_RUN_ID')}`,
  commitSha: required('GITHUB_SHA'),
  stage: required('RELEASE_ALERT_STAGE'),
  deploymentId: await deploymentId(),
  controlledTest: process.env.RELEASE_ALERT_CONTROLLED_TEST === 'true',
})
const body = JSON.stringify(payload)
const response = await fetch(new URL('/api/internal/ops-alerts', baseUrl), {
  method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10_000), body,
  headers: {
    'Content-Type': 'application/json',
    'X-Maha-Alert-Event': payload.event,
    'X-Maha-Alert-ID': payload.eventId,
    'X-Maha-Alert-Signature': signOpsAlert(body, secret),
  },
})
if (!response.ok) throw new Error(`Operations alert delivery returned HTTP ${response.status}.`)
console.log(JSON.stringify({ delivered: true, event: payload.event, eventId: payload.eventId }))
