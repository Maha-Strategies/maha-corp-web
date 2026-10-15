import { input, records, id, digest, spec, hash, otherHash, unique, finding as f, metric as m, type AuditSpec } from './batch5-core.ts'
import type { SciencePolicy } from './batch11-science-core.ts'

export const materialBoundary = 'Bounded public or synthetic nonpersonal material metadata only. No synthesis instructions, recipe optimization, material selection, property prediction, chemical identity lookup, engineering safety, source authenticity or performance certification. Digests are caller-supplied pins, not independently verified bytes.'

/** Exact reduced rational values avoid rounding and remain within the closed
 * response's 80-character metric bound for the declared integer input limits. */
export function rational(n: bigint, d: bigint): string {
  if (d <= 0n) throw Error('nonpositive_material_denominator')
  let a = n < 0n ? -n : n, b = d
  while (b !== 0n) { const next = a % b; a = b; b = next }
  const numerator = n / a, denominator = d / a
  return denominator === 1n ? String(numerator) : `${numerator}/${denominator}`
}

/** A material lot and a measurement source are different links: the former
 * pins physical-lot declarations, the latter pins method/export provenance.
 * Neither resolves remote identities, signatures or source bytes. */
export function materialBindingAudits(p: SciencePolicy, materialKey: string): AuditSpec[] {
  const prefix = p.category + '-', row = p.sample
  const lot = { id: 'lot1', datasetRef: row.datasetRef, materialRef: row[materialKey], materialLotRef: row.materialLotRef, lotRevision: hash, materialDigest: hash }
  const source = { id: 'source1', datasetRef: row.datasetRef, materialRef: row[materialKey], materialLotRef: row.materialLotRef, methodDigest: row.methodDigest, sourceRevision: hash, sourceDigest: hash }
  return [
    spec(prefix + 'reference-integrity-map', 'Bind measurement rows to the exact supplied dataset/material/lot/revision/content declarations. ' + materialBoundary,
      input({ lots: records({ datasetRef: id, materialRef: id, materialLotRef: id, lotRevision: digest, materialDigest: digest }), rows: records({ ...p.pins, lotId: id, lotRevision: digest, materialDigest: digest }) }),
      { lots: [lot], rows: [{ ...row, lotId: 'lot1', lotRevision: hash, materialDigest: hash }] },
      { lots: [{ ...lot, lotRevision: otherHash }], rows: [{ ...row, lotId: 'lot1', lotRevision: hash, materialDigest: hash }] },
      [prefix + 'material-lot-pin-mismatch', prefix + 'material-lot-missing'], [prefix + 'bound-material-lot-references'], i => {
        unique(i.lots.map(r => r.id)); unique(i.rows.map(r => r.id)); const lots = new Map(i.lots.map(r => [r.id, r])); let bound = 0
        const findings = i.rows.flatMap(r => { const declared: Record<string, unknown> = r, lot = lots.get(r.lotId); if (!lot) return [f(prefix + 'material-lot-missing', r.id)]; if (lot.datasetRef !== declared.datasetRef || lot.materialRef !== declared[materialKey] || lot.materialLotRef !== declared.materialLotRef || lot.lotRevision !== r.lotRevision || lot.materialDigest !== r.materialDigest) return [f(prefix + 'material-lot-pin-mismatch', r.id)]; bound++; return [] })
        return { findings, metrics: [m(prefix + 'bound-material-lot-references', p.category, bound)] }
      }),
    spec(prefix + 'provenance-edge-audit', 'Bind measurement rows to exact dataset/material/lot/method/source-revision/content manifests; matching pins do not prove experimental execution. ' + materialBoundary,
      input({ sources: records({ datasetRef: id, materialRef: id, materialLotRef: id, methodDigest: digest, sourceRevision: digest, sourceDigest: digest }), rows: records({ ...p.pins, sourceId: id, sourceRevision: digest, sourceDigest: digest }) }),
      { sources: [source], rows: [{ ...row, sourceId: 'source1', sourceRevision: hash, sourceDigest: hash }] },
      { sources: [{ ...source, methodDigest: otherHash }], rows: [{ ...row, sourceId: 'source1', sourceRevision: hash, sourceDigest: hash }] },
      [prefix + 'measurement-source-pin-mismatch', prefix + 'measurement-source-missing'], [prefix + 'bound-measurement-sources'], i => {
        unique(i.sources.map(r => r.id)); unique(i.rows.map(r => r.id)); const sources = new Map(i.sources.map(r => [r.id, r])); let bound = 0
        const findings = i.rows.flatMap(r => { const declared: Record<string, unknown> = r, s = sources.get(r.sourceId); if (!s) return [f(prefix + 'measurement-source-missing', r.id)]; if (s.datasetRef !== declared.datasetRef || s.materialRef !== declared[materialKey] || s.materialLotRef !== declared.materialLotRef || s.methodDigest !== declared.methodDigest || s.sourceRevision !== r.sourceRevision || s.sourceDigest !== r.sourceDigest) return [f(prefix + 'measurement-source-pin-mismatch', r.id)]; bound++; return [] })
        return { findings, metrics: [m(prefix + 'bound-measurement-sources', p.category, bound)] }
      }),
  ]
}
