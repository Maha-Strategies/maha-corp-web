import { validateDiscoveryExtension, validateDiscoveryExtensionSpec } from '@x402/extensions/bazaar'
import { recoverTypedDataAddress } from 'viem'

type JsonRecord = Record<string, unknown>

export type ConformanceVerdict = 'accept' | 'reject' | 'warn' | 'indeterminate'
export type ConformanceRetry = 'safe' | 'unsafe' | 'after_correction' | 'not_applicable'

export type ConformanceExpected = {
  verdict: ConformanceVerdict
  phase: string
  code: string
  retry: ConformanceRetry
  httpStatus?: number
  notes?: string
}

export type ConformanceFixture = {
  id: string
  title: string
  layer: string
  description: string
  input: JsonRecord
  expected: ConformanceExpected
  specReferences: string[]
}

export type ConformanceCorpus = {
  $schema?: string
  schemaVersion: string
  corpusVersion: string
  protocolVersion: number
  license: string
  licenseUrl: string
  evaluationTime: number
  specReferences: string[]
  fixtures: ConformanceFixture[]
}

export type ConformanceActual = Pick<ConformanceExpected, 'verdict' | 'phase' | 'code' | 'retry'>

export type ConformanceResult = {
  id: string
  title: string
  passed: boolean
  expected: ConformanceExpected
  actual: ConformanceActual
}

const CAIP_2 = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const TRANSACTION = /^0x[a-fA-F0-9]{64}$/
const NONCE = /^0x[a-fA-F0-9]{64}$/

const TRANSFER_WITH_AUTHORIZATION = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
] as const

function record(value: unknown, label = 'value'): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as JsonRecord
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`)
  return value
}

function integer(value: unknown, label: string): bigint {
  const parsed = typeof value === 'bigint' ? value : typeof value === 'number' && Number.isInteger(value) ? BigInt(value) : typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null
  if (parsed === null) throw new Error(`${label} must be an unsigned integer.`)
  return parsed
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.entries(value as JsonRecord)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(',')}}`
}

function jsonSchemaStructurallyValid(value: unknown): boolean {
  if (typeof value === 'boolean') return true
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const schema = value as JsonRecord
  const allowedTypes = new Set(['null', 'boolean', 'object', 'array', 'number', 'string', 'integer'])
  if (typeof schema.type === 'string' && !allowedTypes.has(schema.type)) return false
  if (Array.isArray(schema.type) && schema.type.some((item) => typeof item !== 'string' || !allowedTypes.has(item))) return false
  if (schema.properties !== undefined) {
    if (!schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) return false
    if (Object.values(schema.properties as JsonRecord).some((child) => !jsonSchemaStructurallyValid(child))) return false
  }
  if (schema.items !== undefined && !jsonSchemaStructurallyValid(schema.items)) return false
  return true
}

function actual(verdict: ConformanceVerdict, phase: string, code: string, retry: ConformanceRetry): ConformanceActual {
  return { verdict, phase, code, retry }
}

function fixtureById(corpus: ConformanceCorpus, id: string): ConformanceFixture {
  const fixture = corpus.fixtures.find((candidate) => candidate.id === id)
  if (!fixture) throw new Error(`Unknown fixture reference: ${id}`)
  return fixture
}

function referencedPayment(corpus: ConformanceCorpus, input: JsonRecord): JsonRecord {
  if (input.payment) return record(input.payment, 'payment')
  return record(fixtureById(corpus, string(input.paymentFixture, 'paymentFixture')).input.payment, 'referenced payment')
}

function referencedRequirement(corpus: ConformanceCorpus, input: JsonRecord): JsonRecord {
  if (input.requirement) return record(input.requirement, 'requirement')
  const source = fixtureById(corpus, string(input.requirementFixture, 'requirementFixture')).input
  return record(source.requirement, 'referenced requirement')
}

function requirementMismatch(requirement: JsonRecord, accepted: JsonRecord, authorization: JsonRecord): ConformanceActual | null {
  if (requirement.network !== accepted.network) return actual('reject', 'requirements', 'requirement_mismatch_network', 'after_correction')
  if (String(requirement.asset).toLowerCase() !== String(accepted.asset).toLowerCase()) return actual('reject', 'requirements', 'requirement_mismatch_asset', 'after_correction')
  if (String(requirement.payTo).toLowerCase() !== String(accepted.payTo).toLowerCase() || String(requirement.payTo).toLowerCase() !== String(authorization.to).toLowerCase()) {
    return actual('reject', 'requirements', 'requirement_mismatch_payee', 'after_correction')
  }
  if (integer(requirement.amount, 'requirement.amount') !== integer(accepted.amount, 'accepted.amount') || integer(requirement.amount, 'requirement.amount') !== integer(authorization.value, 'authorization.value')) {
    return actual('reject', 'requirements', 'requirement_mismatch_amount', 'after_correction')
  }
  return null
}

async function evaluatePayment(corpus: ConformanceCorpus, fixture: ConformanceFixture): Promise<ConformanceActual> {
  const payment = referencedPayment(corpus, fixture.input)
  const requirement = referencedRequirement(corpus, fixture.input)
  const accepted = record(payment.accepted, 'payment.accepted')
  const payload = record(payment.payload, 'payment.payload')
  const authorization = record(payload.authorization, 'payment.payload.authorization')
  const mismatch = requirementMismatch(requirement, accepted, authorization)
  if (mismatch) return mismatch

  const evaluationTime = integer(fixture.input.evaluationTime ?? corpus.evaluationTime, 'evaluationTime')
  const validAfter = integer(authorization.validAfter, 'authorization.validAfter')
  const validBefore = integer(authorization.validBefore, 'authorization.validBefore')
  if (evaluationTime <= validAfter) return actual('reject', 'verify', 'authorization_not_yet_valid', 'after_correction')
  if (evaluationTime > validBefore) return actual('reject', 'verify', 'authorization_expired', 'after_correction')

  const network = string(accepted.network, 'accepted.network')
  const chainId = network.startsWith('eip155:') ? Number(network.slice('eip155:'.length)) : Number.NaN
  const extra = record(accepted.extra ?? {}, 'accepted.extra')
  const from = string(authorization.from, 'authorization.from')
  const nonce = string(authorization.nonce, 'authorization.nonce')
  if (!EVM_ADDRESS.test(from) || !NONCE.test(nonce) || !Number.isSafeInteger(chainId)) {
    return actual('reject', 'verify', 'authorization_malformed', 'after_correction')
  }

  try {
    const recovered = await recoverTypedDataAddress({
      domain: {
        name: typeof extra.name === 'string' ? extra.name : 'USD Coin',
        version: typeof extra.version === 'string' ? extra.version : '2',
        chainId,
        verifyingContract: string(accepted.asset, 'accepted.asset') as `0x${string}`,
      },
      types: { TransferWithAuthorization: [...TRANSFER_WITH_AUTHORIZATION] },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: from as `0x${string}`,
        to: string(authorization.to, 'authorization.to') as `0x${string}`,
        value: integer(authorization.value, 'authorization.value'),
        validAfter,
        validBefore,
        nonce: nonce as `0x${string}`,
      },
      signature: string(payload.signature, 'payment.payload.signature') as `0x${string}`,
    })
    if (recovered.toLowerCase() !== from.toLowerCase()) return actual('reject', 'verify', 'signature_invalid', 'after_correction')
  } catch {
    return actual('reject', 'verify', 'signature_invalid', 'after_correction')
  }
  return actual('accept', 'verify', 'valid_eip3009_payment', 'not_applicable')
}

function evaluateReceipt(input: JsonRecord): ConformanceActual {
  if (!input.message) return actual('reject', 'receipt', 'receipt_missing', 'unsafe')
  const receipt = record(input.message, 'receipt')
  const valid = typeof receipt.success === 'boolean'
    && typeof receipt.transaction === 'string'
    && (!receipt.success || TRANSACTION.test(receipt.transaction))
    && typeof receipt.network === 'string'
    && CAIP_2.test(receipt.network)
    && (receipt.payer === undefined || typeof receipt.payer === 'string' && EVM_ADDRESS.test(receipt.payer))
  return valid
    ? actual('accept', 'receipt', 'valid_receipt', 'not_applicable')
    : actual('reject', 'receipt', 'receipt_malformed', 'unsafe')
}

export function validateConformanceCorpus(corpus: unknown): asserts corpus is ConformanceCorpus {
  const value = record(corpus, 'corpus')
  if (value.schemaVersion !== '1.0.0' || value.protocolVersion !== 2 || value.license !== 'Apache-2.0') throw new Error('Unsupported corpus envelope.')
  if (!Array.isArray(value.fixtures) || value.fixtures.length === 0) throw new Error('Corpus fixtures must be a non-empty array.')
  const ids = new Set<string>()
  for (const candidate of value.fixtures) {
    const fixture = record(candidate, 'fixture')
    const id = string(fixture.id, 'fixture.id')
    if (ids.has(id)) throw new Error(`Duplicate fixture id: ${id}`)
    ids.add(id)
    if (!fixture.input || !fixture.expected || !Array.isArray(fixture.specReferences) || fixture.specReferences.length === 0) throw new Error(`Fixture ${id} is incomplete.`)
  }
}

export async function evaluateConformanceFixture(corpus: ConformanceCorpus, fixture: ConformanceFixture): Promise<ConformanceActual> {
  switch (fixture.id) {
    case 'http.challenge.valid-v2': {
      const message = record(fixture.input.message, 'challenge')
      const accepts = Array.isArray(message.accepts) ? message.accepts : []
      const valid = fixture.input.status === 402 && fixture.input.headerName === 'PAYMENT-REQUIRED' && message.x402Version === 2 && accepts.length > 0
      return valid
        ? actual('accept', 'challenge', 'valid_v2_challenge', 'not_applicable')
        : actual('reject', 'challenge', 'challenge_malformed', 'after_correction')
    }
    case 'requirements.network.malformed-caip2': {
      const requirement = record(fixture.input.requirement, 'requirement')
      return typeof requirement.network === 'string' && CAIP_2.test(requirement.network)
        ? actual('accept', 'requirements', 'valid_caip2_network', 'not_applicable')
        : actual('reject', 'requirements', 'invalid_caip2_network', 'after_correction')
    }
    case 'payment.valid.eip3009':
    case 'payment.mismatch.network':
    case 'payment.mismatch.asset':
    case 'payment.mismatch.payee':
    case 'payment.mismatch.amount':
    case 'payment.authorization.expired':
      return evaluatePayment(corpus, fixture)
    case 'payment.authorization.replay': {
      const source = fixtureById(corpus, string(fixture.input.paymentFixture, 'paymentFixture'))
      const verified = await evaluatePayment(corpus, source)
      if (verified.verdict !== 'accept') return verified
      const payment = referencedPayment(corpus, fixture.input)
      const accepted = record(payment.accepted, 'payment.accepted')
      const authorization = record(record(payment.payload, 'payment.payload').authorization, 'payment.payload.authorization')
      const identity = canonicalJson({
        network: accepted.network,
        asset: String(accepted.asset).toLowerCase(),
        from: String(authorization.from).toLowerCase(),
        nonce: String(authorization.nonce).toLowerCase(),
      })
      const consumed = new Set<string>()
      const attempts = Number(fixture.input.attempts)
      const consumedAfter = Number(fixture.input.consumedAfterAttempt)
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (consumed.has(identity)) return actual('reject', 'replay', 'authorization_replayed', 'unsafe')
        if (attempt >= consumedAfter) consumed.add(identity)
      }
      return actual('accept', 'replay', 'authorization_unused', 'not_applicable')
    }
    case 'bazaar.crawler.accidental-400': {
      const response = record(fixture.input.response, 'response')
      return response.status === 402
        ? actual('accept', 'crawler', 'crawler_challenged', 'not_applicable')
        : actual('reject', 'crawler', 'crawler_not_challenged', 'after_correction')
    }
    case 'bazaar.example.invalid':
    case 'bazaar.schema.invalid': {
      const extension = record(fixture.input.extension, 'extension')
      if (!jsonSchemaStructurallyValid(extension.schema)) return actual('reject', 'discovery', 'bazaar_schema_invalid', 'after_correction')
      const spec = validateDiscoveryExtensionSpec(extension as never)
      if (!spec.valid) return actual('reject', 'discovery', 'bazaar_schema_invalid', 'after_correction')
      const examples = validateDiscoveryExtension(extension as never)
      return examples.valid
        ? actual('accept', 'discovery', 'bazaar_declaration_valid', 'not_applicable')
        : actual('reject', 'discovery', 'bazaar_example_invalid', 'after_correction')
    }
    case 'bazaar.metadata.stale':
      return canonicalJson(fixture.input.live) === canonicalJson(fixture.input.indexed)
        ? actual('accept', 'discovery', 'bazaar_metadata_current', 'not_applicable')
        : actual('warn', 'discovery', 'bazaar_metadata_stale', 'after_correction')
    case 'settlement.result.ambiguous':
      return fixture.input.requestSubmitted === true && fixture.input.transportOutcome === 'timeout' && !fixture.input.receipt
        ? actual('indeterminate', 'settle', 'settlement_indeterminate', 'unsafe')
        : actual('reject', 'settle', 'settlement_failed', 'safe')
    case 'receipt.missing':
    case 'receipt.malformed':
      return evaluateReceipt(fixture.input)
    default:
      throw new Error(`Reference runner does not implement fixture ${fixture.id}.`)
  }
}

export async function runConformanceCorpus(corpusValue: unknown): Promise<ConformanceResult[]> {
  validateConformanceCorpus(corpusValue)
  const corpus = corpusValue
  return Promise.all(corpus.fixtures.map(async (fixture) => {
    const actualResult = await evaluateConformanceFixture(corpus, fixture)
    return {
      id: fixture.id,
      title: fixture.title,
      passed: actualResult.verdict === fixture.expected.verdict
        && actualResult.phase === fixture.expected.phase
        && actualResult.code === fixture.expected.code
        && actualResult.retry === fixture.expected.retry,
      expected: fixture.expected,
      actual: actualResult,
    }
  }))
}
