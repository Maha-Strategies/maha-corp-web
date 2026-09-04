import { randomUUID } from 'node:crypto'

import {
  publicEpistemicReleaseProvenance,
  type EpistemicCanonicalRelease,
} from './epistemic-release.ts'
import { sha256Canonical } from './epistemic-publication.ts'
import {
  MCP_EVIDENCE_EXECUTION_VERSION,
  MCP_EVIDENCE_LICENSE_PLANS,
  MCP_EVIDENCE_LICENSE_TERMS,
  MCP_EVIDENCE_LICENSE_TERMS_SHA256,
  MCP_EVIDENCE_LICENSE_VERSION,
  MCP_EVIDENCE_PROJECTION_VERSION,
  MCP_EVIDENCE_TOOL_NAME,
  type McpEvidencePlanId,
} from './mcp-evidence-public-contract.ts'

export {
  MCP_EVIDENCE_CAPABILITY,
  MCP_EVIDENCE_EXECUTION_VERSION,
  MCP_EVIDENCE_LICENSE_PLANS,
  MCP_EVIDENCE_LICENSE_TERMS,
  MCP_EVIDENCE_LICENSE_TERMS_SHA256,
  MCP_EVIDENCE_LICENSE_VERSION,
  MCP_EVIDENCE_PROJECTION_VERSION,
  MCP_EVIDENCE_PROTOCOL_VERSION,
  MCP_EVIDENCE_SERVER,
  MCP_EVIDENCE_TOOL,
  MCP_EVIDENCE_TOOL_NAME,
  type McpEvidencePlanId,
} from './mcp-evidence-public-contract.ts'

export interface McpEvidenceSelector {
  releaseId?: string
  canonicalPath?: string
}

export interface McpEvidenceToolArguments {
  clientRequestId: string
  selector: McpEvidenceSelector
}

export type McpEvidenceJsonRpcId = string | number | null

export interface McpEvidenceRpcEnvelope {
  message: Record<string, unknown>
  id: McpEvidenceJsonRpcId | undefined
  initializedNotification: boolean
}

export interface McpEvidenceGrantSnapshot {
  schemaVersion: typeof MCP_EVIDENCE_LICENSE_VERSION
  grantId: string
  clientId: string
  credentialId: string
  planId: McpEvidencePlanId
  planVersion: string
  allowedTools: readonly [typeof MCP_EVIDENCE_TOOL_NAME]
  monthlyQuotaUnits: number
  validFrom: string
  validUntil: string
  considerationState: 'internal-evaluation' | 'externally-contracted'
  contractedAmountUsdCents: number
  receivedAmountUsdCents: number
  commercialReference: string | null
  termsSha256: string
  issuedAt: string
  grantSha256: string
}

export interface McpEvidenceExecutionReservation {
  executionId: string
  grantId: string
  planId: McpEvidencePlanId
  planVersion: string
  clientRequestId: string
  requestSha256: string
  releaseId: string
  releaseSha256: string
  quotaPeriodStartedAt: string
  unitQuantity: 1
  idempotentReplay: boolean
}

const CLIENT_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/
const RELEASE_ID = /^epirelease_[a-f0-9]{32}$/
const CANONICAL_PATH = /^\/knowledge\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/
const CLIENT_ID = /^client_[a-f0-9]{32}$/
const CREDENTIAL_ID = /^cred_[a-f0-9]{32}$/
const SHA256 = /^sha256:[a-f0-9]{64}$/

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

function line(value: unknown, label: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`)
  const normalized = value.trim()
  if (normalized.length < minimum || normalized.length > maximum || /[\r\n]/.test(normalized)) {
    throw new Error(`${label} must contain ${minimum}-${maximum} characters on one line.`)
  }
  return normalized
}

function isoInstant(value: unknown, label: string): string {
  const normalized = line(value, label, 20, 40)
  const parsed = new Date(normalized)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== normalized) throw new Error(`${label} must be a canonical UTC instant.`)
  return normalized
}

export function parseMcpEvidenceRpcEnvelope(raw: string): McpEvidenceRpcEnvelope {
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('MCP request must be an object.')
  const message = parsed as Record<string, unknown>
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') throw new Error('Invalid JSON-RPC request.')
  const hasId = Object.hasOwn(message, 'id')
  const id = typeof message.id === 'string' || typeof message.id === 'number' || message.id === null
    ? message.id
    : undefined
  if (message.method === 'notifications/initialized') {
    if (hasId) throw new Error('JSON-RPC notifications cannot include an id.')
    return { message, id: undefined, initializedNotification: true }
  }
  if (!hasId || id === undefined) throw new Error('JSON-RPC requests require a valid id.')
  return { message, id, initializedNotification: false }
}

export function parseMcpEvidenceToolArguments(value: unknown): McpEvidenceToolArguments {
  const input = object(value, 'tool arguments')
  const unexpected = Object.keys(input).filter((key) => !['clientRequestId', 'selector'].includes(key))
  if (unexpected.length) throw new Error(`Unsupported tool argument: ${unexpected[0]}.`)
  const clientRequestId = line(input.clientRequestId, 'clientRequestId', 8, 160)
  if (!CLIENT_REQUEST_ID.test(clientRequestId)) throw new Error('clientRequestId has an invalid format.')
  const selector = object(input.selector, 'selector')
  const selectorKeys = Object.keys(selector)
  if (selectorKeys.length !== 1 || !['releaseId', 'canonicalPath'].includes(selectorKeys[0])) {
    throw new Error('selector must contain exactly one of releaseId or canonicalPath.')
  }
  if (selector.releaseId !== undefined) {
    const releaseId = line(selector.releaseId, 'selector.releaseId', 43, 43)
    if (!RELEASE_ID.test(releaseId)) throw new Error('selector.releaseId is invalid.')
    return { clientRequestId, selector: { releaseId } }
  }
  const canonicalPath = line(selector.canonicalPath, 'selector.canonicalPath', 20, 240)
  if (!CANONICAL_PATH.test(canonicalPath)) throw new Error('selector.canonicalPath is invalid.')
  return { clientRequestId, selector: { canonicalPath } }
}

export function mcpEvidenceRequestSha256(argumentsValue: McpEvidenceToolArguments): string {
  return sha256Canonical({ toolName: MCP_EVIDENCE_TOOL_NAME, arguments: argumentsValue })
}

export function mcpEvidenceIdempotencySha256(scope: string, value: string): string {
  if (!/^[a-z0-9-]{3,80}$/.test(scope)) throw new Error('Idempotency scope is invalid.')
  const normalized = line(value, 'idempotencyKey', 8, 160)
  return sha256Canonical({ scope, idempotencyKey: normalized })
}

export function createMcpEvidenceExecutionId(): string {
  return `mcpexe_${randomUUID().replaceAll('-', '')}`
}

export function createMcpEvidenceGrantId(): string {
  return `mcpgrant_${randomUUID().replaceAll('-', '')}`
}

export function mcpEvidencePlan(value: unknown) {
  if (typeof value !== 'string' || !(value in MCP_EVIDENCE_LICENSE_PLANS)) throw new Error('planId is unavailable.')
  return MCP_EVIDENCE_LICENSE_PLANS[value as McpEvidencePlanId]
}

export function buildMcpEvidenceGrantSnapshot(input: {
  grantId?: string
  clientId: string
  credentialId: string
  planId: McpEvidencePlanId
  validFrom: string
  validUntil: string
  considerationState: 'internal-evaluation' | 'externally-contracted'
  contractedAmountUsdCents: number
  receivedAmountUsdCents: number
  commercialReference: string | null
  issuedAt: string
}): McpEvidenceGrantSnapshot {
  if (!CLIENT_ID.test(input.clientId)) throw new Error('clientId is invalid.')
  if (!CREDENTIAL_ID.test(input.credentialId)) throw new Error('credentialId is invalid.')
  const plan = mcpEvidencePlan(input.planId)
  const validFrom = isoInstant(input.validFrom, 'validFrom')
  const validUntil = isoInstant(input.validUntil, 'validUntil')
  const issuedAt = isoInstant(input.issuedAt, 'issuedAt')
  if (Date.parse(validUntil) <= Date.parse(validFrom)) throw new Error('validUntil must be later than validFrom.')
  if (!Number.isInteger(input.contractedAmountUsdCents) || input.contractedAmountUsdCents < 0) throw new Error('contractedAmountUsdCents must be a non-negative integer.')
  if (!Number.isInteger(input.receivedAmountUsdCents) || input.receivedAmountUsdCents < 0 || input.receivedAmountUsdCents > input.contractedAmountUsdCents) throw new Error('receivedAmountUsdCents must be between zero and contractedAmountUsdCents.')
  if (input.considerationState === 'internal-evaluation' && (input.contractedAmountUsdCents !== 0 || input.receivedAmountUsdCents !== 0 || input.commercialReference !== null)) {
    throw new Error('Internal evaluation grants cannot claim a contract, payment, or commercial reference.')
  }
  if (input.considerationState === 'externally-contracted' && !input.commercialReference) throw new Error('Externally contracted grants require a commercialReference.')
  const grantId = input.grantId ?? createMcpEvidenceGrantId()
  if (!/^mcpgrant_[a-f0-9]{32}$/.test(grantId)) throw new Error('grantId is invalid.')
  const unsigned = {
    schemaVersion: MCP_EVIDENCE_LICENSE_VERSION,
    grantId,
    clientId: input.clientId,
    credentialId: input.credentialId,
    planId: input.planId,
    planVersion: plan.planVersion,
    allowedTools: plan.allowedTools,
    monthlyQuotaUnits: plan.monthlyQuotaUnits,
    validFrom,
    validUntil,
    considerationState: input.considerationState,
    contractedAmountUsdCents: input.contractedAmountUsdCents,
    receivedAmountUsdCents: input.receivedAmountUsdCents,
    commercialReference: input.commercialReference,
    termsSha256: MCP_EVIDENCE_LICENSE_TERMS_SHA256,
    issuedAt,
  }
  return { ...unsigned, grantSha256: sha256Canonical(unsigned) }
}

export function buildLicensedEvidenceProjection(
  release: EpistemicCanonicalRelease,
  execution: McpEvidenceExecutionReservation,
) {
  if (release.releaseId !== execution.releaseId || release.releaseSha256 !== execution.releaseSha256) {
    throw new Error('Execution reservation does not bind the selected canonical release.')
  }
  if (!release.gateDecision.publicEligible || release.gateDecision.reasons.length !== 0) {
    throw new Error('The selected release is not publication-eligible.')
  }
  if (!SHA256.test(release.recordSha256) || !SHA256.test(release.releaseSha256)) throw new Error('The selected release digest is invalid.')
  const publicProvenance = publicEpistemicReleaseProvenance(release, [release], [])
  return {
    schemaVersion: MCP_EVIDENCE_PROJECTION_VERSION,
    execution: {
      schemaVersion: MCP_EVIDENCE_EXECUTION_VERSION,
      executionId: execution.executionId,
      clientRequestId: execution.clientRequestId,
      requestSha256: execution.requestSha256,
      toolName: MCP_EVIDENCE_TOOL_NAME,
      planId: execution.planId,
      planVersion: execution.planVersion,
      quotaPeriodStartedAt: execution.quotaPeriodStartedAt,
      unitQuantity: execution.unitQuantity,
    },
    release: publicProvenance.release,
    record: {
      schemaVersion: release.recordSnapshot.schemaVersion,
      evidencePolicyVersion: release.recordSnapshot.evidencePolicyVersion,
      id: release.recordSnapshot.id,
      domainSlug: release.recordSnapshot.domainSlug,
      recordKind: release.recordSnapshot.recordKind,
      slug: release.recordSnapshot.slug,
      title: release.recordSnapshot.title,
      description: release.recordSnapshot.description,
      summary: release.recordSnapshot.summary,
      claims: release.recordSnapshot.claims,
      sources: release.recordSnapshot.sources,
      sections: release.recordSnapshot.sections,
      bridges: release.recordSnapshot.bridges,
      boundaries: release.recordSnapshot.boundaries,
      prohibitedInferences: release.recordSnapshot.prohibitedInferences,
    },
    provenance: publicProvenance.provenance,
    privacyBoundary: publicProvenance.privacyBoundary,
    licenseBoundary: MCP_EVIDENCE_LICENSE_TERMS.evidenceBoundary,
  }
}

export function mcpEvidenceOutputSha256(projection: ReturnType<typeof buildLicensedEvidenceProjection>): string {
  return sha256Canonical(projection)
}
