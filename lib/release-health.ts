export const RELEASE_MANIFEST_SCHEMA = 'maha.production-release.v1' as const

export type ReleaseHealthCheck = {
  name: 'homepage' | 'openapi' | 'billing_readiness' | 'observability_readiness'
  path: string
  status: number
  latencyMs: number
  state: 'ready' | 'failed'
  code: string
}

export type ProductionDeployment = {
  id: string
  url: string
  createdAt: number
  target: 'production'
  readyState: 'READY'
}

export type ProductionReleaseManifest = {
  schema: typeof RELEASE_MANIFEST_SCHEMA
  generatedAt: string
  canonicalUrl: string
  deployment: ProductionDeployment
  checks: ReleaseHealthCheck[]
  source: { repository: string; workflowRunId: string; commitSha: string }
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Expected an object.')
  return value as Record<string, unknown>
}

function baseUrl(value: string, allowDeploymentUrl = false) {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('Production base URL must be valid HTTPS.') }
  const deploymentHost = /^maha-corp-[a-z0-9]+-mayonerajans-projects\.vercel\.app$/
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.pathname !== '/' || url.search || (url.hostname !== 'www.mahastrategies.com' && !(allowDeploymentUrl && deploymentHost.test(url.hostname)))) {
    throw new Error('Production base URL is not an approved Maha production host.')
  }
  return url
}

export function parseProductionDeployment(value: unknown, expectedProjectId: string): ProductionDeployment {
  const deployment = object(value)
  if (typeof deployment.id !== 'string' || !/^dpl_[A-Za-z0-9]+$/.test(deployment.id)) throw new Error('Vercel deployment ID is invalid.')
  if (deployment.name !== 'maha-corp-web' || deployment.target !== 'production' || deployment.readyState !== 'READY') throw new Error('Vercel deployment is not a ready Maha production deployment.')
  if (typeof deployment.url !== 'string' || !/^maha-corp-[a-z0-9]+-mayonerajans-projects\.vercel\.app$/.test(deployment.url)) throw new Error('Vercel deployment URL is invalid.')
  if (!Number.isInteger(deployment.createdAt) || Number(deployment.createdAt) <= 0) throw new Error('Vercel deployment timestamp is invalid.')
  const projectId = typeof deployment.projectId === 'string' ? deployment.projectId : undefined
  if (projectId && projectId !== expectedProjectId) throw new Error('Vercel deployment belongs to a different project.')
  return { id: deployment.id, url: deployment.url, createdAt: Number(deployment.createdAt), target: 'production', readyState: 'READY' }
}

async function json(response: Response) {
  try { return object(await response.json()) } catch { return null }
}

export async function checkProductionRelease(input: { baseUrl: string; releaseHealthToken: string; bypassSecret?: string; allowDeploymentUrl?: boolean; fetcher?: Fetcher }) {
  const origin = baseUrl(input.baseUrl, input.allowDeploymentUrl).origin
  if (input.releaseHealthToken.length < 32) throw new Error('Release health token is not configured.')
  const fetcher = input.fetcher ?? fetch
  const definitions = [
    { name: 'homepage' as const, path: '/', authorization: false },
    { name: 'openapi' as const, path: '/api/docs/openapi', authorization: false },
    { name: 'billing_readiness' as const, path: '/api/admin/billing-readiness', authorization: true },
    { name: 'observability_readiness' as const, path: '/api/admin/observability-readiness', authorization: true },
  ]
  const checks: ReleaseHealthCheck[] = []
  for (const definition of definitions) {
    const started = performance.now()
    let status = 0, code = 'request_failed', state: 'ready' | 'failed' = 'failed'
    try {
      const headers = new Headers({ Accept: definition.name === 'homepage' ? 'text/html' : 'application/json' })
      if (definition.authorization) headers.set('Authorization', `Bearer ${input.releaseHealthToken}`)
      if (input.bypassSecret) headers.set('x-vercel-protection-bypass', input.bypassSecret)
      const response = await fetcher(`${origin}${definition.path}`, { headers, redirect: 'manual', signal: AbortSignal.timeout(10_000) })
      status = response.status
      if (definition.name === 'homepage') {
        const contentType = response.headers.get('content-type') ?? ''
        state = response.status === 200 && contentType.toLowerCase().includes('text/html') ? 'ready' : 'failed'
        code = state === 'ready' ? 'homepage_reachable' : 'homepage_invalid'
      } else {
        const body = await json(response)
        if (definition.name === 'openapi') {
          state = response.status === 200 && body?.openapi === '3.1.0' ? 'ready' : 'failed'
          code = state === 'ready' ? 'openapi_reachable' : 'openapi_invalid'
        } else {
          state = response.status === 200 && body?.state === 'ready' && body?.readOnly === true ? 'ready' : 'failed'
          code = state === 'ready' ? `${definition.name}_ready` : `${definition.name}_unavailable`
        }
      }
    } catch { /* bounded result below */ }
    checks.push({ name: definition.name, path: definition.path, status, latencyMs: Math.round((performance.now() - started) * 100) / 100, state, code })
  }
  return { state: checks.every((check) => check.state === 'ready') ? 'ready' as const : 'unhealthy' as const, checks }
}

export function createProductionReleaseManifest(input: { canonicalUrl: string; deployment: ProductionDeployment; checks: ReleaseHealthCheck[]; repository: string; workflowRunId: string; commitSha: string; generatedAt?: string }): ProductionReleaseManifest {
  const canonicalUrl = baseUrl(input.canonicalUrl).origin
  if (input.checks.length !== 4 || input.checks.some((check) => check.state !== 'ready')) throw new Error('A last-known-good manifest requires every release-health check to pass.')
  if (!/^[0-9]+$/.test(input.workflowRunId) || !/^[a-f0-9]{40}$/.test(input.commitSha) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository)) throw new Error('Release source metadata is invalid.')
  return { schema: RELEASE_MANIFEST_SCHEMA, generatedAt: input.generatedAt ?? new Date().toISOString(), canonicalUrl, deployment: input.deployment, checks: input.checks, source: { repository: input.repository, workflowRunId: input.workflowRunId, commitSha: input.commitSha } }
}

export function parseProductionReleaseManifest(value: unknown, now = Date.now(), maxAgeMs = 14 * 86_400_000): ProductionReleaseManifest {
  const manifest = object(value)
  if (manifest.schema !== RELEASE_MANIFEST_SCHEMA || typeof manifest.generatedAt !== 'string') throw new Error('Release manifest schema is invalid.')
  const generatedAt = Date.parse(manifest.generatedAt)
  if (!Number.isFinite(generatedAt) || generatedAt > now + 300_000 || generatedAt < now - maxAgeMs) throw new Error('Release manifest is outside the recovery window.')
  const deployment = object(manifest.deployment)
  const parsedDeployment = parseProductionDeployment({ ...deployment, name: 'maha-corp-web' }, process.env.VERCEL_PROJECT_ID ?? 'prj_afSBk4GaUchbuPuHF3ctZSS42iRU')
  const checks = Array.isArray(manifest.checks) ? manifest.checks : []
  const expectedNames = new Set(['homepage', 'openapi', 'billing_readiness', 'observability_readiness'])
  if (checks.length !== 4 || checks.some((value) => {
    const check = object(value)
    return typeof check.name !== 'string' || !expectedNames.delete(check.name) || typeof check.path !== 'string' || !check.path.startsWith('/') || check.status !== 200 || typeof check.latencyMs !== 'number' || !Number.isFinite(check.latencyMs) || check.latencyMs < 0 || check.state !== 'ready' || typeof check.code !== 'string'
  }) || expectedNames.size !== 0) throw new Error('Release manifest does not describe a healthy deployment.')
  const source = object(manifest.source)
  if (typeof source.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repository) || typeof source.workflowRunId !== 'string' || !/^[0-9]+$/.test(source.workflowRunId) || typeof source.commitSha !== 'string' || !/^[a-f0-9]{40}$/.test(source.commitSha)) throw new Error('Release manifest source metadata is invalid.')
  return { schema: RELEASE_MANIFEST_SCHEMA, generatedAt: manifest.generatedAt, canonicalUrl: baseUrl(String(manifest.canonicalUrl)).origin, deployment: parsedDeployment, checks: checks as ReleaseHealthCheck[], source: source as ProductionReleaseManifest['source'] }
}
