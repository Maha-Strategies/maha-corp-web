import { BRIEFS } from './briefs-data.ts'
import { INTELLIGENCE_KNOWLEDGE_LINKS, getIntelligenceBriefSlugsForKnowledgeObject } from './intelligence-knowledge-links.ts'
import { type ClaimEmpiricalStatus, type ClaimProvenance } from './claim-evidence.ts'
import { KNOWLEDGE_ARTICLES, KNOWLEDGE_SOURCES, knowledgeArticlePath } from './knowledge-data.ts'
import { KNOWLEDGE_SUPPLIERS, knowledgeSupplierPath } from './knowledge-process-profiles.ts'

export const EDITORIAL_REVIEW_POLICY = {
  briefReviewDays: 60,
  claimReviewDays: 180,
  sourceFreshnessYears: 5,
} as const

export interface EditorialCoverageGap {
  objectType: 'brief' | 'knowledge' | 'supplier'
  id: string
  title: string
  status: string
  reason: string
  href: string
}

export interface EditorialClaimFinding {
  articleId: string
  articleTitle: string
  claimId: string
  claimProvenance: ClaimProvenance
  claimEmpirical: ClaimEmpiricalStatus
  statement: string
  sourceCount: number
  reason: string
  href: string
}

export interface EditorialBriefReview {
  briefSlug: string
  title: string
  status: string
  lastReviewedOn: string
  ageDays: number
  triggers: string[]
  href: string
}

export interface EditorialCoverageAudit {
  generatedOn: string
  policy: typeof EDITORIAL_REVIEW_POLICY
  summary: {
    briefs: number
    knowledgeObjects: number
    graphEdges: number
    coverageGaps: number
    weakEvidence: number
    staleClaims: number
    briefsNeedingReview: number
  }
  coverageGaps: EditorialCoverageGap[]
  weakEvidence: EditorialClaimFinding[]
  staleClaims: EditorialClaimFinding[]
  briefsNeedingReview: EditorialBriefReview[]
}

const DAY_MS = 86_400_000

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function ageInDays(date: string, asOf: Date): number {
  return Math.max(0, Math.floor((Date.parse(dateOnly(asOf)) - Date.parse(date)) / DAY_MS))
}

function isReviewSensitiveStatus(status: string): boolean {
  return /(PRELIMINARY|CRITICAL|VOLATILE|EMERGING|TRANSITION|COMPLIANCE|STRUCTURAL SHIFT)/i.test(status)
}

function weakEvidenceReason(empirical: ClaimEmpiricalStatus, sourceCount: number): string | null {
  if (empirical === 'open-question') return 'Open question has not yet reached an evidenced conclusion.'
  if (empirical === 'bounded-inference') return 'Bounded inference needs either stronger corroboration or a fresh boundary review.'
  if (empirical === 'interested-party') return 'Only support is a party with a commercial stake in the claim; seek independent corroboration.'
  if (empirical === 'method-basis' && sourceCount < 2) return 'Method claim relies on fewer than two cited sources.'
  if (sourceCount === 0) return 'Claim has no resolving citation.'
  return null
}

export function buildEditorialCoverageAudit(asOf = new Date()): EditorialCoverageAudit {
  const generatedOn = dateOnly(asOf)
  const linkByBrief = new Map(INTELLIGENCE_KNOWLEDGE_LINKS.map((link) => [link.briefSlug, link]))
  const sourceById = new Map(KNOWLEDGE_SOURCES.map((source) => [source.id, source]))

  const briefCoverageGaps: EditorialCoverageGap[] = BRIEFS
    .filter((brief) => !linkByBrief.has(brief.slug))
    .map((brief) => ({
      objectType: 'brief',
      id: brief.slug,
      title: brief.title,
      status: brief.status,
      reason: 'No supporting Knowledge process, concept, material, or supplier profile is connected.',
      href: `/intelligence/briefs/${brief.slug}`,
    }))

  const knowledgeCoverageGaps: EditorialCoverageGap[] = KNOWLEDGE_ARTICLES
    .filter((article) => getIntelligenceBriefSlugsForKnowledgeObject(article.id).length === 0)
    .map((article) => ({
      objectType: 'knowledge',
      id: article.id,
      title: article.title,
      status: article.status,
      reason: 'Published Knowledge object is not yet used by an Intelligence brief.',
      href: knowledgeArticlePath(article),
    }))

  const supplierCoverageGaps: EditorialCoverageGap[] = KNOWLEDGE_SUPPLIERS
    .filter((supplier) => getIntelligenceBriefSlugsForKnowledgeObject(supplier.id).length === 0)
    .map((supplier) => ({
      objectType: 'supplier',
      id: supplier.id,
      title: supplier.name,
      status: 'EVIDENCE PROFILE',
      reason: 'Published supplier profile is not yet used as capability context by an Intelligence brief.',
      href: knowledgeSupplierPath(supplier),
    }))

  const weakEvidence: EditorialClaimFinding[] = []
  const staleClaims: EditorialClaimFinding[] = []
  for (const article of KNOWLEDGE_ARTICLES) {
    const articleAge = ageInDays(article.dateModified, asOf)
    for (const claim of article.claims) {
      const base = {
        articleId: article.id,
        articleTitle: article.title,
        claimId: claim.id,
        claimProvenance: claim.provenance,
        claimEmpirical: claim.empirical,
        statement: claim.statement,
        sourceCount: claim.sourceIds.length,
        href: `${knowledgeArticlePath(article)}#claim-${claim.id}`,
      }
      const weakReason = weakEvidenceReason(claim.empirical, claim.sourceIds.length)
      if (weakReason) weakEvidence.push({ ...base, reason: weakReason })

      const sources = claim.sourceIds.map((id) => sourceById.get(id)).filter((source) => source !== undefined)
      const everySourceIsDated = sources.length > 0 && sources.every((source) => source.year !== undefined)
      const datedSourcesAreOld = everySourceIsDated && sources.every((source) => source.year! < asOf.getUTCFullYear() - EDITORIAL_REVIEW_POLICY.sourceFreshnessYears)
      if (articleAge >= EDITORIAL_REVIEW_POLICY.claimReviewDays) {
        staleClaims.push({ ...base, reason: `Parent article has not been reviewed for ${articleAge} days.` })
      } else if (datedSourcesAreOld) {
        const years = sources.map((source) => source.year!).sort((a, b) => a - b)
        staleClaims.push({ ...base, reason: `All cited evidence with publication dates is from ${years[0]}–${years.at(-1)}; check for newer evidence.` })
      }
    }
  }

  const briefsNeedingReview: EditorialBriefReview[] = BRIEFS.flatMap((brief) => {
    const lastReviewedOn = brief.dateModified ?? brief.datePublished
    const ageDays = ageInDays(lastReviewedOn, asOf)
    const triggers: string[] = []
    if (ageDays >= EDITORIAL_REVIEW_POLICY.briefReviewDays) triggers.push(`Last reviewed ${ageDays} days ago`)
    if (isReviewSensitiveStatus(brief.status)) triggers.push(`Status is ${brief.status}`)
    if (!linkByBrief.has(brief.slug)) triggers.push('Supporting Knowledge coverage is missing')
    if (triggers.length === 0) return []
    return [{ briefSlug: brief.slug, title: brief.title, status: brief.status, lastReviewedOn, ageDays, triggers, href: `/intelligence/briefs/${brief.slug}` }]
  }).sort((left, right) => {
    const leftCoverage = left.triggers.includes('Supporting Knowledge coverage is missing') ? 1 : 0
    const rightCoverage = right.triggers.includes('Supporting Knowledge coverage is missing') ? 1 : 0
    return rightCoverage - leftCoverage || right.triggers.length - left.triggers.length || right.ageDays - left.ageDays || left.title.localeCompare(right.title)
  })

  const coverageGaps = [...briefCoverageGaps, ...knowledgeCoverageGaps, ...supplierCoverageGaps]
  const graphEdges = INTELLIGENCE_KNOWLEDGE_LINKS.reduce((total, link) => total + link.articleIds.length + link.supplierIds.length, 0)
  return {
    generatedOn,
    policy: EDITORIAL_REVIEW_POLICY,
    summary: {
      briefs: BRIEFS.length,
      knowledgeObjects: KNOWLEDGE_ARTICLES.length + KNOWLEDGE_SUPPLIERS.length,
      graphEdges,
      coverageGaps: coverageGaps.length,
      weakEvidence: weakEvidence.length,
      staleClaims: staleClaims.length,
      briefsNeedingReview: briefsNeedingReview.length,
    },
    coverageGaps,
    weakEvidence,
    staleClaims,
    briefsNeedingReview,
  }
}
