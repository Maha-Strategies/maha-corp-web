import { objectSchema as o, arraySchema as a, textSchema as s, enumSchema as e, HASH_SCHEMA, type MicroSchema } from './micro-schema.ts'

/** Owner-approved distinct settlement amounts, 2026-09-13. */
export const COMPATIBILITY_PRODUCTS = {
  'celestial-result-compatibility': { amount: '7000', title: 'Celestial Result Compatibility Check', description: 'Compare two structured celestial result declarations using versioned rules. Reports mismatched conventions and missing prerequisites. No inferred settings, time/frame conversion, calculation verification or predictive validation.' },
  'evidence-frame-compatibility': { amount: '10500', title: 'Evidence-Frame Compatibility Check', description: 'Check up to ten declared claim-evidence relationships against a finite, versioned rule set. Reports unsupported frame transfers and missing information. Unknown combinations remain unresolved. No prose interpretation, source inspection or truth certification.' },
} as const
export type CompatibilityId = keyof typeof COMPATIBILITY_PRODUCTS
export const COMPATIBILITY_IDS = Object.keys(COMPATIBILITY_PRODUCTS) as CompatibilityId[]
export const isCompatibilityProduct = (id: string): id is CompatibilityId => Object.hasOwn(COMPATIBILITY_PRODUCTS, id)
const nullable = (schema: MicroSchema): MicroSchema => ({ oneOf: [schema, { type: 'null' }] })
const partial = (fields: Record<string, MicroSchema>): MicroSchema => ({ ...o(fields), required: [] })
const decimal: MicroSchema = { type: 'string', maxLength: 24, pattern: '^-?(0|[1-9][0-9]{0,6})(\\.[0-9]{1,12})?$' }
const date: MicroSchema = { type: 'string', maxLength: 10, pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' }
export const CELESTIAL_VOCABULARY = {
  resultKind: ['body-position', 'lunar-node-position', 'house-cusps'],
  targetBody: ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'lunar-node', 'house-cusps'],
  timeScale: ['UTC', 'TAI', 'TT', 'UT1', 'TDB'], origin: ['geocentric', 'topocentric'],
  coordinateFrame: ['ecliptic', 'equatorial'], frameEpoch: ['J2000.0', 'of-date'],
  precessionNutation: ['iau-2006-2000a', 'iau-1976-1980', 'none'],
  zodiac: ['tropical', 'sidereal', 'not-applicable'], positionConvention: ['apparent', 'geometric', 'not-applicable'],
  nodeConvention: ['mean', 'true', 'not-applicable'],
  houseSystem: ['placidus', 'koch', 'equal', 'whole-sign', 'porphyry', 'regiomontanus', 'campanus', 'not-applicable'],
} as const
// Nonempty unrecognized labels are accepted as declarations but never resolve positively.
const celestial = partial({
  ...Object.fromEntries(Object.keys(CELESTIAL_VOCABULARY).map(k => [k, nullable(s(80))])),
  julianDay: nullable(decimal),
  observer: nullable(partial({ longitudeDeg: nullable(decimal), latitudeDeg: nullable(decimal), heightMeters: nullable(decimal), datum: nullable(s(80)), latitudeType: nullable(s(80)), heightReference: nullable(s(80)) })),
  ayanamsa: nullable(partial({ modelId: nullable(s(80)), definitionVersion: nullable(s(80)) })),
})
const pair = partial({
  pairId: s(80), claimType: nullable(s(80)), evidenceType: nullable(s(80)), sourceRole: nullable(s(80)),
  claimScope: nullable(s(160)), evidenceScope: nullable(s(160)), sourceId: nullable(s(160)), locator: nullable(s(160)),
  claimAsOfDate: nullable(date), evidencePublishedDate: nullable(date),
  claimEdition: nullable(s(160)), evidenceEdition: nullable(s(160)),
  eventDate: nullable(date), coverageStart: nullable(date), coverageEnd: nullable(date),
})
export const COMPATIBILITY_INPUT_SCHEMAS: Record<CompatibilityId, MicroSchema> = {
  'celestial-result-compatibility': o({ dataClass: e('public', 'synthetic'), left: celestial, right: celestial }),
  'evidence-frame-compatibility': o({ dataClass: e('public', 'synthetic'), pairs: a(pair, 1, 10) }),
}
const issue = o({ ruleId: s(100), field: s(100), explanation: s(600), neededNext: s(600) })
const issues = a(issue, 0, 80)
const no: MicroSchema = { type: 'boolean', enum: [false] }
export const COMPATIBILITY_RESULT_SCHEMAS: Record<CompatibilityId, MicroSchema> = {
  'celestial-result-compatibility': o({ ruleSetVersion: s(100), ruleSetDigest: HASH_SCHEMA,
    state: e('compatible-declared-conventions', 'incompatible-declared-conventions', 'insufficient-information'),
    fields: a(o({ field: s(100), left: nullable(s(200)), right: nullable(s(200)), state: e('match', 'different', 'missing-or-unsupported', 'not-applicable'), ruleId: s(100) }), 1, 40),
    issues, missingPrerequisites: a(s(100), 0, 80), calculationsVerified: no, conventionsInferred: no, conversionPerformed: no, predictionValidated: no }),
  'evidence-frame-compatibility': o({ ruleSetVersion: s(100), ruleSetDigest: HASH_SCHEMA,
    pairs: a(o({ index: { type: 'integer', minimum: 0, maximum: 9 }, pairId: nullable(s(80)), state: e('declared-frames-compatible', 'frame-transfer-not-justified', 'required-information-missing'), issues,
      matchedRuleId: nullable(s(100)) }), 1, 10), arbitraryProseRead: no, sourcesInspected: no, assertionsVerified: no }),
}
export const CELESTIAL_EXAMPLE = {
  resultKind: 'body-position', targetBody: 'moon', julianDay: '2461296.5', timeScale: 'TT',
  origin: 'geocentric', coordinateFrame: 'ecliptic', frameEpoch: 'of-date', precessionNutation: 'iau-2006-2000a',
  zodiac: 'sidereal', ayanamsa: { modelId: 'lahiri', definitionVersion: 'caller-pinned-v1' },
  positionConvention: 'apparent', nodeConvention: 'not-applicable', houseSystem: 'not-applicable',
}
export const EVIDENCE_EXAMPLE = {
  pairId: 'synthetic-vendor-performance', claimType: 'independent-performance', evidenceType: 'vendor-brochure', sourceRole: 'vendor',
  claimScope: 'synthetic-model-v1-test-a', evidenceScope: 'synthetic-model-v1-test-a', sourceId: 'synthetic-brochure', locator: 'page-2',
  claimAsOfDate: '2026-09-13', evidencePublishedDate: '2026-09-01',
}
export const COMPATIBILITY_SAMPLES: Record<CompatibilityId, Record<string, unknown>> = {
  'celestial-result-compatibility': { dataClass: 'synthetic', left: CELESTIAL_EXAMPLE, right: { ...CELESTIAL_EXAMPLE, zodiac: 'tropical', ayanamsa: null } },
  'evidence-frame-compatibility': { dataClass: 'synthetic', pairs: [EVIDENCE_EXAMPLE] },
}
