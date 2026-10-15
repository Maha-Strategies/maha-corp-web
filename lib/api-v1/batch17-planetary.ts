import { z } from 'zod'
import { input, records, id, digest, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, samePins } from './batch11-science-core.ts'
import { framedMeasurementAudits } from './batch15-framed-measurements.ts'
import { declaredEpochOrder } from './batch16-time-series.ts'

const category = 'planetary-measurements', prefix = category + '-'
const boundary = 'Caller-supplied public or synthetic planetary export metadata only. No PDS label parsing or standards conformance, source lookup, coordinate/longitude/latitude or unit conversion, physical-validity inference, orbit computation, navigation or safety certification. Declared source/model digests do not verify bytes.'
const frame = { datasetRef: id, targetRef: id, siteRef: id, coordinateFrameRef: id, longitudeConventionRef: id, latitudeConventionRef: id, timeScaleRef: id, epochOriginRef: id, tickUnitRef: id, methodDigest: digest, recordRevision: digest }
const sample = { datasetRef: 'planetary1', targetRef: 'synthetic-planet1', siteRef: 'site1', coordinateFrameRef: 'declared-frame1', longitudeConventionRef: 'declared-east-positive', latitudeConventionRef: 'declared-planetocentric', timeScaleRef: 'declared-scale1', epochOriginRef: 'declared-origin1', tickUnitRef: 'declared-seconds', methodDigest: hash, recordRevision: hash }
const quantities = ['radius', 'latitude', 'longitude', 'temperature', 'pressure', 'albedo'] as const
const units = ['kilometres', 'metres', 'degrees', 'radians', 'kelvin', 'degrees-celsius', 'pascal', 'bar', 'ratio'] as const
const compatible = { radius: ['kilometres', 'metres'], latitude: ['degrees', 'radians'], longitude: ['degrees', 'radians'], temperature: ['kelvin', 'degrees-celsius'], pressure: ['pascal', 'bar'], albedo: ['ratio'] }
const numeric = framedMeasurementAudits({ category, boundary, frame, sample: { id: 'm1', ...sample }, quantities, units, compatible, sampleQuantity: 'radius', sampleUnit: 'kilometres' })
const coverage = spec(prefix + 'condition-coverage-map', 'Check one exact declared observation per requested quantity at one site and epoch, with identical target, coordinate conventions, time basis, method and revision. Unknown, duplicate, missing and undeclared quantities are findings. Availability is not physical consistency, full spatial coverage or empirical truth. ' + boundary,
  input({ ...frame, epochRef: id, requiredQuantities: z.array(z.enum(quantities)).min(1).max(6), rows: records({ ...frame, epochRef: id, quantity: z.enum(quantities), unit: z.enum(units), value: z.number().finite().min(-1e9).max(1e9).nullable(), qualifier: z.enum(['exact', 'unknown']) }, 0) }),
  { ...sample, epochRef: 'epoch1', requiredQuantities: ['radius'], rows: [{ id: 'm1', ...sample, epochRef: 'epoch1', quantity: 'radius', unit: 'kilometres', value: 1, qualifier: 'exact' }] },
  { ...sample, epochRef: 'epoch1', requiredQuantities: ['radius'], rows: [] },
  [prefix + 'quantity-not-established', prefix + 'measurement-frame-mismatch', prefix + 'quantity-undeclared', prefix + 'measurement-not-exact', prefix + 'quantity-unit-mismatch'], [prefix + 'established-requested-quantities'], i => {
    unique(i.requiredQuantities); unique(i.rows.map(r => r.id)); let established = 0
    const issues = (r: typeof i.rows[number]) => [...(!samePins(r, i, Object.keys(frame)) || r.epochRef !== i.epochRef ? [f(prefix + 'measurement-frame-mismatch', r.id)] : []), ...(r.value === null || r.qualifier !== 'exact' ? [f(prefix + 'measurement-not-exact', r.id)] : []), ...(!compatible[r.quantity].includes(r.unit) ? [f(prefix + 'quantity-unit-mismatch', r.id)] : [])]
    const findings = i.requiredQuantities.flatMap(q => { const matches = i.rows.filter(r => r.quantity === q); if (matches.length === 1 && issues(matches[0]).length === 0) { established++; return [] }; return [f(prefix + 'quantity-not-established', q)] })
    findings.push(...i.rows.flatMap(r => [...issues(r), ...(!i.requiredQuantities.includes(r.quantity) ? [f(prefix + 'quantity-undeclared', r.id)] : [])]))
    return { findings, metrics: [m(prefix + 'established-requested-quantities', category, established)] }
  })
export const BATCH17_PLANETARY = scienceRecordSuite({ category, noun: 'target/site/convention/time/method-pinned planetary measurements', boundary,
  pins: { ...frame, exportDigest: digest, scopeRef: id }, sample: { id: 'planet1', ...sample, exportDigest: hash, scopeRef: 'public-metadata' }, owner: 'datasetRef', subject: 'targetRef', revision: 'recordRevision', content: 'exportDigest', units, unitMeaning: 'planetary quantities' },
  [...numeric, declaredEpochOrder({ category, boundary, frame, sample }), coverage])
