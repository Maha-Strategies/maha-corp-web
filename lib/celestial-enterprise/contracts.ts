/** Stable public contracts for the Maha Celestial Evidence API. */

import { ASTROLOGY_VERSION } from '../astrology-traditions.ts'
import { buildBirthReport, type BirthInput, type BirthReport } from '../birth-report.ts'
import { COMPILER_VERSION } from '../interpretation-compiler.ts'
import { buildCorporateReport, type CorporateReport, type CorporateReportInput } from '../corporate-report.ts'
import { digestOf, isExplicitUtcInstant } from '../celestial-hypotheses/canonical.ts'

export const CELESTIAL_ENTERPRISE_API_VERSION = 'maha-celestial-api/1' as const
export const CELESTIAL_CONSENT_POLICY_VERSION = 'celestial-consent/1' as const
export const CELESTIAL_REPRODUCIBILITY_POLICY_VERSION = 'celestial-reproducibility/1' as const

export const CELESTIAL_INTERPRETATION_PACKS = [
  {
    packId: 'facts-only', version: '1.0.0', status: 'active', reportTypes: ['individual-birth', 'corporate-event'],
    traditionIds: [], description: 'Calculated chart, calendrical facts, conventions, uncertainty, and provenance without interpretation.',
  },
  {
    packId: 'jyotisha-source-bound', version: '1.0.0', status: 'active', reportTypes: ['individual-birth', 'corporate-event'],
    traditionIds: ['vedic-jyotisha'], description: 'Review-gated Jyotiṣa modules only; unavailable rules remain visibly withheld.',
  },
  {
    packId: 'comparative-natal', version: '1.0.0', status: 'active', reportTypes: ['individual-birth'],
    traditionIds: ['vedic-jyotisha', 'hellenistic-ptolemaic'], description: 'Separate, non-synthesized natal outputs from two named traditions.',
  },
] as const

export type CelestialReportType = 'individual-birth' | 'corporate-event'
export type CelestialPackId = typeof CELESTIAL_INTERPRETATION_PACKS[number]['packId']
export type ConsentBasis = 'explicit-subject-consent' | 'authorized-organizational-record' | 'public-record'

export interface CelestialConsent {
  policyVersion: typeof CELESTIAL_CONSENT_POLICY_VERSION
  basis: ConsentBasis
  capturedAtUtc: string
  consentReferenceSha256: string
}

export interface CelestialDataPolicy {
  saveReport: boolean
  retentionDays: number
  consent: CelestialConsent
}

export interface CelestialEnterpriseReportRequest {
  apiVersion: typeof CELESTIAL_ENTERPRISE_API_VERSION
  clientRequestId: string
  reportType: CelestialReportType
  interpretationPack: { packId: CelestialPackId; version: string }
  dataPolicy: CelestialDataPolicy
  input: BirthInput | CorporateReportInput
}

export interface CelestialEnterpriseReport {
  apiVersion: typeof CELESTIAL_ENTERPRISE_API_VERSION
  reportId: string
  clientRequestId: string
  tenantId: string
  reportType: CelestialReportType
  interpretationPack: { packId: CelestialPackId; version: string; packSha256: string }
  status: 'completed'
  generatedAtUtc: string
  expiresAtUtc: string | null
  saved: boolean
  dataGovernance: {
    consentPolicyVersion: typeof CELESTIAL_CONSENT_POLICY_VERSION
    consentBasis: ConsentBasis
    consentReferenceSha256: string
    retentionDays: number
    deletionAvailable: boolean
  }
  result: BirthReport | CorporateReport
  reproducibility: {
    policyVersion: typeof CELESTIAL_REPRODUCIBILITY_POLICY_VERSION
    requestSha256: string
    resultSha256: string
    astrologyRegistryVersion: typeof ASTROLOGY_VERSION
    compilerVersion: typeof COMPILER_VERSION
    guarantee: string
  }
  boundaries: string[]
}

export class CelestialEnterpriseValidationError extends Error {
  readonly issues: string[]
  constructor(issues: string[]) { super('The enterprise celestial request is invalid.'); this.name = 'CelestialEnterpriseValidationError'; this.issues = issues }
}

const ID = /^[a-z][a-z0-9_-]{7,95}$/
const SHA = /^sha256:[a-f0-9]{64}$/

export function resolveInterpretationPack(packId: string, version: string, reportType: CelestialReportType) {
  const pack = CELESTIAL_INTERPRETATION_PACKS.find((candidate) => candidate.packId === packId && candidate.version === version)
  if (!pack || !(pack.reportTypes as readonly string[]).includes(reportType)) throw new CelestialEnterpriseValidationError(['The requested interpretation-pack version is unavailable for this report type.'])
  return { ...pack, packSha256: digestOf(pack) }
}

export function parseCelestialEnterpriseRequest(value: unknown): CelestialEnterpriseReportRequest {
  const issues: string[] = []
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const reportType = input.reportType as CelestialReportType
  const policy = input.dataPolicy && typeof input.dataPolicy === 'object' ? input.dataPolicy as Record<string, unknown> : {}
  const consent = policy.consent && typeof policy.consent === 'object' ? policy.consent as Record<string, unknown> : {}
  const pack = input.interpretationPack && typeof input.interpretationPack === 'object' ? input.interpretationPack as Record<string, unknown> : {}
  if (input.apiVersion !== CELESTIAL_ENTERPRISE_API_VERSION) issues.push(`apiVersion must be ${CELESTIAL_ENTERPRISE_API_VERSION}.`)
  if (!ID.test(String(input.clientRequestId ?? ''))) issues.push('clientRequestId must be a stable 8–96 character identifier.')
  if (!['individual-birth', 'corporate-event'].includes(reportType)) issues.push('reportType is unsupported.')
  const retentionDays = Number(policy.retentionDays)
  if (typeof policy.saveReport !== 'boolean' || !Number.isInteger(retentionDays) || retentionDays < 0 || retentionDays > 3_650 || (policy.saveReport && retentionDays < 1) || (!policy.saveReport && retentionDays !== 0)) issues.push('Retention must be 0 for unsaved reports or 1–3,650 days for saved reports.')
  if (consent.policyVersion !== CELESTIAL_CONSENT_POLICY_VERSION || !['explicit-subject-consent', 'authorized-organizational-record', 'public-record'].includes(String(consent.basis)) || !isExplicitUtcInstant(consent.capturedAtUtc) || !SHA.test(String(consent.consentReferenceSha256 ?? ''))) issues.push('A valid consent record and digest are required.')
  if (reportType === 'individual-birth' && consent.basis !== 'explicit-subject-consent') issues.push('Individual reports require explicit subject consent.')
  if (reportType === 'corporate-event' && consent.basis === 'explicit-subject-consent') issues.push('Corporate reports require an organizational or public-record basis, not human-subject consent.')
  if (!input.input || typeof input.input !== 'object' || Array.isArray(input.input)) issues.push('input must contain the report calculation inputs.')
  if (issues.length) throw new CelestialEnterpriseValidationError(issues)
  resolveInterpretationPack(String(pack.packId ?? ''), String(pack.version ?? ''), reportType)
  return {
    apiVersion: CELESTIAL_ENTERPRISE_API_VERSION,
    clientRequestId: String(input.clientRequestId), reportType,
    interpretationPack: { packId: String(pack.packId) as CelestialPackId, version: String(pack.version) },
    dataPolicy: { saveReport: Boolean(policy.saveReport), retentionDays, consent: consent as unknown as CelestialConsent },
    input: input.input as unknown as BirthInput | CorporateReportInput,
  }
}

function applyPack(result: BirthReport | CorporateReport, packId: CelestialPackId): BirthReport | CorporateReport {
  if (packId === 'facts-only') {
    if ('traditions' in result) return { ...result, traditions: [] }
    return { ...result, interpretation: { ...result.interpretation, status: 'withheld', modules: [], exclusions: [], refusal: { stage: 'pack-policy', message: 'The facts-only pack does not compile interpretation.', issues: [] }, reportId: null, inputSha256: null } }
  }
  if (packId === 'jyotisha-source-bound' && 'traditions' in result) return { ...result, traditions: result.traditions.filter((tradition) => tradition.traditionId === 'vedic-jyotisha') }
  return result
}

export function compileEnterpriseCelestialReport(tenantId: string, request: CelestialEnterpriseReportRequest, generatedAtUtc: string): CelestialEnterpriseReport {
  if (!ID.test(tenantId) || !isExplicitUtcInstant(generatedAtUtc)) throw new CelestialEnterpriseValidationError(['Tenant and generation instant must be explicit and valid.'])
  const pack = resolveInterpretationPack(request.interpretationPack.packId, request.interpretationPack.version, request.reportType)
  const rawResult = request.reportType === 'individual-birth'
    ? buildBirthReport(request.input as BirthInput)
    : buildCorporateReport(request.input as CorporateReportInput)
  const result = applyPack(rawResult, request.interpretationPack.packId)
  const requestSha256 = digestOf(request)
  const resultSha256 = digestOf(result)
  const identity = digestOf({ tenantId, clientRequestId: request.clientRequestId, requestSha256 })
  const expiresAtUtc = request.dataPolicy.saveReport ? new Date(new Date(generatedAtUtc).getTime() + request.dataPolicy.retentionDays * 86_400_000).toISOString() : null
  return {
    apiVersion: CELESTIAL_ENTERPRISE_API_VERSION, reportId: `celrep_${identity.slice(7, 31)}`,
    clientRequestId: request.clientRequestId, tenantId, reportType: request.reportType,
    interpretationPack: { packId: pack.packId, version: pack.version, packSha256: pack.packSha256 },
    status: 'completed', generatedAtUtc, expiresAtUtc, saved: request.dataPolicy.saveReport,
    dataGovernance: {
      consentPolicyVersion: CELESTIAL_CONSENT_POLICY_VERSION,
      consentBasis: request.dataPolicy.consent.basis,
      consentReferenceSha256: request.dataPolicy.consent.consentReferenceSha256,
      retentionDays: request.dataPolicy.retentionDays,
      deletionAvailable: request.dataPolicy.saveReport,
    },
    result,
    reproducibility: {
      policyVersion: CELESTIAL_REPRODUCIBILITY_POLICY_VERSION, requestSha256, resultSha256,
      astrologyRegistryVersion: ASTROLOGY_VERSION, compilerVersion: COMPILER_VERSION,
      guarantee: 'For the same canonical request, frozen interpretation pack, registry, compiler, ephemeris, and time-zone data versions, Maha guarantees byte-equivalent canonical result data. Narrative meaning and predictive outcomes are not guaranteed.',
    },
    boundaries: [
      'Astronomical calculations and declared chart conventions are separated from unvalidated interpretive tradition.',
      'No report certifies prediction, valuation, investment return, medical or legal conclusions, or guaranteed outcomes.',
      'Enterprise controls govern access and provenance; they do not upgrade empirical status.',
    ],
  }
}
