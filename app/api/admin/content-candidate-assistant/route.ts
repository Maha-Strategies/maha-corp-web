import Anthropic from '@anthropic-ai/sdk'

import { jsonResponse } from '@/lib/agent-inquiries'
import { candidateResearchQueries, contentCandidateAssistantPrompt, parseCandidateAssistantRequest, parseContentCandidateSuggestion, selectIndependentSources } from '@/lib/content-candidate-assistant'
import { authorizeMarketMapping } from '@/lib/market-mapping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 45

type ExaResult = { url?: unknown; title?: unknown; highlights?: unknown; text?: unknown; publishedDate?: unknown }

function authorized(request: Request) { const result = authorizeMarketMapping(request); return result.authorized ? result : null }
function unavailable(message: string, status = 503) { return jsonResponse({ error: { code: 'content_candidate_assistant_unavailable', message } }, status) }

async function retrieveSources(apiKey: string, seedQuestion: string) {
  const results: unknown[] = []
  for (const query of candidateResearchQueries(seedQuestion)) {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, numResults: 5, type: 'auto', contents: { highlights: true } }),
    })
    if (!response.ok) continue
    const body = await response.json() as { results?: unknown }
    if (!Array.isArray(body.results)) continue
    for (const raw of body.results as ExaResult[]) {
      results.push({
        url: raw.url,
        title: raw.title,
        snippet: Array.isArray(raw.highlights) ? raw.highlights.filter((item): item is string => typeof item === 'string').join(' ') : raw.text,
        publishedOn: raw.publishedDate,
      })
    }
  }
  return selectIndependentSources(results)
}

export async function POST(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  if (process.env.CONTENT_CANDIDATE_ASSISTANT_ENABLED !== 'true') return unavailable('The candidate intake assistant is disabled. Set CONTENT_CANDIDATE_ASSISTANT_ENABLED=true to enable explicit, operator-triggered retrieval and generation.')
  if (!process.env.EXA_API_KEY || !process.env.ANTHROPIC_API_KEY) return unavailable('The candidate intake assistant is not configured.')

  let input: ReturnType<typeof parseCandidateAssistantRequest>
  try { input = parseCandidateAssistantRequest(await request.json()) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request.' } }, 400) }
  let sources: ReturnType<typeof selectIndependentSources>
  try {
    sources = await retrieveSources(process.env.EXA_API_KEY, input.seedQuestion)
  } catch {
    return unavailable('The read-only Exa research step failed. Confirm EXA_API_KEY is present in Vercel and try again.')
  }
  if (sources.length < 3) return unavailable('The read-only research step did not find three independent, dated sources. Refine the question or add sources manually.', 422)
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({ model: process.env.CONTENT_CANDIDATE_ASSISTANT_MODEL ?? 'claude-sonnet-4-6', max_tokens: 2_000, messages: [{ role: 'user', content: contentCandidateAssistantPrompt({ ...input, sources }) }] })
    const responseText = message.content.map((block) => block.type === 'text' ? block.text : '').join('\n').trim()
    const unfenced = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const start = unfenced.indexOf('{'); const end = unfenced.lastIndexOf('}')
    const raw = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced
    const suggestion = parseContentCandidateSuggestion(JSON.parse(raw), { topicCluster: input.topicCluster, sources })
    return jsonResponse({ suggestion, savedCandidate: false, publicationAuthority: false, sourcesRetrieved: sources.length }, 200)
  } catch (error) {
    console.error('Content candidate assistant failed:', error instanceof Error ? error.name : 'unknown_error')
    const reason = error instanceof Error ? error.message : 'unknown validation error'
    return unavailable(`The model did not return a valid private candidate suggestion (${reason}). No candidate was saved; you can retry.`)
  }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
