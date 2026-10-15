import { z } from 'zod'
import { input, records, id, digest, spec, hash, otherHash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, scientificBoundary } from './batch11-science-core.ts'

const category = 'genomic-records', prefix = category + '-'
const convention = z.enum(['zero-based-half-open', 'one-based-closed'])
const coordinate = z.number().int().min(0).max(1e9), length = z.number().int().min(1).max(1e9)
const pins = { assemblyRef: id, contigRef: id, recordRevision: digest, sequenceDigest: digest, contigLength: length, coordinateConvention: convention, scopeRef: id }
const row = { id: 'contig-record1', assemblyRef: 'assembly-synthetic1', contigRef: 'contig1', recordRevision: hash, sequenceDigest: hash, contigLength: 100, coordinateConvention: 'zero-based-half-open', scopeRef: 'public-metadata' }
const statement = (text: string) => text + '. ' + scientificBoundary
const units = ['bases', 'reads', 'fold', 'ratio', 'percent'] as const
const numeric = measurementAudits({ category, noun: 'nonpersonal genomic export metrics', quantities: ['length', 'read-count', 'depth', 'fraction'], units,
  compatible: { length: ['bases'], 'read-count': ['reads'], depth: ['fold'], fraction: ['ratio', 'percent'] }, sampleQuantity: 'depth', sampleUnit: 'fold' })
const reference = spec(prefix + 'reference-integrity-map', statement('Check declared intervals against exact assembly/contig/version/digest/length pins. Coordinates require an explicit zero-based half-open or one-based closed convention; no conversion between assemblies or sequence lookup'),
  input({ contigs: records({ assemblyRef: id, contigRef: id, contigRevision: digest, sequenceDigest: digest, contigLength: length }), rows: records({ ...pins, contigId: id, contigRevision: digest, start: coordinate, end: coordinate }) }),
  { contigs: [{ id: 'c1', assemblyRef: row.assemblyRef, contigRef: row.contigRef, contigRevision: hash, sequenceDigest: hash, contigLength: 100 }], rows: [{ ...row, contigId: 'c1', contigRevision: hash, start: 0, end: 100 }] },
  { contigs: [{ id: 'c1', assemblyRef: row.assemblyRef, contigRef: row.contigRef, contigRevision: hash, sequenceDigest: hash, contigLength: 100 }], rows: [{ ...row, contigId: 'c1', contigRevision: hash, start: 0, end: 101 }] },
  [prefix + 'interval-outside-contig', prefix + 'contig-missing', prefix + 'contig-frame-mismatch', prefix + 'invalid-interval-order'], [prefix + 'bound-intervals', prefix + 'interval-length-bases'], i => {
    unique(i.contigs.map(r => r.id)); unique(i.rows.map(r => r.id)); const contigs = new Map(i.contigs.map(r => [r.id, r])); let bound = 0
    const metrics: ReturnType<typeof m>[] = []
    const findings = i.rows.flatMap(r => { const c = contigs.get(r.contigId), closed = r.coordinateConvention === 'one-based-closed'
      const issues = [...(r.start < (closed ? 1 : 0) || r.end > r.contigLength ? [f(prefix + 'interval-outside-contig', r.id)] : []), ...(!c ? [f(prefix + 'contig-missing', r.id)] : c.assemblyRef !== r.assemblyRef || c.contigRef !== r.contigRef || c.contigRevision !== r.contigRevision || c.sequenceDigest !== r.sequenceDigest || c.contigLength !== r.contigLength ? [f(prefix + 'contig-frame-mismatch', r.id)] : []), ...((closed ? r.start > r.end : r.start >= r.end) ? [f(prefix + 'invalid-interval-order', r.id)] : [])]
      // Do not emit lengths for invalid or unresolved references.
      if (!issues.length) { bound++; metrics.push(m(prefix + 'interval-length-bases', r.id, r.end - r.start + (closed ? 1 : 0))) }; return issues })
    return { findings, metrics: [m(prefix + 'bound-intervals', category, bound), ...metrics] }
  })
const bound = spec(prefix + 'declared-bound-audit', statement('Compare feature intervals with one caller-defined assembly/contig/revision/convention window; calculate union coverage of fully contained valid intervals without double counting overlaps. This is coordinate arithmetic, not biological coverage quality'),
  input({ assemblyRef: id, contigRef: id, revision: digest, coordinateConvention: convention, windowStart: coordinate, windowEnd: coordinate, rows: records({ assemblyRef: id, contigRef: id, revision: digest, coordinateConvention: convention, start: coordinate, end: coordinate }) }),
  { assemblyRef: row.assemblyRef, contigRef: row.contigRef, revision: hash, coordinateConvention: 'zero-based-half-open', windowStart: 0, windowEnd: 10, rows: [{ id: 'i1', assemblyRef: row.assemblyRef, contigRef: row.contigRef, revision: hash, coordinateConvention: 'zero-based-half-open', start: 0, end: 5 }] },
  { assemblyRef: row.assemblyRef, contigRef: row.contigRef, revision: hash, coordinateConvention: 'zero-based-half-open', windowStart: 0, windowEnd: 10, rows: [{ id: 'i1', assemblyRef: row.assemblyRef, contigRef: row.contigRef, revision: hash, coordinateConvention: 'zero-based-half-open', start: 0, end: 11 }] },
  [prefix + 'interval-outside-declared-window', prefix + 'window-frame-mismatch', prefix + 'invalid-interval-order'], [prefix + 'fully-contained-intervals', prefix + 'union-covered-bases'], i => {
    unique(i.rows.map(r => r.id)); const closed = i.coordinateConvention === 'one-based-closed', offset = closed ? 1 : 0
    if (i.windowStart < offset || (closed ? i.windowStart > i.windowEnd : i.windowStart >= i.windowEnd)) throw Error('invalid_genomic_window')
    let contained = 0; const spans: [number, number][] = []
    const findings = i.rows.flatMap(r => {
      if (r.assemblyRef !== i.assemblyRef || r.contigRef !== i.contigRef || r.revision !== i.revision || r.coordinateConvention !== i.coordinateConvention) return [f(prefix + 'window-frame-mismatch', r.id)]
      if (r.start < offset || (closed ? r.start > r.end : r.start >= r.end)) return [f(prefix + 'invalid-interval-order', r.id)]
      if (r.start < i.windowStart || r.end > i.windowEnd) return [f(prefix + 'interval-outside-declared-window', r.id)]
      contained++; spans.push([r.start - offset, r.end]); return []
    })
    spans.sort((a, b) => a[0] - b[0]); let covered = 0, start = -1, end = -1
    for (const span of spans) { if (start < 0) { [start, end] = span } else if (span[0] <= end) end = Math.max(end, span[1]); else { covered += end - start; [start, end] = span } }; if (start >= 0) covered += end - start
    return { findings, metrics: [m(prefix + 'fully-contained-intervals', category, contained), m(prefix + 'union-covered-bases', category, covered)] }
  })
const provenance = spec(prefix + 'provenance-edge-audit', statement('Bind contig records to exact assembly-manifest revision/digest declarations. An assembly identifier without the pinned revision is insufficient; no source bytes are downloaded and membership of the sequence in the assembly is not established'),
  input({ assemblies: records({ assemblyRef: id, revision: digest, manifestDigest: digest }), rows: records({ ...pins, assemblyId: id, assemblyRevision: digest, manifestDigest: digest }) }),
  { assemblies: [{ id: 'a1', assemblyRef: row.assemblyRef, revision: hash, manifestDigest: hash }], rows: [{ ...row, assemblyId: 'a1', assemblyRevision: hash, manifestDigest: hash }] },
  { assemblies: [{ id: 'a1', assemblyRef: row.assemblyRef, revision: otherHash, manifestDigest: hash }], rows: [{ ...row, assemblyId: 'a1', assemblyRevision: hash, manifestDigest: hash }] },
  [prefix + 'assembly-provenance-pin-mismatch', prefix + 'assembly-provenance-missing'], [prefix + 'bound-assembly-provenance'], i => {
    unique(i.assemblies.map(r => r.id)); unique(i.rows.map(r => r.id)); const assemblies = new Map(i.assemblies.map(r => [r.id, r])); let bound = 0
    const findings = i.rows.flatMap(r => { const a = assemblies.get(r.assemblyId); if (!a) return [f(prefix + 'assembly-provenance-missing', r.id)]; if (a.assemblyRef !== r.assemblyRef || a.revision !== r.assemblyRevision || a.manifestDigest !== r.manifestDigest) return [f(prefix + 'assembly-provenance-pin-mismatch', r.id)]; bound++; return [] })
    return { findings, metrics: [m(prefix + 'bound-assembly-provenance', category, bound)] }
  })
export const BATCH11_GENOMICS = scienceRecordSuite({ category, noun: 'nonpersonal assembly/contig/version/coordinate metadata', boundary: scientificBoundary, pins, sample: row,
  owner: 'assemblyRef', subject: 'contigRef', revision: 'recordRevision', content: 'sequenceDigest', units, unitMeaning: 'genomic export metrics' }, [...numeric.filter(s => !s.id.endsWith('declared-bound-audit')), reference, bound, provenance])
