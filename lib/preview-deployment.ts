// A scheduled capacity run has no Preview URL handed to it: Previews are
// per-commit and ephemeral. This selects the newest ready one to measure.
//
// Selection is strict rather than best-effort. Measuring the wrong deployment
// silently produces a trend line that means nothing, and the one deployment
// this must never select is Production — the harness refuses that host, but the
// filter should not depend on the harness catching it.

export type PreviewDeployment = { id: string; url: string; createdAt: number; commitSha?: string }

type RawDeployment = {
  uid?: unknown
  id?: unknown
  url?: unknown
  state?: unknown
  readyState?: unknown
  target?: unknown
  createdAt?: unknown
  projectId?: unknown
  meta?: { githubCommitSha?: unknown }
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * Vercel reports readiness as `readyState` on some API versions and `state` on
 * others; a deployment is only eligible when whichever field is present says
 * READY.
 */
function isReady(deployment: RawDeployment): boolean {
  const state = text(deployment.readyState) ?? text(deployment.state)
  return state === 'READY'
}

export function selectNewestReadyPreview(payload: unknown, projectId: string): PreviewDeployment {
  const deployments = (payload as { deployments?: unknown })?.deployments
  if (!Array.isArray(deployments)) throw new Error('Vercel returned no deployment list.')

  const eligible: PreviewDeployment[] = []
  for (const entry of deployments as RawDeployment[]) {
    if (!entry || typeof entry !== 'object') continue
    // `production` and `staging` targets are explicitly not what this measures.
    if (text(entry.target) !== 'preview') continue
    if (!isReady(entry)) continue
    // Only enforced when the API includes it; a mismatch means the query was
    // scoped wrongly and the result cannot be trusted.
    const owner = text(entry.projectId)
    if (owner && owner !== projectId) continue
    const url = text(entry.url)
    const id = text(entry.uid) ?? text(entry.id)
    const createdAt = typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt) ? entry.createdAt : undefined
    if (!url || !id || createdAt === undefined) continue
    eligible.push({ id, url, createdAt, commitSha: text(entry.meta?.githubCommitSha) })
  }

  if (eligible.length === 0) throw new Error('No ready Preview deployment is available to measure.')
  return eligible.reduce((newest, candidate) => (candidate.createdAt > newest.createdAt ? candidate : newest))
}

/** Vercel reports a bare host; the harness requires an origin. */
export function previewOrigin(deployment: PreviewDeployment): string {
  return deployment.url.startsWith('http') ? deployment.url : `https://${deployment.url}`
}
