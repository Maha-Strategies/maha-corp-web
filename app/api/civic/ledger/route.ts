import { z } from 'zod'
import { civicInputError, civicResponse, readCivicJson } from '../../../../lib/civic/http.ts'
import { readCivicLedgerPage } from '../../../../lib/civic/ledger-store.ts'
import { checkpointSchema, ledgerReceiptSchema, verifyLedger } from '../../../../lib/civic/transparency-ledger.ts'

export const runtime = 'nodejs'
export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get('after') ?? '0'
  if (!/^(0|[1-9][0-9]*)$/.test(cursor) || !Number.isSafeInteger(Number(cursor))) return civicResponse({ error: 'Invalid ledger cursor.' }, 400)
  try { return civicResponse({ status: 'stored-unanchored', ...await readCivicLedgerPage(Number(cursor)),
    limitation: 'Local hash integrity only. No Base anchor has been independently verified by this endpoint. Monetary records are declarations until transfer evidence is independently verified.' }) }
  catch { return civicResponse({ status: 'unavailable', error: 'Civic ledger storage is unconfigured, unavailable, or failed integrity validation.' }, 503) }
}

// Verify a downloaded bundle. There is deliberately no public append endpoint.
export async function POST(request: Request) {
  try {
    const bundle = z.object({ receipts: z.array(ledgerReceiptSchema).max(100), preceding: checkpointSchema, expectedHead: checkpointSchema }).strict().parse(await readCivicJson(request, 256_000))
    const head = verifyLedger(bundle.receipts, bundle.preceding, bundle.expectedHead)
    return civicResponse({ status: 'integrity-valid', head, limitation: 'Compared against the supplied checkpoint only. An independently obtained anchor is required to detect a fully rewritten history.' })
  } catch (error) { return civicInputError(error) }
}
