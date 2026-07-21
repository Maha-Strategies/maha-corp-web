import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping, createMarketOpportunityId, marketMappingHash, marketOpportunityScore } from '@/lib/market-mapping'
import { parseSearchConsoleImport, searchConsoleImportCandidates } from '@/lib/search-console-ingestion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The Search Console import failed validation.' } }, 400)
  return jsonResponse({ error: { code: 'market_mapping_unavailable', message: 'The market-mapping ledger is temporarily unavailable.' } }, 503)
}

export async function POST(request: Request) {
  const authorization = authorizeMarketMapping(request)
  if (!authorization.authorized || !authorization.actorFingerprint) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let input: ReturnType<typeof parseSearchConsoleImport>
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > 280_000) return jsonResponse({ error: { code: 'payload_too_large', message: 'The Search Console import is limited to 256 KB of CSV data.' } }, 413)
    input = parseSearchConsoleImport(JSON.parse(raw))
  } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid Search Console export.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const { error: snapshotError } = await ledger.from('search_console_query_snapshots').upsert(
    input.rows.map((row) => ({ observed_on: input.observedAt, query: row.query, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position, imported_at: new Date().toISOString() })),
    { onConflict: 'observed_on,query' },
  )
  if (snapshotError) return jsonResponse({ error: { code: 'search_performance_unavailable', message: 'Search performance storage is unavailable. Apply the feedback migration first.' } }, 503)
  const { eligible, skipped } = searchConsoleImportCandidates(input)
  let created = 0, duplicates = 0, failed = 0
  for (const candidate of eligible) {
    const { data, error } = await ledger.rpc('create_market_opportunity', {
      p_opportunity_id: createMarketOpportunityId(), p_source: candidate.source, p_signal_class: candidate.signalClass, p_source_reference: candidate.sourceReference, p_title: candidate.title,
      p_problem: candidate.problem, p_buyer: candidate.buyer, p_proposed_solution: candidate.proposedSolution, p_evidence: candidate.evidence,
      p_demand_evidence: candidate.demandEvidence, p_commercial_intent: candidate.commercialIntent, p_capability_fit: candidate.capabilityFit,
      p_speed_to_validate: candidate.speedToValidate, p_risk_penalty: candidate.riskPenalty, p_score: marketOpportunityScore(candidate),
      p_idempotency_hash: marketMappingHash(candidate.idempotencyKey), p_actor_fingerprint: authorization.actorFingerprint, p_at: new Date().toISOString(),
    })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) { failed += 1; continue }
    if ((data as { idempotentReplay?: unknown }).idempotentReplay === true) duplicates += 1
    else created += 1
  }
  return jsonResponse({ import: { rows: input.rows.length, snapshots: input.rows.length, eligible: eligible.length, skipped, created, duplicates, failed }, autonomousPublishingSupported: false, autonomousSpendSupported: false, autonomousOutreachSupported: false }, 200)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
