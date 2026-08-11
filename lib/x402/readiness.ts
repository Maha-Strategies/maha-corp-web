import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { x402Config, x402Enabled, type X402Config } from './config.ts'
import { X402_OFFERS, offerFor, type X402Offer } from './offers.ts'
import { MAX_RESOURCE_DESCRIPTION_BYTES, MAX_RESOURCE_DESCRIPTION_CHARS } from './discovery.ts'

// Operational readiness for the x402 surface.
//
// `catalogContradictions` was being computed and then dropped on the floor: a
// deployment whose X402_RESOURCES disagreed with the published catalog logged a
// line at boot and served traffic. A contradiction nobody is paged about is a
// contradiction that ships.
//
// Everything below reports state, never configuration. No secret, key,
// facilitator credential, connection string, or raw environment value appears
// in the output -- the checks answer "is this coherent", and a readiness
// endpoint that echoed the values it checked would be a credential leak with an
// uptime dashboard attached.

export type ReadinessCheck = {
  id: string
  state: 'ok' | 'warn' | 'fail'
  summary: string
  /** Never a value; only what is wrong and what would fix it. */
  detail?: string
}

export type X402ReadinessReport = {
  state: 'ready' | 'degraded' | 'unavailable'
  enabled: boolean
  checkedAt: string
  offers: { id: string; status: X402Offer['status']; enabledInThisEnvironment: boolean; payableInProduction: boolean }[]
  checks: ReadinessCheck[]
}

/** Tables and functions each enabled offer needs before it can serve a payer. */
const REQUIRED_RELATIONS: Record<string, { tables: string[]; functions: string[] }> = {
  'context-compression': { tables: ['x402_payments', 'x402_offer_usage_daily'], functions: ['record_x402_offer_usage'] },
  'deep-context-evaluation': { tables: ['x402_payments', 'x402_offer_usage_daily'], functions: ['record_x402_offer_usage'] },
  'mps-autonomous-audit': {
    tables: ['x402_payments', 'x402_offer_usage_daily', 'x402_mps_audits', 'x402_offer_admissions'],
    functions: ['record_x402_offer_usage', 'reserve_x402_admission', 'resume_x402_mps_audit'],
  },
}

type Probe = (relation: string) => Promise<boolean>

/**
 * Existence probe that cannot become a data leak.
 *
 * Selects nothing and returns a boolean. A readiness check that fetched rows
 * to prove a table exists would put customer data in an operations response.
 */
function defaultProbe(): Probe | null {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return null
  return async (relation: string) => {
    try {
      const { error } = await ledger.from(relation).select('*', { count: 'exact', head: true }).limit(0)
      return !error
    } catch {
      return false
    }
  }
}

export async function getX402Readiness(options: {
  environment?: Record<string, string | undefined>
  probe?: Probe | null
} = {}): Promise<X402ReadinessReport> {
  const environment = options.environment ?? process.env
  const checkedAt = new Date().toISOString()
  const checks: ReadinessCheck[] = []

  if (!x402Enabled(environment)) {
    return {
      state: 'unavailable',
      enabled: false,
      checkedAt,
      offers: X402_OFFERS.map((offer) => ({
        id: offer.id, status: offer.status, enabledInThisEnvironment: false, payableInProduction: offer.availability.payableInProduction,
      })),
      checks: [{ id: 'x402.enabled', state: 'warn', summary: 'X402_ENABLED is not true; no offer is payable in this environment.' }],
    }
  }

  let config: X402Config | null = null
  try {
    config = x402Config(environment)
  } catch (error) {
    // A present-but-invalid configuration is the one case that must fail
    // loudly: it serves 503s to payers while looking configured.
    checks.push({
      id: 'x402.configuration',
      state: 'fail',
      summary: 'x402 configuration is present but invalid, so payments are refused.',
      detail: error instanceof Error ? error.message : 'unknown_error',
    })
    return { state: 'unavailable', enabled: true, checkedAt, offers: [], checks }
  }
  if (!config) {
    return {
      state: 'unavailable', enabled: false, checkedAt, offers: [],
      checks: [{ id: 'x402.enabled', state: 'warn', summary: 'x402 is not configured in this environment.' }],
    }
  }

  const enabledIds = new Set(config.resources.map((resource) => resource.offerId))

  // --- Configuration contradictions -----------------------------------------
  checks.push(config.catalogContradictions.length === 0
    ? { id: 'x402.catalog.agreement', state: 'ok', summary: 'X402_RESOURCES agrees with the published offer catalog.' }
    : {
        id: 'x402.catalog.agreement',
        state: 'fail',
        summary: `X402_RESOURCES contradicts the published catalog in ${config.catalogContradictions.length} place(s).`,
        // The contradiction text names the offer and the disagreeing field,
        // never the environment variable's contents.
        detail: config.catalogContradictions.join(' | '),
      })

  // --- Settlement configuration validity ------------------------------------
  const settlementProblems: string[] = []
  if (!/^https:\/\//.test(config.facilitatorUrl)) settlementProblems.push('the facilitator URL is not https')
  if (!config.payTo) settlementProblems.push('no payee is configured')
  if (!config.asset) settlementProblems.push('no asset is configured')
  if (!config.assetEip712.name || !config.assetEip712.version) {
    settlementProblems.push('the asset EIP-712 domain is incomplete, which refuses every payment at the facilitator')
  }
  const usingCdpMainnet = config.facilitatorUrl.includes('api.cdp.coinbase.com')
  if (usingCdpMainnet && !config.cdpCredentials) settlementProblems.push('the CDP mainnet facilitator has no credentials')

  checks.push(settlementProblems.length === 0
    ? { id: 'x402.settlement.configuration', state: 'ok', summary: `Settlement is configured for ${config.caip2Network}.` }
    : { id: 'x402.settlement.configuration', state: 'fail', summary: 'Settlement configuration is incomplete.', detail: settlementProblems.join('; ') })

  checks.push(config.chainRpcUrl
    ? { id: 'x402.settlement.confirmation', state: 'ok', summary: 'Settlements are corroborated against the chain.' }
    : {
        id: 'x402.settlement.confirmation',
        state: 'warn',
        summary: 'No chain RPC is configured, so settlements are taken on the facilitator\'s word.',
        detail: 'Repeat-buyer analytics will report these as unconfirmed rather than as purchases.',
      })

  // --- Offer enabled but unavailable ----------------------------------------
  for (const offer of X402_OFFERS) {
    if (!enabledIds.has(offer.id)) continue
    if (offer.status === 'available') continue

    // `preview` means exactly this: exercised in a non-production environment.
    // Enabling it there is the intended state, so it is a warning that names
    // the constraint rather than a failure that cries wolf on every Preview.
    // `withheld` has no environment where enabling it is correct.
    const withheld = offer.status === 'withheld'
    checks.push({
      id: `x402.offer.${offer.id}.status`,
      state: withheld ? 'fail' : 'warn',
      summary: withheld
        ? `${offer.id} is enabled for payment but published as "withheld".`
        : `${offer.id} is enabled and published as "preview": correct outside Production, never inside it.`,
      detail: `An agent would be quoted a price for an offer the catalog says is not payable in Production. Gates: ${offer.availability.blockedBy.join(' | ') || 'none recorded'}`,
    })
  }
  for (const offer of X402_OFFERS) {
    if (offer.status !== 'available' || enabledIds.has(offer.id)) continue
    checks.push({
      id: `x402.offer.${offer.id}.enablement`,
      state: 'warn',
      summary: `${offer.id} is published as available but is not enabled in this environment.`,
    })
  }

  // --- Missing tables and migrations ----------------------------------------
  const probe = options.probe !== undefined ? options.probe : defaultProbe()
  if (!probe) {
    checks.push({ id: 'x402.storage', state: 'fail', summary: 'The ledger is unreachable, so required tables cannot be verified.' })
  } else {
    for (const offerId of enabledIds) {
      const required = REQUIRED_RELATIONS[offerId]
      if (!required) continue
      const missing: string[] = []
      for (const table of required.tables) {
        if (!(await probe(table))) missing.push(table)
      }
      checks.push(missing.length === 0
        ? { id: `x402.offer.${offerId}.storage`, state: 'ok', summary: `${offerId} has the tables it needs.` }
        : {
            id: `x402.offer.${offerId}.storage`,
            state: 'fail',
            summary: `${offerId} is enabled but ${missing.length} required table(s) are missing.`,
            detail: `Unapplied migrations: ${missing.join(', ')}. A payer would settle and then receive a 503.`,
          })
    }
  }

  // --- Discovery availability -----------------------------------------------
  const discoveryProblems: string[] = []
  for (const offer of X402_OFFERS) {
    if (offer.description.length > MAX_RESOURCE_DESCRIPTION_CHARS
      || new TextEncoder().encode(offer.description).length > MAX_RESOURCE_DESCRIPTION_BYTES) {
      discoveryProblems.push(`${offer.id}: description exceeds the facilitator ceiling, which refuses settlement`)
    }
    if (!offerFor(offer.method, offer.path)) discoveryProblems.push(`${offer.id}: not resolvable by method and path`)
  }
  checks.push(discoveryProblems.length === 0
    ? { id: 'x402.discovery.consistency', state: 'ok', summary: 'Published declarations are internally consistent.' }
    : { id: 'x402.discovery.consistency', state: 'fail', summary: 'Published discovery is inconsistent.', detail: discoveryProblems.join('; ') })

  const failed = checks.some((check) => check.state === 'fail')
  const warned = checks.some((check) => check.state === 'warn')

  return {
    state: failed ? 'unavailable' : warned ? 'degraded' : 'ready',
    enabled: true,
    checkedAt,
    offers: X402_OFFERS.map((offer) => ({
      id: offer.id,
      status: offer.status,
      enabledInThisEnvironment: enabledIds.has(offer.id),
      payableInProduction: offer.availability.payableInProduction,
    })),
    checks,
  }
}
