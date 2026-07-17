import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMpsOperations, parseMpsOperationsLookup } from '@/lib/mps-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 4_096

type StripeEventRow = {
  stripe_event_id: string
  event_type: string
  object_id: string | null
  processor: string
  processing_result: string
  processed_at: string
}

type LedgerEntryRow = {
  client_id: string
  quantity: number | string
  source_type: string
  source_id: string
  metadata: unknown
}

function operationsAuthorizationResponse(request: Request) {
  const authorization = authorizeMpsOperations(request)
  if (authorization.kind === 'unconfigured') {
    return jsonResponse({ error: { code: 'operations_unavailable', message: 'The MPS operations control plane is not configured.' } }, 503)
  }
  if (authorization.kind === 'unauthorized') {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid MPS operations bearer token is required.' } }, 401)
  }
  return null
}

function stripeEventId(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return null
  const value = (metadata as { stripeEventId?: unknown }).stripeEventId
  return typeof value === 'string' && /^evt_[A-Za-z0-9]+$/.test(value) ? value : null
}

async function handlePost(request: Request) {
  const authorizationResponse = operationsAuthorizationResponse(request)
  if (authorizationResponse) return authorizationResponse
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: { code: 'payload_too_large', message: 'Lookup request exceeds the 4 KB limit.' } }, 413)
  }

  let lookup: ReturnType<typeof parseMpsOperationsLookup>
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return jsonResponse({ error: { code: 'payload_too_large', message: 'Lookup request exceeds the 4 KB limit.' } }, 413)
    }
    const body = JSON.parse(raw) as { query?: unknown }
    lookup = parseMpsOperationsLookup(typeof body.query === 'string' ? body.query : null)
  } catch (error) {
    return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid lookup request.' } }, 400)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The operational ledger is not configured.' } }, 503)

  const clientIds = new Set<string>()
  const directEvents = new Map<string, StripeEventRow>()
  let seedError: { code?: string } | null = null

  async function addCheckoutClient(column: 'public_id' | 'stripe_checkout_session_id' | 'stripe_payment_intent_id', value: string) {
    const { data, error } = await ledger!.from('mps_credit_checkouts').select('client_id').eq(column, value).maybeSingle()
    if (error) seedError = error
    if (data?.client_id) clientIds.add(String(data.client_id))
  }

  async function addRefundClient(refundId: string) {
    const { data, error } = await ledger!.from('mps_credit_ledger_entries')
      .select('client_id').eq('source_type', 'stripe_refund').eq('source_id', refundId).maybeSingle()
    if (error) seedError = error
    if (data?.client_id) clientIds.add(String(data.client_id))
  }

  if (lookup.kind === 'client') {
    clientIds.add(lookup.value)
  } else if (lookup.kind === 'credential' || lookup.kind === 'credential_prefix') {
    const column = lookup.kind === 'credential' ? 'public_id' : 'secret_prefix'
    const { data, error } = await ledger.from('agent_client_credentials').select('client_id').eq(column, lookup.value)
    if (error) seedError = error
    for (const row of data ?? []) clientIds.add(String(row.client_id))
  } else if (lookup.kind === 'checkout') {
    await addCheckoutClient('public_id', lookup.value)
  } else if (lookup.kind === 'stripe_session') {
    await addCheckoutClient('stripe_checkout_session_id', lookup.value)
  } else if (lookup.kind === 'stripe_payment_intent') {
    await addCheckoutClient('stripe_payment_intent_id', lookup.value)
  } else if (lookup.kind === 'stripe_refund') {
    await addRefundClient(lookup.value)
  } else if (lookup.kind === 'receipt_email') {
    const { data, error } = await ledger.from('agent_clients').select('public_id').eq('display_name', lookup.value)
    if (error) seedError = error
    for (const row of data ?? []) clientIds.add(String(row.public_id))
  } else {
    const { data, error } = await ledger.from('stripe_webhook_events')
      .select('stripe_event_id, event_type, object_id, processor, processing_result, processed_at')
      .eq('stripe_event_id', lookup.value).maybeSingle()
    if (error) seedError = error
    if (data) {
      const event = data as StripeEventRow
      directEvents.set(event.stripe_event_id, event)
      if (event.object_id?.startsWith('cs_')) await addCheckoutClient('stripe_checkout_session_id', event.object_id)
      if (event.object_id?.startsWith('re_')) await addRefundClient(event.object_id)
    }
  }

  if (seedError) {
    console.error('MPS operations lookup seed failed:', seedError.code ?? 'unknown_error')
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The operational ledger could not be searched.' } }, 503)
  }

  const ids = [...clientIds]
  if (!ids.length && !directEvents.size) {
    return jsonResponse({ error: { code: 'not_found', message: 'No operational records matched that exact identifier.' } }, 404)
  }

  const empty = { data: [] as Record<string, unknown>[], error: null }
  const [clientsResult, credentialsResult, checkoutsResult, entriesResult, auditsResult, actionsResult, balancesResult] = ids.length
    ? await Promise.all([
        ledger.from('agent_clients')
          .select('public_id, display_name, status, created_at, revoked_at').in('public_id', ids).order('created_at', { ascending: false }),
        ledger.from('agent_client_credentials')
          .select('public_id, client_id, label, secret_prefix, allowed_offer_ids, allowed_capabilities, rate_limit_per_hour, expires_at, status, billing_mode, issued_at, revoked_at, revocation_reason')
          .in('client_id', ids).order('issued_at', { ascending: false }).limit(100),
        ledger.from('mps_credit_checkouts')
          .select('public_id, client_id, credential_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_payment_amount, stripe_payment_currency, stripe_price_id, credit_quantity, status, failure_code, created_at, paid_at')
          .in('client_id', ids).order('created_at', { ascending: false }).limit(100),
        ledger.from('mps_credit_ledger_entries')
          .select('public_id, client_id, checkout_id, entry_type, unit, quantity, source_type, source_id, event_hash, metadata, created_at')
          .in('client_id', ids).order('created_at', { ascending: false }).limit(200),
        ledger.from('agent_mps_audits')
          .select('public_id, client_id, credential_id, client_request_id, input_hash, status, failure_code, model, created_at, completed_at')
          .in('client_id', ids).order('created_at', { ascending: false }).limit(100),
        ledger.from('mps_operator_actions')
          .select('public_id, action_type, client_id, credential_id, replacement_credential_id, reason, reference_id, action_result, created_at')
          .in('client_id', ids).order('created_at', { ascending: false }).limit(100),
        ledger.rpc('get_mps_operational_balances', { p_client_ids: ids }),
      ])
    : [empty, empty, empty, empty, empty, empty, empty]

  const readError = clientsResult.error ?? credentialsResult.error ?? checkoutsResult.error
    ?? entriesResult.error ?? auditsResult.error ?? actionsResult.error ?? balancesResult.error
  if (readError) {
    console.error('MPS operations lookup read failed:', readError.code ?? 'unknown_error')
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The operational records could not be read.' } }, 503)
  }

  const entries = (entriesResult.data ?? []) as unknown as LedgerEntryRow[]
  const objectIds = new Set<string>()
  for (const checkout of checkoutsResult.data ?? []) {
    if (typeof checkout.stripe_checkout_session_id === 'string') objectIds.add(checkout.stripe_checkout_session_id)
  }
  const linkedEventIds = new Set<string>()
  for (const entry of entries) {
    if (entry.source_type === 'stripe_refund') objectIds.add(entry.source_id)
    const eventId = stripeEventId(entry.metadata)
    if (eventId) linkedEventIds.add(eventId)
  }

  const eventReads = []
  if (objectIds.size) {
    eventReads.push(ledger.from('stripe_webhook_events')
      .select('stripe_event_id, event_type, object_id, processor, processing_result, processed_at')
      .in('object_id', [...objectIds]).order('processed_at', { ascending: false }).limit(200))
  }
  if (linkedEventIds.size) {
    eventReads.push(ledger.from('stripe_webhook_events')
      .select('stripe_event_id, event_type, object_id, processor, processing_result, processed_at')
      .in('stripe_event_id', [...linkedEventIds]).order('processed_at', { ascending: false }).limit(200))
  }
  const eventResults = await Promise.all(eventReads)
  for (const result of eventResults) {
    if (result.error) {
      console.error('MPS operations Stripe event lookup failed:', result.error.code)
      return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Stripe event records could not be read.' } }, 503)
    }
    for (const row of result.data ?? []) {
      const event = row as StripeEventRow
      directEvents.set(event.stripe_event_id, event)
    }
  }

  const balances = Object.fromEntries((balancesResult.data ?? []).map((row: { client_id: unknown; balance: unknown }) => [
    String(row.client_id),
    Number(row.balance),
  ]))
  const found = Boolean((clientsResult.data?.length ?? 0) || directEvents.size)
  if (!found) return jsonResponse({ error: { code: 'not_found', message: 'No operational records matched that exact identifier.' } }, 404)

  return jsonResponse({
    lookup: { kind: lookup.kind, exactMatch: true },
    balances,
    clients: clientsResult.data ?? [],
    credentials: credentialsResult.data ?? [],
    checkouts: checkoutsResult.data ?? [],
    ledgerEntries: entriesResult.data ?? [],
    audits: auditsResult.data ?? [],
    stripeEvents: [...directEvents.values()].sort((left, right) => right.processed_at.localeCompare(left.processed_at)),
    operatorActions: actionsResult.data ?? [],
    secretsIncluded: false,
    limits: { credentials: 100, checkouts: 100, ledgerEntries: 200, audits: 100, stripeEvents: 200, operatorActions: 100 },
  }, 200)
}

export async function POST(request: Request) {
  try {
    return await handlePost(request)
  } catch (error) {
    console.error('MPS operations lookup request failed:', error instanceof Error ? error.name : 'unknown_error')
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The operational lookup could not be completed.' } }, 503)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
