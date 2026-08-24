// Preview and Production share one Vercel project. A variable defined once for
// both environments carries the same value in both, so anything that
// exposes a Preview deployment exposes Production to the same degree.
//
// The isolation that matters is already in place -- Preview has its own
// Supabase project, Redis keyspace, and Stripe key -- but roughly forty
// variables are still single-valued, and some of them authenticate against
// Production.
//
// This compares the two environments and reports variable NAMES and a verdict.
// It never returns, logs, or stores a value.

export type IsolationTier = 'must_differ' | 'should_differ' | 'may_share'

/**
 * The rule: anything that authenticates, signs, encrypts, or bills must be
 * per-environment. Anything that merely configures may be shared.
 *
 * `must_differ` fails the check. `should_differ` warns: sharing is defensible
 * but costs money or crosses into a live account. Everything unlisted is
 * treated as `may_share`, so a new configuration variable does not create noise
 * — but a new credential has to be classified here deliberately.
 */
export const ISOLATION_POLICY: Readonly<Record<string, IsolationTier>> = {
  // Data stores. Sharing these means Preview writes to Production.
  NEXT_PUBLIC_SUPABASE_URL: 'must_differ',
  SUPABASE_SERVICE_ROLE_KEY: 'must_differ',
  UPSTASH_REDIS_REST_URL: 'must_differ',
  UPSTASH_REDIS_REST_TOKEN: 'must_differ',

  // Operator and reviewer tokens. These authenticate against Production's
  // control planes: credential issuance, the revenue ledger, operator actions.
  AGENT_REVIEW_TOKEN: 'must_differ',
  PRACTITIONER_REVIEW_TOKEN: 'must_differ',
  CELESTIAL_REGISTRY_TOKEN: 'must_differ',
  EPISTEMIC_OPERATIONS_TOKEN: 'must_differ',
  AGENT_INQUIRY_TOKEN: 'must_differ',
  REVENUE_CONTROL_TOKEN: 'must_differ',
  WORKFLOW_CONTROL_TOKEN: 'must_differ',
  ORCHESTRATION_TENANT_TOKENS: 'must_differ',
  MPS_OPERATIONS_TOKEN: 'must_differ',
  INBOUND_OPERATIONS_TOKEN: 'must_differ',
  MARKET_MAPPING_TOKEN: 'must_differ',
  RELEASE_HEALTH_TOKEN: 'must_differ',
  CRON_SECRET: 'must_differ',

  // Money. A shared webhook secret lets a Preview leak forge signed events
  // against Production.
  STRIPE_SECRET_KEY: 'must_differ',
  STRIPE_WEBHOOK_SECRET: 'must_differ',
  STRIPE_BOOKS_WEBHOOK_SECRET: 'must_differ',
  STRIPE_UTILITY_WEBHOOK_SECRET: 'must_differ',
  STRIPE_MPS_CREDITS_WEBHOOK_SECRET: 'must_differ',
  STRIPE_API_KEY_WEBHOOK_SECRET: 'must_differ',
  CDP_API_KEY_ID: 'must_differ',
  CDP_API_KEY_SECRET: 'must_differ',

  // Compute and stored-credential encryption. A shared worker token lets
  // Preview drive Production GPU jobs and forge their callbacks.
  MAHA_WORKER_URL: 'must_differ',
  MAHA_WORKER_TOKEN: 'must_differ',
  MAHA_WORKER_WEBHOOK_SECRET: 'must_differ',
  MCP_ENCRYPTION_KEY: 'must_differ',

  // Alerting. A shared routing key pages the on-call for Preview runs, and the
  // E2E suite trips circuit breakers on every pull request by design.
  PAGERDUTY_ROUTING_KEY: 'must_differ',
  MAHA_OPS_WEBHOOK_URL: 'must_differ',
  MAHA_OPS_WEBHOOK_SECRET: 'must_differ',

  // Signing and outbound identity.
  MPS_PUBLIC_AUDIT_RATE_LIMIT_SECRET: 'must_differ',
  PUBLIC_UTILITY_RATE_LIMIT_SECRET: 'must_differ',
  TURNSTILE_SECRET_KEY: 'must_differ',
  RESEND_API_KEY: 'must_differ',

  // Live price identifiers. A live price with a test key simply fails, so this
  // is correctness rather than security.
  STRIPE_MPS_PREFLIGHT_PRICE_ID: 'must_differ',
  STRIPE_MPS_AUDIT_CREDIT_PRICE_ID: 'must_differ',
  STRIPE_API_CREDITS_STARTER_PRICE_ID: 'must_differ',
  STRIPE_API_CREDITS_PRO_PRICE_ID: 'must_differ',
  STRIPE_API_CREDITS_ENTERPRISE_PRICE_ID: 'must_differ',
  STRIPE_TENANT_BUILDER_PRICE_ID: 'must_differ',
  STRIPE_TENANT_SCALE_PRICE_ID: 'must_differ',
  STRIPE_TENANT_AUTO_TOPUP_PRICE_ID: 'must_differ',
  STRIPE_BOOK_PRICE_MAP: 'must_differ',
  STRIPE_UTILITY_PRICE_MAP: 'must_differ',

  // Metered third-party accounts. Sharing bills Production for Preview usage
  // but grants no access to Production's own data.
  ANTHROPIC_API_KEY: 'should_differ',
  OPENAI_API_KEY: 'should_differ',
  EXA_API_KEY: 'should_differ',

  // Deliberately shared: Vercel manages this one value per project.
  VERCEL_AUTOMATION_BYPASS_SECRET: 'may_share',
}

/**
 * A Vercel environment variable record. One record targeting both environments
 * holds a single value used by both; two records hold two values. Sharing can
 * therefore be determined from structure alone, with no need to decrypt
 * anything — this check never handles a secret value.
 *
 * The one case structure cannot see is two separate records that happen to
 * contain the same string. That is worth knowing about but not worth
 * decrypting production secrets to detect.
 */
export type EnvironmentVariable = { key: string; targets: readonly string[] }

export type IsolationFinding = { key: string; tier: Exclude<IsolationTier, 'may_share'>; state: 'shared' | 'missing_preview' | 'missing_production' }

export type IsolationReport = {
  generatedAt: string
  checked: number
  ok: boolean
  violations: IsolationFinding[]
  warnings: IsolationFinding[]
  isolated: string[]
  unclassified: string[]
}

export function tierFor(key: string): IsolationTier {
  return ISOLATION_POLICY[key] ?? 'may_share'
}

const has = (variable: EnvironmentVariable, target: string) => variable.targets.includes(target)

/**
 * Takes the full record list for a project. Only keys and verdicts leave this
 * function; no value is ever read.
 */
export function auditEnvironmentIsolation(
  variables: readonly EnvironmentVariable[],
  now = new Date(),
): IsolationReport {
  const byKey = new Map<string, EnvironmentVariable[]>()
  for (const variable of variables) {
    byKey.set(variable.key, [...(byKey.get(variable.key) ?? []), variable])
  }
  const keys = [...byKey.keys()].sort()

  const violations: IsolationFinding[] = []
  const warnings: IsolationFinding[] = []
  const isolated: string[] = []
  const unclassified: string[] = []

  for (const key of keys) {
    const tier = tierFor(key)
    if (tier === 'may_share') {
      if (!(key in ISOLATION_POLICY)) unclassified.push(key)
      continue
    }

    const records = byKey.get(key) ?? []
    // A single record covering both environments is one value used by both.
    const shared = records.some((record) => has(record, 'production') && has(record, 'preview'))
    const inProduction = records.some((record) => has(record, 'production'))
    const inPreview = records.some((record) => has(record, 'preview'))

    let state: IsolationFinding['state'] | null = null
    if (shared) state = 'shared'
    else if (!inProduction) state = 'missing_production'
    else if (!inPreview) state = 'missing_preview'

    if (state === null) { isolated.push(key); continue }
    // A variable absent from Preview is not a leak; it is simply unset there,
    // and only worth reporting for the tier that must be isolated.
    if (state !== 'shared' && tier === 'should_differ') { isolated.push(key); continue }
    const finding: IsolationFinding = { key, tier, state }
    if (tier === 'must_differ' && state === 'shared') violations.push(finding)
    else warnings.push(finding)
  }

  return {
    generatedAt: now.toISOString(),
    checked: keys.length,
    ok: violations.length === 0,
    violations,
    warnings,
    isolated,
    unclassified,
  }
}
