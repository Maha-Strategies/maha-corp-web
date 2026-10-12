/** Read-only production check. A fresh but incomplete backfill is not healthy. */
const response = await fetch('https://www.mahastrategies.com/api/health/x402-settlements', {
  signal: AbortSignal.timeout(20000), cache: 'no-store', redirect: 'error',
})
const health = await response.json()
if (!Array.isArray(health.networks) || health.networks.length !== 2
  || new Set(health.networks.map((n: { network: string }) => n.network)).size !== 2
  || !['eip155:8453', 'eip155:42161'].every(network => health.networks.some((n: { network: string; source: string; stale: boolean; caughtUp: boolean; observedAt: string }) => n.network === network && n.source === 'scheduled_snapshot' && !n.stale && n.caughtUp && Number.isFinite(Date.parse(n.observedAt)) && Date.now()-Date.parse(n.observedAt)<=2*60*60*1000))) throw new Error('Each configured network must have a fresh, caught-up ledger.')
console.log(JSON.stringify(health, null, 2))
if (!response.ok || health.status !== 'healthy' || health.stale !== false || health.caughtUp !== true
  || health.source !== 'scheduled_snapshot' || !Number.isFinite(Date.parse(health.observedAt))
  || Date.now() - Date.parse(health.observedAt) > 2 * 60 * 60 * 1000) {
  throw new Error('Public settlement ledger is stale, incomplete, unavailable, or using its fallback.')
}
