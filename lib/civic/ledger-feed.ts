import type { LedgerPage } from './ledger-store.ts'
import type { LedgerCheckpoint, LedgerReceipt } from './transparency-ledger.ts'

export type LedgerFeed = { head: LedgerCheckpoint; receipts: LedgerReceipt[]; hasMore: boolean; limitation: string; pendingHeads: LedgerCheckpoint[] }
export type PublicLedgerPage = LedgerPage & { status: 'stored-unanchored'; limitation: string }
export const feedTail = (feed: LedgerFeed | null): LedgerCheckpoint => {
  const last = feed?.receipts.at(-1)
  return last ? { ledgerId: last.ledgerId, sequence: last.sequence, digest: last.digest } : { ledgerId: 'maha-civic', sequence: 0, digest: '0'.repeat(64) }
}
const same = (a: LedgerCheckpoint, b: LedgerCheckpoint) => a.ledgerId === b.ledgerId && a.sequence === b.sequence && a.digest === b.digest

/** API verifies hashes; this browser-safe reducer enforces continuity across snapshots. */
export function mergeLedgerPage(feed: LedgerFeed | null, page: PublicLedgerPage): LedgerFeed {
  const preceding = feedTail(feed)
  if (page.status !== 'stored-unanchored' || !Array.isArray(page.receipts) || page.receipts.length > 100 || typeof page.hasMore !== 'boolean'
    || typeof page.limitation !== 'string' || !same(preceding, page.preceding)) throw new Error('Ledger refresh does not continue the loaded history.')
  let tail = preceding
  const pendingHeads = [...(feed?.pendingHeads ?? []), page.head]
  for (const receipt of page.receipts) {
    if (receipt.ledgerId !== tail.ledgerId || receipt.sequence !== tail.sequence + 1 || receipt.previousDigest !== tail.digest || !/^[a-f0-9]{64}$/.test(receipt.digest)) throw new Error('Ledger refresh contains a broken sequence.')
    tail = { ledgerId: receipt.ledgerId, sequence: receipt.sequence, digest: receipt.digest }
    if (pendingHeads.some(head => head.sequence === tail.sequence && !same(head, tail))) throw new Error('Ledger refresh rewrites a previously observed checkpoint.')
  }
  if (page.head.ledgerId !== tail.ledgerId || !Number.isSafeInteger(page.head.sequence) || page.head.sequence < tail.sequence
    || !/^[a-f0-9]{64}$/.test(page.head.digest) || (feed && page.head.sequence < feed.head.sequence)
    || (feed && page.head.sequence === feed.head.sequence && page.head.digest !== feed.head.digest)
    || (page.hasMore ? !page.receipts.length || tail.sequence >= page.head.sequence : !same(tail, page.head))) throw new Error('Ledger refresh head is inconsistent.')
  const remaining = pendingHeads.filter(head => head.sequence > tail.sequence)
  return { head: page.head, receipts: [...(feed?.receipts ?? []), ...page.receipts], hasMore: page.hasMore, limitation: page.limitation,
    pendingHeads: remaining.filter((head, i) => remaining.findIndex(other => same(head, other)) === i) }
}

/** A suffix of at most 100 records remains compatible with the public verifier. */
export function ledgerFeedBundle(feed: LedgerFeed) {
  const start = Math.max(0, feed.receipts.length - 100), before = feed.receipts[start - 1]
  return { preceding: before ? { ledgerId: before.ledgerId, sequence: before.sequence, digest: before.digest } : { ledgerId: feed.head.ledgerId, sequence: 0, digest: '0'.repeat(64) },
    receipts: feed.receipts.slice(start), expectedHead: feedTail(feed) }
}
