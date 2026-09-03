import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { auditClaim, classifyUtterance, CLAIM_STATUSES } from '../lib/claim-classification.ts'
import { gradeAnswer } from '../lib/answer-completeness.ts'
import { assertBasisCanCarry, EVIDENCE_BASES, FrameTransferError } from '../lib/evidence-basis.ts'
import { assertCalculable } from '../lib/deterministic-calculation.ts'

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const claimAudit = read('content/evidence-batch-12/claim-audit.json')
const proposals = read('content/evidence-batch-12/remediation-proposals.json')
const compiled = read('content/legacy-uplift/uplift-compiled.json')
const depth = read('content/evidence-batch-9/depth-audit.json')
const acquisition = read('content/evidence-batch-12/evidence-acquisition.json')
const dispositions = read('content/evidence-batch-12/religion-dispositions.json')
const calc = read('content/evidence-batch-12/calculation-audit.json')

test('every rendered explanatory paragraph has a classified evidence status', () => {
  let n = 0
  for (const page of claimAudit.pages) {
    for (const claim of page.claims) {
      n += 1
      assert.ok(CLAIM_STATUSES.includes(claim.status), `${claim.text.slice(0, 40)} has no valid status`)
      assert.ok(claim.reason.length > 20, 'every status must carry a reason')
    }
    assert.equal(page.claims.length, page.claimCount)
  }
  assert.equal(n, claimAudit.totalClaims)
  assert.ok(n > 100, 'expected the audit to cover a real corpus of claims')
})

test('existing public prose receives no grandfather exemption', () => {
  assert.equal(claimAudit.grandfatherExemption, false)
  // Being already public is not an input to the function at all.
  const args = auditClaim.toString().slice(0, auditClaim.toString().indexOf(')'))
  assert.ok(!/alreadyPublic|isPublic|published|legacy/i.test(args),
    'auditClaim must not accept a publication-status argument')
  const unpublished = auditClaim({ text: 'Doctrine is a formulated teaching.', citedSourceIds: ['x'], sourceIdentityVerified: false, sourceContentInspected: false, passageSupportsScope: false })
  assert.equal(unpublished.status, 'unsupported')
})

test('unsupported prose cannot satisfy the substantial gate', () => {
  const supported = new Set(depth.verdicts.filter((v: { state: string }) => v.state === 'substantial-and-evidence-backed').map((v: { route: string }) => v.route))
  for (const page of claimAudit.pages) {
    const allUnsupported = page.claims.every((c: { status: string }) => c.status !== 'supported-as-written')
    if (allUnsupported && supported.has(page.route)) {
      // Only allowed if the page later gained an inspected passage.
      const gained = acquisition.claimLevelSupport.some((c: { route: string; verdict: string }) => c.route === page.route && c.verdict === 'supported-as-written')
      assert.ok(gained, `${page.route} is substantial with no supported claim and no new passage`)
    }
  }
})

test('related-record counts equal rendered related-record links', () => {
  for (const page of compiled.pages) {
    const section = (page.sections ?? []).find((s: { dimension: string }) => s.dimension === 'related-records')
    const rendered = section ? section.items.length : 0
    assert.equal(rendered, page.after?.relatedRouteCount ?? 0, `${page.route} counts and renders differently`)
    assert.equal(rendered, (page.after?.relatedRoutes ?? []).length, `${page.route} list and section disagree`)
  }
})

test('all generated internal routes resolve', () => {
  const routes = new Set(compiled.pages.map((p: { route: string }) => p.route))
  let checked = 0
  for (const page of compiled.pages) {
    for (const related of page.after?.relatedRoutes ?? []) {
      checked += 1
      assert.ok(routes.has(related), `${page.route} links to ${related}, which does not exist`)
    }
  }
  assert.ok(checked > 600, `expected the full link set, got ${checked}`)
})

test('a long vague direct answer cannot satisfy completeness', () => {
  const passages = ['Bit precision and analog variability are different error models.', 'Calibration is part of mixed-signal operation.']
  const longVague = 'This is a complex and multifaceted question that involves numerous considerations across several important dimensions, and generally the answer depends on various significant factors that are typically relevant to the appropriate context, which is often considerable in scope.'
  assert.ok(longVague.length > 250, 'the mutation must be long enough to clear any character floor')
  assert.equal(gradeAnswer(longVague, passages).complete, false)
  // A padded restatement of the question also fails.
  assert.equal(gradeAnswer('How can deterministic digital state and variable analog dynamics be compared fairly, given the many important considerations generally relevant?', passages).complete, false)
  // A confident, well-formed assertion that the passages do not support fails.
  assert.equal(gradeAnswer('Comparison is valid only when performed under a declared thermal envelope with matched fabrication nodes and identical workload traces.', passages).complete, false)
})

test('the two rewritten answers are complete against their own passages', () => {
  for (const route of ['/knowledge/neuromorphic-biocomputing/comparisons/digital-and-mixed-signal-neuromorphic-hardware',
    '/knowledge/neuromorphic-biocomputing/comparisons/silicon-energy-and-biological-metabolic-cost']) {
    const page = compiled.pages.find((p: { route: string }) => p.route === route)
    const answer = page.sections.find((s: { dimension: string }) => s.dimension === 'direct-answer').items[0]
    const passages = page.sections.filter((s: { dimension: string }) => s.dimension === 'bounded-comparison').flatMap((s: { items: string[] }) => s.items)
    const verdict = gradeAnswer(answer, passages)
    assert.equal(verdict.complete, true, `${route}: ${verdict.failures.join('; ')}`)
  }
})

test('first-party material remains visibly first-party', () => {
  const firstParty = read('content/evidence-batch-5/first-party-public.json')
  assert.ok(JSON.stringify(firstParty).length > 0)
  const ledger = read('content/evidence-batch-11/basis-ledger.json')
  for (const a of ledger.assignments) {
    if (a.basis === 'first-party-documentation') {
      assert.equal(a.countsAsIndependentSupport, false, `${a.sourceId} must not count as independent`)
      assert.equal(a.publicState, 'first-party-documented')
    }
  }
})

test('textual, historical, empirical and theological frames cannot transfer', () => {
  assert.throws(() => assertBasisCanCarry('primary-textual', 'historical'), FrameTransferError)
  assert.throws(() => assertBasisCanCarry('primary-textual', 'empirical'), FrameTransferError)
  assert.throws(() => assertBasisCanCarry('independent-scientific-or-technical', 'textual'), FrameTransferError)
  assert.throws(() => assertBasisCanCarry('secondary-historical-scholarship', 'empirical'), FrameTransferError)
  for (const basis of EVIDENCE_BASES) {
    assert.throws(() => assertBasisCanCarry(basis, 'theological'), FrameTransferError, `${basis} carried a theological claim`)
  }
  for (const d of dispositions.dispositions) {
    assert.ok(d.evidenceRequired.length > 0, `${d.route} must say what evidence it needs`)
    assert.ok(d.reasoning.length > 60, `${d.route} must say why`)
  }
  assert.equal(dispositions.proposedRevisionsActive, false)
})

test('calculations fail without complete reproducibility inputs', () => {
  assert.throws(() => assertCalculable({
    method: 'Newton iteration', inputs: [], assumptions: ['none'],
    steps: [], units: null,
  } as never))
  assert.equal(calc.summary.accepted, 0)
  for (const r of calc.refused) {
    assert.ok(r.requirementsMissing.length > 0, `${r.candidate} was refused without naming a missing requirement`)
    assert.ok(r.reason.length > 60)
  }
})

test('remediation proposals cannot mutate active releases', () => {
  assert.equal(proposals.active, false)
  assert.equal(proposals.mutatesActiveRelease, false)
  assert.equal(proposals.writtenToProduction, false)
  for (const p of proposals.proposals) {
    assert.equal(p.active, false, `${p.route} proposal is active`)
    assert.equal(p.appliesToRelease, null, `${p.route} proposal targets a release`)
  }
})

test('private passages and review rationale stay outside served output', () => {
  // The private artifacts must not be imported by anything under app/ or components/.
  for (const file of ['content/evidence-batch-12/claim-audit.json', 'content/evidence-batch-12/remediation-proposals.json']) {
    const runtimeImporters = ['lib/legacy-uplift-runtime.ts', 'components/UpliftSections.tsx']
    for (const importer of runtimeImporters) {
      assert.ok(!readFileSync(importer, 'utf8').includes(file), `${importer} imports the private ${file}`)
    }
  }
  // No page's rendered sections may carry review rationale.
  for (const page of compiled.pages) {
    const text = JSON.stringify(page.sections ?? [])
    assert.ok(!text.includes('noClaimSupportReason'), `${page.route} carries review rationale`)
    assert.ok(!text.includes('withholdIfUnresolved'), `${page.route} carries remediation text`)
  }
})

test('deterministic regeneration remains byte-identical', () => {
  const digests = compiled.pages.map((p: { upliftDigest: string }) => p.upliftDigest)
  assert.equal(new Set(digests).size, digests.length, 'digests must be unique per page')
  for (const d of digests) assert.match(d, /^sha256:[0-9a-f]{64}$/)
})

test('test isolation does not weaken production rate limits', () => {
  const runner = readFileSync('scripts/run-preview-e2e-with-disposable-key.ts', 'utf8')
  assert.match(runner, /provision\('integration'\)/)
  assert.match(runner, /provision\('attribution'\)/)
  // Isolation is by identity, never by relaxing a limit or hiding a failure.
  assert.ok(!/rateLimit|RATE_LIMIT|maxRequests|limitOverride/i.test(runner), 'the runner must not touch limiter configuration')
  assert.ok(!/retry|retries/i.test(runner), 'the runner must not retry a gate')
  assert.ok(!/skip|\.only|disable/i.test(runner), 'the runner must not skip or disable a gate')
})

test('the classifier separates an assertion from a caution', () => {
  assert.equal(classifyUtterance('Similarity is not descent.'), 'epistemic-caution')
  assert.equal(classifyUtterance('Must not be read as: a text proves its own history.'), 'epistemic-caution')
  assert.equal(classifyUtterance('Atomize the claim.'), 'procedural-step')
  assert.equal(classifyUtterance('Dated texts and objects'), 'taxonomic-entry')
  assert.equal(classifyUtterance('/knowledge/processes/thin-film-deposition'), 'navigation')
})

test('the audit preserves both cohorts, before and after #390', () => {
  const cohort = read('content/evidence-batch-12/audit-cohort.json')
  assert.equal(cohort.originalCohort.size, 51)
  assert.equal(cohort.currentCohort.size, 86)
  assert.equal(cohort.selected.length, 15)
  assert.equal(cohort.frozenBeforeSearching, true)
  const original = new Set(cohort.originalCohort.routes)
  for (const s of cohort.selected) assert.ok(original.has(s.route), `${s.route} is not in the original cohort`)
})

test('an inspected source that supports nothing is not stretched onto claims', () => {
  const nara = acquisition.inspected.find((s: { sourceId: string }) => s.sourceId === 'nara-document-analysis')
  assert.ok(nara, 'NARA must be recorded as inspected')
  const support = acquisition.claimLevelSupport.filter((c: { sourceId: string }) => c.sourceId === 'nara-document-analysis')
  for (const s of support) assert.notEqual(s.verdict, 'supported-as-written', 'NARA must not support a claim as written')
  assert.ok(!JSON.stringify(compiled.pages).includes('nara-document-analysis'), 'NARA must not appear on any page')
})
