import Anthropic from '@anthropic-ai/sdk'

import { jsonResponse } from '@/lib/agent-inquiries'
import { contentDraftAssistantPrompt, parseAssistantRequest, parseContentDraftSuggestion } from '@/lib/content-draft-assistant'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { sourceMetadataWarnings } from '@/lib/content-source-quality'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

function authorized(request: Request) { const result = authorizeMarketMapping(request); return result.authorized ? result : null }
function unavailable(message: string, status = 503) { return jsonResponse({ error: { code: 'content_draft_assistant_unavailable', message } }, status) }

export async function POST(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  if (process.env.CONTENT_DRAFT_ASSISTANT_ENABLED !== 'true') return unavailable('The private draft assistant is disabled. Set CONTENT_DRAFT_ASSISTANT_ENABLED=true to enable explicit, operator-triggered generation.')
  if (!process.env.ANTHROPIC_API_KEY) return unavailable('The private draft assistant is not configured.')

  let input: { candidateId: string }
  try { input = parseAssistantRequest(await request.json()) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable('The private draft ledger is unavailable.')
  const { data: candidate, error } = await ledger
    .from('content_page_candidates')
    .select('public_id,topic_cluster,proposed_path,reader_question,reader_outcome,original_value,author_attribution,evidence,status')
    .eq('public_id', input.candidateId)
    .maybeSingle()
  if (error) return unavailable('The private draft ledger is unavailable.')
  if (!candidate) return jsonResponse({ error: { code: 'not_found', message: 'Content candidate not found.' } }, 404)
  if (candidate.status !== 'approved_for_draft') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'A human must approve the evidence package before draft generation.' } }, 409)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: process.env.CONTENT_DRAFT_ASSISTANT_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 2_500,
      messages: [{ role: 'user', content: contentDraftAssistantPrompt(candidate) }],
    })
    const raw = message.content.map((block) => block.type === 'text' ? block.text : '').join('\n').trim()
    const suggestion = parseContentDraftSuggestion(JSON.parse(raw))
    return jsonResponse({
      suggestion,
      sourceWarnings: sourceMetadataWarnings(candidate.evidence),
      publicationAuthority: false,
      savedDraft: false,
    }, 200)
  } catch (error) {
    console.error('Content draft assistant failed:', error instanceof Error ? error.name : 'unknown_error')
    return unavailable('The draft assistant did not return a usable private draft. No draft was saved; you can try again.')
  }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
