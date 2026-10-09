import { z } from 'zod'
import { civicInputError, civicResponse, readCivicJson } from '../../../../lib/civic/http.ts'
import { checkpointSchema, civicEventSchema, createBaseRpcReader, verifyLedgerAnchor, verifyUsdcTransfer } from '../../../../lib/civic/transparency-ledger.ts'

export const runtime = 'nodejs'
const inputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('anchor'), checkpoint: checkpointSchema, publisher: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }).strict(),
  z.object({ kind: z.literal('transfer'), event: civicEventSchema }).strict(),
])
export async function POST(request: Request) {
  let input
  try {
    input = inputSchema.parse(await readCivicJson(request, 32_768))
    if (input.kind === 'anchor' && input.checkpoint.sequence === 0) return civicResponse({ error: 'Cannot verify an empty anchor.' }, 400)
    if (input.kind === 'transfer' && input.event.kind === 'decision') return civicResponse({ error: 'Decisions have no transfer.' }, 400)
  } catch (error) { return civicInputError(error) }
  try {
    // The caller cannot choose an RPC URL. Server-side operator configuration only.
    const rpc = createBaseRpcReader(process.env.CIVIC_BASE_RPC_URL || 'https://mainnet.base.org')
    const result = input.kind === 'anchor'
      ? await verifyLedgerAnchor(input.checkpoint, input.publisher, input.transactionHash, rpc)
      : await verifyUsdcTransfer(input.event, rpc)
    return civicResponse({ ...result, verificationInput: input, limitation: 'Read-only evidence from the configured Base RPC, checked against a finalized canonical block. This does not establish completeness, attribution beyond the declared publisher, or lawful use of funds.' })
  } catch { return civicResponse({ status: 'indeterminate', reason: 'Chain verification is unavailable.' }, 503) }
}
