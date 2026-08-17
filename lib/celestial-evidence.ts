/**
 * Maha Celestial Evidence Bundle.
 *
 * The bundle certifies reproducibility and provenance. It does not certify
 * that an astrological interpretation is true or predicts an event. The
 * signed content deliberately keeps astronomical facts, chart conventions,
 * and tradition records in separate fields so a consumer cannot mistake one
 * category for another.
 */

import { createHash } from 'node:crypto'

import canonicalize from 'canonicalize'
import secp256k1 from 'secp256k1'

import { ASTROLOGY_PROHIBITED_USES, ASTROLOGY_VERSION } from './astrology-traditions.ts'
import type { CelestialFactBundle } from './celestial-facts.ts'
import { COMPILER_VERSION } from './interpretation-compiler.ts'
import type { HistoricalCalibration } from './historical-calibration.ts'
import type { NatalChart } from './natal-chart.ts'
import type { NatalTiming } from './natal-timing.ts'
import type { Panchanga } from './panchanga.ts'

export const CELESTIAL_EVIDENCE_VERSION = 'maha-celestial-evidence/0.1' as const
export const CELESTIAL_EVIDENCE_MEDIA_TYPE = 'application/vnd.maha-celestial.evidence+json' as const
export const CELESTIAL_EVIDENCE_SIGNING_KEY_ENV = 'MAHA_CELESTIAL_EVIDENCE_PRIVATE_KEY' as const

export const CELESTIAL_EVIDENCE_NON_CLAIMS = [
  'This bundle does not certify that astrology predicts events.',
  'A valid signature establishes bundle integrity and issuer provenance, not empirical validity.',
  'Astronomical calculations do not validate interpretations built on those calculations.',
  'Source fidelity establishes what a named tradition records, not that the recorded proposition is true.',
] as const

export interface EvidencePassage {
  id: string
  excerpt: string
  locator: string
  sourceTitle: string
  translator?: string
  editionYear: number
  transcriptionNote?: string
}

export interface EvidenceTradition {
  traditionId: string
  traditionName: string
  chartType: string
  reportId: string | null
  inputSha256: string | null
  modules: Array<{
    id: string
    heading: string
    ruleId: string
    interpretation: string
    observedLimbs: string[]
    disagreements: string[]
    boundary: string
    passages: EvidencePassage[]
  }>
  withheld: Array<{ ruleId: string; technique: string; reason: string; detail: string }>
  refusal: { stage: string; message: string; issues: string[] } | null
}

export interface CelestialEvidenceContent {
  schemaVersion: typeof CELESTIAL_EVIDENCE_VERSION
  mediaType: typeof CELESTIAL_EVIDENCE_MEDIA_TYPE
  bundleId: string
  issuedAtUtc: string
  issuer: {
    product: 'Maha Celestial'
    legalEntity: 'Maha Strategies LLC'
    certificationScope: string
  }
  report: {
    reportVersion: string
    resolvedInstantUtc: string
    observer: {
      latitudeDegrees: number
      longitudeDegrees: number
      elevationMeters: number
      horizontalCrs: 'EPSG:4326'
    }
    civilTimeResolution: {
      utcOffset: string
      fold: string
      nonexistentLocalTime: boolean
    }
  }
  astronomicalFacts: CelestialFactBundle
  calculationConventions: {
    natalChartVersion: string
    timingVersion: string
    panchangaVersion: string
    interpretationCompilerVersion: typeof COMPILER_VERSION
    traditionRegistryVersion: typeof ASTROLOGY_VERSION
    natalMethodology: string[]
    timingMethodology: string[]
  }
  chartGeometry: {
    panchanga: Panchanga
    natalChart: NatalChart
    timing: NatalTiming
  }
  interpretations: EvidenceTradition[]
  exploratoryAnalysis: {
    historicalCalibration: HistoricalCalibration | null
    boundary: string
  }
  boundaries: {
    empiricalStatus: 'unvalidated-interpretive-tradition'
    nonClaims: string[]
    prohibitedUses: string[]
  }
}

export interface CelestialEvidenceProof {
  type: 'JsonWebSignature2020'
  created: string
  proofPurpose: 'assertionMethod'
  verificationMethod: string
  algorithm: 'ES256K'
  canonicalization: 'RFC8785'
  publicKey: { encoding: 'compressed-hex'; value: string }
  jws: string
}

export interface CelestialEvidenceBundle extends CelestialEvidenceContent {
  integrity: {
    algorithm: 'SHA-256'
    canonicalization: 'RFC8785'
    contentSha256: string
  }
  proof: CelestialEvidenceProof | null
}

export interface BuildCelestialEvidenceInput {
  issuedAtUtc: string
  reportVersion: string
  instantUtc: string
  utcOffset: string
  fold: string
  nonexistentLocalTime: boolean
  factBundle: CelestialFactBundle
  panchanga: Panchanga
  natalChart: NatalChart
  timing: NatalTiming
  traditions: EvidenceTradition[]
  historicalCalibration: HistoricalCalibration | null
}

export interface CelestialEvidenceVerification {
  status: 'invalid' | 'digest-valid' | 'signature-valid' | 'issuer-verified'
  digestValid: boolean
  signaturePresent: boolean
  signatureValid: boolean
  issuerKeyCurrent: boolean
  bundleId: string | null
  contentSha256: string | null
  keyId: string | null
  issues: string[]
  boundary: string
}

function canonical(value: unknown): string {
  const result = canonicalize(value)
  if (typeof result !== 'string') throw new Error('Evidence content could not be canonicalized.')
  return result
}

function sha256Buffer(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function sha256(value: string): string {
  return `sha256:${sha256Buffer(value).toString('hex')}`
}

function normalizePrivateKey(value: string): string {
  const normalized = value.trim().replace(/^0x/, '').toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(normalized) || !secp256k1.privateKeyVerify(Buffer.from(normalized, 'hex'))) {
    throw new Error(`${CELESTIAL_EVIDENCE_SIGNING_KEY_ENV} must be a valid dedicated 32-byte secp256k1 private key.`)
  }
  return normalized
}

function configuredPrivateKey(): string | null {
  const value = process.env[CELESTIAL_EVIDENCE_SIGNING_KEY_ENV]
  return value ? normalizePrivateKey(value) : null
}

function publicKeyFor(privateKey: string): string {
  return Buffer.from(secp256k1.publicKeyCreate(Buffer.from(privateKey, 'hex'), true)).toString('hex')
}

function keyId(publicKey: string): string {
  return `maha-celestial:key:${sha256(publicKey).slice(7, 23)}`
}

function contentFrom(bundle: CelestialEvidenceBundle): CelestialEvidenceContent {
  const { integrity: _integrity, proof: _proof, ...content } = bundle
  return content
}

function signContent(content: CelestialEvidenceContent, privateKey: string): CelestialEvidenceProof {
  const publicKey = publicKeyFor(privateKey)
  const verificationMethod = keyId(publicKey)
  const protectedHeader = Buffer.from(JSON.stringify({ alg: 'ES256K', kid: verificationMethod, typ: CELESTIAL_EVIDENCE_MEDIA_TYPE })).toString('base64url')
  const payload = Buffer.from(canonical(content)).toString('base64url')
  const digest = sha256Buffer(`${protectedHeader}.${payload}`)
  const signature = Buffer.from(secp256k1.ecdsaSign(digest, Buffer.from(privateKey, 'hex')).signature).toString('base64url')
  return {
    type: 'JsonWebSignature2020',
    created: content.issuedAtUtc,
    proofPurpose: 'assertionMethod',
    verificationMethod,
    algorithm: 'ES256K',
    canonicalization: 'RFC8785',
    publicKey: { encoding: 'compressed-hex', value: publicKey },
    jws: `${protectedHeader}..${signature}`,
  }
}

function validUtc(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value))
}

export function buildCelestialEvidenceBundle(input: BuildCelestialEvidenceInput): CelestialEvidenceBundle {
  if (!validUtc(input.issuedAtUtc)) throw new Error('Evidence issuedAtUtc must be an explicit UTC instant.')
  const observer = input.factBundle.observers[0]
  if (!observer) throw new Error('Evidence bundle requires one observer.')

  const identitySeed = canonical({
    reportVersion: input.reportVersion,
    instantUtc: input.instantUtc,
    factBundleId: input.factBundle.bundleId,
    issuedAtUtc: input.issuedAtUtc,
  })
  const content: CelestialEvidenceContent = {
    schemaVersion: CELESTIAL_EVIDENCE_VERSION,
    mediaType: CELESTIAL_EVIDENCE_MEDIA_TYPE,
    bundleId: `mce_${sha256(identitySeed).slice(7, 31)}`,
    issuedAtUtc: input.issuedAtUtc,
    issuer: {
      product: 'Maha Celestial',
      legalEntity: 'Maha Strategies LLC',
      certificationScope: 'Reproducible computation, declared conventions, source provenance, and artifact integrity. Empirical predictive validity is outside the certification scope.',
    },
    report: {
      reportVersion: input.reportVersion,
      resolvedInstantUtc: input.instantUtc,
      observer: {
        latitudeDegrees: observer.latitudeDegrees,
        longitudeDegrees: observer.longitudeDegrees,
        elevationMeters: observer.elevationMeters,
        horizontalCrs: observer.horizontalCrs,
      },
      civilTimeResolution: {
        utcOffset: input.utcOffset,
        fold: input.fold,
        nonexistentLocalTime: input.nonexistentLocalTime,
      },
    },
    astronomicalFacts: input.factBundle,
    calculationConventions: {
      natalChartVersion: input.natalChart.version,
      timingVersion: input.timing.version,
      panchangaVersion: input.panchanga.version,
      interpretationCompilerVersion: COMPILER_VERSION,
      traditionRegistryVersion: ASTROLOGY_VERSION,
      natalMethodology: [...input.natalChart.methodology],
      timingMethodology: [...input.timing.methodology],
    },
    chartGeometry: {
      panchanga: input.panchanga,
      natalChart: input.natalChart,
      timing: input.timing,
    },
    interpretations: input.traditions,
    exploratoryAnalysis: {
      historicalCalibration: input.historicalCalibration,
      boundary: 'Historical calibration is retrospective hypothesis generation. It is not a forecast, causal estimate, significance test, or demonstration of predictive skill.',
    },
    boundaries: {
      empiricalStatus: 'unvalidated-interpretive-tradition',
      nonClaims: [...CELESTIAL_EVIDENCE_NON_CLAIMS],
      prohibitedUses: [...ASTROLOGY_PROHIBITED_USES],
    },
  }
  const canonicalContent = canonical(content)
  const privateKey = configuredPrivateKey()
  return {
    ...content,
    integrity: { algorithm: 'SHA-256', canonicalization: 'RFC8785', contentSha256: sha256(canonicalContent) },
    proof: privateKey ? signContent(content, privateKey) : null,
  }
}

export function verifyCelestialEvidenceBundle(value: unknown): CelestialEvidenceVerification {
  const issues: string[] = []
  const boundary = 'Verification establishes artifact integrity and, when the current issuer key matches, Maha Celestial issuer provenance. It does not establish predictive validity.'
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { status: 'invalid', digestValid: false, signaturePresent: false, signatureValid: false, issuerKeyCurrent: false, bundleId: null, contentSha256: null, keyId: null, issues: ['Bundle must be a JSON object.'], boundary }
  }
  const bundle = value as CelestialEvidenceBundle
  if (bundle.schemaVersion !== CELESTIAL_EVIDENCE_VERSION) issues.push('Unsupported evidence schema version.')
  if (bundle.mediaType !== CELESTIAL_EVIDENCE_MEDIA_TYPE) issues.push('Unexpected evidence media type.')
  if (typeof bundle.bundleId !== 'string' || !/^mce_[a-f0-9]{24}$/.test(bundle.bundleId)) issues.push('Bundle identifier is invalid.')
  if (!validUtc(bundle.issuedAtUtc)) issues.push('issuedAtUtc is invalid.')
  if (!bundle.integrity || bundle.integrity.algorithm !== 'SHA-256' || bundle.integrity.canonicalization !== 'RFC8785') issues.push('Integrity metadata is invalid.')

  let contentSha256: string | null = null
  let digestValid = false
  try {
    const content = contentFrom(bundle)
    contentSha256 = sha256(canonical(content))
    digestValid = contentSha256 === bundle.integrity?.contentSha256
    if (!digestValid) issues.push('Content digest does not match the signed content.')
  } catch {
    issues.push('Bundle content could not be canonicalized.')
  }

  const proof = bundle.proof
  const signaturePresent = Boolean(proof)
  let signatureValid = false
  let issuerKeyCurrent = false
  let proofKeyId: string | null = null
  if (proof) {
    proofKeyId = typeof proof.verificationMethod === 'string' ? proof.verificationMethod : null
    try {
      const [protectedHeader, empty, signature] = proof.jws.split('.')
      const publicKey = proof.publicKey.value
      if (!protectedHeader || empty !== '' || !signature) throw new Error('invalid-jws')
      if (proof.verificationMethod !== keyId(publicKey)) throw new Error('key-id-mismatch')
      const decodedHeader = JSON.parse(Buffer.from(protectedHeader, 'base64url').toString('utf8')) as Record<string, unknown>
      if (decodedHeader.alg !== 'ES256K' || decodedHeader.kid !== proof.verificationMethod || decodedHeader.typ !== CELESTIAL_EVIDENCE_MEDIA_TYPE) throw new Error('header-mismatch')
      if (proof.algorithm !== 'ES256K' || proof.canonicalization !== 'RFC8785' || proof.proofPurpose !== 'assertionMethod') throw new Error('proof-contract-mismatch')
      const content = contentFrom(bundle)
      const payload = Buffer.from(canonical(content)).toString('base64url')
      const digest = sha256Buffer(`${protectedHeader}.${payload}`)
      signatureValid = secp256k1.ecdsaVerify(Buffer.from(signature, 'base64url'), digest, Buffer.from(publicKey, 'hex'))
      if (!signatureValid) issues.push('Detached signature is invalid.')
      const privateKey = configuredPrivateKey()
      issuerKeyCurrent = Boolean(privateKey && publicKeyFor(privateKey) === publicKey)
      if (signatureValid && !issuerKeyCurrent) issues.push('Signature is valid, but the key is not the currently configured Maha Celestial issuer key.')
    } catch {
      issues.push('Signature proof is malformed.')
    }
  } else {
    issues.push('No issuer signature is attached; only the content digest can be verified.')
  }

  const structurallyValid = issues.every((issue) => issue === 'No issuer signature is attached; only the content digest can be verified.' || issue === 'Signature is valid, but the key is not the currently configured Maha Celestial issuer key.')
  const status: CelestialEvidenceVerification['status'] = !digestValid || !structurallyValid
    ? 'invalid'
    : signatureValid && issuerKeyCurrent
      ? 'issuer-verified'
      : signatureValid
        ? 'signature-valid'
        : 'digest-valid'

  return {
    status,
    digestValid,
    signaturePresent,
    signatureValid,
    issuerKeyCurrent,
    bundleId: typeof bundle.bundleId === 'string' ? bundle.bundleId : null,
    contentSha256,
    keyId: proofKeyId,
    issues,
    boundary,
  }
}
