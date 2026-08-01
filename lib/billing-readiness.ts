import { createAgentInquiryLedger } from './agent-inquiry-ledger.ts'

export type ReadinessState = 'ready' | 'degraded' | 'unavailable'
export type ReadinessCheck = {
  state: ReadinessState
  code: string
  count?: number
  latestAt?: string
}

export type BillingReadinessReport = {
  generatedAt: string
  readOnly: true
  state: ReadinessState
  configuration: {
    supabaseUrlConfigured: boolean
    supabaseServiceRoleConfigured: boolean
    upstashUrlConfigured: boolean
    upstashTokenConfigured: boolean
    stripeSecretKeyConfigured: boolean
    stripeWebhookSecretConfigured: boolean
    starterPriceConfigured: boolean
    proPriceConfigured: boolean
    enterprisePriceConfigured: boolean
  }
  dependencies: {
    supabase: ReadinessCheck
    upstash: ReadinessCheck
  }
  ledger: {
    checkouts: ReadinessCheck
    stripeEvents: ReadinessCheck
    entries: ReadinessCheck
    reversals: ReadinessCheck
  }
}

type Environment = Record<string, string | undefined>
type Ledger = NonNullable<ReturnType<typeof createAgentInquiryLedger>>

export const billingLedgerTimestampColumns = {
  api_credit_checkouts: 'created_at',
  api_credit_stripe_events: 'processed_at',
  api_credit_ledger_entries: 'created_at',
  api_credit_payment_reversals: 'created_at',
} as const

type BillingLedgerTable = keyof typeof billingLedgerTimestampColumns

function configured(value: string | undefined) {
  return Boolean(value?.trim().replace(/^["']|["']$/g, ''))
}

function sanitized(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, '') || undefined
}

export function billingConfigurationPresence(environment: Environment = process.env) {
  return {
    supabaseUrlConfigured: configured(environment.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRoleConfigured: configured(environment.SUPABASE_SERVICE_ROLE_KEY),
    upstashUrlConfigured: configured(environment.UPSTASH_REDIS_REST_URL),
    upstashTokenConfigured: configured(environment.UPSTASH_REDIS_REST_TOKEN),
    stripeSecretKeyConfigured: configured(environment.STRIPE_SECRET_KEY),
    stripeWebhookSecretConfigured: configured(environment.STRIPE_API_KEY_WEBHOOK_SECRET),
    starterPriceConfigured: configured(environment.STRIPE_API_CREDITS_STARTER_PRICE_ID),
    proPriceConfigured: configured(environment.STRIPE_API_CREDITS_PRO_PRICE_ID),
    enterprisePriceConfigured: configured(environment.STRIPE_API_CREDITS_ENTERPRISE_PRICE_ID),
  }
}

function readinessState(checks: ReadinessCheck[]): ReadinessState {
  if (checks.every((check) => check.state === 'ready')) return 'ready'
  if (checks.every((check) => check.state === 'unavailable')) return 'unavailable'
  return 'degraded'
}

export function billingLedgerFailureCode(errorCode: string | undefined): string {
  if (errorCode === '42P01' || errorCode === 'PGRST205') return 'ledger_migration_missing_or_schema_cache_stale'
  if (errorCode === '42501' || errorCode === 'PGRST301') return 'ledger_access_denied'
  return 'ledger_table_unavailable'
}

async function inspectTable(ledger: Ledger, table: BillingLedgerTable): Promise<ReadinessCheck> {
  const timestampColumn = billingLedgerTimestampColumns[table]
  try {
    const { data, error, count } = await ledger
      .from(table)
      .select(timestampColumn, { count: 'exact' })
      .order(timestampColumn, { ascending: false })
      .limit(1)
    if (error) return { state: 'unavailable', code: billingLedgerFailureCode(error.code) }
    const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined
    const latestAt = row?.[timestampColumn]
    return {
      state: 'ready',
      code: 'ledger_table_reachable',
      count: typeof count === 'number' ? count : 0,
      latestAt: typeof latestAt === 'string' ? latestAt : undefined,
    }
  } catch {
    return { state: 'unavailable', code: 'ledger_table_unavailable' }
  }
}

async function inspectUpstash(environment: Environment): Promise<ReadinessCheck> {
  const url = sanitized(environment.UPSTASH_REDIS_REST_URL)?.replace(/\/$/, '')
  const token = sanitized(environment.UPSTASH_REDIS_REST_TOKEN)
  if (!url || !token) return { state: 'unavailable', code: 'upstash_configuration_missing' }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['PING']),
      cache: 'no-store',
    })
    if (!response.ok) return { state: 'unavailable', code: 'upstash_ping_failed' }
    const payload = await response.json().catch(() => null) as { result?: unknown } | null
    return payload?.result === 'PONG'
      ? { state: 'ready', code: 'upstash_reachable' }
      : { state: 'unavailable', code: 'upstash_ping_failed' }
  } catch {
    return { state: 'unavailable', code: 'upstash_ping_failed' }
  }
}

export async function getBillingReadiness(environment: Environment = process.env): Promise<BillingReadinessReport> {
  const configuration = billingConfigurationPresence(environment)
  const ledger = createAgentInquiryLedger()
  const unavailableLedger: ReadinessCheck = { state: 'unavailable', code: 'supabase_configuration_missing' }
  const [upstash, checkouts, stripeEvents, entries, reversals] = await Promise.all([
    inspectUpstash(environment),
    ledger ? inspectTable(ledger, 'api_credit_checkouts') : Promise.resolve(unavailableLedger),
    ledger ? inspectTable(ledger, 'api_credit_stripe_events') : Promise.resolve(unavailableLedger),
    ledger ? inspectTable(ledger, 'api_credit_ledger_entries') : Promise.resolve(unavailableLedger),
    ledger ? inspectTable(ledger, 'api_credit_payment_reversals') : Promise.resolve(unavailableLedger),
  ])
  const supabase = readinessState([checkouts, stripeEvents, entries, reversals])
  const configState = Object.values(configuration).every(Boolean) ? 'ready' : 'unavailable'
  const dependencies = {
    supabase: { state: supabase, code: supabase === 'ready' ? 'supabase_ledger_reachable' : 'supabase_ledger_unavailable' } as ReadinessCheck,
    upstash,
  }
  const state = readinessState([dependencies.supabase, dependencies.upstash, { state: configState, code: 'billing_configuration' }])
  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    state,
    configuration,
    dependencies,
    ledger: { checkouts, stripeEvents, entries, reversals },
  }
}
