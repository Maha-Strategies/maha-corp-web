import Anthropic from '@anthropic-ai/sdk'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { PUBLIC_UTILITY_DAILY_LIMIT, PublicUtilityConfigurationError, publicUtilityVisitorHash } from '@/lib/public-utility'
import { MAX_RECEIPT_CHARS, RECEIPT_UTILITY, ReceiptUtilityError, receiptCsv, runReceiptParse, validateReceiptText } from '@/lib/receipt-utility'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BODY_BYTES = 24_576
const MODEL = 'claude-sonnet-4-6'

function response(body: object, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function recordEvent(
  ledger: NonNullable<ReturnType<typeof createAgentInquiryLedger>>,
  visitorHash: string,
  eventType: 'submitted' | 'completed' | 'failed' | 'infeasible',
  inputCharCount: number,
) {
  const { error } = await ledger.from('public_utility_events').insert({
    visitor_hash: visitorHash, utility: RECEIPT_UTILITY, event_type: eventType, input_char_count: inputCharCount,
  })
  if (error) console.error('Public utility event failed:', error.code)
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return response({ error: 'Content-Type must be application/json.' }, 415)
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return response({ error: 'Receipt is too long for the free demo.' }, 413)
  }

  let visitorHash: string
  try {
    visitorHash = publicUtilityVisitorHash(request)
  } catch (error) {
    if (error instanceof PublicUtilityConfigurationError) console.error('Public utility rate limit is not configured.')
    return response({ error: 'The free demo is temporarily unavailable.' }, 503)
  }

  let text: string
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return response({ error: 'Receipt is too long for the free demo.' }, 413)
    const body = JSON.parse(raw) as { text?: unknown }
    text = validateReceiptText(body.text)
  } catch (error) {
    const status = error instanceof ReceiptUtilityError ? error.status : 400
    return response({ error: error instanceof Error ? error.message : 'Invalid request.' }, status)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return response({ error: 'The free demo is temporarily unavailable.' }, 503)
  const { data: allowed, error: quotaError } = await ledger.rpc('consume_public_utility_quota', {
    p_visitor_hash: visitorHash, p_utility: RECEIPT_UTILITY, p_daily_limit: PUBLIC_UTILITY_DAILY_LIMIT,
  })
  if (quotaError) {
    console.error('Public utility quota failed:', quotaError.code)
    return response({ error: 'The free demo is temporarily unavailable.' }, 503)
  }
  if (allowed !== true) {
    return response({ error: `Free demo limit reached (${PUBLIC_UTILITY_DAILY_LIMIT}/day). A paid batch run has no per-day cap.` }, 429)
  }

  await recordEvent(ledger, visitorHash, 'submitted', text.length)
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const parsed = await runReceiptParse(text, async (prompt) => {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2_000,
        messages: [{ role: 'user', content: prompt }],
      })
      return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('\n')
    })

    // Pre-flight feasibility: if it isn't a parseable receipt, say so plainly.
    // In the paid flow this is exactly where we'd decline to charge.
    if (!parsed.feasible) {
      await recordEvent(ledger, visitorHash, 'infeasible', text.length)
      return response({
        feasible: false,
        confidence: parsed.confidence,
        note: parsed.note,
        upsell: null,
      })
    }

    await recordEvent(ledger, visitorHash, 'completed', text.length)
    return response({
      feasible: true,
      confidence: parsed.confidence,
      note: parsed.note,
      receipt: {
        merchant: parsed.merchant,
        purchasedAt: parsed.purchasedAt,
        currency: parsed.currency,
        subtotal: parsed.subtotal,
        tax: parsed.tax,
        total: parsed.total,
        lineItems: parsed.lineItems,
      },
      csv: receiptCsv(parsed),
      rowCount: parsed.lineItems.length,
      maxDemoChars: MAX_RECEIPT_CHARS,
      upsell: { message: 'Batch up to 20 receipts in one run.', unit: 'receipt batch' },
    })
  } catch (error) {
    await recordEvent(ledger, visitorHash, 'failed', text.length)
    const status = error instanceof ReceiptUtilityError ? error.status : 502
    return response({ error: error instanceof ReceiptUtilityError ? error.message : 'The receipt could not be parsed. Please try again.' }, status)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
