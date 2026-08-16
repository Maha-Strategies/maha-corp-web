import assert from 'node:assert/strict'
import test from 'node:test'

import { BRIEFS } from '../lib/briefs-data.ts'
import { buildEditorialCoverageAudit } from '../lib/editorial-coverage-audit.ts'
import { INTELLIGENCE_KNOWLEDGE_LINKS } from '../lib/intelligence-knowledge-links.ts'
import { KNOWLEDGE_ARTICLES } from '../lib/knowledge-data.ts'
import { KNOWLEDGE_SUPPLIERS } from '../lib/knowledge-process-profiles.ts'

const audit = buildEditorialCoverageAudit(new Date('2026-08-13T12:00:00Z'))

test('editorial audit reconciles the published graph', () => {
  assert.equal(audit.summary.briefs, BRIEFS.length)
  assert.equal(audit.summary.knowledgeObjects, KNOWLEDGE_ARTICLES.length + KNOWLEDGE_SUPPLIERS.length)
  assert.equal(audit.summary.graphEdges, INTELLIGENCE_KNOWLEDGE_LINKS.reduce((total, link) => total + link.articleIds.length + link.supplierIds.length, 0))
  assert.equal(audit.summary.coverageGaps, audit.coverageGaps.length)
})

test('coverage gaps identify both unlinked briefs and orphan Knowledge objects', () => {
  assert.ok(audit.coverageGaps.some((item) => item.objectType === 'brief' && item.id === 'physical-ai-deployment'))
  assert.ok(audit.coverageGaps.some((item) => item.objectType === 'supplier' && item.id === 'supplier-disco'))
  for (const gap of audit.coverageGaps) {
    assert.ok(gap.href.startsWith('/'))
    assert.ok(gap.reason.length >= 40)
  }
})

test('weak evidence queue is claim-level and actionable', () => {
  assert.ok(audit.weakEvidence.length > 0)
  assert.ok(audit.weakEvidence.some((item) => item.claimEmpirical === 'bounded-inference'))
  assert.ok(audit.weakEvidence.some((item) => item.claimEmpirical === 'interested-party'), 'vendor-only support must surface as weak evidence')
  for (const finding of audit.weakEvidence) {
    assert.match(finding.href, /^\/knowledge\/.+#claim-/)
    assert.ok(finding.statement.length >= 40)
  }
})

test('staleness is a review signal based on explicit policy', () => {
  assert.ok(audit.staleClaims.length > 0)
  assert.equal(audit.policy.claimReviewDays, 180)
  assert.equal(audit.policy.sourceFreshnessYears, 5)
  assert.ok(audit.staleClaims.every((finding) => finding.reason.includes('check for newer evidence') || finding.reason.includes('has not been reviewed')))
})

test('brief review queue combines age, status, and missing coverage', () => {
  const physicalAi = audit.briefsNeedingReview.find((brief) => brief.briefSlug === 'physical-ai-deployment')
  assert.ok(physicalAi)
  assert.ok(physicalAi.triggers.some((trigger) => trigger.includes('60') || trigger.includes('Supporting Knowledge')))
  assert.ok(audit.briefsNeedingReview.every((brief) => brief.triggers.length > 0))
})
