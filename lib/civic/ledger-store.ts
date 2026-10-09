import { z } from 'zod'
import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { canonicalJson, immutableSnapshot } from './receipt.ts'
import { checkpointSchema, createLedgerReceipt, ledgerReceiptSchema, receiptPayload, verifyLedger,
  type CivicEvent, type LedgerCheckpoint } from './transparency-ledger.ts'

export const ledgerPageSchema = z.object({
  preceding: checkpointSchema, head: checkpointSchema,
  receipts: z.array(ledgerReceiptSchema).max(100), hasMore: z.boolean(),
}).strict()
export type LedgerPage = z.infer<typeof ledgerPageSchema>

export async function readCivicLedgerPage(after = 0): Promise<LedgerPage> {
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(after)
  const client = createAgentInquiryLedger()
  if (!client) throw new Error('Civic ledger storage is unconfigured.')
  const { data, error } = await client.rpc('read_civic_ledger_page', { p_ledger_id: 'maha-civic', p_after: after, p_limit: 100 })
  if (error) throw new Error('Civic ledger storage is unavailable or migration is missing.')
  const page = ledgerPageSchema.parse(data)
  if (page.preceding.ledgerId !== 'maha-civic' || page.preceding.sequence !== after || page.head.ledgerId !== 'maha-civic'
    || page.head.sequence < after) throw new Error('Invalid ledger page checkpoint.')
  const tail = verifyLedger(page.receipts, page.preceding, page.hasMore ? undefined : page.head)
  if (page.hasMore && (!page.receipts.length || tail.sequence >= page.head.sequence)) throw new Error('Invalid ledger pagination.')
  return page
}

/** Operator-only service method. SQL serializes appends and compares the head. */
export async function appendCivicEvent(event: CivicEvent, expectedHead: LedgerCheckpoint) {
  const receipt = createLedgerReceipt(event, expectedHead)
  const client = createAgentInquiryLedger()
  if (!client) throw new Error('Civic ledger storage is unconfigured.')
  const { data, error } = await client.rpc('append_civic_receipt', {
    p_receipt: receipt, p_canonical_payload: canonicalJson(receiptPayload(receipt)),
  })
  if (error) throw new Error('Civic append refused: stale head, duplicate event/transfer, or unavailable store. Reload and reconcile before retrying.')
  const stored = ledgerReceiptSchema.parse(data)
  verifyLedger([stored], expectedHead, { ledgerId: receipt.ledgerId, sequence: receipt.sequence, digest: receipt.digest })
  return immutableSnapshot(stored)
}
