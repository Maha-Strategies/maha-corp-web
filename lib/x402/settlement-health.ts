import type { readPublicSettlementLedger } from './settlement-live-store.ts'

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
  }
}
