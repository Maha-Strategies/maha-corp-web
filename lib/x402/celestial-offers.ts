import type { X402Offer } from './offers.ts'
import type { JsonSchema } from './offer-schemas.ts'
import { CELESTIAL_PRODUCTS, CELESTIAL_PRODUCT_VERSION, CELESTIAL_MAX_REQUEST_BYTES, CELESTIAL_UTC_PATTERN,
  SYNTHETIC_CALCULATION_INPUTS, buildCelestialProduct, type CelestialProductId } from './celestial-products.ts'

const descriptions: Record<CelestialProductId, string> = {
  'celestial-position-snapshot': 'Calculate seven classical-body geocentric longitudes at one UTC instant in Tropical and versioned Lahiri Sidereal frames. Includes explicit conventions and a deterministic integrity receipt. Public or synthetic inputs only. No interpretations, forecasts, LLM calls, or predictive certification. Bodies and receipt digests are not stored.',
  'celestial-chart-evidence': 'Calculate one UTC chart with Tropical and Lahiri Sidereal positions, Sidereal whole-sign houses, mean nodes, geometric aspects and panchanga. Includes numerical limitations and a deterministic integrity receipt. Public or synthetic inputs only. No forecasting narrative, LLM calls or predictive certification. Bodies and receipt digests are not stored.',
  'celestial-vimshottari-timing': 'Calculate Vimshottari birth balance, nine mahadashas and nine antardashas of the active mahadasha at one reference instant. Uses actual nakshatra stay time and a 365.2425-day year. Includes conventions and deterministic receipt. Public or synthetic inputs only. No event prediction, interpretation or LLM calls. Bodies and receipt digests are not stored.',
}
const digestSchema = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' }
const utcSchema = { type: 'string', pattern: CELESTIAL_UTC_PATTERN, description: 'Canonical UTC ISO instant with milliseconds, 1600–2099 inclusive; impossible dates rejected.' }
function inputSchema(id: CelestialProductId): JsonSchema {
  const properties: Record<string, JsonSchema> = { dataClass: { type: 'string', enum: ['public', 'synthetic'] }, instantUtc: utcSchema }
  if (id !== 'celestial-position-snapshot') {
    properties.latitudeDegrees = { type: 'number', minimum: -89.9, maximum: 89.9 }
    properties.longitudeDegrees = { type: 'number', minimum: -180, maximum: 180 }
  }
  if (id === 'celestial-vimshottari-timing') properties.referenceInstantUtc = { ...utcSchema, description: 'At or after instantUtc and less than 100 × 365.2425 days later, also within 1600–2099.' }
  return { type: 'object', additionalProperties: false, properties, required: Object.keys(properties) }
}
function resultSchema(id: CelestialProductId): JsonSchema {
  if (id === 'celestial-position-snapshot') return { type: 'object', additionalProperties: false,
    required: ['instantUtc', 'ayanamsaDegrees', 'positions'], properties: {
      instantUtc: utcSchema, ayanamsaDegrees: { type: 'number' }, positions: { type: 'array', minItems: 7, maxItems: 7,
        items: { type: 'object', additionalProperties: false, required: ['body', 'tropicalLongitude', 'siderealLongitude'], properties: {
          body: { type: 'string', enum: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] },
          tropicalLongitude: { type: 'number', minimum: 0, maximum: 360 }, siderealLongitude: { type: 'number', minimum: 0, maximum: 360 },
        } } },
    } }
  const properties = id === 'celestial-chart-evidence'
    ? { chart: { type: 'object', required: ['version', 'instantUtc', 'placements', 'houses', 'aspects', 'ascendant', 'methodology'] },
      panchanga: { type: 'object', required: ['version', 'tithi', 'nakshatra', 'yoga', 'karana', 'uncertainLimbs'] } }
    : { referenceInstantUtc: utcSchema, vimshottari: { type: 'object', required: ['system', 'birthNakshatraIngressUtc', 'birthNakshatraEgressUtc', 'balanceMethod', 'balanceAtBirthYears', 'yearLengthDays', 'mahadashas', 'antardashas', 'activeMahadasha', 'activeAntardasha'],
      properties: { system: { const: 'vimshottari-120-year' }, yearLengthDays: { const: 365.2425 },
        mahadashas: { type: 'array', minItems: 9, maxItems: 9 }, antardashas: { type: 'array', minItems: 9, maxItems: 9 } } } }
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties }
}
export const CELESTIAL_OFFERS: readonly X402Offer[] = (Object.keys(CELESTIAL_PRODUCTS) as CelestialProductId[]).map(id => {
  const output = buildCelestialProduct(id, SYNTHETIC_CALCULATION_INPUTS[id])
  return {
    id, method: 'POST', ...CELESTIAL_PRODUCTS[id], description: descriptions[id], concurrencyCap: 4,
    serviceName: 'Maha Celestial Calculations', tags: ['astronomy', 'calculation', 'tropical', 'sidereal', 'reproducibility'],
    status: 'available', availability: { payableInProduction: true, blockedBy: [] },
    requiresIdempotency: false, maxRequestBytes: CELESTIAL_MAX_REQUEST_BYTES,
    capabilityBoundaries: output.boundaries,
    retention: { fullSourceTextStored: false, verbatimExcerptsRetained: false,
      retainedFields: ['payment transaction', 'payer wallet', 'fixed offer URL', 'amount', 'settlement status', 'coarse invocation counts'],
      note: 'Request bodies, result bodies and their digests are not persisted by this service. Birth data must not be put in URLs or payment metadata. v0.1 accepts public or synthetic inputs only. Save the returned payload locally; this stateless service has no stored result recovery after network loss.' },
    discovery: { input: { ...SYNTHETIC_CALCULATION_INPUTS[id] }, inputSchema: inputSchema(id), output,
      outputSchema: { type: 'object', additionalProperties: false,
        required: ['version', 'offerId', 'inputDigest', 'result', 'conventions', 'boundaries', 'receiptDigest'],
        properties: { version: { const: CELESTIAL_PRODUCT_VERSION }, offerId: { const: id }, inputDigest: digestSchema,
          result: resultSchema(id), conventions: { type: 'object' }, boundaries: { type: 'array', items: { type: 'string' } }, receiptDigest: digestSchema } } },
  }
})
