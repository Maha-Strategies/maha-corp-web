import type { readPublicSettlementLedger } from './settlement-live-store.ts'
import { DECLARED_PAYMENT_NETWORKS, type UsdcNetwork } from './networks.ts'

/** Independent monitor: a third network must not break monitoring of the first two.
 * Conversely, an activated chain missing from the public projection is a failure.
 */
export function requireHealthySettlementView(value: unknown, expected: UsdcNetwork[] = ['eip155:8453', 'eip155:42161'], now = Date.now()): void {
  const fail = () => { throw new Error('Each configured network must have a fresh, caught-up ledger; missing results are not zero payments.') }
  const fresh = (row: Record<string, unknown>) => row.source === 'scheduled_snapshot' && row.stale === false && row.caughtUp === true
    && typeof row.observedAt === 'string' && Number.isFinite(Date.parse(row.observedAt))
    && now - Date.parse(row.observedAt) >= -60000 && now - Date.parse(row.observedAt) <= 2 * 60 * 60 * 1000
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const health = value as Record<string, unknown>, rows = health.networks
  if (health.status !== 'healthy' || !fresh(health) || !Array.isArray(rows) || rows.length < 2 || rows.length > DECLARED_PAYMENT_NETWORKS.length) return fail()
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.network !== 'string'
      || !DECLARED_PAYMENT_NETWORKS.includes(row.network as UsdcNetwork) || seen.has(row.network) || !fresh(row)) return fail()
    seen.add(row.network)
  }
  if (!expected.every(network => seen.has(network))) return fail()
}

/** Public, credential-free freshness check; never triggers a scan or a write. */
export function settlementHealth(view: Awaited<ReturnType<typeof readPublicSettlementLedger>>) {
  const healthy = view.source === 'scheduled_snapshot' && !view.stale && view.caughtUp
  return {
    status: healthy ? 'healthy' : 'degraded',
    source: view.source,
    stale: view.stale,
    caughtUp: view.caughtUp,
    observedAt: view.ledger.observedAt,
    scannedFromBlock: view.ledger.scannedFromBlock,
    scannedToBlock: view.ledger.scannedToBlock,
    ...('networks' in view ? { networks: view.networks.map(network => ({
      network: network.ledger.caip2Network ?? 'eip155:8453', source: network.source,
      stale: network.stale, caughtUp: network.caughtUp, observedAt: network.ledger.observedAt,
      scannedFromBlock: network.ledger.scannedFromBlock, scannedToBlock: network.ledger.scannedToBlock,
    })) } : {}),
  }
}
