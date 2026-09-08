import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { REPLACEMENTS, REVIEW_AXES, digest } from '../lib/federation/readiness-recovery.ts'

const root = resolve(import.meta.dirname, '..')
const federation = resolve(root, 'content/federation')
const read = (name: string) => JSON.parse(readFileSync(resolve(federation, name), 'utf8'))

const v4 = read('federation-route-candidates-v4.json')
const v5 = read('federation-route-candidates-v5.json')
const lineage = read('federation-candidate-lineage-v5.json')
const graph = read('federation-definition-graph-objects-v1.json')
const reviews = read('federation-authority-definition-reviews-v1.json')
const reassessment = read('federation-authority-application-reassessment-v1.json')
const sources = read('federation-readiness-recovery-source-inspections-v1.json')
const priority = read('federation-readiness-recovery-priority-v1.json')
const specs = read('federation-readiness-recovery-page-specifications-v1.json')
const ledger = read('federation-unified-readiness-ledger-v1.json')

test('v5 preserves the exact 1,628-route budget and property allocations', () => {
  assert.equal(v5.candidates.length, 1628)
  assert.equal(new Set(v5.candidates.map((row: { candidateId: string }) => row.candidateId)).size, 1628)
  assert.equal(new Set(v5.candidates.map((row: { url: string }) => row.url)).size, 1628)
  assert.equal(v5.activeRanks.length, 1628)
  assert.equal(v5.summary.observedCanonicalRoutes + v5.candidates.length, 4000)
  assert.deepEqual(v5.allocation, v4.allocation)
})

test('exactly four duplicative candidates are replaced by distinct operational roles', () => {
  const v4Ids = new Set(v4.candidates.map((row: { candidateId: string }) => row.candidateId))
  const v5Ids = new Set(v5.candidates.map((row: { candidateId: string }) => row.candidateId))
  assert.deepEqual(lineage.counts, { retained: 1624, supersededAsDuplicative: 4, replacementsAdded: 4, resultingRouteCandidates: 1628 })
  for (const replacement of lineage.replacements) {
    assert.equal(v4Ids.has(replacement.predecessorCandidateId), true)
    assert.equal(v5Ids.has(replacement.predecessorCandidateId), false)
    assert.equal(v4Ids.has(replacement.replacementCandidateId), false)
    assert.equal(v5Ids.has(replacement.replacementCandidateId), true)
  }
  assert.equal(new Set(REPLACEMENTS.map((row) => row.routeRole)).size, 4)
})

test('definition review accepts eleven bindings and holds deterministic arithmetic', () => {
  assert.deepEqual(reviews.counts, { reviewed: 12, accepted: 11, revise: 1, human: 0, expert: 0 })
  type GraphObject = { graphObjectId: string; routeBudget: boolean; publicRoute: string | null }
  const graphById = new Map<string, GraphObject>(graph.graphObjects.map((row: GraphObject) => [row.graphObjectId, row]))
  for (const review of reviews.reviews) {
    const graphObject = graphById.get(review.graphObjectId)
    assert.ok(graphObject)
    assert.equal(review.reviewerKind, 'automated-internal-editorial')
    assert.equal(review.humanReviewed, false)
    assert.equal(review.expertReviewed, false)
    assert.deepEqual(review.axes.map((axis: { axis: string }) => axis.axis), REVIEW_AXES)
    assert.equal(review.graphObjectDigest, digest(graphObject))
    assert.ok(review.proposalDigest.startsWith('sha256:'))
    assert.equal(graphObject.routeBudget, false)
    assert.equal(graphObject.publicRoute, null)
  }
  const arithmetic = reviews.reviews.find((row: { conceptId: string }) => row.conceptId.endsWith(':deterministic-arithmetic'))
  assert.equal(arithmetic.finalDecision, 'revise')
  assert.equal(arithmetic.bindingState, 'held-without-definition-binding')
})

test('all 48 applications are reassessed without definition-evidence inheritance', () => {
  assert.deepEqual(reassessment.counts, { candidates: 48, evidenceReady: 17, revise: 31 })
  assert.ok(reassessment.reassessments.every((row: { independentApplicationAssessment: boolean; noInheritanceFinding: string }) => row.independentApplicationAssessment && /may not inherit evidence readiness/.test(row.noInheritanceFinding)))
  const accepted = reassessment.reassessments.filter((row: { finalState: string }) => row.finalState === 'evidence-ready')
  assert.equal(accepted.filter((row: { routeRole: string }) => row.routeRole === 'uncertainty').length, 11)
  assert.equal(accepted.filter((row: { routeRole: string }) => row.routeRole === 'worked-example').length, 6)
  assert.ok(reassessment.reassessments.filter((row: { routeRole: string }) => ['machine-interface', 'reproducibility'].includes(row.routeRole)).every((row: { finalState: string }) => row.finalState === 'revise'))
  assert.ok(reassessment.reassessments.filter((row: { conceptId: string }) => row.conceptId.endsWith(':deterministic-arithmetic')).every((row: { finalState: string }) => row.finalState === 'revise'))
})

test('the original 514-route backlog is ranked without invented demand', () => {
  assert.deepEqual(priority.counts, { backlog: 514, reviewedThisPass: 52, deferredToLaterPass: 462 })
  assert.equal(priority.scoring.demand, 'unknown unless already observed; not invented here')
  for (let index = 1; index < priority.priorities.length; index += 1) {
    assert.ok(priority.priorities[index - 1].priorityScore >= priority.priorities[index].priorityScore)
  }
  for (const row of priority.priorities) {
    const expected = Math.round((Math.min(row.dependencyFanout, 4) / 4 * 35 + row.machineUtility * 0.35 + row.commercialProximity * 0.30) * 100) / 100
    assert.equal(row.priorityScore, expected)
  }
})

test('replacement sources point to exact local symbols and remain first-party', () => {
  assert.equal(sources.replacementSources.length, 4)
  for (const source of sources.replacementSources) {
    const [path, symbols] = source.locator.split(' — ')
    assert.equal(existsSync(resolve(root, path)), true, path)
    const implementation = readFileSync(resolve(root, path), 'utf8')
    for (const symbol of symbols.split(' and ')) {
      assert.match(implementation, new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    }
    assert.equal(source.independence, 'not-independent')
    assert.equal(source.sourceClass, 'first-party-implementation')
  }
})

test('substantial-page specifications exist only for the 21 newly ready candidates', () => {
  assert.deepEqual(specs.counts, { specifications: 21, boundedQuestions: 105, authorityApplications: 17, replacements: 4 })
  const specIds = new Set(specs.specifications.map((row: { candidateId: string }) => row.candidateId))
  assert.equal(specIds.size, 21)
  for (const specification of specs.specifications) {
    assert.equal(specification.implementationState, 'specification-only')
    assert.equal(specification.boundedQuestions.length, 5)
    assert.ok(specification.sourceBindings.length > 0)
    assert.ok(specification.definitionDependency)
  }
})

test('the unified ledger partitions all routes and records zero execution', () => {
  assert.deepEqual(ledger.counts, { routeCandidates: 1628, implementationReady: 1135, unresolved: 493, duplicateSlotsRemaining: 0, newlyReadyThisPass: 21 })
  assert.equal(ledger.entries.length, 1628)
  assert.equal(ledger.entries.filter((row: { implementationState: string }) => row.implementationState === 'implementation-ready').length, 1135)
  assert.equal(ledger.entries.filter((row: { implementationState: string }) => row.implementationState === 'unresolved').length, 493)
  assert.ok(ledger.entries.every((row: { publicRouteCreated: boolean }) => row.publicRouteCreated === false))
  assert.deepEqual(ledger.execution, { publicRoutesGenerated: 0, buildRun: false, sitemapChanged: false, llmsChanged: false, released: 0, deployed: false })
})

test('all recovery artifacts authenticate their complete bodies and contain no private payloads', () => {
  const names = [
    'federation-route-candidates-v5.json',
    'federation-candidate-lineage-v5.json',
    'federation-readiness-recovery-source-inspections-v1.json',
    'federation-authority-definition-reviews-v1.json',
    'federation-authority-application-reassessment-v1.json',
    'federation-readiness-recovery-priority-v1.json',
    'federation-readiness-recovery-page-specifications-v1.json',
    'federation-unified-readiness-ledger-v1.json',
  ]
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
    const serialized = JSON.stringify(value)
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'reviewerIdentity']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
})

test('regeneration is byte-identical and cannot alter public-surface files', () => {
  const names = [
    'federation-route-candidates-v5.json',
    'federation-candidate-lineage-v5.json',
    'federation-readiness-recovery-source-inspections-v1.json',
    'federation-authority-definition-reviews-v1.json',
    'federation-authority-application-reassessment-v1.json',
    'federation-readiness-recovery-priority-v1.json',
    'federation-readiness-recovery-page-specifications-v1.json',
    'federation-unified-readiness-ledger-v1.json',
  ]
  const before = names.map((name) => readFileSync(resolve(federation, name), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-readiness-recovery.ts'], { cwd: root })
  const after = names.map((name) => readFileSync(resolve(federation, name), 'utf8'))
  assert.deepEqual(after, before)
  const changed = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
  assert.doesNotMatch(changed, /(?:^|\n)\?\? (?:app|components|public)\//)
  assert.doesNotMatch(changed, /sitemap|llms/)
})
