/**
 * The sanitized public conformance result.
 *
 * Two verdicts, kept apart on purpose. **Protocol conformance** is whether the
 * payment contract is well-formed and payment-breaking behaviour is absent.
 * **Discovery eligibility** is whether a registry would list the offer. They
 * fail independently: an offer can be perfectly conformant and unlisted, or
 * listed and broken. Collapsing them into one score is how a discovery problem
 * gets reported as a payment problem, and vice versa.
 */
export const X402_CONFORMANCE_RESULT_VERSION = '1.0.0'
export const X402_CONFORMANCE_RESULT_PATH = 'public/.well-known/x402-conformance-result.json'

export type ConformanceVerdict = 'pass' | 'fail' | 'not-observed'

/** How a verdict was reached, so a reader can weight it. */
export type EvidenceClass =
  | 'local-contract-test'      // deterministic, reproducible from this repository
  | 'unpaid-live-probe'        // an unpaid request against the live endpoint
  | 'paid-settlement'          // a settled payment; the strongest, and the rarest
  | 'third-party-tool'         // an external tool's output
  | 'not-observed'

export type ConformanceDimension = {
  dimension: string
  verdict: ConformanceVerdict
  evidenceClass: EvidenceClass
  /** Payment-breaking dimensions gate payability; discovery ones do not. */
  category: 'protocol-conformance' | 'discovery-eligibility'
  detail: string
}

export type X402ConformanceResult = {
  schemaVersion: typeof X402_CONFORMANCE_RESULT_VERSION
  /**
   * The snapshot this static document describes. Same meaning as the
   * manifest's field, and named the same so a consumer reading both does not
   * have to work out whether two differently-named dates mean the same thing.
   * Not a probe time and not a build timestamp.
   */
  configurationAsOf: string
  subject: { offerId: string; canonicalResource: string }
  /** Separate roll-ups. There is deliberately no single combined score. */
  verdicts: {
    protocolConformance: ConformanceVerdict
    discoveryEligibility: ConformanceVerdict
  }
  dimensions: ConformanceDimension[]
  sanitization: {
    credentialsIncluded: false
    paymentSignaturesIncluded: false
    requestContentIncluded: false
    responseBodiesIncluded: false
    rawHeadersIncluded: false
    customerDataIncluded: false
  }
  limitations: string[]
}

/** Fields that must never appear in a published conformance result. */
export const CONFORMANCE_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /PAYMENT-SIGNATURE/i,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/,
  /sk-ant-[A-Za-z0-9_-]{8,}/,
  /\b0x[a-fA-F0-9]{64}\b/,
  /"headers"\s*:/,
  /"requestBody"\s*:/,
  /"responseBody"\s*:/,
  /_SECRET|_TOKEN|PRIVATE_KEY/,
]

export function findForbiddenInConformance(result: unknown): string[] {
  const serialized = JSON.stringify(result)
  return CONFORMANCE_FORBIDDEN_PATTERNS.filter((pattern) => pattern.test(serialized)).map((pattern) => pattern.source)
}

/** A roll-up is `fail` on any failure, `not-observed` if nothing was observed. */
export function rollUp(dimensions: ConformanceDimension[], category: ConformanceDimension['category']): ConformanceVerdict {
  const relevant = dimensions.filter((entry) => entry.category === category)
  if (relevant.length === 0) return 'not-observed'
  if (relevant.some((entry) => entry.verdict === 'fail')) return 'fail'
  if (relevant.every((entry) => entry.verdict === 'not-observed')) return 'not-observed'
  return relevant.some((entry) => entry.verdict === 'pass') ? 'pass' : 'not-observed'
}

export function parseConformanceResult(value: unknown): X402ConformanceResult {
  const record = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  if (!record) throw new Error('The conformance result must be a JSON object.')
  if (record.schemaVersion !== X402_CONFORMANCE_RESULT_VERSION) {
    throw new Error(`Unsupported conformance schema version; this tool reads ${X402_CONFORMANCE_RESULT_VERSION}.`)
  }
  if (typeof record.configurationAsOf !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(record.configurationAsOf)) {
    throw new Error('configurationAsOf must be an ISO date.')
  }
  if (!Array.isArray(record.dimensions) || record.dimensions.length === 0) {
    throw new Error('dimensions must list at least one measured dimension.')
  }
  const verdicts = record.verdicts as Record<string, unknown> | undefined
  if (!verdicts || typeof verdicts.protocolConformance !== 'string' || typeof verdicts.discoveryEligibility !== 'string') {
    throw new Error('verdicts must report protocolConformance and discoveryEligibility separately.')
  }
  const dimensions = record.dimensions as ConformanceDimension[]
  // A roll-up that disagrees with its own dimensions is worse than no roll-up.
  for (const category of ['protocol-conformance', 'discovery-eligibility'] as const) {
    const key = category === 'protocol-conformance' ? 'protocolConformance' : 'discoveryEligibility'
    const derived = rollUp(dimensions, category)
    if (verdicts[key] !== derived) {
      throw new Error(`verdicts.${key} is "${String(verdicts[key])}" but the dimensions derive "${derived}".`)
    }
  }
  const sanitization = record.sanitization as Record<string, unknown> | undefined
  if (!sanitization) throw new Error('sanitization must be declared.')
  for (const flag of ['credentialsIncluded', 'paymentSignaturesIncluded', 'requestContentIncluded', 'responseBodiesIncluded', 'rawHeadersIncluded', 'customerDataIncluded']) {
    if (sanitization[flag] !== false) throw new Error(`sanitization.${flag} must be false.`)
  }
  const forbidden = findForbiddenInConformance(record)
  if (forbidden.length > 0) throw new Error(`conformance result contains forbidden content: ${forbidden.join(', ')}`)
  return record as unknown as X402ConformanceResult
}
