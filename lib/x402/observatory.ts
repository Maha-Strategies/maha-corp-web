import { isIP } from 'node:net'

import type { DoctorReport, DoctorRequest } from './doctor.ts'

export const OBSERVATORY_SCHEMA_VERSION = '1.0.0'
export const OBSERVATORY_MAX_RESOURCES = 20

export type CheckState = 'pass' | 'fail' | 'unknown' | 'not_applicable'
export type BazaarState = 'current' | 'stale' | 'missing' | 'unknown' | 'not_declared'
export type SettlementState = 'disabled' | 'not_run' | 'success' | 'failed' | 'indeterminate'

export type ObservatoryResource = {
  id: string
  name: string
  url: string
  operator: string
  request: DoctorRequest
  boundedSettlement: {
    enabled: boolean
    maximumAmountBaseUnits?: string
  }
}

export type ObservatoryObservation = {
  schemaVersion: typeof OBSERVATORY_SCHEMA_VERSION
  observationId: string
  resourceId: string
  resourceUrl: string
  observedAt: string
  durationMs: number
  challengeReachable: CheckState
  v2Compliant: CheckState
  schemaValid: CheckState
  crawlerReceives402: CheckState
  bazaarState: BazaarState
  digestSource: 'catalog' | 'reconstructed' | 'none'
  settlementState: SettlementState
  settlementTransaction?: string
  findingCodes: string[]
}

export type PublicObservatoryEntry = ObservatoryResource & {
  latest: ObservatoryObservation | null
  lastSuccessfulBoundedSettlementAt: string | null
  lastSuccessfulBoundedSettlementTransaction: string | null
}

const RELEVANT_V2_FAILURES = new Set([
  'x402.version',
  'x402.headers.v2',
  'x402.header.payment_required',
  'x402.requirement.network',
  'x402.requirement.amount',
  'x402.requirement.asset',
  'x402.requirement.payee',
  'x402.requirement.timeout',
])

function hasFinding(report: DoctorReport, ruleId: string, level?: 'error' | 'warning' | 'note'): boolean {
  return report.findings.some((finding) => finding.ruleId === ruleId && (!level || finding.level === level))
}

function hasAnyError(report: DoctorReport, rules: Set<string>): boolean {
  return report.findings.some((finding) => finding.level === 'error' && rules.has(finding.ruleId))
}

export function validateObservatoryResources(resources: ObservatoryResource[]): void {
  if (resources.length === 0 || resources.length > OBSERVATORY_MAX_RESOURCES) throw new Error(`The observatory requires 1-${OBSERVATORY_MAX_RESOURCES} resources.`)
  const ids = new Set<string>(), urls = new Set<string>()
  for (const resource of resources) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resource.id)) throw new Error(`Invalid observatory resource id: ${resource.id}`)
    if (!resource.name.trim() || resource.name.length > 120 || !resource.operator.trim() || resource.operator.length > 120) throw new Error(`Invalid observatory resource metadata: ${resource.id}`)
    const url = new URL(resource.url)
    url.hash = ''
    const hostname = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || !hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal') || isIP(hostname)) {
      throw new Error(`Observatory resources must be credential-free public HTTPS DNS URLs: ${resource.id}`)
    }
    const sensitiveHeader = Object.keys(resource.request.headers ?? {}).find((header) => /^(?:authorization|cookie|payment-signature)$/i.test(header))
    if (sensitiveHeader) throw new Error(`Observatory registry requests cannot contain sensitive headers: ${resource.id}`)
    if (resource.request.body && resource.request.body.length > 65_536) throw new Error(`Observatory registry request bodies are limited to 64 KiB: ${resource.id}`)
    const canonicalUrl = url.toString()
    if (ids.has(resource.id) || urls.has(canonicalUrl)) throw new Error(`Duplicate observatory resource: ${resource.id}`)
    ids.add(resource.id); urls.add(canonicalUrl)
    if (resource.boundedSettlement.enabled && !/^\d+$/.test(resource.boundedSettlement.maximumAmountBaseUnits ?? '')) {
      throw new Error(`A paid observatory check requires an integer base-unit ceiling: ${resource.id}`)
    }
  }
}

export function observationFromDoctor(input: {
  resource: ObservatoryResource
  report: DoctorReport
  observationId?: string
  observedAt?: string
}): ObservatoryObservation {
  const { resource, report } = input
  const networkFailed = hasFinding(report, 'x402.network', 'error')
  const challengeReachable: CheckState = networkFailed || !report.live
    ? 'unknown'
    : report.live.status === 402 ? 'pass' : 'fail'
  const v2Compliant: CheckState = challengeReachable !== 'pass'
    ? 'unknown'
    : report.live?.x402Version === 2 && !hasAnyError(report, RELEVANT_V2_FAILURES) ? 'pass' : 'fail'
  const declarationReadable = report.live?.x402Version !== undefined
  const bazaarDeclared = declarationReadable && !hasFinding(report, 'x402.bazaar.missing')
  const schemaValid: CheckState = !declarationReadable
    ? 'unknown'
    : !bazaarDeclared
    ? 'not_applicable'
    : hasFinding(report, 'x402.bazaar.schema', 'error') || hasFinding(report, 'x402.bazaar.examples', 'error') ? 'fail' : 'pass'
  const crawlerReceives402: CheckState = !declarationReadable
    ? 'unknown'
    : !bazaarDeclared
    ? 'not_applicable'
    : report.live?.crawlerStatus === undefined ? 'unknown' : report.live.crawlerStatus === 402 ? 'pass' : 'fail'
  const bazaarState: BazaarState = !declarationReadable
    ? 'unknown'
    : !bazaarDeclared
    ? 'not_declared'
    : report.bazaar?.found === false ? 'missing'
      : report.bazaar?.matchesLive === true ? 'current'
        : report.bazaar?.matchesLive === false ? 'stale' : 'unknown'
  const settlementState: SettlementState = !resource.boundedSettlement.enabled
    ? 'disabled'
    : report.live?.transaction ? 'success'
      : report.live?.paidStatus === undefined ? 'not_run'
        : report.live.paidStatus >= 500 ? 'indeterminate' : 'failed'

  return {
    schemaVersion: OBSERVATORY_SCHEMA_VERSION,
    observationId: input.observationId ?? crypto.randomUUID(),
    resourceId: resource.id,
    resourceUrl: resource.url,
    observedAt: input.observedAt ?? new Date().toISOString(),
    durationMs: Math.max(0, Math.round(report.durationMs)),
    challengeReachable,
    v2Compliant,
    schemaValid,
    crawlerReceives402,
    bazaarState,
    digestSource: report.bazaar?.digestSource ?? 'none',
    settlementState,
    ...(report.live?.transaction ? { settlementTransaction: report.live.transaction } : {}),
    findingCodes: [...new Set(report.findings.map((finding) => finding.ruleId))].sort().slice(0, 40),
  }
}

export function publicObservatorySnapshot(
  resources: ObservatoryResource[],
  observations: ObservatoryObservation[],
): PublicObservatoryEntry[] {
  validateObservatoryResources(resources)
  return resources.map((resource) => {
    const resourceObservations = observations
      .filter((observation) => observation.resourceId === resource.id)
      .sort((left, right) => right.observedAt.localeCompare(left.observedAt))
    const lastSettlement = resourceObservations.find((observation) => observation.settlementState === 'success')
    return {
      ...resource,
      latest: resourceObservations[0] ?? null,
      lastSuccessfulBoundedSettlementAt: lastSettlement?.observedAt ?? null,
      lastSuccessfulBoundedSettlementTransaction: lastSettlement?.settlementTransaction ?? null,
    }
  })
}
