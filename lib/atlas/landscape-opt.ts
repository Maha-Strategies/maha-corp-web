export const LANDSCAPE_OPT_ATLAS_URL = 'https://research.mahastrategies.com/atlas/landscape-opt'
export const MAHA_ORGANIZATION_ID = 'https://research.mahastrategies.com/#organization'
export const MAYON_RAJAN_PERSON_ID = 'https://www.mayonemaharajan.com/#person'

export interface LandscapeParameters { moduliDimension: number; fluxIntegerMatrix: { rows: number; columns: number; entryBound: number }; constraintPolynomialDegrees: number[]; tadpoleBound?: number; morseCriticalPoints: { index: number; count: number }[] }
export interface ConvergenceMetric { iterations: number; energyResidual: number; equalityResidual: number; inequalityViolation: number; criticalPointClass: 'minimum' | 'saddle' | 'maximum' | 'undetermined' }
export interface ConstraintSatisfactionThroughput { candidatesEvaluated: number; elapsedMs: number; feasibleCandidates: number; exactIntegerChecks: number; hardware: 'cpu' | 'gpu' | 'tpu' }
export interface LandscapeSource { id: string; authors: string; title: string; year: number; url: string; doi?: string; arxiv?: string }
export interface LandscapeClaim { id: string; statement: string; evidenceSourceIds: readonly string[]; status: 'supported-method-basis' | 'research-direction'; boundary: string }

export const landscapeParameterExamples: readonly LandscapeParameters[] = [{ moduliDimension: 100, fluxIntegerMatrix: { rows: 200, columns: 200, entryBound: 1000 }, constraintPolynomialDegrees: [2, 3, 4], tadpoleBound: 10000, morseCriticalPoints: [{ index: 0, count: 0 }, { index: 1, count: 0 }] }]
export const convergenceMetricSchema: readonly ConvergenceMetric[] = [{ iterations: 0, energyResidual: 0, equalityResidual: 0, inequalityViolation: 0, criticalPointClass: 'undetermined' }]
export const constraintThroughputSchema: readonly ConstraintSatisfactionThroughput[] = [{ candidatesEvaluated: 0, elapsedMs: 0, feasibleCandidates: 0, exactIntegerChecks: 0, hardware: 'gpu' }]

export const landscapeSources: readonly LandscapeSource[] = [
  { id: 'douglas-2003', authors: 'Michael R. Douglas', title: 'The statistics of string/M theory vacua', year: 2003, url: 'https://arxiv.org/abs/hep-th/0303194', arxiv: 'hep-th/0303194' },
  { id: 'douglas-2004', authors: 'Michael R. Douglas', title: 'Statistics of String vacua', year: 2004, url: 'https://arxiv.org/abs/hep-ph/0401004', arxiv: 'hep-ph/0401004' },
  { id: 'denef-douglas-2004', authors: 'Frederik Denef, Michael R. Douglas', title: 'Distributions of flux vacua', year: 2004, url: 'https://arxiv.org/abs/hep-th/0404116', arxiv: 'hep-th/0404116' },
  { id: 'kklt-2003', authors: 'Shamit Kachru, Renata Kallosh, Andrei Linde, Sandip P. Trivedi', title: 'de Sitter Vacua in String Theory', year: 2003, url: 'https://arxiv.org/abs/hep-th/0301240', arxiv: 'hep-th/0301240' },
  { id: 'vafa-2005', authors: 'Cumrun Vafa', title: 'The String Landscape and the Swampland', year: 2005, url: 'https://arxiv.org/abs/hep-th/0509212', arxiv: 'hep-th/0509212' },
  { id: 'taylor-wang-2015', authors: 'Washington Taylor, Yi-Nan Wang', title: 'The F-theory geometry with most flux vacua', year: 2015, url: 'https://arxiv.org/abs/1511.03209', arxiv: '1511.03209' },
]

export const landscapeClaims: readonly LandscapeClaim[] = [
  { id: 'lso-001', statement: 'Flux-vacua studies formulate an ensemble of discrete flux choices and continuous moduli subject to geometric and effective-theory conditions; Morse critical-point classification supplies a language for distinguishing stationary-point types.', evidenceSourceIds: ['douglas-2003', 'douglas-2004', 'denef-douglas-2004'], status: 'supported-method-basis', boundary: 'Topological navigation may diversify candidate exploration but cannot guarantee avoidance of every local minimum or a globally optimal solution.' },
  { id: 'lso-002', statement: 'Integer flux choices can be filtered against declared tadpole, integrality, and polynomial constraints before expensive continuous optimization, with each retained candidate carrying its exact constraint residual record.', evidenceSourceIds: ['denef-douglas-2004', 'kklt-2003'], status: 'supported-method-basis', boundary: 'The filter is only as exact as the supplied arithmetic representation and does not prove a physical vacuum, moduli stability, or solver completeness.' },
  { id: 'lso-003', statement: 'Landscape-inspired decomposition can be evaluated as a heuristic for large layout and allocation problems by reporting dimensional reduction, feasibility, objective value, and runtime against a shared baseline.', evidenceSourceIds: ['douglas-2004', 'taylor-wang-2015'], status: 'research-direction', boundary: 'No billion-variable EDA performance or exact-constraint throughput claim is made without a workload-specific benchmark.' },
]

export function assertLandscapeOptReferentialIntegrity(): void { const ids = new Set(landscapeSources.map((source) => source.id)); const claims = new Set<string>(); for (const claim of landscapeClaims) { if (claims.has(claim.id)) throw new Error(`Duplicate landscape claim id: ${claim.id}`); claims.add(claim.id); for (const sourceId of claim.evidenceSourceIds) if (!ids.has(sourceId)) throw new Error(`Claim ${claim.id} references missing source ${sourceId}`) } }
assertLandscapeOptReferentialIntegrity()
