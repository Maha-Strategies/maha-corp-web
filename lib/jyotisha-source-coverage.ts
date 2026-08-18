import {
  ASTROLOGY_PASSAGES,
  ASTROLOGY_RULES,
  ASTROLOGY_SOURCES,
  JYOTISHA_COVERAGE_AREAS,
  type JyotishaCoverageArea,
} from './astrology-traditions.ts'
import {
  assessRulePublicationReview,
  type PractitionerReviewRecord,
  type PublicationReviewStatus,
} from './practitioner-review.ts'

export const JYOTISHA_SOURCE_COVERAGE_VERSION = 'jyotisha-source-coverage/0.2' as const

export const JYOTISHA_COVERAGE_LABELS: Record<JyotishaCoverageArea, string> = {
  'planetary-house-placement': 'Planetary house placement',
  'house-rulers': 'House rulers',
  'nakshatra-interpretation': 'Nakshatra interpretation',
  'explicit-yogas': 'Explicitly defined yogas',
  'dasha-interpretation': 'Daśā interpretation',
  'transit-interpretation': 'Transit interpretation',
  'mundane-corporate-charts': 'Mundane and corporate charts',
  'panchanga-selection': 'Pañcāṅga classification and activity selection',
}

export interface JyotishaCoverageRule {
  ruleId: string
  doctrineStatus: NonNullable<(typeof ASTROLOGY_RULES)[number]['sourceBoundCoverage']>['doctrineStatus']
  chartTypes: string[]
  passageIds: string[]
  sourceIds: string[]
  rightsCleared: boolean
  reviewStatus: PublicationReviewStatus
  reviewRequirements: ReturnType<typeof assessRulePublicationReview>['requirements']
}

export interface JyotishaCoverageAreaRecord {
  area: JyotishaCoverageArea
  label: string
  status: 'encoded-awaiting-practitioner-review' | 'practitioner-reviewed' | 'revision-required'
  rules: JyotishaCoverageRule[]
}

export function buildJyotishaSourceCoverage(reviews: PractitionerReviewRecord[] = []): {
  version: typeof JYOTISHA_SOURCE_COVERAGE_VERSION
  publicationPolicy: string
  areas: JyotishaCoverageAreaRecord[]
} {
  const passageById = new Map(ASTROLOGY_PASSAGES.map((passage) => [passage.id, passage]))
  const sourceById = new Map(ASTROLOGY_SOURCES.map((source) => [source.id, source]))
  const rules = ASTROLOGY_RULES.filter((rule) => rule.traditionId === 'vedic-jyotisha' && rule.sourceBoundCoverage)

  const areas = JYOTISHA_COVERAGE_AREAS.map((area): JyotishaCoverageAreaRecord => {
    const areaRules = rules.filter((rule) => rule.sourceBoundCoverage?.area === area).map((rule): JyotishaCoverageRule => {
      const review = assessRulePublicationReview(rule.id, reviews)
      const sourceIds = [...new Set(rule.passageIds.map((passageId) => passageById.get(passageId)?.sourceId).filter((id): id is string => Boolean(id)))]
      return {
        ruleId: rule.id,
        doctrineStatus: rule.sourceBoundCoverage!.doctrineStatus,
        chartTypes: [...rule.chartTypes],
        passageIds: [...rule.passageIds],
        sourceIds,
        rightsCleared: sourceIds.length > 0 && sourceIds.every((sourceId) => {
          const status = sourceById.get(sourceId)?.rightsStatus
          return status === 'public-domain' || status === 'freely-licensed'
        }),
        reviewStatus: review.status,
        reviewRequirements: review.requirements,
      }
    })
    const status = areaRules.some((rule) => rule.reviewStatus === 'revision-required')
      ? 'revision-required'
      : areaRules.length > 0 && areaRules.every((rule) => rule.reviewStatus === 'accepted')
        ? 'practitioner-reviewed'
        : 'encoded-awaiting-practitioner-review'
    return { area, label: JYOTISHA_COVERAGE_LABELS[area], status, rules: areaRules }
  })

  return {
    version: JYOTISHA_SOURCE_COVERAGE_VERSION,
    publicationPolicy: 'Encoded coverage is not report-ready coverage. Every cited passage must pass source-fidelity review and every structured rule must pass rule-formalization review against its frozen version and digest before the rule may enter generated output.',
    areas,
  }
}

export function assertJyotishaSourceCoverageIntegrity(): void {
  const coverage = buildJyotishaSourceCoverage()
  const ruleCount = coverage.areas.reduce((sum, area) => sum + area.rules.length, 0)
  if (ruleCount < 100 || ruleCount > 250) throw new Error(`Source-bound Jyotiṣa coverage must remain between 100 and 250 rules; found ${ruleCount}.`)
  for (const area of coverage.areas) {
    if (area.rules.length === 0) throw new Error(`${area.area} has no source-bound Jyotiṣa rule.`)
    for (const rule of area.rules) {
      if (!rule.rightsCleared) throw new Error(`${rule.ruleId} does not cite a rights-cleared source.`)
      if (rule.reviewRequirements.length < 2) throw new Error(`${rule.ruleId} is missing passage or formalization review requirements.`)
    }
  }
  const entityCharts = new Set(coverage.areas.find((area) => area.area === 'mundane-corporate-charts')?.rules.flatMap((rule) => rule.chartTypes))
  if (!entityCharts.has('mundane') || !entityCharts.has('corporate')) throw new Error('Mundane and corporate chart coverage must remain separately encoded.')
}

assertJyotishaSourceCoverageIntegrity()
