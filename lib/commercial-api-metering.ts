export const COMMERCIAL_API_OPERATIONS = {
  mps_audit: { endpoint: '/api/mps-audits', method: 'POST' },
  mps_credit_balance: { endpoint: '/api/mps-credits', method: 'GET' },
  book_entitlement: { endpoint: '/api/books/[id]/entitlement', method: 'GET' },
  book_content: { endpoint: '/api/books/[id]/content', method: 'GET' },
  mcp_evidence_retrieval: { endpoint: '/api/mcp/evidence', method: 'POST' },
} as const

export type CommercialApiOperation = keyof typeof COMMERCIAL_API_OPERATIONS

type Ledger = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }> }

export type CommercialApiUsageRow = {
  usage_day: string
  operation: CommercialApiOperation
  endpoint: string
  method: string
  status_class: number
  request_count: number | string
  unit_quantity: number | string
}

function number(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Records only a daily aggregate keyed by a server-side credential ID. It never
 * accepts request headers, IPs, tokens, payloads, URLs with user input, or PII.
 * Metering failure is intentionally non-blocking for the paid API response.
 */
export async function recordCommercialApiUsage(
  ledger: Ledger,
  input: { credentialId: string; operation: CommercialApiOperation; statusCode: number; unitQuantity?: number },
) {
  const definition = COMMERCIAL_API_OPERATIONS[input.operation]
  const { error } = await ledger.rpc('record_commercial_api_usage', {
    p_credential_id: input.credentialId,
    p_operation: input.operation,
    p_endpoint: definition.endpoint,
    p_method: definition.method,
    p_status_code: input.statusCode,
    p_unit_quantity: input.unitQuantity ?? 1,
    p_observed_at: new Date().toISOString(),
  })
  if (error) console.error('Commercial API meter write failed:', error.code ?? 'unknown_error')
}

export function aggregateCommercialApiUsage(rows: CommercialApiUsageRow[]) {
  const byOperation = new Map<string, { operation: string; endpoint: string; method: string; requests: number; units: number; successfulRequests: number; clientErrors: number; serverErrors: number }>()
  let requests = 0
  let units = 0
  let successfulRequests = 0

  for (const row of rows) {
    const count = number(row.request_count)
    const quantity = number(row.unit_quantity)
    requests += count
    units += quantity
    if (row.status_class < 4) successfulRequests += count

    const current = byOperation.get(row.operation) ?? {
      operation: row.operation, endpoint: row.endpoint, method: row.method, requests: 0, units: 0, successfulRequests: 0, clientErrors: 0, serverErrors: 0,
    }
    current.requests += count
    current.units += quantity
    if (row.status_class < 4) current.successfulRequests += count
    if (row.status_class === 4) current.clientErrors += count
    if (row.status_class === 5) current.serverErrors += count
    byOperation.set(row.operation, current)
  }

  return {
    requests,
    units,
    successfulRequests,
    successRate: requests === 0 ? null : successfulRequests / requests,
    byOperation: [...byOperation.values()].sort((left, right) => right.requests - left.requests || left.operation.localeCompare(right.operation)),
  }
}
