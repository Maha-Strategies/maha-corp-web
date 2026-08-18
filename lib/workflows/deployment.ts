import { createHash } from 'node:crypto'

export type OrchestrationDeploymentMode = 'legacy' | 'hosted' | 'private'
export type OrchestrationStorageProvider = 'upstash-rest'

type Environment = Record<string, string | undefined>
type TenantCredential = { tenantId: string; tokenSha256: string }

export type OrchestrationDeploymentConfig = {
  mode: OrchestrationDeploymentMode
  storageProvider: OrchestrationStorageProvider
  retentionDays: number
  credentials: TenantCredential[]
  authReady: boolean
  storageReady: boolean
  ready: boolean
  errors: string[]
}

const TENANT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/
const TOKEN_MINIMUM_BYTES = 32

function clean(value: string | undefined): string | undefined { return value?.trim().replace(/^['"]|['"]$/g, '') || undefined }
function tokenDigest(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex') }

export function orchestrationDeploymentConfig(environment: Environment = process.env): OrchestrationDeploymentConfig {
  const rawMode = clean(environment.ORCHESTRATION_DEPLOYMENT_MODE)
  const modeValid = rawMode === undefined || rawMode === 'hosted' || rawMode === 'private'
  const mode: OrchestrationDeploymentMode = rawMode === undefined ? 'legacy' : rawMode === 'hosted' || rawMode === 'private' ? rawMode : 'legacy'
  const errors: string[] = []
  if (rawMode && rawMode !== 'hosted' && rawMode !== 'private') errors.push('ORCHESTRATION_DEPLOYMENT_MODE must be hosted or private.')

  const rawRetention = clean(environment.ORCHESTRATION_RETENTION_DAYS) ?? '30'
  const retentionDays = Number(rawRetention)
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) errors.push('ORCHESTRATION_RETENTION_DAYS must be an integer from 1 to 365.')

  const storageProvider: OrchestrationStorageProvider = 'upstash-rest'
  const configuredStorage = clean(environment.ORCHESTRATION_STORAGE_PROVIDER)
  if (configuredStorage && configuredStorage !== storageProvider) errors.push('Only the upstash-rest orchestration storage provider is supported in this release.')
  const storageReady = Boolean(clean(environment.UPSTASH_REDIS_REST_URL) && clean(environment.UPSTASH_REDIS_REST_TOKEN))
  if (!storageReady) errors.push('Durable Redis REST storage is not configured.')

  const credentials: TenantCredential[] = []
  const authErrors: string[] = []
  if (mode === 'hosted') parseHostedCredentials(clean(environment.ORCHESTRATION_TENANT_TOKENS), credentials, authErrors)
  else {
    const token = clean(environment.WORKFLOW_CONTROL_TOKEN)
    if (!token || Buffer.byteLength(token, 'utf8') < TOKEN_MINIMUM_BYTES) authErrors.push('WORKFLOW_CONTROL_TOKEN must contain at least 32 UTF-8 bytes.')
    const tenantId = mode === 'private' ? clean(environment.ORCHESTRATION_PRIVATE_TENANT_ID) : undefined
    if (mode === 'private' && (!tenantId || !TENANT_ID.test(tenantId))) authErrors.push('ORCHESTRATION_PRIVATE_TENANT_ID is invalid.')
    if (token && Buffer.byteLength(token, 'utf8') >= TOKEN_MINIMUM_BYTES) credentials.push({ tenantId: tenantId ?? '', tokenSha256: tokenDigest(token) })
  }
  errors.push(...authErrors)

  const authReady = modeValid && credentials.length > 0 && authErrors.length === 0
  const retentionReady = Number.isInteger(retentionDays) && retentionDays >= 1 && retentionDays <= 365
  return { mode, storageProvider, retentionDays: retentionReady ? retentionDays : 30, credentials, authReady, storageReady, ready: errors.length === 0, errors }
}

function parseHostedCredentials(raw: string | undefined, destination: TenantCredential[], errors: string[]): void {
  if (!raw) { errors.push('ORCHESTRATION_TENANT_TOKENS is required in hosted mode.'); return }
  let value: unknown
  try { value = JSON.parse(raw) } catch { errors.push('ORCHESTRATION_TENANT_TOKENS must be valid JSON.'); return }
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) { errors.push('ORCHESTRATION_TENANT_TOKENS must contain 1 to 500 tenant credentials.'); return }
  const tenants = new Set<string>(); const tokens = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some((key) => key !== 'tenantId' && key !== 'token')) { errors.push('Each hosted tenant credential must contain only tenantId and token.'); continue }
    const record = entry as Record<string, unknown>
    if (typeof record.tenantId !== 'string' || !TENANT_ID.test(record.tenantId) || typeof record.token !== 'string' || Buffer.byteLength(record.token, 'utf8') < TOKEN_MINIMUM_BYTES) { errors.push('A hosted tenant credential is invalid.'); continue }
    const digest = tokenDigest(record.token)
    if (tenants.has(record.tenantId) || tokens.has(digest)) { errors.push('Hosted tenant IDs and tokens must be unique.'); continue }
    tenants.add(record.tenantId); tokens.add(digest); destination.push({ tenantId: record.tenantId, tokenSha256: digest })
  }
}

export function workflowRetentionSeconds(environment: Environment = process.env): number {
  return orchestrationDeploymentConfig(environment).retentionDays * 24 * 60 * 60
}
