import initRDKit, { type MainModule, type Mol } from '@rdkit/rdkit'
import { requireCondition as check, positive, finite, linearFit, matchedPeaks } from './math.ts'
type Input = Record<string, unknown>
// Conventional average atomic masses in g/mol, rounded; no isotope or hydrate syntax.
export const ATOMIC_MASS: Readonly<Record<string, number>> = Object.freeze({ H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.9984, Ne: 20.1797, Na: 22.9898, Mg: 24.305, Al: 26.9815, Si: 28.085, P: 30.9738, S: 32.06, Cl: 35.45, Ar: 39.948, K: 39.0983, Ca: 40.078, Fe: 55.845, Co: 58.9332, Ni: 58.6934, Cu: 63.546, Zn: 65.38, Se: 78.971, Br: 79.904, Ag: 107.8682, I: 126.9045, Au: 196.9666 })
export function parseFormula(formula: string): Record<string, number> {
  check(/^[A-Za-z0-9()]{1,128}$/.test(formula))
  let cursor = 0
  const count = () => { const match = /^\d+/.exec(formula.slice(cursor)); if (!match) return 1
    check(!match[0].startsWith('0')); cursor += match[0].length; const n = Number(match[0]); check(Number.isSafeInteger(n) && n <= 1000000); return n }
  const group = (depth: number): Record<string, number> => {
    check(depth <= 4); const result: Record<string, number> = {}
    while (cursor < formula.length && formula[cursor] !== ')') {
      let part: Record<string, number>
      if (formula[cursor] === '(') { cursor++; part = group(depth + 1); check(formula[cursor] === ')'); cursor++ }
      else { const match = /^[A-Z][a-z]?/.exec(formula.slice(cursor)); check(match && Object.hasOwn(ATOMIC_MASS, match[0])); cursor += match[0].length; part = { [match[0]]: 1 } }
      const multiplier = count()
      for (const [s, n] of Object.entries(part)) { result[s] = (result[s] ?? 0) + n * multiplier; check(result[s] <= 1000000) }
    }
    check(Object.keys(result).length > 0); return result
  }
  const result = group(0); check(cursor === formula.length); return result
}
let rdkitPromise: Promise<MainModule> | undefined
export async function rdkit() {
  rdkitPromise ??= initRDKit().then(r => { check(r.version() === '2026.09.1'); r.disable_logging(); return r }).catch(e => { rdkitPromise = undefined; throw e })
  return rdkitPromise
}
function molecule(r: MainModule, smiles: string): Mol | null {
  check(smiles.length <= 512 && !/[\s|*>]/.test(smiles))
  let m: Mol | null = null
  try { m = r.get_mol(smiles) } catch { return null }
  if (m && (m.get_num_atoms(false) > 256 || m.get_num_atoms(false) < 1)) { m.delete(); throw new Error('molecule_size_not_supported') }
  return m
}
async function molecularProduct(id: string, i: Input): Promise<Record<string, unknown>> {
  const r = await rdkit(), toolkit = `RDKit MinimalLib ${r.version()} / npm @rdkit/rdkit 2026.9.1`
  const left = molecule(r, (i.smiles ?? i.left) as string)
  let right: Mol | null = null
  try {
    if (id === 'chemistry-smiles-validation') {
      if (!left) return { valid: false, canonicalSmiles: null, atoms: 0, fragments: 0, warnings: ['SMILES-parse-or-valence-sanitization-failed'], toolkit }
      const canonicalSmiles = left.get_smiles(), d = JSON.parse(left.get_descriptors()) as Record<string, number>, warnings: string[] = []
      if (canonicalSmiles.includes('.')) warnings.push('disconnected-fragments-retained')
      if (d.NumUnspecifiedAtomStereoCenters > 0) warnings.push('unspecified-stereocenters')
      return { valid: true, canonicalSmiles, atoms: left.get_num_atoms(false), fragments: canonicalSmiles.split('.').length, warnings, toolkit }
    }
    check(left)
    if (id === 'chemistry-molecular-descriptor-pack') {
      const d = JSON.parse(left.get_descriptors()) as Record<string, number>
      return { canonicalSmiles: left.get_smiles(), averageMass: d.amw, exactMass: d.exactmw, logP: d.CrippenClogP, tpsa: d.tpsa, hydrogenBondDonors: d.NumHBD, hydrogenBondAcceptors: d.NumHBA, toolkit }
    }
    right = molecule(r, i.right as string); check(right)
    if (id === 'chemistry-molecular-identity-comparison') return { identicalCanonicalStructure: left.get_smiles() === right.get_smiles(), leftCanonical: left.get_smiles(), rightCanonical: right.get_smiles(),
      saltProtonationStereoPolicy: 'canonical isomeric SMILES; preserve salts, charge, isotope and declared stereo; no tautomer/protonation normalization; not specimen identity', toolkit }
    const options = JSON.stringify({ radius: 2, nBits: 2048, useChirality: true }), a = left.get_morgan_fp(options), b = right.get_morgan_fp(options)
    check(a.length === 2048 && b.length === 2048 && /^[01]+$/.test(a) && /^[01]+$/.test(b))
    let intersectionBits = 0, unionBits = 0
    for (let k = 0; k < 2048; k++) { if (a[k] === '1' && b[k] === '1') intersectionBits++; if (a[k] === '1' || b[k] === '1') unionBits++ }
    check(unionBits > 0)
    return { tanimoto: intersectionBits / unionBits, intersectionBits, unionBits, fingerprint: 'Morgan radius=2 nBits=2048 useChirality=true; bit collisions possible', toolkit, identityEstablished: false }
  } finally { left?.delete(); right?.delete() }
}
export async function chemistryProduct(id: string, i: Input): Promise<Record<string, unknown>> {
  if (['chemistry-smiles-validation', 'chemistry-molecular-descriptor-pack', 'chemistry-molecular-identity-comparison', 'chemistry-fingerprint-similarity'].includes(id)) return molecularProduct(id, i)
  switch (id) {
    case 'chemistry-formula-mass-check': {
      const atoms = parseFormula(i.formula as string)
      return { elements: Object.entries(atoms).sort(([a], [b]) => a.localeCompare(b)).map(([symbol, count]) => ({ symbol, count })), molarMassGPerMol: Object.entries(atoms).reduce((s, [k, n]) => s + n * ATOMIC_MASS[k], 0), convention: '30-element rounded conventional average atomic mass table v1; neutral composition; parentheses supported; no isotopes, charges or hydrate dots', isotopeSpecific: false }
    }
    case 'chemistry-dilution-calculator': {
      const stock = positive(i.stockMolPerL as number), target = i.targetMolPerL as number, final = positive(i.finalVolumeL as number); check(target <= stock)
      const stockVolumeL = target / stock * final
      return { stockVolumeL, diluentVolumeL: final - stockVolumeL, assumption: 'C1*V1=C2*V2; additive volumes; no mixing/safety instructions' }
    }
    case 'chemistry-concentration-basis': {
      const value = i.value as number, mw = positive(i.molarMassGPerMol as number), density = positive(i.densityGPerML as number)
      if (i.from === 'mass-fraction') check(value <= 1)
      const gL = i.from === 'mol/L' ? value * mw : i.from === 'g/L' ? value : value * density * 1000
      const converted = i.to === 'mol/L' ? gL / mw : i.to === 'g/L' ? gL : gL / (density * 1000)
      if (i.to === 'mass-fraction') check(converted <= 1)
      return { value: converted, unit: i.to, intermediateGPerL: gL, densityAssumedGPerML: density }
    }
    case 'chemistry-reaction-conservation': {
      type Species = { formula: string; coefficient: number; charge: number }
      const elements: Record<string, number> = {}; let chargeDelta = 0
      for (const [key, sign] of [['reactants', -1], ['products', 1]] as const) for (const species of i[key] as Species[]) {
        chargeDelta += sign * species.coefficient * species.charge
        for (const [element, n] of Object.entries(parseFormula(species.formula))) elements[element] = (elements[element] ?? 0) + sign * species.coefficient * n
      }
      const differences = Object.entries(elements).filter(([, d]) => d !== 0).sort(([a], [b]) => a.localeCompare(b)).map(([element, delta]) => ({ element, delta }))
      return { balanced: !differences.length && chargeDelta === 0, differences, chargeDelta, feasibilityEstablished: false }
    }
    case 'chemistry-spectrum-peak-comparison': {
      const observed = i.observed as number[], reference = i.reference as number[], matches = matchedPeaks(observed, reference, i.tolerance as number)
      return { matches, unmatchedReferenceIndices: reference.map((_, k) => k).filter(k => !matches.some(m => m.referenceIndex === k)), method: 'nearest-unused-reference within absolute tolerance; input-order greedy', unit: i.unit, compoundIdentityEstablished: false }
    }
    case 'chemistry-arrhenius-fit': {
      const t = i.kelvin as number[], rate = i.rate as number[]; check(t.every(v => v > 0) && rate.every(v => v > 0))
      const transformedFit = linearFit(t.map(v => 1 / v), rate.map(Math.log))
      return { activationEnergyJPerMol: -8.31446261815324 * transformedFit.slope, preExponential: finite(Math.exp(transformedFit.intercept)), transformedFit, method: 'unweighted OLS ln(rate) vs 1/K; R=8.31446261815324 J/mol/K; rate units inherited; no extrapolation or mechanism claim' }
    }
    case 'chemistry-electrochemical-normalizer': {
      const comparableDeclaredConditions = i.sourceConditions === i.targetConditions
      return { convertedPotentialV: comparableDeclaredConditions ? (i.potentialV as number) + (i.sourceReferenceOffsetToSHEV as number) - (i.targetReferenceOffsetToSHEV as number) : null,
        comparableDeclaredConditions, issues: comparableDeclaredConditions ? [] : ['reference-conditions-differ; no-automatic-conversion'], signConvention: 'E_target=E_source+source_vs_SHE-target_vs_SHE; offsets are caller declarations', offsetsIndependentlyVerified: false }
    }
    case 'chemistry-enzyme-kinetics-fit': {
      const x = i.substrate as number[], y = i.velocity as number[]; check(x.every(v => v > 0) && y.every(v => v > 0))
      const transformedFit = linearFit(x.map(v => 1 / v), y.map(v => 1 / v)); positive(transformedFit.slope); positive(transformedFit.intercept)
      const Vmax = finite(1 / transformedFit.intercept), Km = finite(transformedFit.slope / transformedFit.intercept)
      return { Vmax, Km, transformedFit, residuals: x.map((s, k) => y[k] - Vmax * s / (Km + s)), method: 'Lineweaver-Burk unweighted reciprocal OLS; low-substrate noise amplified; no inhibition or identifiability guarantee', parameterConfidenceInterval: null }
    }
    default: throw new Error('unsupported_chemistry_product')
  }
}
