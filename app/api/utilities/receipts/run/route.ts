import Anthropic from '@anthropic-ai/sdk'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { cleanupDraftUploads, fetchDraftImages, type DraftImage } from '@/lib/receipt-upload-store'
import { assertMixedBatchWithinLimit } from '@/lib/receipt-uploads'
import {
  ParsedReceipt, RECEIPT_UTILITY, ReceiptUtilityError,
  buildReceiptImagePrompt, feasibleReceipts, parseReceiptResponse, receiptBatchCsv, runReceiptParse, validateOptionalReceiptTexts,
} from '@/lib/receipt-utility'
import { reconcileRevenueDelivery } from '@/lib/revenue-reconciliation'
import { REVENUE_OFFER_FOR_UTILITY, utilityCatalogConfig, validUtilityCheckoutId } from '@/lib/utility-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BODY_BYTES = 262_144
const MODEL = 'claude-sonnet-4-6'

function response(body: object, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

type BatchItem = { source: 'image' | 'text'; parse: () => Promise<ParsedReceipt> }
type BatchResult = { index: number; source: 'image' | 'text'; parsed: ParsedReceipt | null }

// Issue a full refund for a run that produced nothing usable, then flip the
// consumed token to refunded. The refund webhook reconciles the revenue reversal.
async function autoRefund(
  ledger: NonNullable<ReturnType<typeof createAgentInquiryLedger>>,
  checkoutId: string, stripeSecretKey: string,
): Promise<boolean> {
  const { data: checkout } = await ledger.from('utility_checkouts').select('stripe_payment_intent_id').eq('public_id', checkoutId).maybeSingle()
  const paymentIntentId = checkout?.stripe_payment_intent_id
  if (!paymentIntentId || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) return false
  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `refund_${checkoutId}` },
      body: new URLSearchParams({ payment_intent: paymentIntentId, reason: 'requested_by_customer' }),
      cache: 'no-store',
    })
    const refund = await stripeResponse.json() as { status?: unknown }
    if (!stripeResponse.ok || refund.status !== 'succeeded') {
      console.error('Utility auto-refund was not confirmed:', stripeResponse.status, refund.status ?? 'unknown')
      return false
    }
  } catch (error) {
    console.error('Utility auto-refund error:', error instanceof Error ? error.message : 'unknown_error')
    return false
  }
  const { data: marked, error } = await ledger.rpc('mark_utility_run_refunded', { p_checkout_id: checkoutId })
  if (error) return false
  if (marked === 'refunded') return true
  const { data: settled } = await ledger.from('utility_checkouts').select('run_status').eq('public_id', checkoutId).maybeSingle()
  return settled?.run_status === 'refunded'
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return response({ error: 'Content-Type must be application/json.' }, 415)
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return response({ error: 'Batch payload is too large.' }, 413)
  }

  let checkoutId: string
  let texts: string[]
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return response({ error: 'Batch payload is too large.' }, 413)
    const body = JSON.parse(raw) as { checkoutId?: unknown; receipts?: unknown }
    if (typeof body.checkoutId !== 'string' || !validUtilityCheckoutId(body.checkoutId)) {
      return response({ error: 'A valid checkout id is required.' }, 400)
    }
    checkoutId = body.checkoutId
    texts = validateOptionalReceiptTexts(body.receipts) // images may be the only input
  } catch (error) {
    const status = error instanceof ReceiptUtilityError ? error.status : 400
    return response({ error: error instanceof Error ? error.message : 'Invalid request.' }, status)
  }

  let config
  try { config = utilityCatalogConfig() }
  catch (error) {
    console.error('Utility run configuration invalid:', error instanceof Error ? error.message : 'unknown_error')
    return response({ error: 'Paid runs are temporarily unavailable.' }, 503)
  }
  if (!config) return response({ error: 'Paid runs are not currently available.' }, 503)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return response({ error: 'Paid runs are temporarily unavailable.' }, 503)

  // Claim the single use BEFORE the fallible worker runs. Nothing below this
  // point may run for an unpaid/unclaimed checkout.
  const { data: claim, error: claimError } = await ledger.rpc('claim_utility_run', {
    p_checkout_id: checkoutId, p_run_at: new Date().toISOString(),
  })
  if (claimError) {
    console.error('Utility run claim failed:', claimError.code)
    return response({ error: 'Paid runs are temporarily unavailable.' }, 503)
  }
  switch (claim) {
    case 'claimed': break
    case 'not_found': return response({ error: 'No such checkout.' }, 404)
    case 'not_paid': return response({ error: 'This checkout has not been paid yet.' }, 402)
    case 'already_consumed': return response({ error: 'This run has already been used.' }, 409)
    case 'refunded': return response({ error: 'This run was refunded.' }, 410)
    default: return response({ error: 'Paid runs are temporarily unavailable.' }, 503)
  }

  // The claim succeeded: this run is terminal for its inputs. Fetch the images
  // bound to this checkout's draft (server-side; the client never names a path),
  // and ALWAYS clean up the source images afterward — on delivery, on refund, or
  // if anything throws — so photos are never retained past processing.
  const { data: checkoutRow } = await ledger.from('utility_checkouts').select('draft_id').eq('public_id', checkoutId).maybeSingle()
  const draftId: string | null = checkoutRow?.draft_id ?? null
  let outcome: 'delivered' | 'refunded' = 'refunded'

  try {
    const images = draftId ? await fetchDraftImages(ledger, draftId) : []

    // Enforce the combined image+text limit (and the "at least one" minimum). An
    // out-of-bounds batch cannot be processed, so it is refunded like an empty one.
    let batchError: string | null = null
    try { assertMixedBatchWithinLimit({ imageCount: images.length, textCount: texts.length }) }
    catch (error) { batchError = error instanceof Error ? error.message : 'This batch could not be processed.' }
    if (batchError) {
      if (!await autoRefund(ledger, checkoutId, config.stripeSecretKey)) {
        return response({ error: `${batchError} The automatic refund is still being confirmed; contact support if it does not appear shortly.` }, 502)
      }
      return response({ delivered: false, refunded: true, note: `${batchError} The payment was refunded.`, results: [] }, 422)
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const textOf = (message: Anthropic.Message) => message.content.map((block) => (block.type === 'text' ? block.text : '')).join('\n')
    const parseImage = async (image: DraftImage): Promise<ParsedReceipt> => {
      const message = await client.messages.create({
        model: MODEL, max_tokens: 2_000,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: image.contentType, data: image.dataBase64 } },
          { type: 'text', text: buildReceiptImagePrompt() },
        ] }],
      })
      return parseReceiptResponse(textOf(message))
    }
    const parseText = (text: string): Promise<ParsedReceipt> => runReceiptParse(text, async (prompt) => {
      const message = await client.messages.create({ model: MODEL, max_tokens: 2_000, messages: [{ role: 'user', content: prompt }] })
      return textOf(message)
    })

    // Images first, then pasted text — a stable order for the CSV `receipt` index.
    const items: BatchItem[] = [
      ...images.map((image) => ({ source: 'image' as const, parse: () => parseImage(image) })),
      ...texts.map((text) => ({ source: 'text' as const, parse: () => parseText(text) })),
    ]

    const results: BatchResult[] = await Promise.all(items.map(async (item, index): Promise<BatchResult> => {
      try { return { index, source: item.source, parsed: await item.parse() } }
      catch (error) {
        console.error('Utility receipt parse failed:', index, item.source, error instanceof Error ? error.message : 'unknown_error')
        return { index, source: item.source, parsed: null }
      }
    }))

    const deliverable = feasibleReceipts(results.map((r) => r.parsed))

    // You are only charged when at least one receipt yields usable data. Anything
    // else — all infeasible, worker errors, or a mix — triggers an auto-refund.
    if (deliverable.length === 0) {
      if (!await autoRefund(ledger, checkoutId, config.stripeSecretKey)) {
        return response({ error: 'No receipt could be parsed. The automatic refund is still being confirmed; contact support if it does not appear shortly.' }, 502)
      }
      return response({
        delivered: false, refunded: true,
        note: 'None of the submitted receipts could be parsed, so the payment was refunded.',
        results: results.map((r) => ({ index: r.index, source: r.source, feasible: false })),
      }, 422)
    }

    outcome = 'delivered'
    // Payment was reconciled at webhook time as paid-not-delivered; record delivery
    // now. Best-effort — the buyer already has their CSV regardless of this call.
    const delivery = await reconcileRevenueDelivery(ledger, {
      offerId: REVENUE_OFFER_FOR_UTILITY[RECEIPT_UTILITY], checkoutReference: checkoutId,
      referenceId: checkoutId, deliveredAt: new Date().toISOString(),
    })
    if (delivery !== 'processed' && delivery !== 'duplicate' && delivery !== 'ignored') {
      console.error('Utility delivery reconciliation unavailable:', delivery)
    }

    return response({
      delivered: true,
      csv: receiptBatchCsv(deliverable),
      receiptCount: deliverable.length,
      rowCount: deliverable.reduce((sum, receipt) => sum + receipt.lineItems.length, 0),
      results: results.map((r) => ({
        index: r.index,
        source: r.source,
        feasible: r.parsed?.feasible === true,
        confidence: r.parsed?.confidence ?? 0,
        note: r.parsed?.note ?? 'This receipt could not be parsed.',
        merchant: r.parsed?.merchant ?? null,
        rowCount: r.parsed?.lineItems.length ?? 0,
      })),
    })
  } finally {
    // Delete the source images after processing — delivery, refund, or failure.
    if (draftId) await cleanupDraftUploads(ledger, draftId, outcome)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
