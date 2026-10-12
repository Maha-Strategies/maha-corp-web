import { requireCondition as check, positive, finite, linearFit, weightedQuantile, matchedPeaks, increasing, paired, unique } from './math.ts'
type Input = Record<string, unknown>
export function materialsProduct(id: string, i: Input): Record<string, unknown> {
  switch (id) {
    case 'materials-property-record-check': {
      const value = i.value as number, uncertainty = i.uncertainty as number, issues: string[] = []
      positive(i.temperatureK as number)
      if ((i.source as string).trim().length < 3) issues.push('source-insufficient')
      if ((i.method as string).trim().length < 3) issues.push('method-insufficient')
      if (!['thermal-conductivity', 'electrical-resistivity', 'density', 'elastic-modulus', 'cte'].includes(i.property as string)) issues.push('unreviewed-property-unit-convention')
      const units: Record<string, string> = { 'thermal-conductivity': 'W/m/K', 'electrical-resistivity': 'ohm*m', density: 'kg/m^3', 'elastic-modulus': 'Pa', cte: '1/K' }
      if (units[i.property as string] && i.unit !== units[i.property as string]) issues.push('unit-does-not-match-reviewed-convention')
      return { declarationsComplete: !issues.length, issues, relativeUncertainty: value === 0 ? null : uncertainty / Math.abs(value), measurementVerified: false }
    }
    case 'materials-particle-size-summary': {
      const values = i.diametersMicrometers as number[], weights = i.weights as number[]; check(values.every(v => v > 0))
      check(values.length === weights.length); const total = positive(weights.reduce((s, w) => s + w, 0))
      return { D10Micrometers: weightedQuantile(values, weights, .1), D50Micrometers: weightedQuantile(values, weights, .5), D90Micrometers: weightedQuantile(values, weights, .9),
        weightedMeanMicrometers: values.reduce((s, v, k) => s + v * weights[k], 0) / total, weighting: i.weighting, method: 'inverse weighted empirical CDF, no interpolation; supplied weights already in declared basis, not converted' }
    }
    case 'materials-sheet-resistance': return { sheetResistanceOhmPerSquare: positive(i.resistivityOhmM as number) / positive(i.thicknessM as number), uniformFilmAssumed: true }
    case 'materials-thermal-expansion-mismatch': return { mismatchStrain: ((i.alphaFilmPerK as number) - (i.alphaSubstratePerK as number)) * (i.deltaTemperatureK as number), linearConstantCTEAssumed: true, stressCalculated: false }
    case 'materials-thermal-stack-resistance': {
      const layers = i.layers as { thicknessM: number; conductivityWPerMK: number }[], interfaces = i.interfaceResistanceM2KPerW as number[]
      check(interfaces.length === layers.length - 1)
      const resistance = layers.reduce((s, l) => s + positive(l.thicknessM) / positive(l.conductivityWPerMK), 0) + interfaces.reduce((s, v) => s + v, 0)
      return { areaNormalizedResistanceM2KPerW: resistance, resistanceKPerW: resistance / positive(i.areaM2 as number), model: 'steady-state 1D series conduction; identical area; interface resistances supplied; no convection/radiation/lateral spreading' }
    }
    case 'materials-stress-strain-analysis': {
      const x = i.strain as number[], y = i.stressMPa as number[], end = i.elasticFitEndIndex as number
      paired(x, y); check(increasing(x) && end < x.length && x[0] <= .002)
      const elasticFit = linearFit(x.slice(0, end + 1), y.slice(0, end + 1)), E = positive(elasticFit.slope)
      let energy = 0, offsetYieldMPa: number | null = null
      for (let k = 1; k < x.length; k++) {
        energy += (x[k] - x[k - 1]) * (y[k] + y[k - 1]) / 2
        const a = y[k - 1] - (elasticFit.intercept + E * (x[k - 1] - .002)), b = y[k] - (elasticFit.intercept + E * (x[k] - .002))
        if (offsetYieldMPa === null && a >= 0 && b <= 0 && x[k] >= .002 && a !== b) offsetYieldMPa = y[k - 1] + a / (a - b) * (y[k] - y[k - 1])
      }
      return { elasticModulusMPa: E, elasticFit, ultimateStressMPa: Math.max(...y), energyDensityMJPerM3: energy, offsetYieldMPa,
        method: 'engineering input; declared inclusive elastic window OLS; first piecewise-linear 0.2% offset crossing; trapezoidal energy over supplied range only, not toughness unless fracture captured' }
    }
    case 'materials-xrd-peak-analysis': {
      const lambda = positive(i.wavelengthAngstrom as number)
      return { dSpacingAngstrom: (i.twoThetaDegrees as number[]).map(v => lambda / (2 * Math.sin(v * Math.PI / 360))), diffractionOrder: 1, phaseIdentityEstablished: false, method: 'Bragg n=1; two-theta input degrees; no lattice indexing or phase identification' }
    }
    case 'materials-optical-bandgap-fit': {
      const x = i.energyEV as number[], alpha = i.absorptionPerM as number[], start = i.fitStartIndex as number, end = i.fitEndIndex as number
      paired(x, alpha); check(increasing(x) && x.every(v => v > 0) && alpha.every(v => v > 0) && end < x.length && end - start >= 2)
      const power = i.transition === 'direct-allowed' ? 2 : .5
      const y = x.map((e, k) => finite((e * alpha[k]) ** power))
      const transformedFit = linearFit(x.slice(start, end + 1), y.slice(start, end + 1)); positive(transformedFit.slope)
      const bandgapEV = positive(-transformedFit.intercept / transformedFit.slope)
      let trimmedWindowBandgapEV: number | null = null
      if (end - start >= 4) { const fit = linearFit(x.slice(start + 1, end), y.slice(start + 1, end)); if (fit.slope > 0) trimmedWindowBandgapEV = finite(-fit.intercept / fit.slope) }
      return { bandgapEV, transformedFit, trimmedWindowBandgapEV, fitWindowSensitivityEV: trimmedWindowBandgapEV === null ? null : Math.abs(bandgapEV - trimmedWindowBandgapEV), transition: i.transition,
        method: 'Tauc linear extrapolation: (alpha*E)^2 direct allowed, ^0.5 indirect allowed; caller selects fit window; trim-one-each-end sensitivity, not bandgap validation' }
    }
    case 'materials-raman-reference-comparison': {
      const ref = i.referenceCmInverse as number[], matches = matchedPeaks(i.observedCmInverse as number[], ref, i.toleranceCmInverse as number)
      return { matches, unmatchedReferenceIndices: ref.map((_, k) => k).filter(k => !matches.some(m => m.referenceIndex === k)), method: 'nearest-unused-reference absolute cm^-1 tolerance; input-order greedy; intensity not assessed', uniqueMaterialIdentityEstablished: false }
    }
    case 'materials-candidate-comparison': {
      const criteria = i.criteria as { id: string; weight: number; direction: string }[], candidates = i.candidates as { id: string; values: (number | null)[] }[]
      check(unique(criteria.map(c => c.id)) && unique(candidates.map(c => c.id)) && candidates.every(c => c.values.length === criteria.length))
      const totalWeight = positive(criteria.reduce((s, c) => s + c.weight, 0))
      const ranges = criteria.map((_, k) => { const values = candidates.map(c => c.values[k]).filter((v): v is number => v !== null); return { min: Math.min(...values), max: Math.max(...values) } })
      const assessments = candidates.map(c => { const missingCriteria = criteria.filter((_, k) => c.values[k] === null).map(c => c.id)
        let score: number | null = null
        if (!missingCriteria.length) score = criteria.reduce((s, criterion, k) => { const range = ranges[k], raw = range.max === range.min ? .5 : ((c.values[k] as number) - range.min) / (range.max - range.min); return s + criterion.weight * (criterion.direction === 'higher' ? raw : 1 - raw) }, 0) / totalWeight
        return { id: c.id, score, missingCriteria }
      })
      return { assessments, normalization: 'min-max observed candidate cohort per criterion; equal range=0.5; any missing criterion withholds entire score; no imputation', evidenceVerified: false }
    }
    case 'materials-deposition-compatibility': {
      positive(i.substrateMaximumK as number); positive(i.processPeakK as number)
      const declaredConstraintConflicts: string[] = []
      if ((i.processPeakK as number) > (i.substrateMaximumK as number)) declaredConstraintConflicts.push('process-temperature-exceeds-declared-substrate-limit')
      if (i.substrateCorrosionSensitive && i.processCorrosive) declaredConstraintConflicts.push('declared-corrosion-sensitivity-conflict')
      return { declaredConstraintConflicts, noDeclaredConflict: !declaredConstraintConflicts.length, compatibilityValidated: false, processRecipeProvided: false }
    }
    case 'materials-qualification-evidence-brief': {
      const required = i.requiredTests as string[], evidence = i.evidence as { test: string; status: string; record: Input }[]
      check(unique(required) && unique(evidence.map(e => e.test)) && unique(evidence.map(e => e.record.id)))
      return { application: i.application, passedDeclarations: evidence.filter(e => required.includes(e.test) && e.status === 'pass').map(e => e.test),
        failedDeclarations: evidence.filter(e => required.includes(e.test) && e.status === 'fail').map(e => e.test), missingTests: required.filter(t => !evidence.some(e => e.test === t && e.status !== 'not-run')), qualificationEstablished: false }
    }
    default: throw new Error('unsupported_materials_product')
  }
}
