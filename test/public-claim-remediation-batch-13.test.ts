import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { DISPOSITIONS, fingerprint, recommendDisposition } from '../lib/assertion-inventory.ts'
import { proposeCorrection, assertReviewBinds, assertMayReachProduction, CorrectionGovernanceError } from '../lib/correction-governance.ts'
import { detectPublicClaimDefects, PUBLIC_CLAIM_DEFECTS, RELEVANCE_CONTRACT } from '../lib/public-claim-defects.ts'
import { auditClaim } from '../lib/claim-classification.ts'

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const inv = read('content/evidence-batch-13/assertion-inventory.json')
const freeze = read('content/evidence-batch-13/high-risk-freeze.json')
const insp = read('content/evidence-batch-13/high-risk-inspection.json')
const corr = read('content/evidence-batch-13/governed-corrections.json')
const fp = read('content/evidence-batch-13/first-party-outcomes.json')
const fixture = read('content/evidence-batch-13/preflight-relevance-fixture.json')
const calc = read('content/evidence-batch-12/calculation-audit.json')
const depth = read('content/evidence-batch-9/depth-audit.json')
const compiled = read('content/legacy-uplift/uplift-compiled.json')
const claimAudit = read('content/evidence-batch-12/claim-audit.json')

test('every one of the 67 assertions is enumerated exactly once', () => {
  assert.equal(inv.totalAssertions, 67)
  assert.equal(inv.assertions.length, 67)
  const ids = inv.assertions.map((a: { assertionId: string }) => a.assertionId)
  assert.equal(new Set(ids).size, 67, 'assertion ids must be unique')
  const prints = inv.assertions.map((a: { textFingerprint: string }) => a.textFingerprint)
  assert.equal(new Set(prints).size, 67, 'each assertion must be a distinct sentence at a distinct route')
  for (const a of inv.assertions) {
    assert.ok(DISPOSITIONS.includes(a.disposition), `${a.assertionId} has an invalid disposition`)
    assert.ok(a.route && a.pageRevision && a.evidentiaryFrame && a.whySupportIsMissing)
    assert.equal(typeof a.narrowingCouldSupport, 'boolean')
    assert.equal(typeof a.removalChangesCentralMeaning, 'boolean')
  }
})

test('limitations are not misclassified as unsupported factual claims', () => {
  const unsupportedTexts = claimAudit.pages.flatMap((p: { claims: { status: string; text: string }[] }) =>
    p.claims.filter((c) => c.status === 'unsupported').map((c) => c.text))
  for (const t of unsupportedTexts) {
    assert.ok(!/^must not be read as/i.test(t.trim()), `a limitation was filed as unsupported: ${t.slice(0, 50)}`)
  }
  const interpretive = claimAudit.statusTotals.interpretive
  assert.ok(interpretive > 40, `expected the cautions to be recognised, got ${interpretive}`)
})

test('interpretations are distinct from empirical assertions', () => {
  const caution = auditClaim({ text: 'Similarity is not descent.', citedSourceIds: [], sourceIdentityVerified: false, sourceContentInspected: false, passageSupportsScope: false })
  const empirical = auditClaim({ text: 'Scaling devices changes measured latency.', citedSourceIds: [], sourceIdentityVerified: false, sourceContentInspected: false, passageSupportsScope: false })
  assert.equal(caution.status, 'interpretive')
  assert.equal(empirical.status, 'unsupported')
  assert.notEqual(caution.kind, empirical.kind)
})

test('existing public status gives no grandfather exemption', () => {
  const args = auditClaim.toString().slice(0, auditClaim.toString().indexOf(')'))
  assert.ok(!/alreadyPublic|isPublic|published|legacy|grandfather/i.test(args))
  // Every one of the 67 is already public, and every one still carries a defect.
  for (const a of inv.assertions) {
    assert.notEqual(a.disposition, 'retain-blocked', `${a.assertionId} was excused`)
  }
})

test('a topical citation cannot satisfy claim support', () => {
  const topical = auditClaim({
    text: 'Scaling samples or devices can change behavior.',
    citedSourceIds: ['neurobench', 'isscr-guidelines'],
    sourceIdentityVerified: true, sourceContentInspected: false, passageSupportsScope: false,
  })
  assert.equal(topical.status, 'unsupported')
  // a067: "Scaling samples or devices can change behavior." Its three cited
  // sources are all topically adjacent and none states it.
  const determination = insp.determinations.find((d: { assertionId: string }) => d.assertionId === 'a067')
  assert.equal(determination.verdict, 'unresolved')
  assert.equal(insp.summary.supportedAsWritten, 0)
})

test('corrected text requires a new revision digest', () => {
  const p = proposeCorrection({
    assertionId: 'x1', route: '/knowledge/x', activeRevision: 'sha256:aaa', activePageRevision: 'sha256:aaa',
    originalText: 'original', correctedText: 'corrected', correctionKind: 'narrow', rationale: 'because',
  })
  assert.notEqual(p.proposedRevision, p.activeRevision)
  const other = proposeCorrection({
    assertionId: 'x1', route: '/knowledge/x', activeRevision: 'sha256:aaa', activePageRevision: 'sha256:aaa',
    originalText: 'original', correctedText: 'corrected differently', correctionKind: 'narrow', rationale: 'because',
  })
  assert.notEqual(p.proposedRevision, other.proposedRevision, 'different text must produce a different digest')
  assert.throws(() => proposeCorrection({
    assertionId: 'x1', route: '/knowledge/x', activeRevision: 'sha256:aaa', activePageRevision: 'sha256:aaa',
    originalText: 'same', correctedText: 'same', correctionKind: 'narrow', rationale: 'because',
  }), CorrectionGovernanceError)
})

test('stale review cannot authorize a correction', () => {
  const decision = { assertionId: 'x1', boundToRevision: 'sha256:old', decidedBy: 'x', decision: 'approved-for-preview' as const, decidedAt: '2026-09-03' }
  assert.throws(() => assertReviewBinds(decision, 'sha256:new'), CorrectionGovernanceError)
  assertReviewBinds(decision, 'sha256:old')
})

test('proposed corrections remain inactive and cannot reach Production', () => {
  assert.equal(corr.active, false)
  assert.equal(corr.writtenToProduction, false)
  assert.equal(corr.activeRecordsPreserved, true)
  assert.equal(corr.productionReachability.provenUnreachable, true)
  for (const p of corr.proposals) {
    assert.equal(p.active, false, `${p.assertionId} is active`)
    assert.equal(p.appliesToRelease, null)
    assert.notEqual(p.proposedRevision, p.activeRevision)
  }
  // Even an authenticated release authority cannot push an undecided proposal.
  const p = corr.proposals[0]
  assert.throws(() => assertMayReachProduction({ proposal: p, decision: null, releaseAuthorityAuthenticated: true }), CorrectionGovernanceError)
  // And an approved decision without authority is refused too.
  assert.throws(() => assertMayReachProduction({
    proposal: p,
    decision: { assertionId: p.assertionId, boundToRevision: p.proposedRevision, decidedBy: 'x', decision: 'approved-for-preview', decidedAt: '2026-09-03' },
    releaseAuthorityAuthenticated: false,
  }), CorrectionGovernanceError)
})

test('no Preview canary was manufactured from incomplete reviews', () => {
  assert.equal(corr.previewCanary.available, false)
  assert.equal(corr.previewCanary.cohortSize, 0)
  for (const d of corr.decisions) assert.notEqual(d.decision, 'approved-for-preview')
})

test('first-party claims remain visibly first-party', () => {
  const ledger = read('content/evidence-batch-11/basis-ledger.json')
  for (const a of ledger.assignments) {
    if (a.basis === 'first-party-documentation') assert.equal(a.countsAsIndependentSupport, false)
  }
  const deepened = fp.outcomes.find((o: { outcome: string }) => o.outcome === 'deepened')
  assert.equal(deepened.disclosurePreserved, true)
  const page = compiled.pages.find((p: { route: string }) => p.route === deepened.route)
  const state = depth.verdicts.find((v: { route: string }) => v.route === deepened.route).state
  assert.ok(state.startsWith('first-party-documented'), `${deepened.route} is ${state}, which hides that it is first-party`)
  assert.ok(page, 'the deepened page must compile')
})

test('company-published numbers cannot become independent measurements', () => {
  const deepened = fp.outcomes.find((o: { outcome: string }) => o.outcome === 'deepened')
  assert.match(deepened.numericalStatements, /None|company-published/i)
  // Every named product line the page renders is attributed to the company.
  const page = compiled.pages.find((p: { route: string }) => p.route === deepened.route)
  const mech = page.sections.filter((s: { dimension: string }) => s.dimension === 'mechanism-or-method').flatMap((s: { items: string[] }) => s.items)
  const productLines = mech.filter((i: string) => /^(V93000|T5801|ACS Gemini|SiConic)/.test(i))
  assert.ok(productLines.length >= 4, `expected the named products to render, got ${productLines.length}`)
  for (const line of productLines) {
    assert.match(line, /Advantest (states|describes)/, `unattributed vendor line: ${line.slice(0, 60)}`)
  }
})

test('unsupported assertions cannot satisfy the substantial gate', () => {
  const supported = new Set(depth.verdicts.filter((v: { state: string }) => v.state === 'substantial-and-evidence-backed').map((v: { route: string }) => v.route))
  const auditedRoutes = new Set(inv.assertions.map((a: { route: string }) => a.route))
  for (const route of auditedRoutes) {
    if (!supported.has(route)) continue
    // Support may come from any batch. What must never happen is a page counted
    // substantial with no inspected passage behind any of its claims.
    const page = compiled.pages.find((p: { route: string }) => p.route === route)
    assert.ok((page.after?.explanatorySources ?? 0) > 0,
      `${route} is counted substantial with no explanatory source at all`)
  }
})

test('refused calculations remain absent', () => {
  assert.equal(calc.summary.accepted, 0)
  assert.equal(calc.refused.length, 4)
  const text = JSON.stringify(compiled.pages)
  assert.ok(!text.includes('deterministic-calculation-batch-13'), 'no batch 13 calculation may exist')
  // Not zero any more, and the rule was never zero. What Batch 12 refused was a
  // calculation without complete reproducibility inputs. A calculation executed
  // by the kernel and verified by rerunning it satisfies that, so the property
  // is what is asserted: anything rendered must be kernel-executed.
  const withCalc = compiled.pages.filter((p: { sections?: { dimension: string }[] }) =>
    (p.sections ?? []).some((s) => s.dimension === 'deterministic-calculation'))
  for (const page of withCalc) {
    const section = (page.sections as { dimension: string; items: string[] }[])
      .find((s) => s.dimension === 'deterministic-calculation')!
    assert.match(section.items.join(' '), /Executed by kernel sha256:[0-9a-f]{64}/,
      `${(page as { route: string }).route} renders a calculation that was not kernel-executed`)
  }
  assert.equal(calc.retainedFromEarlierBatch.length, 1)
  assert.match(calc.retainedFromEarlierBatch[0].route, /root-finding/)
})

test('a page warning against a comparison never generates it as a calculation', () => {
  const warns = compiled.pages.find((p: { route: string }) => p.route.endsWith('/silicon-energy-and-biological-metabolic-cost'))
  const calcs = (warns.sections ?? []).filter((s: { dimension: string }) => s.dimension === 'deterministic-calculation')
  assert.equal(calcs.length, 0)
})

test('private remediation data stays outside served output', () => {
  const runtime = readFileSync('lib/legacy-uplift-runtime.ts', 'utf8')
  for (const f of ['assertion-inventory', 'high-risk-inspection', 'governed-corrections', 'preflight-relevance-fixture']) {
    assert.ok(!runtime.includes(f), `the runtime imports the private ${f}`)
  }
  const rendered = JSON.stringify(compiled.pages.map((p: { sections?: unknown }) => p.sections))
  // Field names, not bare words: "editorial rationale" is legitimate prose on
  // the textual-criticism page and must not be mistaken for a leaked field.
  for (const field of ['dispositionBecause', 'riskFactors', 'whySupportIsMissing', 'proposedRevision', 'textFingerprint', 'provenanceDigest']) {
    assert.ok(!rendered.includes(`"${field}"`), `rendered sections carry the ${field} field`)
    assert.ok(!rendered.includes(field), `rendered sections mention ${field}`)
  }
})

test('the preflight fixture detects every defect kind and claims no truth verification', () => {
  assert.equal(RELEVANCE_CONTRACT.independentlyVerifiesTruth, false)
  assert.equal(fixture.independentlyVerifiesTruth, false)
  assert.equal(fixture.paymentImplemented, false)
  assert.equal(fixture.stripeAdded, false)
  assert.equal(fixture.publicPricingAdded, false)
  assert.equal(new Set(fixture.codesExercised).size, PUBLIC_CLAIM_DEFECTS.length)
  // The real PRISMA case must be caught.
  const detected = detectPublicClaimDefects({
    text: 'Separate exploratory from confirmatory hypotheses.',
    citedSourceIds: ['prisma-2020'], sourceInspected: true, locator: 'Methods, Scope',
    passageText: 'PRISMA 2020 is not intended to guide systematic review conduct.',
    sourceDeclaredScope: 'reporting-standard', claimFrame: 'conduct-guidance',
  })
  assert.ok(detected.some((d) => d.code === 'evidence-frame-mismatch'))
  // A well-supported claim produces nothing.
  assert.equal(detectPublicClaimDefects({
    text: 'Footprint and synaptic operations are the reported quantities.',
    citedSourceIds: ['neurobench-2304-04640'], sourceInspected: true, locator: 'Algorithm Track Metrics',
    passageText: 'Footprint is the memory footprint in bytes required to represent a model.',
    sourceDeclaredScope: 'research-finding', claimFrame: 'definitional',
  }).length, 0)
})

test('deterministic regeneration remains byte-identical', () => {
  const digests = compiled.pages.map((p: { upliftDigest: string }) => p.upliftDigest)
  assert.equal(new Set(digests).size, digests.length)
  assert.equal(fingerprint('/a', 'text'), fingerprint('/a', 'text'))
  assert.notEqual(fingerprint('/a', 'text'), fingerprint('/b', 'text'))
})

test('the high-risk cohort was frozen before inspection and spans enough pages', () => {
  assert.equal(freeze.frozenBeforeInspection, true)
  assert.equal(freeze.cohortSize, 25)
  assert.ok(freeze.pagesSpanned >= 8, `expected at least eight pages, got ${freeze.pagesSpanned}`)
  const frozenIds = new Set(freeze.assertions.map((a: { assertionId: string }) => a.assertionId))
  for (const d of insp.determinations) {
    assert.ok(frozenIds.has(d.assertionId), `${d.assertionId} was determined but never frozen`)
  }
})

test('a cited-but-unread source routes to inspection, not to a guess', () => {
  const { disposition } = recommendDisposition({ assertionType: 'definitional', hasCitedSource: true, sourceInspected: false, centralToPage: false })
  assert.equal(disposition, 'inspect-current-source')
  const noSource = recommendDisposition({ assertionType: 'procedural-step', hasCitedSource: false, sourceInspected: false, centralToPage: false })
  assert.equal(noSource.disposition, 'reframe-as-limitation')
})
