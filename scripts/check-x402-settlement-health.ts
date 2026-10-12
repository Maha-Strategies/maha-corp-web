/** Read-only production check. A fresh but incomplete backfill is not healthy. */
import { requireHealthySettlementView } from '../lib/x402/settlement-health.ts'
import type { UsdcNetwork } from '../lib/x402/networks.ts'
const response = await fetch('https://www.mahastrategies.com/api/health/x402-settlements', {
  signal: AbortSignal.timeout(20000), cache: 'no-store', redirect: 'error',
})
const health = await response.json()
const expected: UsdcNetwork[] = ['eip155:8453', 'eip155:42161']
if (process.env.X402_POLYGON_ENABLED === 'true') expected.push('eip155:137')
requireHealthySettlementView(health, expected)
console.log(JSON.stringify(health, null, 2))
if (!response.ok || health.status !== 'healthy' || health.stale !== false || health.caughtUp !== true
  || health.source !== 'scheduled_snapshot' || !Number.isFinite(Date.parse(health.observedAt))
  || Date.now() - Date.parse(health.observedAt) > 2 * 60 * 60 * 1000) {
  throw new Error('Public settlement ledger is stale, incomplete, unavailable, or using its fallback.')
}
