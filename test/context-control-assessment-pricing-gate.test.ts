import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

/**
 * The gate on the Context-Control Evidence Assessment price.
 *
 * The proposed $12,500 / $25,000 prices are defensible only when a prospect can
 * inspect the package before the call: the reproducible evidence artifact, the
 * sample deliverable, the data-boundary one-pager, and the honest benchmark.
 *
 * This asserts the invariant rather than today's state, so it stays green both
 * before and after those land, and fails on the single thing that must not
 * happen -- the price moving ahead of the package.
 */
const ROOT = join(import.meta.dirname, '..')
const OFFER_PAGE = 'app/integrations/wso2/page.tsx'

/** Each prerequisite, identified by an artifact that only exists once it merges. */
const PREREQUISITES = [
  { id: 'wso2-evidence-artifact', path: 'content/integrations/wso2-live-evaluation-evidence.json' },
  { id: 'sample-assessment', path: 'content/assessments/context-control-evidence-assessment-sample.pdf' },
  { id: 'security-boundary', path: 'content/security/context-control-security-boundary.pdf' },
  { id: 'mcrb1-dense-baseline', path: 'public/benchmarks/mcrb-1/dense/results.json' },
] as const

/** Prices that may only appear once every prerequisite is in the tree. */
const GATED_PRICES = ['$12,500', '$25,000'] as const

const missing = () => PREREQUISITES.filter((entry) => !existsSync(join(ROOT, entry.path)))
const offerPage = () => readFileSync(join(ROOT, OFFER_PAGE), 'utf8')

test('the raised prices do not appear while any prerequisite is missing', () => {
  const absent = missing()
  if (absent.length === 0) return // gate open; the pricing test suite governs from here
  const page = offerPage()
  for (const price of GATED_PRICES) {
    assert.ok(
      !page.includes(price),
      `${OFFER_PAGE} advertises ${price}, but these prerequisites are not in the tree: ${absent.map((entry) => entry.id).join(', ')}`,
    )
  }
})

test('the founding-partner rate is never presented as a general discount', () => {
  const page = offerPage()
  if (!page.includes('$2,500')) return
  // Whatever the surrounding copy, the constraint travels with the number.
  assert.match(page, /Founding design-partner|founding design partner/i)
  assert.ok(
    /structured technical feedback|first two|reference/i.test(page),
    'the $2,500 rate must state what is required in exchange for it',
  )
})

test('exclusions a buyer relies on stay on the page at any price', () => {
  const page = offerPage()
  for (const [label, pattern] of [
    ['no WSO2 partnership or endorsement', /not claiming WSO2 partnership, certification, approval, or customer validation/],
    ['no guaranteed result', /No fixed compression, savings, retention, or latency result is promised/],
    ['synthetic corpus disclosed', /corpus is synthetic/],
    ['evaluation-only bundle', /policy bundle is evaluation-only/],
  ] as [string, RegExp][]) {
    assert.match(page, pattern, `the offer page dropped its "${label}" boundary`)
  }
})

test('the readiness record names every missing prerequisite', () => {
  const record = readFileSync(join(ROOT, 'docs/commercial/context-control-assessment-pricing-readiness.md'), 'utf8')
  for (const entry of missing()) {
    assert.ok(record.includes(entry.path) || record.includes(entry.id),
      `the readiness record does not account for missing prerequisite ${entry.id}`)
  }
  if (missing().length > 0) {
    assert.match(record, /GATE CLOSED/)
    assert.match(record, /No public price or sales copy was changed/i)
  }
})

test('the gate is driven by artifacts, not by a hand-maintained flag', () => {
  // A boolean someone can flip is not a gate. Every prerequisite is identified
  // by a file whose presence is the merge signal.
  assert.equal(PREREQUISITES.length, 4)
  for (const entry of PREREQUISITES) {
    assert.match(entry.path, /^(content|public|docs)\//)
  }
})
