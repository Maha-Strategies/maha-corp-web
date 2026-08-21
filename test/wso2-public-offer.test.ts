import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { loadWso2LiveEvidence } from '../lib/integrations/wso2-live-evidence.ts'

const ROOT = join(import.meta.dirname, '..')

test('the public WSO2 offer states its commercial scope and compatibility boundaries', () => {
  const page = readFileSync(join(ROOT, 'app/integrations/wso2/page.tsx'), 'utf8')

  assert.match(page, /Fixed-scope evaluation · \$5,000/)
  assert.match(page, /Founding design-partner evaluations may be scoped at \$2,500/)
  assert.match(page, /not claiming WSO2 partnership, certification, approval, or customer validation/)
  assert.match(page, /public policy bundle is evaluation-only/)
  assert.match(page, /corpus is synthetic/)
  assert.match(page, /No fixed compression, savings, retention, or latency result is promised/)
})

test('the public WSO2 result is tied to its pinned comparator and reproduction evidence', () => {
  const page = readFileSync(join(ROOT, 'app/integrations/wso2/page.tsx'), 'utf8')

  assert.match(page, /WSO2 AI Gateway 1\.1\.0/)
  assert.match(page, /Prompt Compressor 0\.9\.0/)
  assert.match(page, /0\.55 retained ratio/)
  assert.match(page, /npm run reproduce:wso2-evaluation/)
  assert.match(page, /wso2-reproduction\.json/)
  assert.match(page, /wso2-sanitized-three-path-trace\.json/)
  assert.match(page, /wso2-live-evaluation-evidence\.json/)
  assert.match(page, /npm run validate:wso2-live-evidence/)
})

/**
 * The previous version of this test asserted the page source literally
 * contained '98.84%'. That is exactly the property this work removes: a
 * headline typed into a component cannot be checked against anything. The test
 * now asserts the inverse -- no aggregate may be spelled out in the source, and
 * every displayed figure must come from the artifact.
 */
test('no evaluation aggregate is hardcoded in the WSO2 page source', () => {
  const page = readFileSync(join(ROOT, 'app/integrations/wso2/page.tsx'), 'utf8')
  const evidence = loadWso2LiveEvidence()

  const forbiddenLiterals = [
    evidence.comparison.inputTokenReductionPercent,
    evidence.comparison.costReductionPercent,
    ...Object.values(evidence.aggregates).flatMap((aggregate) => [
      aggregate.providerInputTokens.toLocaleString('en-US'),
      String(aggregate.providerInputTokens),
      aggregate.costUsd,
    ]),
  ]

  for (const literal of forbiddenLiterals) {
    assert.ok(
      !page.includes(literal),
      `The WSO2 page hardcodes '${literal}'. Every aggregate must be read from the evidence artifact.`,
    )
  }
})

test('the WSO2 page reads its results from the evidence artifact', () => {
  const page = readFileSync(join(ROOT, 'app/integrations/wso2/page.tsx'), 'utf8')

  assert.match(page, /loadWso2LiveEvidence\(\)/)
  assert.match(page, /evidence\.aggregates\[path\]/)
  assert.match(page, /evidence\.comparison\.inputTokenReductionPercent/)
  assert.match(page, /evidence\.comparison\.costReductionPercent/)
  // The published digest must be computed from the file, never transcribed.
  assert.match(page, /sha256File\(WSO2_LIVE_EVIDENCE_PATH\)/)
})

test('the page names which retention scorer it displays, and publishes the other', () => {
  const page = readFileSync(join(ROOT, 'app/integrations/wso2/page.tsx'), 'utf8')

  assert.match(page, /path-blinded semantic rubric/)
  assert.match(page, /exact evidence-span containment/)
  assert.match(page, /deterministicFacts/)
  assert.match(page, /adjudicatedFacts/)
})

test('the representative trace is not presented as evidence for the aggregate', () => {
  const page = readFileSync(join(ROOT, 'app/integrations/wso2/page.tsx'), 'utf8')

  assert.match(page, /Sanitized trace, one representative workload/)
  assert.match(page, /one representative call, not evidence for the aggregate/)
})
