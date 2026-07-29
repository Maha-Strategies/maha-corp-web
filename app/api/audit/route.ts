import Anthropic from '@anthropic-ai/sdk'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { MpsAuditError, runMpsAudit } from '@/lib/mps-audit-engine'
import { PUBLIC_MPS_AUDIT_DAILY_LIMIT, PublicMpsAuditConfigurationError, publicAuditVisitorHash } from '@/lib/public-mps-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BODY_BYTES = 16_384
const MODEL = 'claude-sonnet-4-6'

function response(body: object, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function acquisitionChannel(request: Request) {
  return request.headers.get('x-maha-acquisition-channel') === 'github_action' ? 'github_action' : 'web'
}

async function recordEvent(
  ledger: NonNullable<ReturnType<typeof createAgentInquiryLedger>>,
  visitorHash: string,
  eventType: 'submitted' | 'completed' | 'failed',
  inputCharCount: number,
  acquisitionChannel: 'web' | 'github_action',
  claimCount?: number,
) {
  const { error } = await ledger.from('mps_public_audit_events').insert({
    visitor_hash: visitorHash,
    event_type: eventType,
    input_char_count: inputCharCount,
    claim_count: claimCount ?? null,
    acquisition_channel: acquisitionChannel,
  })
  if (error) console.error('Public MPS audit event failed:', error.code)
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return response({ error: 'Content-Type must be application/json.' }, 415)
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return response({ error: 'Passage too long for the free preflight.' }, 413)
  }

  let visitorHash: string
  try {
    visitorHash = publicAuditVisitorHash(request)
  } catch (error) {
    if (error instanceof PublicMpsAuditConfigurationError) {
      console.error('Public MPS audit rate limit is not configured.')
      return response({ error: 'The free preflight is temporarily unavailable.' }, 503)
    }
    return response({ error: 'The free preflight is temporarily unavailable.' }, 503)
  }

  let text: string
  try {
    const body = await request.json() as { text?: unknown }
    if (typeof body.text !== 'string') throw new MpsAuditError('No passage provided.', 400)
    text = body.text.trim()
    if (!text) throw new MpsAuditError('No passage provided.', 400)
    if (text.length > 6_000) throw new MpsAuditError('Passage too long for the free preflight (max ~6,000 characters).', 413)
  } catch (error) {
    const status = error instanceof MpsAuditError ? error.status : 400
    return response({ error: error instanceof Error ? error.message : 'Invalid request body.' }, status)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return response({ error: 'The free preflight is temporarily unavailable.' }, 503)
  const { data: allowed, error: quotaError } = await ledger.rpc('consume_public_mps_audit_quota', {
    p_visitor_hash: visitorHash,
    p_daily_limit: PUBLIC_MPS_AUDIT_DAILY_LIMIT,
  })
  if (quotaError) {
    console.error('Public MPS audit quota failed:', quotaError.code)
    return response({ error: 'The free preflight is temporarily unavailable.' }, 503)
  }
  if (allowed !== true) {
    return response({ error: `Free preflight limit reached. Please return tomorrow, or use the private MPS Preflight for a longer document.` }, 429)
  }

  const channel = acquisitionChannel(request)
  await recordEvent(ledger, visitorHash, 'submitted', text.length, channel)
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const audit = await runMpsAudit(text, async (prompt) => {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1_500,
        messages: [{ role: 'user', content: prompt }],
      })
      return message.content.map((block) => block.type === 'text' ? block.text : '').join('\n')
    })
    await recordEvent(ledger, visitorHash, 'completed', text.length, channel, audit.claims.length)
    return response(audit)
  } catch (error) {
    await recordEvent(ledger, visitorHash, 'failed', text.length, channel)
    if (error instanceof MpsAuditError) return response({ error: error.message }, error.status)
    console.error('Public MPS audit error:', error instanceof Error ? error.name : 'unknown_error')
    return response({ error: "The audit didn't complete. Please try again tomorrow or use the private preflight." }, 502)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
