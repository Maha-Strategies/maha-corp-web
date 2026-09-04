import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  EVIDENCE_STATUSES, FORBIDDEN_IN_PUBLIC_DISCLOSURE,
  assertNoAuditInternals, disclosureFor,
} from '../lib/evidence-status-disclosure.ts'
import { evidenceStatusFor } from '../lib/evidence-status-runtime.ts'

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const status = read('content/legacy-uplift/evidence-status-public.json')
const compiled = read('content/legacy-uplift/uplift-compiled.json')
const audit = read('content/evidence-batch-9/depth-audit.json')

test('every page with no inspected source is labelled as such', () => {
  const labelled = new Map<string, string>(
    status.entries.map((e: { route: string; status: string }) => [e.route, e.status]))
  let checked = 0
  for (const page of compiled.pages) {
    if (!page.eligible || !page.after) continue
    checked += 1
    const label = labelled.get(page.route)
    assert.ok(label, `${page.route} carries no evidence status at all`)
    if ((page.after.explanatorySources ?? 0) === 0) {
      assert.notEqual(label, 'independently-supported',
        `${page.route} has no inspected source but is labelled independently supported`)
    }
  }
  assert.equal(checked, status.entries.length, 'every eligible page must be labelled exactly once')
  assert.ok(status.counts['cited-but-uninspected'] > 80,
    'the uninspected pages must actually be labelled, not quietly dropped')
})

test('a page that gains an inspected source loses the caveat automatically', () => {
  // Derived from counts, so nothing has to be edited when evidence arrives.
  const before = disclosureFor({ citedSourceCount: 3, inspectedSourceCount: 0, isFirstParty: false })
  const after = disclosureFor({ citedSourceCount: 3, inspectedSourceCount: 2, isFirstParty: false })
  assert.equal(before.status, 'cited-but-uninspected')
  assert.equal(after.status, 'independently-supported')
  assert.notEqual(before.headline, after.headline)
  assert.equal(after.doNotUseFor, null, 'a supported page carries no blanket warning')
})

test('the label never says the content is false', () => {
  const forbidden = /\b(false|wrong|incorrect|inaccurate|unreliable|untrue|misleading|do not trust)\b/i
  for (const entry of status.entries) {
    const text = [entry.headline, entry.detail, entry.useFor, entry.doNotUseFor].filter(Boolean).join(' ')
    assert.ok(!forbidden.test(text),
      `${entry.route} calls the content false; unverified is not the same as wrong`)
  }
})

test('a supported page says so, so silence is never ambiguous', () => {
  // A caveat that renders only on weak pages cannot be told apart from a
  // banner that failed to render.
  const supported = status.entries.filter((e: { status: string }) => e.status === 'independently-supported')
  assert.ok(supported.length > 0)
  for (const e of supported) {
    assert.match(e.headline, /inspected/i, `${e.route} does not state that it was checked`)
    assert.ok(e.detail.length > 60)
  }
})

test('first-party pages keep their limits stated', () => {
  const fp = status.entries.filter((e: { status: string }) => e.status === 'first-party-documented')
  assert.ok(fp.length > 0)
  for (const e of fp) {
    assert.ok(e.doNotUseFor, `${e.route} must say what first-party documentation cannot establish`)
    assert.match(e.doNotUseFor, /performance|reliability|yield|comparison/i)
  }
})

test('every status is one of the declared kinds, and each says what to rely on', () => {
  for (const e of status.entries) {
    assert.ok((EVIDENCE_STATUSES as readonly string[]).includes(e.status), `${e.route}: ${e.status}`)
    assert.ok(e.headline.length > 10 && e.detail.length > 40)
    assert.ok(e.useFor.length > 20, `${e.route} does not say what it is good for`)
  }
})

test('no audit internals reach the public artifact', () => {
  assertNoAuditInternals(status)
  const raw = readFileSync('content/legacy-uplift/evidence-status-public.json', 'utf8')
  for (const term of FORBIDDEN_IN_PUBLIC_DISCLOSURE) {
    assert.ok(!raw.includes(term), `the public artifact carries ${term}`)
  }
  assert.throws(() => assertNoAuditInternals({ route: '/x', riskFactors: ['a'] }))
})

test('the runtime resolves a route, and an unknown route renders nothing', () => {
  const known = status.entries[0].route
  assert.ok(evidenceStatusFor(known))
  assert.equal(evidenceStatusFor('/knowledge/not/a/page'), null)
})

test('the published status matches the current corpus', () => {
  // There is no chained regeneration step, so a stale file would otherwise ship
  // labels describing a corpus that no longer exists. This fails instead.
  const before = readFileSync('content/legacy-uplift/evidence-status-public.json', 'utf8')
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-evidence-status.ts'], { stdio: 'ignore' })
  assert.equal(readFileSync('content/legacy-uplift/evidence-status-public.json', 'utf8'), before,
    'the evidence status file is stale; regenerate it')
})

test('the labelled counts reconcile with the depth audit', () => {
  const supported = status.counts['independently-supported'] ?? 0
  assert.equal(supported, audit.depthDistribution['substantial-and-evidence-backed'] ?? 0,
    'the pages labelled supported must be the pages the audit found supported')
})

test('every page template that renders content also renders the status', () => {
  const templates = execFileSync('git', ['grep', '-l', 'UpliftSections', '--', 'app/knowledge'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)
  assert.ok(templates.length >= 8)
  for (const t of templates) {
    assert.match(readFileSync(t, 'utf8'), /<EvidenceStatus route=/,
      `${t} renders page content without an evidence status`)
  }
})
