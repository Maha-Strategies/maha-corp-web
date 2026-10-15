import { z } from 'zod'
import { input, object, records, list, id, digest, spec, hash, otherHash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits } from './batch11-science-core.ts'

const category = 'reaction-records', prefix = category + '-'
const boundary = 'Bounded public or synthetic reaction metadata and supplied integer composition declarations only. No chemical identity lookup, formula generation, synthesis instructions, recipe optimization, kinetic prediction, chemical feasibility or safety certification. A balanced declaration does not prove a reaction occurs.'
const pins = { datasetRef: id, reactionRef: id, recordRevision: digest, reactionDigest: digest, methodDigest: digest, scopeRef: id }
const row = { id: 'reaction1', datasetRef: 'dataset1', reactionRef: 'reaction-synthetic1', recordRevision: hash, reactionDigest: hash, methodDigest: hash, scopeRef: 'public-metadata' }
const statement = (text: string) => text + '. ' + boundary
const units = ['grams', 'milligrams', 'mol', 'mmol', 'ratio', 'percent', 'seconds'] as const
const numeric = measurementAudits({ category, noun: 'declared reaction record metrics', quantities: ['mass', 'amount', 'fraction', 'duration'], units,
  compatible: { mass: ['grams', 'milligrams'], amount: ['mol', 'mmol'], fraction: ['ratio', 'percent'], duration: ['seconds'] }, sampleQuantity: 'amount', sampleUnit: 'mol' })
const moleculePins = { datasetRef: id, speciesRef: id, compositionRevision: digest, compositionDigest: digest }
const reference = spec(prefix + 'reference-integrity-map', statement('Bind participant references to supplied dataset/species/composition-revision/digest records; identifiers and digest-shaped strings do not establish chemical identity'),
  input({ species: records(moleculePins), participants: records({ speciesId: id, ...moleculePins, side: z.enum(['reactant', 'product']), coefficient: z.number().int().min(1).max(1e6) }) }),
  { species: [{ id: 's1', datasetRef: row.datasetRef, speciesRef: 'species1', compositionRevision: hash, compositionDigest: hash }], participants: [{ id: 'p1', speciesId: 's1', datasetRef: row.datasetRef, speciesRef: 'species1', compositionRevision: hash, compositionDigest: hash, side: 'reactant', coefficient: 1 }] },
  { species: [{ id: 's1', datasetRef: row.datasetRef, speciesRef: 'species1', compositionRevision: otherHash, compositionDigest: hash }], participants: [{ id: 'p1', speciesId: 's1', datasetRef: row.datasetRef, speciesRef: 'species1', compositionRevision: hash, compositionDigest: hash, side: 'reactant', coefficient: 1 }] },
  [prefix + 'participant-composition-pin-mismatch', prefix + 'participant-species-missing'], [prefix + 'bound-participant-references'], i => {
    unique(i.species.map(r => r.id)); unique(i.participants.map(r => r.id)); const species = new Map(i.species.map(r => [r.id, r])); let bound = 0
    const findings = i.participants.flatMap(r => { const s = species.get(r.speciesId); if (!s) return [f(prefix + 'participant-species-missing', r.id)]; if (s.datasetRef !== r.datasetRef || s.speciesRef !== r.speciesRef || s.compositionRevision !== r.compositionRevision || s.compositionDigest !== r.compositionDigest) return [f(prefix + 'participant-composition-pin-mismatch', r.id)]; bound++; return [] })
    return { findings, metrics: [m(prefix + 'bound-participant-references', category, bound)] }
  })
const atoms = list(object({ elementRef: id, count: z.number().int().min(1).max(1e6) }), 1, 16)
const participant = { side: z.enum(['reactant', 'product']), coefficient: z.number().int().min(1).max(1e6), atoms, charge: z.number().int().min(-1e6).max(1e6) }
const balanceRows = [
  { id: 'h2', side: 'reactant', coefficient: 2, atoms: [{ elementRef: 'H', count: 2 }], charge: 0 },
  { id: 'o2', side: 'reactant', coefficient: 1, atoms: [{ elementRef: 'O', count: 2 }], charge: 0 },
  { id: 'water', side: 'product', coefficient: 2, atoms: [{ elementRef: 'H', count: 2 }, { elementRef: 'O', count: 1 }], charge: 0 },
]
const balance = spec(prefix + 'condition-coverage-map', statement('Check element-label and charge conservation with exact integer arithmetic over at most 32 participants, 16 element counts each and 64 distinct element labels overall; no isotope equivalence or chemical feasibility inference'),
  input({ participants: records(participant) }).refine(i => new Set(i.participants.flatMap(r => r.atoms.map(a => a.elementRef))).size <= 64, 'reaction_element_universe_over_64'), { participants: balanceRows }, { participants: balanceRows.map(r => r.id === 'water' ? { ...r, coefficient: 1 } : r) },
  [prefix + 'declared-element-imbalance', prefix + 'declared-charge-imbalance', prefix + 'reaction-side-missing'], [prefix + 'elements-with-equal-declared-counts', prefix + 'charge-delta', prefix + 'element-delta'], i => {
    unique(i.participants.map(r => r.id)); const deltas = new Map<string, bigint>(); let charge = 0n
    for (const r of i.participants) { unique(r.atoms.map(a => a.elementRef)); const coefficient = BigInt(r.coefficient) * (r.side === 'product' ? 1n : -1n); charge += coefficient * BigInt(r.charge); for (const a of r.atoms) deltas.set(a.elementRef, (deltas.get(a.elementRef) ?? 0n) + coefficient * BigInt(a.count)) }
    const entries = [...deltas].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    return { findings: [...(entries.some(([, n]) => n !== 0n) ? [f(prefix + 'declared-element-imbalance', ...i.participants.map(r => r.id))] : []), ...(charge !== 0n ? [f(prefix + 'declared-charge-imbalance', ...i.participants.map(r => r.id))] : []), ...(!i.participants.some(r => r.side === 'product') || !i.participants.some(r => r.side === 'reactant') ? [f(prefix + 'reaction-side-missing')] : [])],
      metrics: [m(prefix + 'elements-with-equal-declared-counts', category, entries.filter(([, n]) => n === 0n).length), m(prefix + 'charge-delta', category, charge), ...entries.map(([element, n]) => m(prefix + 'element-delta', element, n))] }
  })
const provenance = spec(prefix + 'provenance-edge-audit', statement('Bind reaction records to exact dataset/method/source-revision/content manifest pins; no proof of real experimental execution or causal provenance'),
  input({ sources: records({ datasetRef: id, methodDigest: digest, sourceRevision: digest, sourceDigest: digest }), rows: records({ ...pins, sourceId: id, sourceRevision: digest, sourceDigest: digest }) }),
  { sources: [{ id: 's1', datasetRef: row.datasetRef, methodDigest: hash, sourceRevision: hash, sourceDigest: hash }], rows: [{ ...row, sourceId: 's1', sourceRevision: hash, sourceDigest: hash }] },
  { sources: [{ id: 's1', datasetRef: row.datasetRef, methodDigest: hash, sourceRevision: hash, sourceDigest: otherHash }], rows: [{ ...row, sourceId: 's1', sourceRevision: hash, sourceDigest: hash }] },
  [prefix + 'reaction-source-pin-mismatch', prefix + 'reaction-source-missing'], [prefix + 'bound-reaction-sources'], i => {
    unique(i.sources.map(r => r.id)); unique(i.rows.map(r => r.id)); const sources = new Map(i.sources.map(r => [r.id, r])); let bound = 0
    const findings = i.rows.flatMap(r => { const s = sources.get(r.sourceId); if (!s) return [f(prefix + 'reaction-source-missing', r.id)]; if (s.datasetRef !== r.datasetRef || s.methodDigest !== r.methodDigest || s.sourceRevision !== r.sourceRevision || s.sourceDigest !== r.sourceDigest) return [f(prefix + 'reaction-source-pin-mismatch', r.id)]; bound++; return [] })
    return { findings, metrics: [m(prefix + 'bound-reaction-sources', category, bound)] }
  })
export const BATCH12_REACTIONS = scienceRecordSuite({ category, noun: 'dataset/reaction/method/revision declarations', boundary, pins, sample: row,
  owner: 'datasetRef', subject: 'reactionRef', revision: 'recordRevision', content: 'reactionDigest', units, unitMeaning: 'reaction measurement declarations' }, [...numeric.filter(s => !s.id.endsWith('condition-coverage-map')), reference, balance, provenance])
