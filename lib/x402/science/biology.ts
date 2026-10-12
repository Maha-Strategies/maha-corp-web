import { requireCondition as check, positive, finite, linearFit, mean, unique } from './math.ts'
type Input = Record<string, unknown>
const residueMass: Record<string, number> = { A: 71.0788, R: 156.1875, N: 114.1038, D: 115.0886, C: 103.1388, E: 129.1155, Q: 128.1307, G: 57.0519, H: 137.1411, I: 113.1594, L: 113.1594, K: 128.1741, M: 131.1926, F: 147.1766, P: 97.1167, S: 87.0782, T: 101.1051, W: 186.2132, Y: 163.1760, V: 99.1326 }
function alignment(left: string, right: string) {
  const m = left.length, n = right.length, gap = -2
  const scores = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let a = 0; a <= m; a++) scores[a][0] = a * gap
  for (let b = 0; b <= n; b++) scores[0][b] = b * gap
  for (let a = 1; a <= m; a++) for (let b = 1; b <= n; b++) scores[a][b] = Math.max(scores[a - 1][b - 1] + (left[a - 1] === right[b - 1] ? 2 : -1), scores[a - 1][b] + gap, scores[a][b - 1] + gap)
  let a = m, b = n, l = '', r = ''
  while (a > 0 || b > 0) {
    if (a > 0 && b > 0 && scores[a][b] === scores[a - 1][b - 1] + (left[a - 1] === right[b - 1] ? 2 : -1)) { l = left[--a] + l; r = right[--b] + r }
    else if (a > 0 && scores[a][b] === scores[a - 1][b] + gap) { l = left[--a] + l; r = '-' + r }
    else { l = '-' + l; r = right[--b] + r }
  }
  return { score: scores[m][n], alignedLeft: l, alignedRight: r, identityFraction: [...l].filter((c, k) => c !== '-' && c === r[k]).length / l.length,
    gaps: [...l, ...r].filter(c => c === '-').length, method: 'Needleman-Wunsch global DNA alignment; match=2 mismatch=-1 linear gap=-2; tie order diagonal/up/left; identity includes gap columns' }
}
const controlRules: Record<string, string[]> = {
  qpcr: ['positive', 'negative', 'no-template', 'no-RT', 'reference'],
  'cell-response': ['positive', 'negative', 'vehicle', 'viability'],
  binding: ['positive', 'negative', 'orthogonal'],
}
export function biologyProduct(id: string, i: Input): Record<string, unknown> {
  switch (id) {
    case 'biology-fasta-quality': {
      const fasta = i.fasta as string, alphabet = i.alphabet as string, issues: string[] = []
      check(!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(fasta))
      const raw: { id: string; sequence: string }[] = []
      for (const line of fasta.split(/\r?\n/).map(l => l.trim()).filter(Boolean)) {
        if (line.startsWith('>')) {
          const name = line.slice(1).split(/\s+/)[0]
          if (!/^[A-Za-z0-9._:-]{1,80}$/.test(name)) { issues.push('invalid-record-id'); continue }
          raw.push({ id: name, sequence: '' }); check(raw.length <= 128)
        } else if (!raw.length) issues.push('sequence-before-header')
        else { raw[raw.length - 1].sequence += line.toUpperCase(); check(raw[raw.length - 1].sequence.length <= 10000) }
      }
      const allowed = alphabet === 'DNA' ? /^[ACGTN]*$/ : alphabet === 'RNA' ? /^[ACGUN]*$/ : /^[ACDEFGHIKLMNPQRSTVWYXBZ]*$/
      if (!raw.length) issues.push('no-records')
      if (!unique(raw.map(r => r.id))) issues.push('duplicate-record-ids')
      const records = raw.map(r => { if (!r.sequence.length) issues.push(`empty-sequence:${r.id}`); if (!allowed.test(r.sequence)) issues.push(`invalid-alphabet:${r.id}`)
        return { id: r.id, length: r.sequence.length, ambiguous: [...r.sequence].filter(c => (alphabet === 'protein' ? 'XBZ' : 'N').includes(c)).length } })
      return { valid: !issues.length, records, issues }
    }
    case 'biology-dna-rna-composition': {
      const seq = (i.sequence as string).toUpperCase()
      check(!(i.alphabet === 'DNA' ? seq.includes('U') : seq.includes('T')))
      const counts = Object.fromEntries('ACGTUN'.split('').map(c => [c, [...seq].filter(x => x === c).length]))
      const calledBases = seq.length - counts.N
      return { counts, calledBases, gcFractionOfCalledBases: calledBases ? (counts.G + counts.C) / calledBases : null, ambiguousFraction: counts.N / seq.length }
    }
    case 'biology-protein-sequence-descriptors': {
      const seq = (i.sequence as string).toUpperCase(), count = (c: string) => [...seq].filter(x => x === c).length
      const basic = (pka: number) => 1 / (1 + 10 ** (7 - pka)), acidic = (pka: number) => 1 / (1 + 10 ** (pka - 7))
      const chargeAtPH7Approx = basic(9.69) - acidic(2.34) + count('K') * basic(10.5) + count('R') * basic(12.4) + count('H') * basic(6)
        - count('D') * acidic(3.86) - count('E') * acidic(4.25) - count('C') * acidic(8.33) - count('Y') * acidic(10.07)
      return { length: seq.length, composition: Object.keys(residueMass).sort().map(residue => ({ residue, count: count(residue) })), averageMassDa: [...seq].reduce((s, c) => s + residueMass[c], 18.01528), aromaticFraction: (count('F') + count('W') + count('Y')) / seq.length, chargeAtPH7Approx,
        massConvention: 'unmodified neutral linear peptide; average residue masses plus one water; fixed pKa Henderson-Hasselbalch approximation, not structure-dependent charge', modifiedResiduesSupported: false }
    }
    case 'biology-pairwise-sequence-comparison': return alignment(i.left as string, i.right as string)
    case 'biology-accession-version-check': {
      const records = i.records as Input[], matches = records.filter(r => r.accession === i.requestedAccession && r.version === i.requestedVersion)
      return { found: matches.length > 0, uniqueMatch: matches.length === 1, matches, snapshotVersion: i.snapshotVersion, authoritativeDatabaseQueried: false }
    }
    case 'biology-protein-confidence-audit': {
      const values = i.plddt as number[], fraction = (fn: (v: number) => boolean) => values.filter(fn).length / values.length
      return { meanPlddt: mean(values), veryHighFraction: fraction(v => v > 90), confidentFraction: fraction(v => v >= 70 && v <= 90), lowFraction: fraction(v => v >= 50 && v < 70), veryLowFraction: fraction(v => v < 50), functionalValidation: false }
    }
    case 'biology-qpcr-run-quality': {
      const ct = i.ct as number[], efficiency = i.efficiency as number; check(ct.every(v => v >= 0 && v <= 60) && efficiency > 0 && efficiency <= 1.2)
      const meanCt = mean(ct), ctSD = Math.sqrt(ct.reduce((s, v) => s + (v - meanCt) ** 2, 0) / (ct.length - 1)), issues: string[] = []
      if (efficiency < .9 || efficiency > 1.1) issues.push('efficiency-outside-declared-QC-band-90-to-110-percent')
      if (ctSD > .5) issues.push('replicate-Ct-SD-exceeds-0.5')
      for (const key of ['referenceStable', 'noTemplateNegative', 'noRTNegative', 'meltSinglePeak']) if (!i[key]) issues.push(`control-declaration-failed:${key}`)
      return { meanCt, ctSD, issues, declarationsComplete: !issues.length, assayValidated: false }
    }
    case 'biology-qpcr-relative-expression': {
      const ts = i.targetSampleCt as number, tc = i.targetControlCt as number, rs = i.referenceSampleCt as number, rc = i.referenceControlCt as number,
        te = i.targetEfficiency as number, re = i.referenceEfficiency as number
      check([ts, tc, rs, rc].every(v => v >= 0 && v <= 60) && te > 0 && te <= 1.2 && re > 0 && re <= 1.2 && i.referenceStable === true)
      const expressionRatio = finite((1 + te) ** (tc - ts) / (1 + re) ** (rc - rs)); positive(expressionRatio)
      return { expressionRatio, deltaDeltaCt: (ts - rs) - (tc - rc), method: 'Pfaffl ratio; efficiencies supplied as amplification increment (1=100%); stable reference required', referenceStabilityAssumed: true }
    }
    case 'biology-assay-control-coverage': {
      const controls = i.controls as string[]; check(unique(controls)); const required = controlRules[i.assay as string], missing = required.filter(c => !controls.includes(c))
      return { required, missing, covered: !missing.length, controlEffectivenessVerified: false }
    }
    case 'biology-research-dose-response-fit': {
      const x = i.dose as number[], y = i.normalizedResponse as number[]; check(x.every(v => v > 0) && y.every(v => v > 0 && v < 1))
      const transformedFit = linearFit(x.map(Math.log), y.map(v => Math.log(v / (1 - v))))
      check(Math.abs(transformedFit.slope) > 1e-8)
      const halfResponseDose = positive(finite(Math.exp(-transformedFit.intercept / transformedFit.slope)))
      return { halfResponseDose, hillSlope: transformedFit.slope, transformedFit,
        residuals: x.map((d, k) => y[k] - 1 / (1 + Math.exp(-(transformedFit.intercept + transformedFit.slope * Math.log(d))))),
        method: 'fixed bottom=0 top=1 logit-linear Hill fit; endpoints excluded, unweighted; not a four-parameter nonlinear fit or treatment dose', clinicalInterpretation: false }
    }
    case 'biology-replicate-batch-confounding': {
      const rows = i.observations as { id: string; biologicalUnit: string; condition: string; batch: string }[]; check(unique(rows.map(r => r.id)))
      const units = [...new Set(rows.map(r => r.biologicalUnit))], conditions = [...new Set(rows.map(r => r.condition))]; check(conditions.length >= 2)
      const batches = [...new Set(rows.map(r => r.batch))]
      const fullyConditionConfoundedBatches = batches.filter(b => new Set(rows.filter(r => r.batch === b).map(r => r.condition)).size === 1)
      const crossConditionUnits = units.filter(u => new Set(rows.filter(r => r.biologicalUnit === u).map(r => r.condition)).size > 1)
      return { biologicalUnits: units.length, technicalReplicateCount: rows.length - units.length, fullyConditionConfoundedBatches, crossConditionUnits, independentReplicationVerified: false }
    }
    case 'biology-translation-boundary-check': {
      const records = i.records as Input[]; check(unique(records.map(r => r.id)))
      return { frameMatches: i.evidenceFrame === i.claimFrame, issues: i.evidenceFrame === i.claimFrame ? [] : ['evidence-frame-does-not-match-claim-frame; bridge-validation-required'], humanEfficacyEstablished: false, recordsChecked: records.length }
    }
    case 'biology-design-assay-evidence-brief': {
      check(/^sha256:[a-f0-9]{64}$/.test(i.sequenceDigest as string)); const rows = i.records as Input[]; check(unique(rows.map(r => r.id)))
      const controls = i.controls as string[]; check(unique(controls)); const gaps: string[] = []
      for (const c of ['positive', 'negative']) if (!controls.includes(c)) gaps.push(`missing-control:${c}`)
      return { designId: i.designId, assayId: i.assayId, evidenceIds: rows.map(r => r.id), gaps, provenanceDeclarationsComplete: !gaps.length, designOrAssayVerified: false }
    }
    default: throw new Error('unsupported_biology_product')
  }
}
