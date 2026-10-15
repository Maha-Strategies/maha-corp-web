import { input, records, id, digest, spec, hash, otherHash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, scientificBoundary } from './batch11-science-core.ts'

const category = 'protein-measurements', prefix = category + '-'
const pins = { datasetRef: id, proteinRef: id, isoformRef: id, sequenceRevision: digest, sequenceDigest: digest, recordRevision: digest, measurementsDigest: digest, scopeRef: id }
const row = { id: 'protein1', datasetRef: 'dataset1', proteinRef: 'protein-synthetic1', isoformRef: 'isoform1', sequenceRevision: hash, sequenceDigest: hash, recordRevision: hash, measurementsDigest: hash, scopeRef: 'public-metadata' }
const statement = (text: string) => text + '. ' + scientificBoundary
const units = ['mg-per-mL', 'ug-per-mL', 'mol-per-L', 'nmol-per-L', 'AU', 'ratio', 'percent', 'kDa', 'Da', 'seconds'] as const
const numeric = measurementAudits({ category, noun: 'protein measurement records', quantities: ['mass-concentration', 'molar-concentration', 'signal', 'fraction', 'mass', 'duration'], units,
  compatible: { 'mass-concentration': ['mg-per-mL', 'ug-per-mL'], 'molar-concentration': ['mol-per-L', 'nmol-per-L'], signal: ['AU'], fraction: ['ratio', 'percent'], mass: ['kDa', 'Da'], duration: ['seconds'] }, sampleQuantity: 'mass-concentration', sampleUnit: 'mg-per-mL' })
const proteinPins = { proteinRef: id, isoformRef: id, sequenceRevision: digest, sequenceDigest: digest }
const reference = spec(prefix + 'reference-integrity-map', statement('Bind measurements to exact protein/isoform/sequence-revision/digest declarations without fetching or inferring sequence identity, structure or function'),
  input({ proteins: records(proteinPins), rows: records({ ...pins, proteinId: id }) }),
  { proteins: [{ id: 'p1', proteinRef: row.proteinRef, isoformRef: row.isoformRef, sequenceRevision: hash, sequenceDigest: hash }], rows: [{ ...row, proteinId: 'p1' }] },
  { proteins: [{ id: 'p1', proteinRef: row.proteinRef, isoformRef: 'isoform2', sequenceRevision: hash, sequenceDigest: hash }], rows: [{ ...row, proteinId: 'p1' }] },
  [prefix + 'protein-frame-mismatch', prefix + 'protein-reference-missing'], [prefix + 'bound-protein-references'], i => {
    unique(i.proteins.map(r => r.id)); unique(i.rows.map(r => r.id)); const proteins = new Map(i.proteins.map(r => [r.id, r])); let bound = 0
    const findings = i.rows.flatMap(r => { const p = proteins.get(r.proteinId); if (!p) return [f(prefix + 'protein-reference-missing', r.id)]; if (p.proteinRef !== r.proteinRef || p.isoformRef !== r.isoformRef || p.sequenceRevision !== r.sequenceRevision || p.sequenceDigest !== r.sequenceDigest) return [f(prefix + 'protein-frame-mismatch', r.id)]; bound++; return [] })
    return { findings, metrics: [m(prefix + 'bound-protein-references', category, bound)] }
  })
const provenance = spec(prefix + 'provenance-edge-audit', statement('Bind protein measurements to exact dataset/protein/isoform/sequence/method source manifests. Pin consistency does not verify protein abundance or molecular provenance'),
  input({ sources: records({ datasetRef: id, ...proteinPins, methodDigest: digest, artifactDigest: digest }), rows: records({ ...pins, sourceId: id, methodDigest: digest, artifactDigest: digest }) }),
  { sources: [{ id: 's1', datasetRef: row.datasetRef, proteinRef: row.proteinRef, isoformRef: row.isoformRef, sequenceRevision: hash, sequenceDigest: hash, methodDigest: hash, artifactDigest: hash }], rows: [{ ...row, sourceId: 's1', methodDigest: hash, artifactDigest: hash }] },
  { sources: [{ id: 's1', datasetRef: row.datasetRef, proteinRef: row.proteinRef, isoformRef: row.isoformRef, sequenceRevision: hash, sequenceDigest: hash, methodDigest: hash, artifactDigest: otherHash }], rows: [{ ...row, sourceId: 's1', methodDigest: hash, artifactDigest: hash }] },
  [prefix + 'source-provenance-pin-mismatch', prefix + 'source-provenance-missing'], [prefix + 'bound-source-provenance'], i => {
    unique(i.sources.map(r => r.id)); unique(i.rows.map(r => r.id)); const sources = new Map(i.sources.map(r => [r.id, r])); let bound = 0
    const findings = i.rows.flatMap(r => { const s = sources.get(r.sourceId); if (!s) return [f(prefix + 'source-provenance-missing', r.id)]; if (s.datasetRef !== r.datasetRef || s.proteinRef !== r.proteinRef || s.isoformRef !== r.isoformRef || s.sequenceRevision !== r.sequenceRevision || s.sequenceDigest !== r.sequenceDigest || s.methodDigest !== r.methodDigest || s.artifactDigest !== r.artifactDigest) return [f(prefix + 'source-provenance-pin-mismatch', r.id)]; bound++; return [] })
    return { findings, metrics: [m(prefix + 'bound-source-provenance', category, bound)] }
  })
export const BATCH11_PROTEINS = scienceRecordSuite({ category, noun: 'protein/isoform/sequence-pinned measurement exports', boundary: scientificBoundary, pins, sample: row,
  owner: 'datasetRef', subject: 'proteinRef', revision: 'recordRevision', content: 'measurementsDigest', units, unitMeaning: 'protein measurements' }, [...numeric, reference, provenance])
