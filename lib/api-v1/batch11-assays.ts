import { input, records, id, digest, spec, hash, otherHash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, scientificBoundary } from './batch11-science-core.ts'

const category = 'biology-assays', prefix = category + '-'
const pins = { studyRef: id, assayRef: id, recordRevision: digest, measurementsDigest: digest, protocolDigest: digest, batchRef: id, scopeRef: id }
const row = { id: 'assay1', studyRef: 'study1', assayRef: 'assay-run1', recordRevision: hash, measurementsDigest: hash, protocolDigest: hash, batchRef: 'batch1', scopeRef: 'public-metadata' }
const statement = (text: string) => text + '. ' + scientificBoundary
const units = ['mg-per-L', 'ug-per-L', 'AU', 'seconds', 'celsius', 'count', 'ratio', 'percent'] as const
const numeric = measurementAudits({ category, noun: 'assay measurement exports', quantities: ['concentration', 'signal', 'duration', 'temperature', 'count', 'fraction'], units,
  compatible: { concentration: ['mg-per-L', 'ug-per-L'], signal: ['AU'], duration: ['seconds'], temperature: ['celsius'], count: ['count'], fraction: ['ratio', 'percent'] }, sampleQuantity: 'concentration', sampleUnit: 'mg-per-L' })
const reference = spec(prefix + 'reference-integrity-map', statement('Bind assay exports to the exact study and protocol digest. A protocol reference is metadata, not a validated wet-lab procedure'),
  input({ protocols: records({ studyRef: id, protocolDigest: digest }), rows: records({ ...pins, protocolId: id }) }),
  { protocols: [{ id: 'p1', studyRef: row.studyRef, protocolDigest: hash }], rows: [{ ...row, protocolId: 'p1' }] },
  { protocols: [{ id: 'p1', studyRef: row.studyRef, protocolDigest: otherHash }], rows: [{ ...row, protocolId: 'p1' }] },
  [prefix + 'protocol-frame-mismatch', prefix + 'protocol-missing'], [prefix + 'bound-protocol-records'], i => {
    unique(i.protocols.map(r => r.id)); unique(i.rows.map(r => r.id)); const protocols = new Map(i.protocols.map(r => [r.id, r])); let bound = 0
    const findings = i.rows.flatMap(r => { const p = protocols.get(r.protocolId); if (!p) return [f(prefix + 'protocol-missing', r.id)]; if (p.studyRef !== r.studyRef || p.protocolDigest !== r.protocolDigest) return [f(prefix + 'protocol-frame-mismatch', r.id)]; bound++; return [] })
    return { findings, metrics: [m(prefix + 'bound-protocol-records', category, bound)] }
  })
const provenance = spec(prefix + 'provenance-edge-audit', statement('Bind assay-to-source edges to an exact study/batch/protocol/source-revision frame and digest. This is source linkage, not execution provenance'),
  input({ sources: records({ studyRef: id, batchRef: id, protocolDigest: digest, sourceRevision: digest, sourceDigest: digest }), rows: records({ ...pins, sourceId: id, sourceRevision: digest, sourceDigest: digest }) }),
  { sources: [{ id: 's1', studyRef: row.studyRef, batchRef: row.batchRef, protocolDigest: hash, sourceRevision: hash, sourceDigest: hash }], rows: [{ ...row, sourceId: 's1', sourceRevision: hash, sourceDigest: hash }] },
  { sources: [{ id: 's1', studyRef: row.studyRef, batchRef: row.batchRef, protocolDigest: hash, sourceRevision: hash, sourceDigest: otherHash }], rows: [{ ...row, sourceId: 's1', sourceRevision: hash, sourceDigest: hash }] },
  [prefix + 'source-provenance-pin-mismatch', prefix + 'source-provenance-missing'], [prefix + 'bound-source-provenance'], i => {
    unique(i.sources.map(r => r.id)); unique(i.rows.map(r => r.id)); const sources = new Map(i.sources.map(r => [r.id, r])); let bound = 0
    const findings = i.rows.flatMap(r => { const s = sources.get(r.sourceId); if (!s) return [f(prefix + 'source-provenance-missing', r.id)]; if (s.studyRef !== r.studyRef || s.batchRef !== r.batchRef || s.protocolDigest !== r.protocolDigest || s.sourceRevision !== r.sourceRevision || s.sourceDigest !== r.sourceDigest) return [f(prefix + 'source-provenance-pin-mismatch', r.id)]; bound++; return [] })
    return { findings, metrics: [m(prefix + 'bound-source-provenance', category, bound)] }
  })
export const BATCH11_ASSAYS = scienceRecordSuite({ category, noun: 'assay study/batch/protocol/export metadata', boundary: scientificBoundary, pins, sample: row,
  owner: 'studyRef', subject: 'assayRef', revision: 'recordRevision', content: 'measurementsDigest', units, unitMeaning: 'assay measurements' }, [...numeric, reference, provenance])
