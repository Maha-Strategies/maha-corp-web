import { createHash } from 'node:crypto'
import { combineDimensions, linearInterpolate, trapezoidIntegral, type DimensionVector } from '../federation/readiness-tranche-21.ts'
import { compileAuditExport, verifyVersionRelationship, type VersionNode } from '../federation/readiness-tranche-22.ts'
import { MICRO_BOUNDARIES, MICRO_INPUT_SCHEMAS, MICRO_MAX_REQUEST_BYTES, MICRO_MAX_RESPONSE_BYTES, MICRO_PRODUCTS, MICRO_VERSION, schemaAccepts, type MicroProductId } from './micro-contracts.ts'
import { microOutputSchema } from './micro-output-schemas.ts'

type Row = Record<string, unknown>
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
export class MicroInputError extends Error { constructor() { super('invalid_or_unsupported_micro_input') } }
export function canonicalMicro(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalMicro).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalMicro((value as Row)[k])}`).join(',')}}`
  throw new MicroInputError()
}
export const microDigest = (value: unknown): string => `sha256:${createHash('sha256').update(canonicalMicro(value), 'utf8').digest('hex')}`
export function canonicalUtc(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const d = new Date(value)
  return Number.isFinite(d.getTime()) && d.toISOString() === value && d.getUTCFullYear() >= 1600 && d.getUTCFullYear() <= 2099
}

/** JSON wire round-trip strips prototypes; schemas refuse all unrecognized fields. */
export function parseMicroInput(id: MicroProductId, supplied: unknown): Row {
  let text: string
  try { text = canonicalMicro(supplied) } catch { throw new MicroInputError() }
  if (Buffer.byteLength(text) > MICRO_MAX_REQUEST_BYTES || !schemaAccepts(MICRO_INPUT_SCHEMAS[id], supplied)) throw new MicroInputError()
  return JSON.parse(text) as Row
}

function numericResult(input: Row, id: MicroProductId): Row {
  const unit = (key: string) => (input[key] as string).trim()
  if (!unit('xUnit') || !unit('yUnit')) throw new MicroInputError()
  const result = id === 'exact-interpolation-receipt'
    ? linearInterpolate(BigInt(input.x0 as string), BigInt(input.y0 as string), BigInt(input.x1 as string), BigInt(input.y1 as string), BigInt(input.x as string))
    : trapezoidIntegral(BigInt(input.spacing as string), (input.ordinates as string[]).map(x => BigInt(x)))
  return { numerator: result.numerator.toString(), denominator: result.denominator.toString(),
    method: id === 'exact-interpolation-receipt' ? 'two-node-linear-interpolation' : 'composite-trapezoidal-rule',
    xUnit: unit('xUnit'), yUnit: unit('yUnit'), resultUnit: id === 'exact-interpolation-receipt' ? unit('yUnit') : `${unit('xUnit')} * ${unit('yUnit')}`,
    unitBasis: 'caller-declared; not converted or independently validated', arithmetic: 'exact-rational',
    approximationError: 'not-estimated', measurementUncertainty: 'not-estimated' }
}

function coreResult(id: MicroProductId, input: Row): Row | null {
  switch (id) {
    case 'citation-binding-check': {
      const bindings = input.bindings as { expected: Row; observed: Row }[]
      if (bindings.some(b => !(b.expected.value as string).trim() || !(b.observed.value as string).trim())) throw new MicroInputError()
      const checks = bindings.map((b, index) => {
        const mismatches = ['sourceId', 'sourceRevision', 'kind', 'value'].filter(k => b.expected[k] !== b.observed[k])
        return { index, matches: mismatches.length === 0, mismatches, expectedDigest: microDigest(b.expected), observedDigest: microDigest(b.observed) }
      })
      return { allMatch: checks.every(c => c.matches), checks, passageInspected: false, claimSupportVerified: false }
    }
    case 'revision-lineage-check': {
      const previous = input.previous as VersionNode | null, next = input.next as VersionNode
      if (previous && ((previous.relation === 'initial') !== (previous.predecessorDigest === null) || previous.predecessorDigest === previous.revisionDigest)) throw new MicroInputError()
      const issues: string[] = []
      // Codes are from this finite set, never arbitrary exception text.
      if (next.relation === 'initial') {
        if (previous || next.predecessorDigest !== null) issues.push('initial-has-predecessor')
      } else {
        if (!previous || previous.objectId !== next.objectId) issues.push('predecessor-object-mismatch')
        if (!previous || next.predecessorDigest !== previous.revisionDigest) issues.push('predecessor-digest-mismatch')
        if (previous && next.revisionDigest === previous.revisionDigest) issues.push('revision-unchanged')
      }
      if (!issues.length) verifyVersionRelationship(previous, next)
      return { consistent: issues.length === 0, transition: next.relation, issues, reviewInherited: false, authenticityVerified: false }
    }
    case 'audit-export-normalizer': {
      const events = input.events as { eventId: string; eventType: string; subjectDigest: string; occurredAt: string }[]
      if (events.some(e => !canonicalUtc(e.occurredAt))) throw new MicroInputError()
      // Explicit reconstruction: never rely on a type annotation to strip extra data.
      const exported = compileAuditExport(events.map(e => ({ eventId: e.eventId, eventType: e.eventType, subjectDigest: e.subjectDigest, occurredAt: e.occurredAt })))
      const ordered = exported.entries.sort((a, b) => compareText(a.occurredAt, b.occurredAt) || compareText(a.eventId, b.eventId))
      return { events: ordered, exportDigest: microDigest(ordered), completenessVerified: false, eventOccurrenceVerified: false }
    }
    case 'dimensional-consistency-check': {
      const actual = [...combineDimensions(input.left as DimensionVector, input.right as DimensionVector, input.operation as 'multiply' | 'divide')]
      return { dimensionOrder: ['length', 'mass', 'time', 'electric-current', 'temperature', 'amount-of-substance', 'luminous-intensity'],
        actual, expected: input.expected, consistent: canonicalMicro(actual) === canonicalMicro(input.expected), unitsConverted: false, formulaValidated: false }
    }
    case 'exact-interpolation-receipt':
    case 'sampled-series-integration': return numericResult(input, id)
    case 'evidence-conflict-comparator': {
      const observations = input.observations as Row[]
      if (new Set(observations.map(o => o.observationId)).size !== observations.length || observations.some(o => o.normalizedClaimId !== input.claimId || !(o.exactLocator as string).trim())) throw new MicroInputError()
      const eligible = observations.filter(o => o.population === input.population && o.outcome === input.outcome)
      const supporting = eligible.filter(o => o.direction === 'supports').map(o => o.observationId as string).sort()
      const opposing = eligible.filter(o => o.direction === 'opposes').map(o => o.observationId as string).sort()
      const mixed = eligible.filter(o => o.direction === 'mixed').map(o => o.observationId as string).sort()
      const excluded = observations.filter(o => !eligible.includes(o)).map(o => ({ observationId: o.observationId as string,
        reasons: [...(o.population !== input.population ? ['population-mismatch'] : []), ...(o.outcome !== input.outcome ? ['outcome-mismatch'] : [])] })).sort((a, b) => compareText(a.observationId, b.observationId))
      return { state: eligible.length < 2 ? 'insufficient-comparable-observations' : supporting.length && opposing.length ? 'conflict-observed' : 'no-conflict-observed', supporting, opposing, mixed, excluded, labelsIndependentlyVerified: false, consensusEstablished: false }
    }
    case 'astrology-experiment-plan-check': {
      if (![input.assessedAtUtc, input.startUtc, input.endUtc].every(canonicalUtc)) throw new MicroInputError()
      const analysis = input.analysis as Row, issues: string[] = []
      if ((input.startUtc as string) <= (input.assessedAtUtc as string)) issues.push('start-not-after-declared-assessment')
      if ((input.endUtc as string) <= (input.startUtc as string)) issues.push('end-not-after-start')
      if (input.comparator === 'none') issues.push('comparator-missing')
      if ((input.sampleSize as number) < 2) issues.push('fewer-than-two-observations-planned')
      if (analysis.missingData === 'unspecified') issues.push('missing-data-rule-unspecified')
      if (analysis.stoppingRule === 'unspecified') issues.push('stopping-rule-unspecified')
      if (analysis.multipleTesting === 'unspecified') issues.push('multiple-testing-rule-unspecified')
      return { state: issues.length ? 'revise' : 'declarations-complete', issues,
        assessedAgainst: 'maha-structured-low-stakes-plan/0.1', registered: false, trustedTimestamp: false,
        conventionVerified: false, randomizationVerified: false, powerAssessed: false, predictionValidated: false,
        note: 'Times, predictor, convention and plan digest are caller declarations. This is not admission to the private hypothesis registry.' }
    }
    default: return null
  }
}

export type MicroCorpusProvider = { releasePacket: (input: Row) => Promise<Row>; passagePacket: (input: Row) => Promise<Row> }
export async function buildMicroProduct(id: MicroProductId, supplied: unknown, corpus?: MicroCorpusProvider) {
  const input = parseMicroInput(id, supplied)
  let result: Row
  try {
    const core = coreResult(id, input)
    if (core) result = core
    else {
      const provider = corpus ?? await import('./micro-corpus.ts')
      result = id === 'release-bound-evidence-packet' ? await provider.releasePacket(input) : await provider.passagePacket(input)
    }
  } catch { throw new MicroInputError() }
  const body = { version: MICRO_VERSION, offerId: id, amountBaseUnits: MICRO_PRODUCTS[id].amount,
    inputDigest: microDigest(input), result, boundaries: [...MICRO_BOUNDARIES] }
  const response = { ...body, receiptDigest: microDigest(body) }
  if (Buffer.byteLength(canonicalMicro(response)) > MICRO_MAX_RESPONSE_BYTES || !schemaAccepts(microOutputSchema(id), response)) throw new MicroInputError()
  return response
}

/** No network or payment. Recomputes the result, not merely its self-declared hash. */
export async function verifyMicroProduct(id: MicroProductId, input: unknown, response: unknown, corpus?: MicroCorpusProvider): Promise<boolean> {
  try { return canonicalMicro(response) === canonicalMicro(await buildMicroProduct(id, input, corpus)) } catch { return false }
}
