import { createHash } from 'node:crypto'

export const RELEASE_ALERT_EVENTS = [
  'release.health_failure',
  'release.health_recovered',
  'release.recovery_drill_failure',
  'release.recovery_drill_recovered',
] as const

export type ReleaseAlertEvent = typeof RELEASE_ALERT_EVENTS[number]

const EVENT_SET = new Set<string>(RELEASE_ALERT_EVENTS)
const RUN_ID = /^[1-9][0-9]{0,19}$/
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/
const COMMIT_SHA = /^[a-f0-9]{40}$/

function bounded(value: string, name: string, maximum: number) {
  const clean = value.trim()
  if (!clean || clean.length > maximum) throw new Error(`${name} is invalid.`)
  return clean
}

export function releaseIncidentContext(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Workflow runs response is invalid.')
  const runs = (value as { workflow_runs?: unknown }).workflow_runs
  if (!Array.isArray(runs)) throw new Error('Workflow runs response is invalid.')
  const completed = runs.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return []
    const run = item as Record<string, unknown>
    if (!RUN_ID.test(String(run.id)) || typeof run.conclusion !== 'string') return []
    return [{ id: String(run.id), conclusion: run.conclusion }]
  })
  return {
    previousConclusion: completed[0]?.conclusion ?? 'none',
    incidentAnchor: completed.find((run) => run.conclusion === 'success')?.id ?? 'none',
  }
}

export function createReleaseAlert(input: {
  event: string
  incidentAnchor?: string
  runId: string
  runUrl: string
  commitSha: string
  stage: string
  deploymentId?: string
  controlledTest?: boolean
  occurredAt?: string
}) {
  if (!EVENT_SET.has(input.event)) throw new Error('Release alert event is invalid.')
  if (!RUN_ID.test(input.runId)) throw new Error('Release alert run ID is invalid.')
  const anchor = input.incidentAnchor?.trim() || 'none'
  if (anchor !== 'none' && !RUN_ID.test(anchor)) throw new Error('Release alert incident anchor is invalid.')
  const expectedUrl = `https://github.com/Maha-Strategies/maha-corp-web/actions/runs/${input.runId}`
  if (input.runUrl !== expectedUrl) throw new Error('Release alert run URL is invalid.')
  if (!COMMIT_SHA.test(input.commitSha)) throw new Error('Release alert commit SHA is invalid.')
  if (input.deploymentId && !DEPLOYMENT_ID.test(input.deploymentId)) throw new Error('Release alert deployment ID is invalid.')
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error('Release alert timestamp is invalid.')
  const event = input.event as ReleaseAlertEvent
  const eventId = `alert_${createHash('sha256').update(`${event}:${anchor}`).digest('hex').slice(0, 32)}`
  return {
    schema: 'maha.ops-alert.v1' as const,
    event,
    eventId,
    occurredAt,
    tenantId: 'maha-platform',
    data: {
      workflow: event.startsWith('release.health_') ? 'production-release-health' : 'production-recovery-drill',
      runId: input.runId,
      runUrl: input.runUrl,
      commitSha: input.commitSha,
      stage: bounded(input.stage, 'Release alert stage', 256),
      ...(input.deploymentId ? { deploymentId: input.deploymentId } : {}),
      ...(input.controlledTest ? { controlledTest: true } : {}),
    },
  }
}
