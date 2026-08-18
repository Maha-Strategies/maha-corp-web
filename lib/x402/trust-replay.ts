import { createHash } from 'node:crypto'
import canonicalize from 'canonicalize'
import denyFixtureJson from '../../content/integrations/x402-trust/action-deny.json' with { type: 'json' }
import proceedFixtureJson from '../../content/integrations/x402-trust/action-proceed.json' with { type: 'json' }
import reviewFixtureJson from '../../content/integrations/x402-trust/action-review.json' with { type: 'json' }
import manifestJson from '../../content/integrations/x402-trust/manifest.json' with { type: 'json' }
import {
  evaluateX402TrustPreview,
  X402_TRUST_ADAPTER_VERSION,
  X402_TRUST_PREVIEW_SCHEMA_SHA256,
  X402_TRUST_PREVIEW_SCHEMA_URL,
  type X402TrustNextAction,
  type X402TrustPolicyOutcome,
  type X402TrustPreviewPolicy,
  type X402TrustSampleRole,
} from './trust-preview.ts'

type FrozenActionFixture = {
  fixtureVersion: '1.0.0'
  fixtureId: string
  frozenAt: string
  sampleRole: X402TrustSampleRole
  policy: X402TrustPreviewPolicy
  input: unknown
  expected: {
    schemaValid: true
    semanticValid: true
    outcome: X402TrustPolicyOutcome
    nextAction: X402TrustNextAction
    reasonCodes: string[]
    advisoryOnly: true
    paymentAuthorized: false
  }
}

export type PublicX402TrustReplay = {
  downloadId: 'proceed' | 'review' | 'deny'
  fixtureId: string
  fixtureLabel: string
  fixtureSha256: string
  frozenAt: string
  sampleRole: X402TrustSampleRole
  schemaValid: true
  semanticValid: true
  signal: {
    resource: string
    recommendation: string
    score: number
    scoreRangeLow: number
    confidence: number
    observedAgeSeconds: number
    liveProbe: boolean
  }
  policy: X402TrustPreviewPolicy
  result: {
    outcome: X402TrustPolicyOutcome
    nextAction: X402TrustNextAction
    reasonCodes: string[]
    advisoryOnly: true
    paymentAuthorized: false
    replayedInputSha256: string
  }
}

export type PublicX402TrustEvidencePayload = {
  evidenceVersion: '1.0.0'
  evidenceType: 'maha-x402-trust-advisory-decision'
  issuedAt: string
  fixture: {
    fixtureId: string
    fixtureSha256: string
    sampleRole: X402TrustSampleRole
    synthetic: true
  }
  contract: {
    adapterVersion: typeof X402_TRUST_ADAPTER_VERSION
    schemaUrl: typeof X402_TRUST_PREVIEW_SCHEMA_URL
    schemaSha256: typeof X402_TRUST_PREVIEW_SCHEMA_SHA256
  }
  validation: { schemaValid: true; semanticValid: true }
  observation: PublicX402TrustReplay['signal']
  policy: X402TrustPreviewPolicy
  decision: PublicX402TrustReplay['result']
  retention: {
    rawReportRetained: false
    reportProseRetained: false
    credentialsRetained: false
    paymentMaterialRetained: false
  }
  nonClaims: string[]
}

export type PublicX402TrustEvidenceDownload = {
  evidence: PublicX402TrustEvidencePayload
  evidenceSha256: string
}

const fixtures = [
  { downloadId: 'proceed', file: 'action-proceed.json', label: 'Bounded proceed', value: proceedFixtureJson },
  { downloadId: 'review', file: 'action-review.json', label: 'Human review', value: reviewFixtureJson },
  { downloadId: 'deny', file: 'action-deny.json', label: 'Stop', value: denyFixtureJson },
] as const

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Frozen x402 Trust replay invariant failed: ${message}`)
}

export function getPublicX402TrustReplays(): PublicX402TrustReplay[] {
  return fixtures.map(({ downloadId, file, label, value }) => {
    const fixture = value as unknown as FrozenActionFixture
    const manifest = manifestJson.fixtures.find((entry) => entry.file === file)
    invariant(manifest, `${file} is absent from the digest manifest`)
    const evaluated = evaluateX402TrustPreview(JSON.stringify(fixture.input), {
      role: fixture.sampleRole,
      policy: fixture.policy,
      now: new Date(fixture.frozenAt),
    })
    invariant(evaluated.ok && evaluated.validation.schemaValid && evaluated.validation.semanticValid, `${file} no longer validates`)
    invariant(evaluated.evidence.decision.outcome === fixture.expected.outcome, `${file} outcome drifted`)
    invariant(evaluated.evidence.decision.nextAction === fixture.expected.nextAction, `${file} next action drifted`)
    invariant(JSON.stringify(evaluated.evidence.decision.reasonCodes) === JSON.stringify(fixture.expected.reasonCodes), `${file} reason codes drifted`)
    invariant(evaluated.evidence.decision.paymentAuthorized === false, `${file} attempted to authorize payment`)
    invariant(manifest.expectedNextAction === evaluated.evidence.decision.nextAction, `${file} disagrees with its manifest`)

    const observation = evaluated.evidence.observation
    invariant(observation.resource && observation.recommendation && observation.score !== null && observation.scoreRangeLow !== null && observation.confidence !== null && observation.observedAgeSeconds !== null && observation.liveProbe !== null, `${file} omitted public replay fields`)
    invariant(evaluated.evidence.source.transportBytesSha256, `${file} omitted its replayed input digest`)

    return {
      downloadId,
      fixtureId: fixture.fixtureId,
      fixtureLabel: label,
      fixtureSha256: manifest.sha256,
      frozenAt: fixture.frozenAt,
      sampleRole: fixture.sampleRole,
      schemaValid: true,
      semanticValid: true,
      signal: {
        resource: observation.resource,
        recommendation: observation.recommendation,
        score: observation.score,
        scoreRangeLow: observation.scoreRangeLow,
        confidence: observation.confidence,
        observedAgeSeconds: observation.observedAgeSeconds,
        liveProbe: observation.liveProbe,
      },
      policy: fixture.policy,
      result: {
        outcome: evaluated.evidence.decision.outcome,
        nextAction: evaluated.evidence.decision.nextAction,
        reasonCodes: evaluated.evidence.decision.reasonCodes,
        advisoryOnly: true,
        paymentAuthorized: false,
        replayedInputSha256: evaluated.evidence.source.transportBytesSha256,
      },
    }
  })
}

function digest(value: unknown): string {
  const serialized = canonicalize(value)
  if (serialized === undefined) throw new Error('Public x402 Trust evidence cannot be canonicalized.')
  return `sha256:${createHash('sha256').update(serialized, 'utf8').digest('hex')}`
}

export function getPublicX402TrustEvidence(downloadId: string): PublicX402TrustEvidenceDownload | null {
  const replay = getPublicX402TrustReplays().find((entry) => entry.downloadId === downloadId)
  if (!replay) return null
  const evidence: PublicX402TrustEvidencePayload = {
    evidenceVersion: '1.0.0',
    evidenceType: 'maha-x402-trust-advisory-decision',
    issuedAt: replay.frozenAt,
    fixture: { fixtureId: replay.fixtureId, fixtureSha256: replay.fixtureSha256, sampleRole: replay.sampleRole, synthetic: true },
    contract: { adapterVersion: X402_TRUST_ADAPTER_VERSION, schemaUrl: X402_TRUST_PREVIEW_SCHEMA_URL, schemaSha256: X402_TRUST_PREVIEW_SCHEMA_SHA256 },
    validation: { schemaValid: true, semanticValid: true },
    observation: replay.signal,
    policy: replay.policy,
    decision: replay.result,
    retention: { rawReportRetained: false, reportProseRetained: false, credentialsRetained: false, paymentMaterialRetained: false },
    nonClaims: [
      'This synthetic replay is not a current observation, merchant rating, endorsement, or security certification.',
      'The advisory decision does not authorize a payment, wallet signature, settlement, or task execution.',
      'The evidence digest authenticates deterministic content equality only; it is not a provider signature.',
    ],
  }
  return { evidence, evidenceSha256: digest(evidence) }
}
