import {
  validateDiscoveryExtension,
  validateDiscoveryExtensionSpec,
} from '@x402/extensions/bazaar'

import {
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  decodeChallenge,
  decodeReceipt,
  type PaymentChallenge,
  type PaymentRequirement,
} from './client.ts'
import {
  DECLARATION_DIGEST_EXTENSION,
  canonicalResourceUrl,
  declarationDigest as computeDeclarationDigest,
  readDeclarationDigestExtension,
} from './declaration-digest.ts'

export const EXTENSION_RESPONSES_HEADER = 'EXTENSION-RESPONSES'
export const DEFAULT_BAZAAR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery'
const LEGACY_X402_HEADERS = ['X-PAYMENT', 'X-PAYMENT-REQUIRED', 'X-PAYMENT-RESPONSE'] as const

export type DoctorLevel = 'error' | 'warning' | 'note'

export type DoctorFinding = {
  ruleId: string
  level: DoctorLevel
  message: string
  detail?: string
}

export type DoctorRequest = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

export type PaidProbe = (input: {
  url: string
  request: Required<Pick<DoctorRequest, 'method'>> & Omit<DoctorRequest, 'method'>
  challenge: PaymentChallenge
}) => Promise<Response>

export type DoctorOptions = {
  endpoint: string
  request?: DoctorRequest
  bazaarUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
  paidProbe?: PaidProbe
}

/**
 * An inexpensive, same-host control for a claim that a protected resource is
 * actually routed. A `402` alone does not establish this: some hosts apply a
 * payment gate before route matching. Conversely, a `200` from an invented
 * path is a soft-404 signal, not evidence that the resource is live.
 */
export type RouteExistence = {
  verdict: 'confirmed' | 'absent' | 'uninformative'
  declaredStatus: number
  negativeControl: {
    url: string
    status: number
    classification: 'not_found' | 'payment_gate_before_routing' | 'soft_200' | 'other'
  }
}

export type DoctorReport = {
  schemaVersion: '1.0.0'
  tool: { name: 'x402-doctor'; version: '0.1.0' }
  endpoint: string
  checkedAt: string
  durationMs: number
  ok: boolean
  summary: { errors: number; warnings: number; notes: number }
  live?: {
    status: number
    x402Version?: number
    resource?: string
    declarationDigest?: string
    integrityDigest?: string
    declaredIntegrityDigest?: string
    metadataVersion?: string
    crawlerStatus?: number
    paidStatus?: number
    transaction?: string
    routeExistence?: RouteExistence
  }
  bazaar?: {
    found: boolean
    resource?: string
    declarationDigest?: string
    digestSource?: 'catalog' | 'reconstructed'
    metadataVersion?: string
    matchesLive?: boolean
    lastUpdated?: string
  }
  extensionResponses: Array<{ source: 'challenge' | 'crawler' | 'paid'; value: unknown }>
  findings: DoctorFinding[]
}

type JsonRecord = Record<string, unknown>

const CAIP_2 = /^[a-z0-9]+:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const INTEGER_AMOUNT = /^[0-9]+$/
const HTTP_METHOD = /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as JsonRecord).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function normalizedUrl(value: string): string {
  const url = new URL(value)
  url.hash = ''
  return url.toString()
}

function negativeControlUrl(endpoint: string): string {
  const url = new URL(endpoint)
  // This path is deliberately not derived from a seller's route. It is a
  // stable, implausible control path, not an attempt to discover routes.
  url.pathname = '/.well-known/x402-doctor-route-control-7db823b9-40ff-48d3-aebe-1c0f6a029eb7/does-not-exist.json'
  url.search = ''
  url.hash = ''
  return url.toString()
}

function classifyRouteExistence(declaredStatus: number, negativeStatus: number): RouteExistence['verdict'] {
  if (declaredStatus === 404 || declaredStatus === 410) return 'absent'
  if (declaredStatus === 402 && (negativeStatus === 404 || negativeStatus === 410)) return 'confirmed'
  return 'uninformative'
}

function negativeControlClassification(status: number): RouteExistence['negativeControl']['classification'] {
  if (status === 404 || status === 410) return 'not_found'
  if (status === 402) return 'payment_gate_before_routing'
  if (status === 200) return 'soft_200'
  return 'other'
}

function recordRouteExistence(report: DoctorReport, endpoint: string, declaredStatus: number, negativeStatus: number): void {
  const classification = negativeControlClassification(negativeStatus)
  const verdict = classifyRouteExistence(declaredStatus, negativeStatus)
  report.live ??= { status: declaredStatus }
  report.live.routeExistence = {
    verdict,
    declaredStatus,
    negativeControl: { url: negativeControlUrl(endpoint), status: negativeStatus, classification },
  }

  if (verdict === 'confirmed') {
    add(report.findings, 'x402.route_existence.confirmed', 'note', 'The protected resource returned 402 while the same-host negative control returned not found.')
  } else if (verdict === 'absent') {
    add(report.findings, 'x402.route_existence.absent', 'error', 'The declared resource returned not found; it cannot be treated as a live protected route.')
  } else if (classification === 'payment_gate_before_routing') {
    add(report.findings, 'x402.route_existence.uninformative_402', 'note', 'The same-host negative control also returned 402, so the payment challenge does not establish route existence.')
  } else if (classification === 'soft_200') {
    add(report.findings, 'x402.route_existence.soft_200', 'warning', 'The same-host negative control returned HTTP 200. Route existence is uninformative; this is distinct from payment-gate-before-routing behavior.')
  } else {
    add(report.findings, 'x402.route_existence.uninformative', 'note', 'The negative control did not return not found, so route existence is uninformative.', `negative_status=${negativeStatus}`)
  }
}

/**
 * Fields a reconstructed comparison may use.
 *
 * A catalog that never returns a field cannot be said to disagree about it.
 * CDP's merchant record omits `mimeType` entirely, and treating that absence
 * as `null` made every healthy listing hash differently from its own live
 * declaration -- a permanent false "stale metadata" warning that prompted
 * bounded settlements to refresh a listing that was already current. Absence
 * is not disagreement, so a field the catalog does not carry is dropped from
 * both sides and reported as uncompared.
 *
 * This applies only to the reconstructed path. When the catalog publishes a
 * declaration digest of its own there is nothing to reconstruct and the
 * comparison is exact.
 */
export function comparableDeclarations(indexed: JsonRecord, live: JsonRecord): {
  indexed: JsonRecord
  live: JsonRecord
  uncompared: string[]
} {
  const uncompared: string[] = []
  const trimmedIndexed: JsonRecord = {}
  const trimmedLive: JsonRecord = {}
  for (const key of Object.keys(live)) {
    // Null or undefined on the indexed side means the catalog did not carry
    // the field. A field it carries as an empty string or empty object is a
    // real value and stays in the comparison.
    if (indexed[key] === null || indexed[key] === undefined) {
      uncompared.push(key)
      continue
    }
    trimmedIndexed[key] = indexed[key]
    trimmedLive[key] = live[key]
  }
  return { indexed: trimmedIndexed, live: trimmedLive, uncompared }
}

function declaration(value: { resource?: unknown; description?: unknown; mimeType?: unknown; accepts?: unknown; extensions?: unknown }): JsonRecord {
  const resource = typeof value.resource === 'string'
    ? value.resource
    : typeof record(value.resource)?.url === 'string'
      ? record(value.resource)!.url
      : null
  const resourceInfo = record(value.resource)
  return {
    resource,
    description: typeof value.description === 'string' ? value.description : resourceInfo?.description ?? null,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : resourceInfo?.mimeType ?? null,
    accepts: Array.isArray(value.accepts) ? value.accepts : [],
    extensions: record(value.extensions) ?? {},
  }
}

function parseEncodedJson(header: string | null): unknown {
  if (!header?.trim()) return null
  const value = header.trim()
  try { return JSON.parse(value) } catch {
    try { return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) } catch { return { malformed: true } }
  }
}

/**
 * Carries the operator's transport headers onto the crawler probe.
 *
 * The declared example describes the *payload* a crawler should send; it cannot
 * describe how to reach a gated deployment. Without this, a Preview behind
 * platform authentication answers the crawler probe with 401 and the doctor
 * reports `crawler_status` as a product defect, when the same request with the
 * operator's bypass header returns a correct 402. That turns the one gate that
 * proves an endpoint is crawlable into a check that can never pass off
 * production, so it gets waived by habit.
 *
 * Only headers the declaration did not set are added, so an operator can reach
 * the deployment without being able to rewrite the example being tested --
 * which is the thing under test.
 */
function withTransportHeaders<T extends { headers?: Record<string, string> } | null>(
  crawlerRequest: T,
  operatorHeaders: Record<string, string> | undefined,
): T {
  if (!crawlerRequest || !operatorHeaders) return crawlerRequest
  const headers = { ...(crawlerRequest.headers ?? {}) }
  const declared = new Set(Object.keys(headers).map((key) => key.toLowerCase()))
  for (const [key, value] of Object.entries(operatorHeaders)) {
    if (!declared.has(key.toLowerCase())) headers[key] = value
  }
  return { ...crawlerRequest, headers }
}

function extensionInput(challenge: PaymentChallenge): Required<Pick<DoctorRequest, 'method'>> & Omit<DoctorRequest, 'method'> | null {
  const bazaar = record(challenge.extensions)?.bazaar
  const info = record(record(bazaar)?.info)
  const input = record(info?.input)
  if (!input) return null
  const method = typeof input.method === 'string' ? input.method.toUpperCase() : ''
  if (!HTTP_METHOD.test(method)) return null

  const headers: Record<string, string> = { accept: 'application/json' }
  const declaredHeaders = record(input.headers)
  for (const [key, value] of Object.entries(declaredHeaders ?? {})) {
    if (typeof value === 'string' && !/^(?:authorization|cookie|payment-signature)$/i.test(key)) headers[key] = value
  }

  const body = input.body === undefined
    ? undefined
    : JSON.stringify(input.body)
  if (body !== undefined && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
    headers['content-type'] = 'application/json'
  }
  return { method, headers, body }
}

function crawlerUrl(endpoint: string, challenge: PaymentChallenge): string {
  const url = new URL(endpoint)
  const input = record(record(record(record(challenge.extensions)?.bazaar)?.info)?.input)
  const query = record(input?.queryParams)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

function add(findings: DoctorFinding[], ruleId: string, level: DoctorLevel, message: string, detail?: string): void {
  findings.push({ ruleId, level, message, ...(detail ? { detail } : {}) })
}

function validateRequirement(requirement: PaymentRequirement, index: number, findings: DoctorFinding[]): void {
  const label = `accepts[${index}]`
  if (requirement.scheme !== 'exact') add(findings, 'x402.requirement.scheme', 'warning', `${label} uses unsupported or non-standard scheme ${requirement.scheme}.`)
  if (!CAIP_2.test(requirement.network)) add(findings, 'x402.requirement.network', 'error', `${label}.network is not a CAIP-2 identifier.`)
  if (!INTEGER_AMOUNT.test(requirement.amount) || BigInt(requirement.amount || '0') <= BigInt(0)) add(findings, 'x402.requirement.amount', 'error', `${label}.amount must be a positive integer string.`)
  if (!Number.isInteger(requirement.maxTimeoutSeconds) || requirement.maxTimeoutSeconds <= 0) add(findings, 'x402.requirement.timeout', 'error', `${label}.maxTimeoutSeconds must be a positive integer.`)
  if (requirement.network.startsWith('eip155:')) {
    if (!EVM_ADDRESS.test(requirement.asset)) add(findings, 'x402.requirement.asset', 'error', `${label}.asset is not an EVM contract address.`)
    if (!EVM_ADDRESS.test(requirement.payTo)) add(findings, 'x402.requirement.payee', 'error', `${label}.payTo is not an EVM address.`)
  }
}

function validateChallenge(challenge: PaymentChallenge, endpoint: string, findings: DoctorFinding[]): void {
  if (challenge.x402Version !== 2) add(findings, 'x402.version', 'error', `Expected x402Version 2; received ${challenge.x402Version}.`)
  try {
    if (normalizedUrl(challenge.resource.url) !== normalizedUrl(endpoint)) {
      add(findings, 'x402.resource.url', 'error', 'The challenge resource URL does not match the endpoint being checked.', challenge.resource.url)
    }
  } catch {
    add(findings, 'x402.resource.url', 'error', 'The challenge resource URL is not an absolute URL.')
  }
  if (!challenge.resource.description?.trim()) add(findings, 'x402.resource.description', 'warning', 'The resource has no semantic description for discovery.')
  if (!challenge.resource.mimeType?.trim()) add(findings, 'x402.resource.mime_type', 'warning', 'The resource has no declared MIME type.')
  challenge.accepts.forEach((requirement, index) => validateRequirement(requirement, index, findings))

  const bazaar = record(challenge.extensions)?.bazaar
  if (!bazaar) {
    add(findings, 'x402.bazaar.missing', 'warning', 'The challenge has no Bazaar discovery extension.')
    return
  }
  const spec = validateDiscoveryExtensionSpec(bazaar as never)
  if (!spec.valid) add(findings, 'x402.bazaar.schema', 'error', 'The Bazaar extension does not satisfy the extension schema.', spec.errors?.join('; '))
  const examples = validateDiscoveryExtension(bazaar as never)
  if (!examples.valid) add(findings, 'x402.bazaar.examples', 'error', 'A Bazaar example does not satisfy its declared JSON Schema.', examples.errors?.join('; '))
}

function requestInit(request: DoctorRequest, signal: AbortSignal): RequestInit {
  return {
    method: request.method ?? 'GET',
    headers: { accept: 'application/json', 'user-agent': 'x402-doctor/0.1.0', ...request.headers },
    ...(request.body === undefined ? {} : { body: request.body }),
    redirect: 'manual',
    signal,
  }
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, request: DoctorRequest, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetchImpl(url, requestInit(request, controller.signal)) } finally { clearTimeout(timer) }
}

function bazaarResources(value: unknown): JsonRecord[] {
  const body = record(value)
  const candidates = Array.isArray(body?.resources) ? body.resources : Array.isArray(body?.items) ? body.items : []
  return candidates.map(record).filter((item): item is JsonRecord => item !== null)
}

function bazaarResourceUrl(value: JsonRecord): string | null {
  if (typeof value.resource === 'string') return value.resource
  const resource = record(value.resource)
  return typeof resource?.url === 'string' ? resource.url : null
}

function extensionResponse(report: DoctorReport, source: 'challenge' | 'crawler' | 'paid', response: Response): void {
  const header = response.headers.get(EXTENSION_RESPONSES_HEADER)
  if (header) report.extensionResponses.push({ source, value: parseEncodedJson(header) })
}

function validateV2Headers(response: Response, source: 'challenge' | 'paid', findings: DoctorFinding[]): void {
  const legacy = LEGACY_X402_HEADERS.filter((header) => response.headers.has(header))
  if (legacy.length > 0) {
    add(findings, 'x402.headers.legacy', 'warning', `${source} response exposes deprecated x402 v1 header names.`, legacy.join(', '))
  }
  const required = source === 'challenge' ? PAYMENT_REQUIRED_HEADER : PAYMENT_RESPONSE_HEADER
  if (!response.headers.has(required)) add(findings, 'x402.headers.v2', 'error', `${source} response is missing the x402 v2 ${required} header.`)
}

export async function diagnoseX402Endpoint(options: DoctorOptions): Promise<DoctorReport> {
  const started = Date.now()
  const endpoint = normalizedUrl(options.endpoint)
  if (!endpoint.startsWith('https://')) throw new Error('x402-doctor only inspects HTTPS endpoints.')
  const timeoutMs = options.timeoutMs ?? 15_000
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const findings: DoctorFinding[] = []
  const report: DoctorReport = {
    schemaVersion: '1.0.0',
    tool: { name: 'x402-doctor', version: '0.1.0' },
    endpoint,
    checkedAt: new Date(started).toISOString(),
    durationMs: 0,
    ok: false,
    summary: { errors: 0, warnings: 0, notes: 0 },
    extensionResponses: [],
    findings,
  }

  try {
    const first = await fetchWithTimeout(fetchImpl, endpoint, options.request ?? {}, timeoutMs)
    report.live = { status: first.status }
    extensionResponse(report, 'challenge', first)
    if (first.status !== 402) {
      const negativeControl = await fetchWithTimeout(fetchImpl, negativeControlUrl(endpoint), { method: 'GET' }, timeoutMs)
      recordRouteExistence(report, endpoint, first.status, negativeControl.status)
      add(findings, 'x402.http.challenge_status', 'error', `The unpaid request returned HTTP ${first.status}; Bazaar requires HTTP 402.`, first.status === 400 ? 'An accidental validation-first 400 prevents crawler indexing.' : undefined)
      return finalize(report, started)
    }
    validateV2Headers(first, 'challenge', findings)

    let challenge: PaymentChallenge
    try { challenge = decodeChallenge(first.headers.get(PAYMENT_REQUIRED_HEADER)) } catch (error) {
      // A malformed challenge is still a response from a declared route. Keep
      // the same-host control in the report before returning so callers can
      // distinguish a decoder failure from a payment gate that runs before
      // routing. This control never carries a payment header or caller input.
      const negativeControl = await fetchWithTimeout(fetchImpl, negativeControlUrl(endpoint), { method: 'GET' }, timeoutMs)
      recordRouteExistence(report, endpoint, first.status, negativeControl.status)
      add(findings, 'x402.header.payment_required', 'error', 'PAYMENT-REQUIRED is missing or malformed.', error instanceof Error ? error.message : String(error))
      return finalize(report, started)
    }
    report.live.x402Version = challenge.x402Version
    report.live.resource = challenge.resource.url
    validateChallenge(challenge, endpoint, findings)
    const liveDeclaration = declaration({
      resource: challenge.resource,
      accepts: challenge.accepts,
      extensions: challenge.extensions,
    })
    report.live.declarationDigest = await sha256(liveDeclaration)
    report.live.integrityDigest = await computeDeclarationDigest({
      x402Version: challenge.x402Version,
      resource: challenge.resource as unknown as JsonRecord,
      accepts: challenge.accepts,
      extensions: challenge.extensions,
    })
    const rawLiveIntegrity = record(challenge.extensions)?.[DECLARATION_DIGEST_EXTENSION]
    const liveIntegrity = readDeclarationDigestExtension(rawLiveIntegrity)
    if (rawLiveIntegrity !== undefined && !liveIntegrity) {
      add(findings, 'x402.declaration_integrity.malformed', 'error', 'The live declaration-integrity extension is malformed.')
    } else if (liveIntegrity) {
      report.live.declaredIntegrityDigest = liveIntegrity.declarationDigest
      report.live.metadataVersion = liveIntegrity.metadataVersion
      if (liveIntegrity.declarationDigest !== report.live.integrityDigest) {
        add(findings, 'x402.declaration_integrity.self_mismatch', 'error', 'The seller-declared digest does not match the live declaration.', `declared=${liveIntegrity.declarationDigest}; computed=${report.live.integrityDigest}`)
      }
      if (liveIntegrity.canonicalResource !== canonicalResourceUrl(endpoint)) {
        add(findings, 'x402.declaration_integrity.resource', 'error', 'The declaration-integrity canonicalResource does not identify the live endpoint.', liveIntegrity.canonicalResource)
      }
    }

    const crawlerRequest = withTransportHeaders(extensionInput(challenge), options.request?.headers)
    if (!crawlerRequest) {
      add(findings, 'x402.bazaar.crawler_input', 'error', 'The Bazaar extension does not contain a reproducible HTTP input example.')
    } else {
      const crawler = await fetchWithTimeout(fetchImpl, crawlerUrl(endpoint, challenge), crawlerRequest, timeoutMs)
      report.live.crawlerStatus = crawler.status
      extensionResponse(report, 'crawler', crawler)
      if (crawler.status !== 402) {
        add(findings, 'x402.bazaar.crawler_status', 'error', `The declared Bazaar crawler request returned HTTP ${crawler.status}, not 402.`, crawler.status === 400 ? 'The declared example reaches application validation before the payment challenge.' : undefined)
      }
    }

    const payTo = challenge.accepts[0]?.payTo
    if (payTo) {
      const bazaarBase = (options.bazaarUrl ?? DEFAULT_BAZAAR_URL).replace(/\/+$/, '')
      const merchant = new URL(`${bazaarBase}/merchant`)
      merchant.searchParams.set('payTo', payTo)
      merchant.searchParams.set('limit', '100')
      try {
        const response = await fetchWithTimeout(fetchImpl, merchant.toString(), { method: 'GET' }, timeoutMs)
        if (!response.ok) {
          add(findings, 'x402.bazaar.lookup', 'warning', `Bazaar merchant lookup returned HTTP ${response.status}.`)
        } else {
          const resources = bazaarResources(await response.json())
          const current = resources.find((resource) => {
            const url = bazaarResourceUrl(resource)
            if (!url) return false
            try { return normalizedUrl(url) === endpoint } catch { return false }
          })
          if (!current) {
            report.bazaar = { found: false }
            add(findings, 'x402.bazaar.not_found', 'warning', 'The live endpoint is not present in the current Bazaar merchant record.')
          } else {
            const rawIndexedIntegrity = current.declarationIntegrity
              ?? record(current.extensions)?.[DECLARATION_DIGEST_EXTENSION]
            const indexedIntegrity = readDeclarationDigestExtension(rawIndexedIntegrity)
            if (rawIndexedIntegrity !== undefined && !indexedIntegrity) {
              add(findings, 'x402.declaration_integrity.catalog_malformed', 'warning', 'The catalog exposes a malformed declaration-integrity value.')
            }
            const indexedDeclaration = declaration(current)
            // Reconstructed comparisons only consider fields the catalog
            // actually returned. See comparableDeclarations.
            const comparable = comparableDeclarations(indexedDeclaration, liveDeclaration)
            const reconstructedDigest = await sha256(comparable.indexed)
            const comparableLiveDigest = await sha256(comparable.live)
            const indexedDigest = indexedIntegrity?.declarationDigest ?? reconstructedDigest
            const matchesLive = indexedIntegrity
              ? indexedDigest === report.live.integrityDigest
              : reconstructedDigest === comparableLiveDigest
            report.bazaar = {
              found: true,
              resource: bazaarResourceUrl(current) ?? undefined,
              declarationDigest: indexedDigest,
              digestSource: indexedIntegrity ? 'catalog' : 'reconstructed',
              matchesLive,
              ...(indexedIntegrity ? { metadataVersion: indexedIntegrity.metadataVersion } : {}),
              ...(typeof current.lastUpdated === 'string' ? { lastUpdated: current.lastUpdated } : {}),
            }
            if (indexedIntegrity && indexedIntegrity.canonicalResource !== canonicalResourceUrl(endpoint)) {
              add(findings, 'x402.declaration_integrity.catalog_resource', 'warning', 'The catalog digest belongs to a different canonical resource.', indexedIntegrity.canonicalResource)
            }
            if (!matchesLive) {
              const liveDigest = indexedIntegrity ? report.live.integrityDigest : comparableLiveDigest
              const scope = indexedIntegrity ? '' : `; compared=${Object.keys(comparable.indexed).join(',') || 'none'}`
              const skipped = comparable.uncompared.length > 0 && !indexedIntegrity ? `; uncompared=${comparable.uncompared.join(',')}` : ''
              add(findings, 'x402.bazaar.stale_metadata', 'warning', 'The Bazaar declaration differs from the live PAYMENT-REQUIRED declaration.', `live=${liveDigest}; bazaar=${indexedDigest}; source=${indexedIntegrity ? 'catalog' : 'reconstructed'}${scope}${skipped}`)
            } else if (!indexedIntegrity && comparable.uncompared.length > 0) {
              // Stated rather than silent: the listing matches on everything
              // comparable, and a reader should know the match is partial and
              // why, instead of reading a clean pass as a complete one.
              add(findings, 'x402.bazaar.partial_comparison', 'note', 'The catalog does not return every declared field, so the match is partial.', `uncompared=${comparable.uncompared.join(',')}`)
            }
          }
        }
      } catch (error) {
        add(findings, 'x402.bazaar.lookup', 'warning', 'Bazaar metadata could not be retrieved.', error instanceof Error ? error.message : String(error))
      }
    }

    if (options.paidProbe && findings.some((finding) => finding.level === 'error')) {
      add(findings, 'x402.payment.skipped', 'warning', 'The paid probe was skipped because the read-only contract checks found errors.')
    } else if (options.paidProbe) {
      if (!crawlerRequest) {
        add(findings, 'x402.payment.skipped', 'error', 'The paid probe cannot run without a valid declared request example.')
      } else {
        const paid = await options.paidProbe({ url: crawlerUrl(endpoint, challenge), request: crawlerRequest, challenge })
        report.live.paidStatus = paid.status
        extensionResponse(report, 'paid', paid)
        validateV2Headers(paid, 'paid', findings)
        const receipt = decodeReceipt(paid.headers.get(PAYMENT_RESPONSE_HEADER))
        if (!paid.ok) add(findings, 'x402.payment.status', 'error', `The bounded paid probe returned HTTP ${paid.status}.`)
        if (!receipt?.success || !receipt.transaction) {
          add(findings, 'x402.payment.receipt', 'error', 'The paid response omitted a successful PAYMENT-RESPONSE receipt.')
        } else {
          report.live.transaction = receipt.transaction
          add(findings, 'x402.payment.settled', 'note', 'One explicitly authorized bounded payment settled successfully.', receipt.transaction)
        }
      }
    }

    if (report.extensionResponses.length === 0) {
      add(findings, 'x402.extensions.responses', 'note', 'No EXTENSION-RESPONSES header was observable on the resource responses. Facilitator responses may not be forwarded by the seller.')
    } else if (report.extensionResponses.some((item) => record(item.value)?.malformed === true)) {
      add(findings, 'x402.extensions.responses', 'warning', 'An EXTENSION-RESPONSES header was present but could not be decoded as JSON.')
    }
    // A control uses GET with no headers or body copied from the declared
    // operation. It cannot spend, authenticate, or replay caller input.
    const negativeControl = await fetchWithTimeout(fetchImpl, negativeControlUrl(endpoint), { method: 'GET' }, timeoutMs)
    recordRouteExistence(report, endpoint, first.status, negativeControl.status)
  } catch (error) {
    add(findings, 'x402.network', 'error', 'The endpoint inspection could not complete.', error instanceof Error ? error.message : String(error))
  }
  return finalize(report, started)
}

function finalize(report: DoctorReport, started: number): DoctorReport {
  report.durationMs = Date.now() - started
  report.summary = {
    errors: report.findings.filter((finding) => finding.level === 'error').length,
    warnings: report.findings.filter((finding) => finding.level === 'warning').length,
    notes: report.findings.filter((finding) => finding.level === 'note').length,
  }
  report.ok = report.summary.errors === 0
  return report
}

export function doctorReportToSarif(report: DoctorReport): JsonRecord {
  const rules = [...new Set(report.findings.map((finding) => finding.ruleId))]
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: report.tool.name,
          version: report.tool.version,
          informationUri: 'https://github.com/x402-foundation/x402',
          rules: rules.map((id) => ({ id, shortDescription: { text: id } })),
        },
      },
      results: report.findings.map((finding) => ({
        ruleId: finding.ruleId,
        level: finding.level === 'note' ? 'note' : finding.level,
        message: { text: `${finding.message}${finding.detail ? ` ${finding.detail}` : ''}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: report.endpoint } } }],
      })),
    }],
  }
}
