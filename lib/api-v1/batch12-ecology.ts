import { z } from 'zod'
import { input, records, id, digest, utc, spec, hash, otherHash, time, later, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits } from './batch11-science-core.ts'

const category = 'ecology-observations', prefix = category + '-'
const boundary = 'Bounded public or synthetic nonpersonal observation metadata only. No names, precise coordinates, sensitive species locations, taxonomy lookup, abundance inference, ecological causation, field instructions or conservation certification. Non-detection is not proven absence; hashes do not anonymize data.'
const pins = { datasetRef: id, observationRef: id, eventRef: id, taxonRef: id, recordRevision: digest, observationDigest: digest, methodDigest: digest, scopeRef: id }
const row = { id: 'observation1', datasetRef: 'dataset1', observationRef: 'obs1', eventRef: 'event1', taxonRef: 'synthetic-taxon1', recordRevision: hash, observationDigest: hash, methodDigest: hash, scopeRef: 'public-metadata' }
const statement = (text: string) => text + '. ' + boundary
const units = ['individuals', 'trap-nights', 'observer-hours', 'square-metres', 'seconds', 'ratio', 'percent'] as const
const numeric = measurementAudits({ category, noun: 'ecology observation export metadata', quantities: ['count', 'sampling-effort', 'area', 'duration', 'fraction'], units,
  compatible: { count: ['individuals'], 'sampling-effort': ['trap-nights', 'observer-hours'], area: ['square-metres'], duration: ['seconds'], fraction: ['ratio', 'percent'] }, sampleQuantity: 'count', sampleUnit: 'individuals' })
const reference = spec(prefix + 'reference-integrity-map', statement('Bind each observation to exact dataset/event/method pins and a caller-declared start-inclusive, end-exclusive event window; do not infer taxonomic identity'),
  input({ events: records({ datasetRef: id, eventRef: id, methodDigest: digest, startsAt: utc, endsAt: utc }), rows: records({ ...pins, eventId: id, observedAt: utc }) }),
  { events: [{ id: 'e1', datasetRef: row.datasetRef, eventRef: row.eventRef, methodDigest: hash, startsAt: time, endsAt: later }], rows: [{ ...row, eventId: 'e1', observedAt: time }] },
  { events: [{ id: 'e1', datasetRef: row.datasetRef, eventRef: row.eventRef, methodDigest: otherHash, startsAt: time, endsAt: later }], rows: [{ ...row, eventId: 'e1', observedAt: time }] },
  [prefix + 'event-frame-mismatch', prefix + 'event-missing', prefix + 'observation-outside-event-window'], [prefix + 'bound-event-observations'], i => {
    unique(i.events.map(r => r.id)); unique(i.rows.map(r => r.id)); if (i.events.some(e => e.startsAt >= e.endsAt)) throw Error('invalid_ecology_event_window')
    const events = new Map(i.events.map(e => [e.id, e])); let bound = 0
    const findings = i.rows.flatMap(r => { const e = events.get(r.eventId); if (!e) return [f(prefix + 'event-missing', r.id)]; const issues = [...(e.datasetRef !== r.datasetRef || e.eventRef !== r.eventRef || e.methodDigest !== r.methodDigest ? [f(prefix + 'event-frame-mismatch', r.id)] : []), ...(r.observedAt < e.startsAt || r.observedAt >= e.endsAt ? [f(prefix + 'observation-outside-event-window', r.id)] : [])]; if (!issues.length) bound++; return issues })
    return { findings, metrics: [m(prefix + 'bound-event-observations', category, bound)] }
  })
const bound = spec(prefix + 'declared-bound-audit', statement('Compare counts and sampling effort with caller-defined inclusive count bounds and minimum effort in exact units. Unknown counts/effort stay unknown and contradictory detected/notDetected declarations are flagged'),
  input({ minimumCount: z.number().int().min(0).max(1e6), maximumCount: z.number().int().min(0).max(1e6), minimumEffort: z.number().int().min(1).max(1e6), effortUnit: z.enum(['trap-nights', 'observer-hours']), rows: records({ count: z.number().int().min(0).max(1e6).nullable(), effort: z.number().int().min(0).max(1e6).nullable(), effortUnit: z.enum(['trap-nights', 'observer-hours']), detection: z.enum(['detected', 'notDetected', 'unknown']) }) }),
  { minimumCount: 0, maximumCount: 10, minimumEffort: 1, effortUnit: 'trap-nights', rows: [{ id: 'r1', count: 2, effort: 1, effortUnit: 'trap-nights', detection: 'detected' }] },
  { minimumCount: 0, maximumCount: 10, minimumEffort: 1, effortUnit: 'trap-nights', rows: [{ id: 'r1', count: 11, effort: 1, effortUnit: 'trap-nights', detection: 'detected' }] },
  [prefix + 'count-outside-declared-bound', prefix + 'count-unknown', prefix + 'effort-unknown', prefix + 'effort-unit-mismatch', prefix + 'effort-below-policy', prefix + 'detection-count-conflict', prefix + 'detection-unknown'], [prefix + 'records-with-complete-compatible-count-and-effort'], i => {
    unique(i.rows.map(r => r.id)); if (i.minimumCount > i.maximumCount) throw Error('reversed_ecology_count_bounds'); let checked = 0
    const findings = i.rows.flatMap(r => { const issues = [...(r.count === null ? [f(prefix + 'count-unknown', r.id)] : r.count < i.minimumCount || r.count > i.maximumCount ? [f(prefix + 'count-outside-declared-bound', r.id)] : []), ...(r.effort === null ? [f(prefix + 'effort-unknown', r.id)] : []), ...(r.effortUnit !== i.effortUnit ? [f(prefix + 'effort-unit-mismatch', r.id)] : r.effort !== null && r.effort < i.minimumEffort ? [f(prefix + 'effort-below-policy', r.id)] : []), ...(r.count !== null && (r.detection === 'detected' && r.count === 0 || r.detection === 'notDetected' && r.count > 0) ? [f(prefix + 'detection-count-conflict', r.id)] : []), ...(r.detection === 'unknown' ? [f(prefix + 'detection-unknown', r.id)] : [])]; if (!issues.length) checked++; return issues })
    return { findings, metrics: [m(prefix + 'records-with-complete-compatible-count-and-effort', category, checked)] }
  })
const provenance = spec(prefix + 'provenance-edge-audit', statement('Bind supplied taxon references to exact taxonomy-revision and taxon-content pins. Matching declarations do not resolve taxonomy or validate an observation'),
  input({ taxa: records({ taxonRef: id, taxonomyRevision: digest, taxonDigest: digest }), rows: records({ ...pins, taxonId: id, taxonomyRevision: digest, taxonDigest: digest }) }),
  { taxa: [{ id: 't1', taxonRef: row.taxonRef, taxonomyRevision: hash, taxonDigest: hash }], rows: [{ ...row, taxonId: 't1', taxonomyRevision: hash, taxonDigest: hash }] },
  { taxa: [{ id: 't1', taxonRef: row.taxonRef, taxonomyRevision: otherHash, taxonDigest: hash }], rows: [{ ...row, taxonId: 't1', taxonomyRevision: hash, taxonDigest: hash }] },
  [prefix + 'taxon-provenance-pin-mismatch', prefix + 'taxon-provenance-missing'], [prefix + 'bound-taxonomy-declarations'], i => {
    unique(i.taxa.map(r => r.id)); unique(i.rows.map(r => r.id)); const taxa = new Map(i.taxa.map(r => [r.id, r])); let bound = 0
    const findings = i.rows.flatMap(r => { const t = taxa.get(r.taxonId); if (!t) return [f(prefix + 'taxon-provenance-missing', r.id)]; if (t.taxonRef !== r.taxonRef || t.taxonomyRevision !== r.taxonomyRevision || t.taxonDigest !== r.taxonDigest) return [f(prefix + 'taxon-provenance-pin-mismatch', r.id)]; bound++; return [] })
    return { findings, metrics: [m(prefix + 'bound-taxonomy-declarations', category, bound)] }
  })
export const BATCH12_ECOLOGY = scienceRecordSuite({ category, noun: 'public dataset/observation/event/taxon/method records', boundary, pins, sample: row,
  owner: 'datasetRef', subject: 'observationRef', revision: 'recordRevision', content: 'observationDigest', units, unitMeaning: 'observation and sampling measures' }, [...numeric.filter(s => !s.id.endsWith('declared-bound-audit')), reference, bound, provenance])
